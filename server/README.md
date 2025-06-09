# Zoom VideoSDK Server

A Node.js server for handling audio recording uploads from the Zoom VideoSDK with a beautiful admin dashboard.

## Features

- **File Upload API**: Accept audio recordings from the VideoSDK client
- **Admin Dashboard**: Beautiful React-based UI for server management
- **Real-time Statistics**: Monitor uploads, server performance, and file management
- **File Management**: View, delete uploaded files through the web interface
- **AssemblyAI Integration**: Token generation for real-time transcription

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the server directory:
```env
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```

## Usage

### Start the server:
```bash
npm start
```

### Development mode (with auto-restart):
```bash
npm run dev
```

The server will start on port 8000 and provide:
- **Admin Dashboard**: http://localhost:8000/admin
- **Upload API**: http://localhost:8000/upload
- **Token API**: http://localhost:8000/token

## API Endpoints

### POST `/upload`
Upload audio recordings from the VideoSDK client.

**Request**: FormData with:
- `file`: Audio file (WAV, MP3, PCM)
- `sampleRate`: Audio sample rate
- `format`: Audio format
- `timestamp`: Recording timestamp

**Response**:
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "fileInfo": { ... }
}
```

### GET `/api/stats`
Get server statistics including uptime, memory usage, and upload counts.

### GET `/api/files`
Get list of all uploaded files with metadata.

### DELETE `/api/files/:filename`
Delete a specific uploaded file.

## Admin Dashboard

The admin dashboard provides:
- **Real-time Statistics**: Server uptime, memory usage, upload counts
- **File Management**: View and delete uploaded files
- **Recent Activity**: Latest upload activity
- **Auto-refresh**: Updates every 30 seconds

## File Structure

```
server/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── admin-ui/         # Admin dashboard files
│   └── index.html    # React-based admin interface
├── uploads/          # Uploaded files (auto-created)
└── README.md         # This file
```

## Configuration

- **Port**: Default 8000 (configurable via environment)
- **Upload Directory**: `./uploads` (auto-created)
- **File Retention**: Files are kept until manually deleted
- **Memory Limits**: Default multer limits apply

## Security Notes

- CORS is enabled for all origins (configure for production)
- No authentication required (add for production use)
- File uploads are stored locally (consider cloud storage for production) 