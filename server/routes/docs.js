const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Create server storage directory for modified documents
const SERVER_DOCS_DIR = path.join(__dirname, '../storage/docs');

// Ensure server storage directory exists
const ensureServerStorageDir = async () => {
  try {
    await fs.mkdir(SERVER_DOCS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create server storage directory:', error);
  }
};

// Initialize storage directory
ensureServerStorageDir();

// Middleware to validate markdown save requests
const validateSaveRequest = (req, res, next) => {
  const { processorType, processorId, content } = req.body;
  
  if (!processorType || !processorId || typeof content !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: processorType, processorId, content'
    });
  }
  
  // Validate processor type
  const validTypes = ['video', 'audio', 'sharing'];
  if (!validTypes.includes(processorType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid processor type. Must be: video, audio, or sharing'
    });
  }
  
  // Validate processor ID (basic sanitization)
  if (!/^[a-zA-Z0-9-_]+$/.test(processorId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid processor ID. Only alphanumeric characters, hyphens, and underscores allowed.'
    });
  }
  
  next();
};

// POST /api/docs/save - Save modified version to server storage
router.post('/save', validateSaveRequest, async (req, res) => {
  try {
    const { processorType, processorId, content } = req.body;
    
    // Create server storage path (not overwriting original files)
    const serverFilePath = path.join(
      SERVER_DOCS_DIR,
      processorType,
      `${processorId}.md`
    );
    
    // Ensure directory exists
    const dirPath = path.dirname(serverFilePath);
    await fs.mkdir(dirPath, { recursive: true });
    
    // Save metadata along with content
    const documentData = {
      content: content,
      processorType: processorType,
      processorId: processorId,
      lastModified: new Date().toISOString(),
      version: 'modified',
      originalExists: await checkOriginalFileExists(processorType, processorId)
    };
    
    // Write to server storage
    await fs.writeFile(serverFilePath, content, 'utf8');
    
    // Also save metadata
    const metadataPath = serverFilePath.replace('.md', '.meta.json');
    await fs.writeFile(metadataPath, JSON.stringify(documentData, null, 2), 'utf8');
    
    res.json({
      success: true,
      message: 'Modified version saved to server (original file preserved)',
      lastModified: documentData.lastModified,
      filePath: `server-storage/${processorType}/${processorId}.md`,
      version: 'modified'
    });
    
  } catch (error) {
    console.error('Error saving markdown to server:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while saving to server storage'
    });
  }
});

// Helper function to check if original file exists
const checkOriginalFileExists = async (processorType, processorId) => {
  try {
    const originalPath = path.join(
      __dirname,
      '../sample/public/docs/processors',
      processorType,
      `${processorId}.md`
    );
    await fs.access(originalPath);
    return true;
  } catch {
    return false;
  }
};

// GET /api/docs/load/:type/:id - Load document (server version first, then original)
router.get('/load/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    
    // Validate parameters
    const validTypes = ['video', 'audio', 'sharing'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid processor type'
      });
    }
    
    // First try to load from server storage (modified version)
    const serverFilePath = path.join(SERVER_DOCS_DIR, type, `${id}.md`);
    const metadataPath = serverFilePath.replace('.md', '.meta.json');
    
    try {
      const content = await fs.readFile(serverFilePath, 'utf8');
      const stats = await fs.stat(serverFilePath);
      
      // Try to load metadata
      let metadata = {};
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } catch {
        // Metadata doesn't exist, create basic info
        metadata = {
          version: 'modified',
          lastModified: stats.mtime.toISOString()
        };
      }
      
      return res.json({
        success: true,
        content: content,
        lastModified: stats.mtime.toISOString(),
        filePath: `server-storage/${type}/${id}.md`,
        version: 'modified',
        source: 'server',
        metadata: metadata
      });
    } catch (serverError) {
      // Server version doesn't exist, try original file
    }
    
    // Fallback to original file
    const originalFilePath = path.join(
      __dirname,
      '../sample/public/docs/processors',
      type,
      `${id}.md`
    );
    
    try {
      const content = await fs.readFile(originalFilePath, 'utf8');
      const stats = await fs.stat(originalFilePath);
      
      res.json({
        success: true,
        content: content,
        lastModified: stats.mtime.toISOString(),
        filePath: `docs/processors/${type}/${id}.md`,
        version: 'original',
        source: 'original'
      });
    } catch (originalError) {
      // Neither server nor original file exists
      res.status(404).json({
        success: false,
        message: 'Document not found (neither modified nor original version exists)'
      });
    }
    
  } catch (error) {
    console.error('Error loading markdown file:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while loading file'
    });
  }
});

// GET /api/docs/list - List all documents (both server and original versions)
router.get('/list', async (req, res) => {
  try {
    const files = [];
    const types = ['video', 'audio', 'sharing'];
    
    // Get original files
    const originalDocsPath = path.join(__dirname, '../sample/public/docs/processors');
    
    for (const type of types) {
      const typePath = path.join(originalDocsPath, type);
      
      try {
        const typeFiles = await fs.readdir(typePath);
        
        for (const file of typeFiles) {
          if (file.endsWith('.md')) {
            const filePath = path.join(typePath, file);
            const stats = await fs.stat(filePath);
            const processorId = file.replace('.md', '');
            
            // Check if there's a modified version on server
            const serverFilePath = path.join(SERVER_DOCS_DIR, type, file);
            let hasModifiedVersion = false;
            let modifiedLastModified = null;
            
            try {
              const serverStats = await fs.stat(serverFilePath);
              hasModifiedVersion = true;
              modifiedLastModified = serverStats.mtime.toISOString();
            } catch {
              // No modified version
            }
            
            files.push({
              processorType: type,
              processorId: processorId,
              fileName: file,
              originalLastModified: stats.mtime.toISOString(),
              originalSize: stats.size,
              hasModifiedVersion: hasModifiedVersion,
              modifiedLastModified: modifiedLastModified,
              activeVersion: hasModifiedVersion ? 'modified' : 'original'
            });
          }
        }
      } catch (error) {
        // Directory doesn't exist, skip
      }
    }
    
    // Also check for server-only files (files that don't have originals)
    try {
      for (const type of types) {
        const serverTypePath = path.join(SERVER_DOCS_DIR, type);
        
        try {
          const serverFiles = await fs.readdir(serverTypePath);
          
          for (const file of serverFiles) {
            if (file.endsWith('.md')) {
              const processorId = file.replace('.md', '');
              
              // Check if this file already exists in our list
              const existsInList = files.some(f => 
                f.processorType === type && f.processorId === processorId
              );
              
              if (!existsInList) {
                const filePath = path.join(serverTypePath, file);
                const stats = await fs.stat(filePath);
                
                files.push({
                  processorType: type,
                  processorId: processorId,
                  fileName: file,
                  originalLastModified: null,
                  originalSize: 0,
                  hasModifiedVersion: true,
                  modifiedLastModified: stats.mtime.toISOString(),
                  activeVersion: 'modified',
                  serverOnly: true
                });
              }
            }
          }
        } catch {
          // Server type directory doesn't exist
        }
      }
    } catch (error) {
      // Server docs directory doesn't exist
    }
    
    // Sort by most recent activity (either modified or original)
    files.sort((a, b) => {
      const aTime = a.modifiedLastModified || a.originalLastModified;
      const bTime = b.modifiedLastModified || b.originalLastModified;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    
    res.json({
      success: true,
      files: files,
      total: files.length,
      serverStoragePath: SERVER_DOCS_DIR
    });
    
  } catch (error) {
    console.error('Error listing markdown files:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while listing files'
    });
  }
});

// POST /api/docs/reset/:type/:id - Reset to original version (delete server version)
router.post('/reset/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    
    const serverFilePath = path.join(SERVER_DOCS_DIR, type, `${id}.md`);
    const metadataPath = serverFilePath.replace('.md', '.meta.json');
    
    // Create backup before deletion
    const backupPath = serverFilePath.replace('.md', `_backup_${Date.now()}.md`);
    
    try {
      await fs.rename(serverFilePath, backupPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, nothing to reset
    }
    
    // Remove metadata file
    try {
      await fs.unlink(metadataPath);
    } catch {
      // Metadata file doesn't exist
    }
    
    res.json({
      success: true,
      message: 'Reset to original version (server version backed up)',
      backupPath: backupPath,
      version: 'original'
    });
    
  } catch (error) {
    console.error('Error resetting to original version:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while resetting version'
    });
  }
});

// GET /api/docs/versions/:type/:id - Get version information
router.get('/versions/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    
    const versions = [];
    
    // Check original version
    const originalPath = path.join(
      __dirname,
      '../sample/public/docs/processors',
      type,
      `${id}.md`
    );
    
    try {
      const stats = await fs.stat(originalPath);
      versions.push({
        version: 'original',
        lastModified: stats.mtime.toISOString(),
        size: stats.size,
        source: 'file-system',
        path: `docs/processors/${type}/${id}.md`
      });
    } catch {
      // Original doesn't exist
    }
    
    // Check server version
    const serverPath = path.join(SERVER_DOCS_DIR, type, `${id}.md`);
    const metadataPath = serverPath.replace('.md', '.meta.json');
    
    try {
      const stats = await fs.stat(serverPath);
      let metadata = {};
      
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } catch {
        // No metadata
      }
      
      versions.push({
        version: 'modified',
        lastModified: stats.mtime.toISOString(),
        size: stats.size,
        source: 'server-storage',
        path: `server-storage/${type}/${id}.md`,
        metadata: metadata
      });
    } catch {
      // Server version doesn't exist
    }
    
    res.json({
      success: true,
      versions: versions,
      activeVersion: versions.find(v => v.version === 'modified') ? 'modified' : 'original'
    });
    
  } catch (error) {
    console.error('Error getting version information:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while getting versions'
    });
  }
});

module.exports = router; 