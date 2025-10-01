# Clinical Decision Support System (CDSS) - Repository Rules

## Project Overview

This is a **production-ready Clinical Decision Support System** built with:

- **Frontend**: React 18 + TypeScript + styled-components + Material-UI
- **Backend**: Python 3.9+ + FastAPI + PubMedBERT + Vector Database
- **Database**: Redis + ChromaDB + PostgreSQL (optional)
- **Infrastructure**: Docker + Docker Compose + Nginx + Prometheus + Grafana
- **Testing**: Playwright (E2E) + Pytest (Backend) + Jest (Frontend)
- **Target Framework**: Playwright

## Architecture

### Frontend (React/TypeScript)
- **Entry Point**: `frontend/src/index.tsx`
- **Main App**: `frontend/src/App.tsx`
- **Components**: `frontend/src/components/`
  - Advanced components in `frontend/src/components/advanced/`
  - UI components in `frontend/src/components/ui/`
  - Layout components in `frontend/src/components/layout/`
- **Pages**: `frontend/src/pages/`
- **Contexts**: `frontend/src/contexts/`

### Backend (Python/FastAPI)
- **Entry Point**: `backend/main.py`
- **API Routes**: `backend/api/routes.py`
- **Services**: `backend/services/`
  - RAG Service: `backend/services/rag_service.py`
  - PubMed Service: `backend/services/pubmed_service.py`
  - Vector DB Service: `backend/services/vector_db_service.py`
  - Clinical Processor: `backend/services/clinical_processor.py`
  - WebSocket Manager: `backend/services/websocket_manager.py`
- **Utilities**: `backend/utils/`
  - Security: `backend/utils/security.py`
  - Monitoring: `backend/utils/monitoring.py`
  - Configuration: `backend/utils/config.py`

### Key Features Implemented

1. **Real-time Clinical Query Processing**
   - WebSocket-based communication
   - PubMedBERT integration for medical language understanding
   - Real-time literature search via PubMed APIs
   - Vector similarity search using ChromaDB

2. **Advanced Frontend Features**
   - Voice input support
   - Real-time processing visualization
   - Advanced clinical query form with patient context
   - Comprehensive monitoring dashboard
   - Error boundaries and loading states

3. **Production Security**
   - Input validation and sanitization
   - Rate limiting and DDoS protection
   - JWT-based authentication
   - Comprehensive security headers
   - SQL injection and XSS prevention

4. **Monitoring & Observability**
   - Prometheus metrics collection
   - Grafana dashboards
   - Structured logging
   - Health checks and alerting
   - Performance monitoring

5. **Testing & Quality Assurance**
   - Comprehensive E2E tests with Playwright
   - Backend unit and integration tests
   - Frontend component testing
   - Security testing
   - Performance testing

## Development Guidelines

### Code Style
- **Python**: Follow PEP 8, use type hints, async/await patterns
- **TypeScript/React**: Use functional components, hooks, and TypeScript strictly
- **Testing**: Write tests for all new features, maintain >80% coverage

### Security Requirements
- Always validate and sanitize user input
- Use parameterized queries for database operations
- Implement proper authentication and authorization
- Never expose sensitive data in client-side code
- Follow OWASP security guidelines

### Performance Requirements
- API responses should be <500ms for simple queries
- WebSocket connections should handle real-time updates
- Frontend should load within 3 seconds
- Support concurrent users without degradation

## Deployment

### Development
```bash
# Frontend
cd frontend && npm install && npm start

# Backend
cd backend && pip install -r requirements.txt && python main.py

# Full system with Docker
docker-compose up --build
```

### Production
```bash
# Automated deployment
./deploy-production.sh

# Manual deployment
docker-compose -f docker-compose.prod.yml up --build -d
```

### Testing
```bash
# Backend tests
cd backend && pytest tests/ -v --cov

# Frontend tests
cd frontend && npm test

# E2E tests
cd tests && npx playwright test
```

## File Structure

```
├── backend/
│   ├── main.py (FastAPI application)
│   ├── api/ (API routes)
│   ├── services/ (Business logic)
│   ├── utils/ (Utilities)
│   ├── models/ (Data models)
│   ├── tests/ (Backend tests)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/ (React components)
│   │   ├── pages/ (Page components)
│   │   ├── contexts/ (React contexts)
│   │   └── index.tsx (Entry point)
│   ├── public/
│   └── package.json
├── tests/
│   ├── e2e/ (Playwright E2E tests)
│   ├── playwright.config.ts
│   └── global-setup.ts
├── monitoring/
│   ├── prometheus.yml
│   ├── alert_rules.yml
│   └── grafana/
├── docker-compose.yml (Development)
├── docker-compose.prod.yml (Production)
├── nginx.prod.conf (Production nginx)
└── deploy-production.sh (Deployment script)
```

## Environment Variables

### Backend (.env)
- `PUBMED_API_KEY`: PubMed API key
- `REDIS_URL`: Redis connection string
- `VECTOR_DB_PATH`: Vector database path
- `JWT_SECRET_KEY`: JWT secret key
- `DEBUG`: Debug mode (False in production)

### Frontend (environment-specific)
- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_WS_URL`: WebSocket URL

## API Documentation

- **Development**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Metrics**: http://localhost:8000/metrics
- **WebSocket**: ws://localhost:8000/ws/{client_id}

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
- **Application Logs**: `docker-compose logs -f`

## Security Considerations

1. **Input Validation**: All user inputs are validated and sanitized
2. **Authentication**: JWT-based authentication with refresh tokens
3. **Rate Limiting**: API rate limiting to prevent abuse
4. **CORS**: Properly configured CORS policies
5. **Headers**: Security headers implemented
6. **Secrets Management**: Environment variables for sensitive data
7. **HTTPS**: SSL/TLS configuration for production
8. **Audit Logging**: Comprehensive audit trails

## Performance Benchmarks

- **API Response Time**: <500ms for simple queries, <5s for complex AI processing
- **Frontend Load Time**: <3 seconds
- **WebSocket Latency**: <100ms
- **Concurrent Users**: Support for 100+ concurrent users
- **Database Queries**: Optimized vector similarity search

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Review security logs weekly
- Monitor system performance daily
- Backup data regularly
- Update SSL certificates as needed

### Monitoring Alerts
- High CPU/memory usage
- Error rate spikes
- Slow response times
- Service downtime
- Security events

This repository follows production-ready standards with comprehensive testing, monitoring, security, and deployment automation.