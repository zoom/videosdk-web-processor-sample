# Markdown Editor Setup Guide

## 📝 Current Behavior

The markdown editor currently saves changes **temporarily** to your browser's localStorage:

- ✅ **Auto-save every 30 seconds** to localStorage
- ✅ **Drafts persist for 24 hours** after browser refresh
- ✅ **Download backup files** for permanent storage
- ❌ **Original files are NOT modified** in the project

## 🔄 How It Works

### Loading Priority
1. **Check localStorage** - Load 24-hour drafts first
2. **Load original file** - From `public/docs/processors/`
3. **Show fallback** - Hardcoded content if no markdown file exists

### Storage Location
- **Temporary drafts**: Browser localStorage
- **Original files**: `sample/public/docs/processors/{type}/{id}.md`
- **Backup downloads**: User's download folder

## 🛠️ Enable Persistent File Saving

To make edits save directly to the original files, follow these steps:

### Step 1: Start the Backend Server

```bash
cd server
npm install
npm start
```

The server will run on `http://localhost:3001`

### Step 2: Enable API Saving

In `sample/src/utils/markdownApi.ts`, uncomment the server API code:

```typescript
// OPTION 1: Real server API (uncomment to enable persistent saving)
const response = await fetch('/api/docs/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request)
});

if (!response.ok) {
  throw new Error(`Server error: ${response.status}`);
}

const result = await response.json();

// Also save to localStorage as backup
const key = `markdown_${request.processorType}_${request.processorId}`;
localStorage.removeItem(key); // Clear draft since it's now saved

return result;
```

### Step 3: Update Frontend Dev Server

Make sure your frontend development server proxies API calls to the backend:

In `vite.config.ts`, add:

```typescript
export default defineConfig({
  // ... existing config
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
```

## 🔐 Security Features

The backend API includes several security measures:

- **Input validation** - Validates processor types and IDs
- **Path sanitization** - Prevents directory traversal attacks
- **Automatic backups** - Creates backups before overwriting files
- **File type restrictions** - Only allows `.md` files

## 📁 API Endpoints

Once the backend is running, these endpoints are available:

### Save Markdown
```http
POST /api/docs/save
Content-Type: application/json

{
  "processorType": "video",
  "processorId": "zoom-dual-mask-video-processor",
  "content": "# Updated Documentation\n\nNew content here..."
}
```

### Load Markdown
```http
GET /api/docs/load/video/zoom-dual-mask-video-processor
```

### List All Files
```http
GET /api/docs/list
```

### Delete File
```http
DELETE /api/docs/delete/video/zoom-dual-mask-video-processor
```

## 🔄 Migration Path

### Current State (Temporary)
- Edits saved to localStorage
- 24-hour draft retention
- Download backups manually
- Original files unchanged

### With Backend (Persistent)
- Edits saved to actual files
- Automatic backups created
- localStorage used as fallback
- Real-time collaboration possible

## 🚀 Production Deployment

For production use, consider:

1. **Database storage** instead of file system
2. **User authentication** and permissions
3. **Version control** integration (Git)
4. **Real-time collaboration** with WebSockets
5. **Content validation** and sanitization
6. **Audit logging** for changes

## 🔧 Troubleshooting

### Editor shows old content after editing
- Check if localStorage has a draft
- Clear browser storage: `localStorage.clear()`
- Refresh the page

### Edits not saving to files
- Ensure backend server is running
- Check browser network tab for API errors
- Verify API endpoint configuration

### Permission errors on file save
- Check file/directory permissions
- Ensure server has write access to docs folder

## 📋 Development Checklist

- [ ] Backend server running on port 3001
- [ ] Frontend proxy configured for `/api` routes
- [ ] API saving enabled in `markdownApi.ts`
- [ ] File permissions set correctly
- [ ] Backup strategy in place

## 🎯 Future Enhancements

Possible improvements for the editor:

- **Git integration** - Commit changes automatically
- **Collaborative editing** - Multiple users editing simultaneously  
- **Version history** - Track and restore previous versions
- **Content templates** - Pre-built documentation templates
- **Markdown linting** - Real-time syntax checking
- **Export formats** - PDF, HTML, Word document export
- **Image uploads** - Drag-and-drop image support
- **Live preview** - Real-time rendering while typing

---

**Current Status**: ✅ Temporary localStorage saving  
**Next Step**: Enable backend API for persistent file saving 