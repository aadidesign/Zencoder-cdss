"""
API Routes for Clinical Decision Support System
"""

from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from loguru import logger

from services.rag_service import RAGService
from services.websocket_manager import WebSocketManager


router = APIRouter()


# Pydantic models for request/response
class PatientContext(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    existing_conditions: Optional[List[str]] = []
    current_medications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    vital_signs: Optional[Dict] = {}


class ClinicalQuery(BaseModel):
    query: str
    patient_context: Optional[PatientContext] = None
    include_recent_only: bool = True


class ClinicalResponse(BaseModel):
    query: str
    timestamp: str
    recommendations: Dict
    sources: List[Dict]
    processing_time: float
    confidence_score: float


# Dependency injection
def get_rag_service(request: Request) -> RAGService:
    return request.app.state.rag_service


def get_websocket_manager(request: Request) -> WebSocketManager:
    return request.app.state.websocket_manager


@router.post("/query", response_model=ClinicalResponse)
async def process_clinical_query(
    clinical_query: ClinicalQuery,
    rag_service: RAGService = Depends(get_rag_service)
):
    """Process a clinical query and return recommendations"""
    
    try:
        logger.info(f"Processing API query: {clinical_query.query}")
        
        # Convert patient context to dict
        patient_context_dict = None
        if clinical_query.patient_context:
            patient_context_dict = clinical_query.patient_context.dict()
        
        # Process query
        response = await rag_service.process_query(
            query=clinical_query.query,
            patient_context=patient_context_dict
        )
        
        return ClinicalResponse(**response)
    
    except Exception as e:
        logger.error(f"Error processing clinical query: {e}")
        raise HTTPException(status_code=500, detail="Error processing clinical query")


@router.get("/search/recent")
async def search_recent_papers(
    query: str,
    limit: int = 10,
    days_back: int = 30,
    rag_service: RAGService = Depends(get_rag_service)
):
    """Search for recent papers on a specific topic"""
    
    try:
        # Use PubMed service directly for paper search
        papers = await rag_service.pubmed_service.search_recent_papers(
            search_terms=[query],
            limit=limit,
            days_back=days_back
        )
        
        return {
            "query": query,
            "total_results": len(papers),
            "papers": papers,
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error searching recent papers: {e}")
        raise HTTPException(status_code=500, detail="Error searching recent papers")


@router.get("/vector-db/stats")
async def get_vector_db_stats(
    rag_service: RAGService = Depends(get_rag_service)
):
    """Get vector database statistics"""
    
    try:
        stats = await rag_service.vector_db.get_collection_stats()
        return {
            "vector_db_stats": stats,
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error getting vector DB stats: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving database statistics")


@router.post("/vector-db/add-papers")
async def add_papers_to_vector_db(
    papers: List[Dict],
    rag_service: RAGService = Depends(get_rag_service)
):
    """Add papers to vector database"""
    
    try:
        success = await rag_service.vector_db.add_documents(papers)
        
        return {
            "success": success,
            "papers_added": len(papers) if success else 0,
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error adding papers to vector DB: {e}")
        raise HTTPException(status_code=500, detail="Error adding papers to database")


@router.get("/websocket/stats")
async def get_websocket_stats(
    websocket_manager: WebSocketManager = Depends(get_websocket_manager)
):
    """Get WebSocket connection statistics"""
    
    return {
        "active_connections": websocket_manager.get_active_connections_count(),
        "connected_clients": websocket_manager.get_connected_clients(),
        "timestamp": datetime.now().isoformat()
    }


@router.post("/clinical-entities/extract")
async def extract_clinical_entities(
    text: str,
    rag_service: RAGService = Depends(get_rag_service)
):
    """Extract clinical entities from text"""
    
    try:
        # Use clinical processor to extract entities
        expanded_query = await rag_service.clinical_processor.expand_clinical_query(text)
        
        return {
            "original_text": text,
            "clinical_entities": expanded_query.clinical_entities,
            "enhanced_query": expanded_query.enhanced_query,
            "search_terms": expanded_query.search_terms,
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error extracting clinical entities: {e}")
        raise HTTPException(status_code=500, detail="Error extracting clinical entities")


@router.get("/health/detailed")
async def detailed_health_check(
    rag_service: RAGService = Depends(get_rag_service),
    websocket_manager: WebSocketManager = Depends(get_websocket_manager)
):
    """Detailed health check of all services"""
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "rag_service": {
                "initialized": rag_service.is_initialized,
                "pubmed_service": rag_service.pubmed_service is not None,
                "vector_db": rag_service.vector_db is not None,
                "clinical_processor": rag_service.clinical_processor is not None,
                "models_loaded": all([
                    rag_service.pubmed_bert_model is not None,
                    rag_service.pubmed_bert_tokenizer is not None,
                    rag_service.sentence_transformer is not None
                ])
            },
            "websocket_manager": {
                "active_connections": websocket_manager.get_active_connections_count(),
                "service_available": True
            }
        }
    }
    
    # Check if any critical service is down
    if not rag_service.is_initialized:
        health_status["status"] = "unhealthy"
        health_status["error"] = "RAG service not initialized"
    
    try:
        # Test vector DB
        vector_stats = await rag_service.vector_db.get_collection_stats()
        health_status["services"]["vector_db_stats"] = vector_stats
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["services"]["vector_db_error"] = str(e)
    
    return health_status