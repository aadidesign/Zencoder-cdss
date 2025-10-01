"""
Clinical Decision Support System - Main Application
Real-time RAG-based system using PubMedBERT and PubMed APIs
Production-ready with comprehensive security and monitoring
"""

import os
import sys
import asyncio
import time
import uvicorn
import signal
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional, List
import traceback
import json
from pathlib import Path
import aioredis
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# FastAPI imports
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Depends, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles

# Security imports
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta

# Monitoring imports
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry, REGISTRY
import psutil
import structlog

# Application imports
from api.routes import router as api_router
from services.rag_service import RAGService
from services.websocket_manager import WebSocketManager
from utils.config import Settings
from utils.security import SecurityService, SecurityMiddleware, SecurityConfig
from utils.monitoring import MonitoringService

# Initialize structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Initialize settings
settings = Settings()

# Initialize Redis client
redis_client: Optional[aioredis.Redis] = None

# Initialize security
security_service: Optional[SecurityService] = None
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize monitoring
monitoring_service: Optional[MonitoringService] = None

# Global services
rag_service: Optional[RAGService] = None
websocket_manager = WebSocketManager()

# Application metrics
request_count = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
request_duration = Histogram('http_request_duration_seconds', 'HTTP request duration', ['method', 'endpoint'])
active_connections = Gauge('websocket_connections_active', 'Active WebSocket connections')
system_health = Gauge('system_health_score', 'Overall system health score')

# Security metrics
failed_auth_attempts = Counter('failed_auth_attempts_total', 'Failed authentication attempts', ['ip_address'])
rate_limit_hits = Counter('rate_limit_hits_total', 'Rate limit hits', ['endpoint'])

# Application state
startup_time = time.time()
shutdown_requested = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup and cleanup on shutdown"""
    global rag_service, redis_client, security_service, monitoring_service
    
    logger.info("Starting Clinical Decision Support System...")
    
    try:
        # Initialize Redis client
        redis_client = await aioredis.from_url(
            settings.REDIS_URL, 
            decode_responses=True,
            retry_on_timeout=True,
            health_check_interval=30
        )
        logger.info("Redis connection established")
        
        # Initialize security service
        security_service = SecurityService(redis_client)
        logger.info("Security service initialized")
        
        # Initialize monitoring service
        monitoring_service = MonitoringService(redis_client)
        await monitoring_service.start(metrics_port=9090)
        logger.info("Monitoring service started")
        
        # Initialize RAG service
        rag_service = RAGService()
        await rag_service.initialize()
        logger.info("RAG service initialized")
        
        # Set global references for dependency injection
        app.state.rag_service = rag_service
        app.state.websocket_manager = websocket_manager
        app.state.redis_client = redis_client
        app.state.security_service = security_service
        app.state.monitoring_service = monitoring_service
        
        # Register health checks
        monitoring_service.health_checker.register_check(
            "rag_service", 
            lambda: {"healthy": rag_service is not None, "message": "RAG service available"}
        )
        
        # Update system health
        system_health.set(1.0)
        
        logger.info("CDSS initialized successfully", 
                   components={
                       "rag_service": bool(rag_service),
                       "redis": bool(redis_client),
                       "security": bool(security_service),
                       "monitoring": bool(monitoring_service)
                   })
    
    except Exception as e:
        logger.error("Failed to initialize CDSS", error=str(e), traceback=traceback.format_exc())
        system_health.set(0.0)
        raise
    
    yield
    
    logger.info("Shutting down CDSS...")
    global shutdown_requested
    shutdown_requested = True
    
    try:
        # Cleanup services
        if monitoring_service:
            await monitoring_service.stop()
        
        if rag_service:
            await rag_service.cleanup()
        
        if redis_client:
            await redis_client.close()
        
        logger.info("CDSS shutdown completed")
    
    except Exception as e:
        logger.error("Error during shutdown", error=str(e))


# Security dependencies
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """Validate JWT token and return current user"""
    try:
        if security_service:
            payload = security_service.verify_token(credentials.credentials)
            return payload
        return None
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def verify_request_security(request: Request):
    """Verify request security"""
    if security_service:
        is_valid, message = await security_service.validate_request(request)
        if not is_valid:
            raise HTTPException(status_code=400, detail=message)

# Create FastAPI app
app = FastAPI(
    title="Clinical Decision Support System",
    description="""
    ## Advanced Clinical Decision Support System
    
    A production-ready, real-time RAG-based Clinical Decision Support System powered by:
    
    - **PubMedBERT**: State-of-the-art medical language model
    - **Real-time PubMed Integration**: Latest research and clinical guidelines
    - **Vector Database**: Semantic search through medical literature
    - **WebSocket Support**: Real-time query processing and updates
    - **Comprehensive Security**: Rate limiting, authentication, and input validation
    - **Production Monitoring**: Prometheus metrics, health checks, and alerting
    
    ### Key Features
    
    - Evidence-based clinical recommendations
    - Patient context integration
    - Multi-specialty support
    - Real-time literature analysis
    - Risk assessment and contraindication detection
    - Comprehensive audit logging
    """,
    version="1.2.0",
    contact={
        "name": "CDSS Support Team",
        "email": "support@cdss.example.com",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
    servers=[
        {"url": "http://localhost:8000", "description": "Development server"},
        {"url": "https://api.cdss.example.com", "description": "Production server"},
    ]
)

# Custom rate limit error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security middleware
if not settings.DEBUG:
    app.add_middleware(HTTPSRedirectMiddleware)

app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=settings.ALLOWED_HOSTS
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
    max_age=3600,
)

# Compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request processing middleware
@app.middleware("http")
async def process_request_middleware(request: Request, call_next):
    """Process requests with timing and security"""
    start_time = time.time()
    request_id = f"req_{int(time.time())}_{hash(str(request.url))}"
    
    # Add request ID to headers
    request.state.request_id = request_id
    
    # Security validation for non-health endpoints
    if not request.url.path.startswith(("/health", "/metrics")):
        try:
            await verify_request_security(request)
        except HTTPException as e:
            if monitoring_service:
                monitoring_service.record_error("security_validation", "middleware")
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail, "request_id": request_id}
            )
    
    # Process request
    try:
        response = await call_next(request)
        
        # Add response headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = str(round((time.time() - start_time) * 1000, 2))
        
        # Record metrics
        duration = time.time() - start_time
        request_count.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()
        
        request_duration.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(duration)
        
        if monitoring_service:
            monitoring_service.record_http_request(
                request.method,
                request.url.path,
                response.status_code,
                duration
            )
        
        return response
        
    except Exception as e:
        logger.error("Request processing error", 
                    error=str(e), 
                    request_id=request_id,
                    path=request.url.path,
                    method=request.method)
        
        if monitoring_service:
            monitoring_service.record_error("request_processing", "middleware")
        
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "request_id": request_id}
        )

# Include API routes
app.include_router(api_router, prefix="/api/v1", tags=["Clinical Decision Support"])


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """Enhanced WebSocket endpoint for real-time communication with security and monitoring"""
    start_time = time.time()
    
    # Validate client ID
    if not client_id or len(client_id) < 3:
        await websocket.close(code=1008, reason="Invalid client ID")
        return
    
    # Rate limiting check
    if security_service:
        client_ip = websocket.client.host if websocket.client else "unknown"
        is_limited, _ = await security_service.rate_limiter.is_rate_limited(
            f"websocket:{client_ip}", limit=10, window=60
        )
        if is_limited:
            await websocket.close(code=1008, reason="Rate limit exceeded")
            return
    
    await websocket_manager.connect(websocket, client_id)
    active_connections.set(len(websocket_manager.active_connections))
    
    logger.info("WebSocket client connected", client_id=client_id, ip=websocket.client.host if websocket.client else "unknown")
    
    try:
        # Send welcome message
        await websocket_manager.send_personal_message({
            "type": "welcome",
            "message": "Connected to CDSS WebSocket",
            "client_id": client_id,
            "server_time": datetime.utcnow().isoformat(),
            "capabilities": [
                "clinical_query",
                "real_time_updates",
                "literature_search",
                "risk_assessment"
            ]
        }, client_id)
        
        while True:
            try:
                # Receive message from client with timeout
                data = await asyncio.wait_for(websocket.receive_json(), timeout=300)
                
                # Validate message structure
                if not isinstance(data, dict) or "type" not in data:
                    await websocket_manager.send_personal_message({
                        "type": "error",
                        "message": "Invalid message format"
                    }, client_id)
                    continue
                
                message_type = data.get("type")
                
                # Process different message types
                if message_type == "ping":
                    await websocket_manager.send_personal_message({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    }, client_id)
                
                elif message_type == "clinical_query":
                    await handle_clinical_query_ws(websocket_manager, client_id, data)
                
                elif message_type == "literature_search":
                    await handle_literature_search_ws(websocket_manager, client_id, data)
                
                elif message_type == "get_system_status":
                    if monitoring_service:
                        status = await monitoring_service.get_health_status()
                        await websocket_manager.send_personal_message({
                            "type": "system_status",
                            "status": status
                        }, client_id)
                
                else:
                    await websocket_manager.send_personal_message({
                        "type": "error",
                        "message": f"Unknown message type: {message_type}"
                    }, client_id)
                
            except asyncio.TimeoutError:
                # Send keepalive ping
                await websocket_manager.send_personal_message({
                    "type": "keepalive",
                    "timestamp": datetime.utcnow().isoformat()
                }, client_id)
                continue
                
            except json.JSONDecodeError:
                await websocket_manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON format"
                }, client_id)
                
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected", client_id=client_id)
    except Exception as e:
        logger.error("WebSocket error", client_id=client_id, error=str(e))
        if monitoring_service:
            monitoring_service.record_error("websocket_error", "websocket")
    finally:
        websocket_manager.disconnect(client_id)
        active_connections.set(len(websocket_manager.active_connections))
        
        # Log connection duration
        duration = time.time() - start_time
        logger.info("WebSocket session ended", 
                   client_id=client_id, 
                   duration_seconds=round(duration, 2))

async def handle_clinical_query_ws(websocket_manager: WebSocketManager, client_id: str, data: dict):
    """Handle clinical query via WebSocket"""
    query = data.get("query", "").strip()
    patient_context = data.get("patient_context", {})
    
    if not query:
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": "Query cannot be empty"
        }, client_id)
        return
    
    # Validate query
    if security_service:
        is_valid, validation_message = security_service.input_sanitizer.validate_clinical_query(query)
        if not is_valid:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": f"Invalid query: {validation_message}"
            }, client_id)
            return
    
    # Send processing status
    await websocket_manager.send_personal_message({
        "type": "processing_started",
        "message": "Processing clinical query...",
        "query_id": f"query_{int(time.time())}",
        "steps": ["analyzing", "searching", "embedding", "matching", "generating"]
    }, client_id)
    
    try:
        # Process with RAG service
        async def websocket_callback(message):
            await websocket_manager.send_personal_message(message, client_id)
        
        if rag_service:
            response = await rag_service.process_query(
                query=query,
                patient_context=patient_context,
                websocket_callback=websocket_callback
            )
            
            # Send final response
            await websocket_manager.send_personal_message({
                "type": "clinical_response",
                "response": response,
                "timestamp": datetime.utcnow().isoformat(),
                "processing_complete": True
            }, client_id)
            
            # Record metrics
            if monitoring_service:
                monitoring_service.record_clinical_query("success", response.get("duration", 0))
        
        else:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "RAG service not available"
            }, client_id)
            
    except Exception as e:
        logger.error("Error processing clinical query via WebSocket", error=str(e), client_id=client_id)
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": "Error processing clinical query",
            "error_code": "PROCESSING_ERROR"
        }, client_id)
        
        if monitoring_service:
            monitoring_service.record_clinical_query("error", 0)

async def handle_literature_search_ws(websocket_manager: WebSocketManager, client_id: str, data: dict):
    """Handle literature search via WebSocket"""
    search_query = data.get("search_query", "").strip()
    max_results = min(data.get("max_results", 10), 50)  # Limit to 50
    
    if not search_query:
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": "Search query cannot be empty"
        }, client_id)
        return
    
    try:
        # Mock literature search (replace with actual PubMed service)
        await websocket_manager.send_personal_message({
            "type": "literature_search_started",
            "message": "Searching PubMed database..."
        }, client_id)
        
        # Simulate search delay
        await asyncio.sleep(2)
        
        # Mock results
        results = [
            {
                "title": f"Clinical research on {search_query}",
                "authors": ["Smith J", "Johnson A"],
                "journal": "New England Journal of Medicine",
                "year": 2023,
                "pmid": "12345678",
                "abstract": f"This study examines {search_query} in clinical settings..."
            }
        ]
        
        await websocket_manager.send_personal_message({
            "type": "literature_search_results",
            "results": results,
            "total_found": len(results),
            "search_query": search_query
        }, client_id)
        
    except Exception as e:
        logger.error("Error in literature search", error=str(e), client_id=client_id)
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": "Error searching literature"
        }, client_id)


@app.get("/")
@limiter.limit("30/minute")
async def root(request: Request):
    """Health check endpoint with basic system info"""
    uptime = time.time() - startup_time
    return {
        "status": "healthy", 
        "message": "Clinical Decision Support System is running",
        "version": "1.2.0",
        "uptime_seconds": round(uptime, 2),
        "environment": "production" if not settings.DEBUG else "development"
    }

@app.get("/health")
@limiter.limit("60/minute")
async def health_check(request: Request):
    """Comprehensive health check with detailed service status"""
    try:
        if monitoring_service:
            health_status = await monitoring_service.get_health_status()
        else:
            health_status = {
                "status": "healthy",
                "services": {
                    "rag_service": rag_service is not None,
                    "websocket_manager": websocket_manager is not None,
                    "redis": redis_client is not None,
                    "security": security_service is not None,
                    "monitoring": monitoring_service is not None
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        
        # Add system metrics
        memory = psutil.virtual_memory()
        health_status.update({
            "system": {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_percent": memory.percent,
                "memory_available_mb": memory.available // (1024 * 1024),
                "disk_usage_percent": psutil.disk_usage('/').percent,
                "load_average": os.getloadavg() if hasattr(os, 'getloadavg') else None
            },
            "application": {
                "active_websockets": len(websocket_manager.active_connections),
                "uptime_seconds": round(time.time() - startup_time, 2),
                "shutdown_requested": shutdown_requested
            }
        })
        
        return health_status
        
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": "Health check failed",
                "timestamp": datetime.utcnow().isoformat()
            }
        )

@app.get("/metrics")
async def metrics_endpoint(request: Request):
    """Prometheus metrics endpoint"""
    return Response(
        generate_latest(REGISTRY),
        media_type=CONTENT_TYPE_LATEST
    )

@app.get("/info")
@limiter.limit("10/minute")
async def system_info(request: Request):
    """System information endpoint"""
    return {
        "name": "Clinical Decision Support System",
        "version": "1.2.0",
        "description": "Real-time RAG-based Clinical Decision Support using PubMedBERT",
        "features": [
            "PubMedBERT integration",
            "Real-time literature search",
            "Vector database semantic search",
            "WebSocket real-time communication",
            "Comprehensive security",
            "Production monitoring"
        ],
        "endpoints": {
            "health": "/health",
            "metrics": "/metrics",
            "api_docs": "/api/docs" if settings.DEBUG else None,
            "websocket": "/ws/{client_id}",
            "api_base": "/api/v1"
        },
        "startup_time": datetime.fromtimestamp(startup_time).isoformat(),
        "environment": {
            "debug": settings.DEBUG,
            "cors_enabled": bool(settings.ALLOWED_ORIGINS),
            "rate_limiting": True,
            "monitoring": monitoring_service is not None
        }
    }

@app.get("/status")
@limiter.limit("20/minute") 
async def service_status(request: Request):
    """Quick service status check"""
    services = {}
    
    # Check each service
    try:
        services["rag_service"] = "healthy" if rag_service else "unavailable"
    except Exception:
        services["rag_service"] = "error"
    
    try:
        if redis_client:
            await redis_client.ping()
            services["redis"] = "healthy"
        else:
            services["redis"] = "unavailable"
    except Exception:
        services["redis"] = "error"
    
    services["websocket"] = "healthy" if websocket_manager else "unavailable"
    services["security"] = "healthy" if security_service else "unavailable"
    services["monitoring"] = "healthy" if monitoring_service else "unavailable"
    
    # Overall status
    unhealthy_services = [k for k, v in services.items() if v != "healthy"]
    overall_status = "healthy" if not unhealthy_services else "degraded"
    
    return {
        "status": overall_status,
        "services": services,
        "unhealthy_services": unhealthy_services,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.on_event("startup")
async def startup_event():
    """Additional startup tasks"""
    logger.info("CDSS application startup completed")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    global shutdown_requested
    shutdown_requested = True
    logger.info("CDSS application shutdown initiated")

# Global exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with structured logging"""
    logger.warning("HTTP exception occurred", 
                  status_code=exc.status_code,
                  detail=exc.detail,
                  path=request.url.path,
                  method=request.method,
                  client_ip=request.client.host if request.client else "unknown")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "path": request.url.path,
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": getattr(request.state, 'request_id', None)
        }
    )

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded"""
    rate_limit_hits.labels(endpoint=request.url.path).inc()
    
    logger.warning("Rate limit exceeded",
                  path=request.url.path,
                  client_ip=request.client.host if request.client else "unknown",
                  limit=str(exc.detail))
    
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded",
            "retry_after": 60,
            "path": request.url.path,
            "timestamp": datetime.utcnow().isoformat()
        },
        headers={"Retry-After": "60"}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler with comprehensive logging"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    logger.error("Unhandled exception occurred",
                error=str(exc),
                error_type=type(exc).__name__,
                request_id=request_id,
                path=request.url.path,
                method=request.method,
                client_ip=request.client.host if request.client else "unknown",
                traceback=traceback.format_exc())
    
    if monitoring_service:
        monitoring_service.record_error(type(exc).__name__, "global_handler")
    
    # Don't expose internal error details in production
    error_detail = str(exc) if settings.DEBUG else "Internal server error"
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": error_detail,
            "error_type": type(exc).__name__ if settings.DEBUG else "InternalError",
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

# Signal handlers for graceful shutdown
def signal_handler(signum, frame):
    """Handle shutdown signals"""
    global shutdown_requested
    logger.info(f"Received signal {signum}, initiating shutdown...")
    shutdown_requested = True

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == "__main__":
    # Production server configuration
    server_config = {
        "host": settings.HOST or "0.0.0.0",
        "port": settings.PORT or 8000,
        "reload": settings.DEBUG,
        "log_level": "info",
        "access_log": True,
        "server_header": False,
        "date_header": False
    }
    
    # SSL configuration for production
    if not settings.DEBUG and hasattr(settings, 'SSL_CERT_PATH') and hasattr(settings, 'SSL_KEY_PATH'):
        if Path(settings.SSL_CERT_PATH).exists() and Path(settings.SSL_KEY_PATH).exists():
            server_config.update({
                "ssl_certfile": settings.SSL_CERT_PATH,
                "ssl_keyfile": settings.SSL_KEY_PATH
            })
            logger.info("SSL certificates configured")
    
    logger.info("Starting CDSS server", config=server_config)
    
    uvicorn.run("main:app", **server_config)