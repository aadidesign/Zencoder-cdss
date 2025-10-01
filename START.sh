#!/bin/bash

echo "🏥 Starting CDSS System on GitHub Codespaces..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Start Redis
echo -e "${BLUE}1. Starting Redis...${NC}"
if docker ps | grep -q cdss-redis; then
    echo -e "${GREEN}✓ Redis already running${NC}"
else
    docker run -d --name cdss-redis -p 6379:6379 redis:7-alpine
    echo -e "${GREEN}✓ Redis started${NC}"
fi

# Step 2: Setup Backend
echo -e "\n${BLUE}2. Setting up Backend...${NC}"
cd backend

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cat > .env << 'EOF'
PUBMED_EMAIL=your.email@example.com
PUBMED_API_KEY=
REDIS_URL=redis://localhost:6379/0
DEBUG=True
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=*
ALLOWED_HOSTS=*
CHROMA_PERSIST_DIRECTORY=/workspaces/Zencoder-cdss/backend/data/chroma_db
EOF
    echo -e "${GREEN}✓ Created .env file${NC}"
fi

# Create venv if doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo -e "${YELLOW}Installing dependencies (this may take a few minutes)...${NC}"
pip install --upgrade pip -q
pip install -r requirements-simple.txt -q

# Start backend in background
echo -e "${GREEN}✓ Starting Backend...${NC}"
python main.py > ../backend.log 2>&1 &
echo $! > ../backend.pid
cd ..

# Step 3: Setup Frontend
echo -e "\n${BLUE}3. Setting up Frontend...${NC}"
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing npm packages...${NC}"
    npm install --legacy-peer-deps
fi

# Start frontend in background
echo -e "${GREEN}✓ Starting Frontend...${NC}"
BROWSER=none npm start > ../frontend.log 2>&1 &
echo $! > ../frontend.pid
cd ..

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ CDSS is starting!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Access via PORTS tab in VS Code:"
echo "  • Frontend: port 3000"
echo "  • Backend API: port 8000"
echo ""
echo "View logs:"
echo "  • Backend: tail -f backend.log"
echo "  • Frontend: tail -f frontend.log"
echo ""
echo "Stop services:"
echo "  • ./STOP.sh"
echo ""
echo "⏳ Wait ~30 seconds for services to start..."

