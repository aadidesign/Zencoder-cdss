# 🚀 GitHub Codespaces - Terminal Commands

All Docker files have been removed. Run directly in terminal.

---

## ⚡ Quick Start (One Command)

```bash
chmod +x START.sh STOP.sh && ./START.sh
```

**That's it!** Access via the PORTS tab (ports 3000 & 8000)

---

## 📋 Manual Setup (If Script Doesn't Work)

### Terminal 1: Redis
```bash
docker run -d --name cdss-redis -p 6379:6379 redis:7-alpine
```

### Terminal 2: Backend
```bash
cd backend

# Create environment file
cat > .env << 'EOF'
PUBMED_EMAIL=your.email@example.com
REDIS_URL=redis://localhost:6379/0
DEBUG=True
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=*
ALLOWED_HOSTS=*
CHROMA_PERSIST_DIRECTORY=/workspaces/Zencoder-cdss/backend/data/chroma_db
EOF

# Setup Python environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements-simple.txt

# Start backend
python main.py
```

### Terminal 3: Frontend
```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Start frontend
npm start
```

---

## 🛑 Stop Everything

```bash
./STOP.sh
```

Or manually:
```bash
pkill -f "uvicorn main:app"
pkill -f "react-scripts start"
docker stop cdss-redis && docker rm cdss-redis
```

---

## 🔧 Troubleshooting

### Port already in use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Redis connection error
```bash
docker restart cdss-redis
# OR
docker rm -f cdss-redis
docker run -d --name cdss-redis -p 6379:6379 redis:7-alpine
```

### Module not found (Backend)
```bash
cd backend
source venv/bin/activate
pip install -r requirements-simple.txt --upgrade
```

### npm install fails (Frontend)
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps --force
```

---

## 📊 Check Status

```bash
# Check if services are running
curl http://localhost:8000/health

# Check Redis
docker ps | grep redis

# Check ports
netstat -tuln | grep -E "3000|8000|6379"

# View logs
tail -f backend.log
tail -f frontend.log
```

---

## 🌐 Access URLs

In Codespaces:
1. Click **"PORTS"** tab at bottom
2. Find ports **3000** and **8000**
3. Click 🌐 icon to open

URLs format:
- Frontend: `https://your-codespace-3000.app.github.dev`
- API Docs: `https://your-codespace-8000.app.github.dev/docs`

---

## 📝 Notes

- **No Docker images** - everything runs directly
- **Lightweight backend** - uses `requirements-simple.txt`
- **First run**: Takes 5-10 minutes (downloads ML models)
- **Subsequent runs**: 30-60 seconds
- **Recommended**: 4-core or 8-core Codespace

---

## 🔑 Optional: Add PubMed API Key

Edit `backend/.env`:
```bash
nano backend/.env
```

Add your key:
```env
PUBMED_EMAIL=your.email@example.com
PUBMED_API_KEY=your_api_key_here
```

Get free key: https://www.ncbi.nlm.nih.gov/account/

