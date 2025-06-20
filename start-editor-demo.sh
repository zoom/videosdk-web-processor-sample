#!/bin/bash

# Markdown Editor Demo Startup Script
echo "🚀 Starting Markdown Editor Demo..."

# Function to kill background processes on exit
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Setup checklist:${NC}"
echo "1. ✅ Backend API created"
echo "2. ✅ Frontend editor implemented"
echo "3. ✅ Vite proxy configured"
echo "4. 🔄 Starting servers..."

# Start backend server
echo -e "\n${YELLOW}🔧 Starting backend server...${NC}"
cd server
npm install > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install backend dependencies${NC}"
    exit 1
fi

node server.js &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID)${NC}"
echo "   📡 API available at: http://localhost:3001/api/docs"

# Wait for backend to start
sleep 2

# Start frontend server
echo -e "\n${YELLOW}🎨 Starting frontend server...${NC}"
cd ../sample
npm install > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install frontend dependencies${NC}"
    kill $BACKEND_PID
    exit 1
fi

npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend server started (PID: $FRONTEND_PID)${NC}"
echo "   🌐 App available at: http://localhost:5173"

# Wait for frontend to start
sleep 3

echo -e "\n${GREEN}🎉 Both servers are running!${NC}"
echo -e "\n${BLUE}📖 How to test the editor:${NC}"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Navigate to any processor (e.g., Video > Dual Mask)"
echo "3. Click the 'Edit Documentation' tab"
echo "4. Make some changes and click Save"
echo "5. Check the file: sample/public/docs/processors/video/zoom-dual-mask-video-processor.md"

echo -e "\n${BLUE}🔍 API endpoints available:${NC}"
echo "• POST /api/docs/save - Save markdown file"
echo "• GET /api/docs/load/:type/:id - Load markdown file"
echo "• GET /api/docs/list - List all files"
echo "• DELETE /api/docs/delete/:type/:id - Delete file"

echo -e "\n${YELLOW}💡 Press Ctrl+C to stop both servers${NC}"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID 