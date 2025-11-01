/**
 * Recording segments upload and merge API
 * Handles real-time segment uploads and final video merging
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use promises version of fs
const fsPromises = fs.promises;
const { existsSync } = fs;

const router = express.Router();

// Base upload directory
const UPLOAD_BASE = path.join(__dirname, '../uploads/recordings');

// Ensure base directory exists
fsPromises.mkdir(UPLOAD_BASE, { recursive: true }).catch(console.error);

// Health check endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Recordings API is running',
    endpoints: {
      segment: 'POST /api/recordings/segment',
      finalize: 'POST /api/recordings/finalize',
      getSession: 'GET /api/recordings/:sessionId',
      deleteSession: 'DELETE /api/recordings/:sessionId',
      listSessions: 'GET /api/recordings/list'
    }
  });
});

/**
 * GET /api/recordings/list
 * List all recording sessions
 */
router.get('/list', async (req, res) => {
  try {
    if (!existsSync(UPLOAD_BASE)) {
      return res.json([]);
    }

    const files = await fsPromises.readdir(UPLOAD_BASE);
    const sessions = [];

    for (const file of files) {
      // Skip hidden files and temp directory
      if (file.startsWith('.')) continue;
      
      const sessionPath = path.join(UPLOAD_BASE, file);
      const stats = await fsPromises.stat(sessionPath);
      
      if (!stats.isDirectory()) continue;

      // Get session info
      const sessionFiles = await fsPromises.readdir(sessionPath);
      const segments = sessionFiles.filter(f => f.endsWith('.webm') && !f.startsWith('complete'));
      const hasComplete = sessionFiles.includes('complete.webm');
      
      let totalSize = 0;
      for (const segmentFile of sessionFiles) {
        if (segmentFile.endsWith('.webm')) {
          const segmentPath = path.join(sessionPath, segmentFile);
          const segmentStats = await fsPromises.stat(segmentPath);
          totalSize += segmentStats.size;
        }
      }

      sessions.push({
        sessionId: file,
        segmentCount: segments.length,
        complete: hasComplete,
        completeUrl: hasComplete ? `/recordings/${file}/complete.webm` : null,
        totalSize: totalSize,
        createdAt: stats.birthtime,
        segments: segments.map(s => ({
          name: s,
          url: `/recordings/${file}/${s}`
        }))
      });
    }

    // Sort by creation time (newest first)
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(sessions);
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Configure multer storage
 * Note: We upload to a temp directory first, then move to the correct session directory
 * because req.body is not available in the destination function
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Upload to temp directory first
      const tempDir = path.join(UPLOAD_BASE, '.temp');
      await fsPromises.mkdir(tempDir, { recursive: true });
      cb(null, tempDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    // Use a unique temporary filename
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    cb(null, `temp-${uniqueId}.webm`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per segment
  }
});

/**
 * POST /api/recordings/segment
 * Upload a single video segment
 */
router.post('/segment', upload.single('file'), async (req, res) => {
  try {
    const { sessionId, segmentIndex, metadata } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId is required' 
      });
    }

    // Create session directory
    const sessionDir = path.join(UPLOAD_BASE, sessionId);
    await fsPromises.mkdir(sessionDir, { recursive: true });

    // Move file from temp to session directory
    const segmentFilename = `segment-${String(segmentIndex).padStart(4, '0')}.webm`;
    const finalPath = path.join(sessionDir, segmentFilename);
    await fsPromises.rename(req.file.path, finalPath);

    // Parse and save metadata
    let parsedMetadata = {};
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (e) {
        console.warn('Failed to parse metadata:', e);
      }
    }

    const metadataPath = path.join(
      sessionDir,
      `segment-${String(segmentIndex).padStart(4, '0')}.json`
    );
    
    await fsPromises.writeFile(
      metadataPath, 
      JSON.stringify(parsedMetadata, null, 2)
    );

    console.log(`✓ Received segment ${segmentIndex} for session ${sessionId}: ${req.file.size} bytes`);
    
    res.json({
      success: true,
      sessionId,
      segmentIndex: parseInt(segmentIndex, 10),
      size: req.file.size,
      path: finalPath,
      metadata: parsedMetadata
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/recordings/finalize
 * Merge all segments into a complete video
 */
router.post('/finalize', async (req, res) => {
  try {
    const { sessionId, method = 'simple' } = req.body; // Default to simple merge
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId is required' 
      });
    }

    const sessionDir = path.join(UPLOAD_BASE, sessionId);
    
    // Check if session directory exists
    if (!existsSync(sessionDir)) {
      return res.status(404).json({ 
        success: false, 
        error: `Session ${sessionId} not found` 
      });
    }

    // Get all segment files
    const files = await fsPromises.readdir(sessionDir);
    const segments = files
      .filter(f => f.endsWith('.webm'))
      .sort(); // Alphabetical sort ensures correct order (segment-0000.webm, segment-0001.webm, etc.)
    
    if (segments.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No segments found' 
      });
    }

    console.log(`Merging ${segments.length} segments for session ${sessionId}...`);

    // Output path
    const outputPath = path.join(sessionDir, 'complete.webm');
    
    // Method 1: Simple binary concatenation (no external dependencies)
    if (method === 'simple') {
      await mergeSegmentsSimple(sessionDir, segments, outputPath);
    }
    // Method 2: ffmpeg concat (requires ffmpeg installed)
    else if (method === 'concat' || method === 'ffmpeg') {
      await mergeSegmentsConcat(sessionDir, segments, outputPath);
    } 
    // Method 3: Using mkvmerge (requires mkvmerge installed)
    else if (method === 'mkvmerge') {
      await mergeSegmentsMkvmerge(sessionDir, segments, outputPath);
    }
    else {
      throw new Error(`Unknown merge method: ${method}`);
    }

    // Get file size
    const stats = await fsPromises.stat(outputPath);
    
    // Load all metadata
    const allMetadata = await loadAllMetadata(sessionDir, segments);
    
    console.log(`✓ Merged video created: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    
    res.json({
      success: true,
      sessionId,
      segmentCount: segments.length,
      outputPath: `/recordings/${sessionId}/complete.webm`,
      size: stats.size,
      sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      metadata: {
        segments: allMetadata,
        totalDuration: allMetadata.reduce((sum, m) => sum + (m.duration || 0), 0),
        totalFrames: allMetadata.reduce((sum, m) => sum + (m.frameCount || 0), 0),
      }
    });
  } catch (error) {
    console.error('Finalize error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/recordings/:sessionId
 * Get session info and segments
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionDir = path.join(UPLOAD_BASE, sessionId);
    
    if (!existsSync(sessionDir)) {
      return res.status(404).json({ 
        success: false, 
        error: `Session ${sessionId} not found` 
      });
    }

    const files = await fsPromises.readdir(sessionDir);
    const segments = files
      .filter(f => f.endsWith('.webm'))
      .sort();
    
    const hasComplete = existsSync(path.join(sessionDir, 'complete.webm'));
    const allMetadata = await loadAllMetadata(sessionDir, segments);
    
    res.json({
      success: true,
      sessionId,
      segmentCount: segments.length,
      segments: segments.map((name, index) => ({
        name,
        url: `/recordings/${sessionId}/${name}`,
        metadata: allMetadata[index] || {}
      })),
      complete: hasComplete,
      completeUrl: hasComplete ? `/recordings/${sessionId}/complete.webm` : null,
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /api/recordings/:sessionId
 * Delete a session and all its segments
 */
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionDir = path.join(UPLOAD_BASE, sessionId);
    
    if (!existsSync(sessionDir)) {
      return res.status(404).json({ 
        success: false, 
        error: `Session ${sessionId} not found` 
      });
    }

    // Delete directory and all contents
    await fsPromises.rm(sessionDir, { recursive: true, force: true });
    
    console.log(`✓ Deleted session ${sessionId}`);
    
    res.json({
      success: true,
      sessionId,
      message: 'Session deleted'
    });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Helper: Simple binary concatenation (no external dependencies)
 * Note: This is a simple approach that works for MediaBunny-generated segments
 * but may not handle all edge cases as reliably as ffmpeg
 */
async function mergeSegmentsSimple(sessionDir, segments, outputPath) {
  console.log('Using simple binary concatenation method (no ffmpeg required)');
  
  // Read all segment files
  const segmentBuffers = [];
  for (const segment of segments) {
    const segmentPath = path.join(sessionDir, segment);
    const buffer = await fsPromises.readFile(segmentPath);
    segmentBuffers.push(buffer);
  }
  
  // Concatenate all buffers
  const totalLength = segmentBuffers.reduce((sum, buf) => sum + buf.length, 0);
  const mergedBuffer = Buffer.concat(segmentBuffers, totalLength);
  
  // Write merged file
  await fsPromises.writeFile(outputPath, mergedBuffer);
  
  console.log(`Merged ${segments.length} segments using simple concatenation: ${(mergedBuffer.length / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * Helper: Merge segments using ffmpeg concat demuxer
 */
async function mergeSegmentsConcat(sessionDir, segments, outputPath) {
  // Create filelist for concat
  const filelistPath = path.join(sessionDir, 'filelist.txt');
  const filelistContent = segments
    .map(f => `file '${f}'`)
    .join('\n');
  
  await fsPromises.writeFile(filelistPath, filelistContent);
  
  // Run ffmpeg
  try {
    execSync(
      `ffmpeg -f concat -safe 0 -i "${filelistPath}" -c copy "${outputPath}" -y`,
      { 
        cwd: sessionDir,
        stdio: 'inherit' 
      }
    );
  } catch (error) {
    throw new Error(`ffmpeg failed: ${error.message}`);
  }
  
  // Cleanup filelist
  await fsPromises.unlink(filelistPath).catch(() => {});
}

/**
 * Helper: Merge segments using mkvmerge
 */
async function mergeSegmentsMkvmerge(sessionDir, segments, outputPath) {
  const firstSegment = segments[0];
  const restSegments = segments.slice(1).map(s => `+${s}`).join(' ');
  
  try {
    execSync(
      `mkvmerge -o "${outputPath}" "${firstSegment}" ${restSegments}`,
      { 
        cwd: sessionDir,
        stdio: 'inherit' 
      }
    );
  } catch (error) {
    throw new Error(`mkvmerge failed: ${error.message}`);
  }
}

/**
 * Helper: Load all segment metadata
 */
async function loadAllMetadata(sessionDir, segments) {
  const metadata = [];
  
  for (const segment of segments) {
    const metadataPath = path.join(
      sessionDir,
      segment.replace('.webm', '.json')
    );
    
    try {
      const content = await fsPromises.readFile(metadataPath, 'utf-8');
      metadata.push(JSON.parse(content));
    } catch (e) {
      metadata.push({});
    }
  }
  
  return metadata;
}

export default router;

