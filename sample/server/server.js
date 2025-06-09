import express from "express";
import cors from "cors";
import { AssemblyAI } from "assemblyai";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_API_KEY = "";

const app = express();
app.use(express.json());
app.use(cors());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const originalName = file.originalname || 'recording';
    cb(null, `${timestamp}-${originalName}`);
  }
});

const upload = multer({ storage });

// Store upload statistics
let uploadStats = {
  totalUploads: 0,
  totalSize: 0,
  recentUploads: []
};

// Serve static admin UI files
app.use('/admin', express.static(path.join(__dirname, 'admin-ui')));

// API Routes
app.get("/token", async (req, res) => {
  try {
    const apiKey = req.query.apiKey || DEFAULT_API_KEY;
    const client = new AssemblyAI({ apiKey: apiKey });
    
    const token = await client.realtime.createTemporaryToken({
      expires_in: 3600,
    });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      sampleRate: req.body.sampleRate,
      format: req.body.format,
      timestamp: req.body.timestamp,
      uploadTime: new Date().toISOString()
    };

    // Update statistics
    uploadStats.totalUploads++;
    uploadStats.totalSize += req.file.size;
    uploadStats.recentUploads.unshift(fileInfo);
    
    // Keep only the last 50 uploads in memory
    if (uploadStats.recentUploads.length > 50) {
      uploadStats.recentUploads = uploadStats.recentUploads.slice(0, 50);
    }

    console.log(`File uploaded: ${req.file.filename} (${req.file.size} bytes)`);
    res.json({ 
      success: true, 
      message: 'File uploaded successfully',
      fileInfo 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get server statistics
app.get('/api/stats', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const serverStats = {
      ...uploadStats,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      totalFiles: files.length,
      serverStartTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
    };
    res.json(serverStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get uploaded files list
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir).map(filename => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      
      // Extract audio format and sample rate from filename
      const formatMatch = filename.match(/\.(wav|mp3|pcm)$/i);
      const sampleRateMatch = filename.match(/(\d+)Hz/i);
      const isPCM = filename.toLowerCase().includes('.pcm') || filename.toLowerCase().includes('pcm');
      
      let format = 'unknown';
      if (formatMatch && formatMatch[1]) {
        format = formatMatch[1].toLowerCase();
      } else if (isPCM) {
        format = 'pcm';
      }
      
      return {
        filename,
        size: stats.size,
        uploadTime: stats.birthtime.toISOString(),
        modifiedTime: stats.mtime.toISOString(),
        format: format,
        sampleRate: sampleRateMatch ? parseInt(sampleRateMatch[1]) : null,
        isPCM: isPCM
      };
    });
    
    files.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded files for playback
app.get('/api/files/:filename/download', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
      // Set appropriate content type based on file extension
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      if (ext === '.wav') {
        contentType = 'audio/wav';
      } else if (ext === '.mp3') {
        contentType = 'audio/mpeg';
      } else if (ext === '.pcm') {
        contentType = 'application/octet-stream';
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete uploaded file
app.delete('/api/files/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Default route - redirect to admin UI
app.get('/', (req, res) => {
  res.redirect('/admin');
});

const PORT = process.env.PORT || 8001;
app.set("port", PORT);
const server = app.listen(app.get("port"), () => {
  console.log(`Server is running on port ${server.address().port}`);
  console.log(`Admin UI available at: http://localhost:${server.address().port}/admin`);
});
