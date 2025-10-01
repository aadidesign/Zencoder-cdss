# Clinical Decision Support System (CDSS)

A real-time RAG-based Clinical Decision Support System that leverages PubMedBERT and PubMed APIs to provide evidence-based clinical recommendations.

## 🏥 Features

- **Real-time Clinical Query Processing**: WebSocket-based real-time communication for immediate feedback
- **PubMedBERT Integration**: Advanced medical language model for clinical text understanding
- **RAG Pipeline**: Retrieval-Augmented Generation for evidence-based recommendations
- **PubMed API Integration**: Real-time fetching of latest research papers
- **Vector Database**: Semantic search using ChromaDB for relevant document retrieval
- **Clinical Entity Extraction**: Advanced NLP for medical entity recognition
- **Professional Medical UI**: Clean, intuitive interface designed for healthcare professionals
- **Production Ready**: Docker containerization, Nginx proxy, Redis caching, comprehensive monitoring

## 🏗️ Architecture

### Backend (Python/FastAPI)
- **RAG Service**: Orchestrates the AI pipeline for clinical recommendations
- **PubMed Service**: Fetches and processes research papers from NCBI
- **Vector Database Service**: Manages document embeddings and semantic search
- **Clinical Processor**: Extracts medical entities and generates recommendations
- **WebSocket Manager**: Real-time communication with frontend

### Frontend (React/TypeScript)
- **Clinical Query Interface**: Input medical questions with patient context
- **Real-time Dashboard**: Shows processing steps and system status
- **Research Browser**: Browse recent papers and recommendations
- **Settings Management**: Configure system parameters

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.9+
- Node.js 16+

### Environment Setup

1. **Clone and navigate to the repository**:
```bash
git clone <repository-url>
cd Zencoder-cdss
```

2. **Set up environment variables**:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

3. **Start the entire system**:
```bash
docker-compose up --build
```

4. **Access the application**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Manual Setup (Development)

#### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

#### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## 🔧 Configuration

### Backend Environment Variables (.env)
```env
# API Configuration
PUBMED_API_KEY=your_pubmed_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Database
VECTOR_DB_PATH=./data/vector_db
REDIS_URL=redis://redis:6379

# Model Configuration
PUBMEDBERT_MODEL=microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext
SENTENCE_TRANSFORMER_MODEL=all-MiniLM-L6-v2

# Application Settings
DEBUG=false
LOG_LEVEL=INFO
MAX_PAPERS_PER_QUERY=20
VECTOR_DB_COLLECTION_NAME=clinical_papers
```

### Frontend Configuration
Configuration is handled through environment variables or at build time.

## 📊 System Components

### RAG Pipeline Flow
1. **Query Processing**: Extract clinical entities from user input
2. **Paper Retrieval**: Search PubMed for relevant recent papers
3. **Document Processing**: Embed papers using sentence transformers
4. **Vector Storage**: Store embeddings in ChromaDB
5. **Semantic Search**: Find most relevant documents
6. **Recommendation Generation**: Use PubMedBERT to generate clinical insights
7. **Real-time Updates**: Stream progress to frontend via WebSocket

### API Endpoints
- `GET /health` - System health check
- `POST /api/clinical-query` - Submit clinical query
- `GET /api/recent-papers` - Get recent papers
- `GET /api/system-stats` - Get system statistics
- `WS /ws` - WebSocket connection for real-time updates

## 🛠️ Development

### Adding New Features
1. **Backend**: Add services in `backend/services/`
2. **Frontend**: Add components in `frontend/src/components/`
3. **API**: Define routes in `backend/api/routes.py`

### Testing
```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Building for Production
```bash
# Build all services
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## 📚 Medical Data Sources

- **PubMed Central**: Open access biomedical literature
- **MEDLINE**: Bibliographic database of life sciences
- **PMC Open Access Subset**: Full-text articles
- **Clinical Trials Database**: Clinical study information

## 🔒 Security & Privacy

- **Data Encryption**: All sensitive data encrypted in transit and at rest
- **HIPAA Compliance**: Designed with healthcare data privacy in mind
- **API Rate Limiting**: Prevents abuse of external APIs
- **Input Sanitization**: Comprehensive input validation and sanitization
- **Audit Logging**: Complete audit trail for all clinical queries

## 📈 Monitoring & Logging

- **Health Checks**: Comprehensive system health monitoring
- **Performance Metrics**: Request timing and system performance
- **Error Tracking**: Detailed error logging and alerting
- **Usage Analytics**: Query patterns and system usage statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This system is designed for educational and research purposes. It should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of qualified health providers with questions regarding medical conditions.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in `/docs`
- Review the API documentation at `/docs` when running

## 📋 Roadmap

- [ ] Integration with additional medical databases
- [ ] Advanced clinical reasoning algorithms
- [ ] Multi-language support
- [ ] Mobile application
- [ ] Clinical workflow integration
- [ ] Advanced analytics dashboard