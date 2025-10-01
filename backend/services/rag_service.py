"""
RAG Service for Clinical Decision Support
Integrates PubMedBERT, PubMed APIs, and vector search
"""

import asyncio
from typing import Dict, List, Optional, Callable
import json
import numpy as np
from datetime import datetime, timedelta
from loguru import logger

from transformers import AutoTokenizer, AutoModel
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings as ChromaSettings
import torch

from .pubmed_service import PubMedService
from .vector_db_service import VectorDBService
from .clinical_processor import ClinicalProcessor
from utils.config import settings


class RAGService:
    """Real-time RAG service for clinical decision support"""
    
    def __init__(self):
        self.pubmed_service = None
        self.vector_db = None
        self.clinical_processor = None
        self.pubmed_bert_model = None
        self.pubmed_bert_tokenizer = None
        self.sentence_transformer = None
        self.is_initialized = False
        
    async def initialize(self):
        """Initialize all components"""
        logger.info("Initializing RAG Service...")
        
        try:
            # Initialize PubMed service
            self.pubmed_service = PubMedService()
            
            # Initialize Vector DB
            self.vector_db = VectorDBService()
            await self.vector_db.initialize()
            
            # Initialize Clinical Processor
            self.clinical_processor = ClinicalProcessor()
            
            # Load PubMedBERT model
            logger.info("Loading PubMedBERT model...")
            self.pubmed_bert_tokenizer = AutoTokenizer.from_pretrained(
                settings.PUBMED_BERT_MODEL
            )
            self.pubmed_bert_model = AutoModel.from_pretrained(
                settings.PUBMED_BERT_MODEL
            )
            
            # Load Sentence Transformer for embeddings
            logger.info("Loading Sentence Transformer model...")
            self.sentence_transformer = SentenceTransformer(
                settings.SENTENCE_TRANSFORMER_MODEL
            )
            
            self.is_initialized = True
            logger.info("RAG Service initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing RAG Service: {e}")
            raise
    
    async def process_query(
        self,
        query: str,
        patient_context: Dict = None,
        websocket_callback: Optional[Callable] = None
    ) -> Dict:
        """Process a clinical query with real-time updates"""
        
        if not self.is_initialized:
            raise RuntimeError("RAG Service not initialized")
        
        logger.info(f"Processing clinical query: {query}")
        
        try:
            # Step 1: Extract clinical entities and expand query
            if websocket_callback:
                await websocket_callback({
                    "type": "processing_step",
                    "step": "extracting_entities",
                    "message": "Extracting clinical entities..."
                })
            
            expanded_query = await self.clinical_processor.expand_clinical_query(
                query, patient_context
            )
            
            # Step 2: Search recent PubMed literature
            if websocket_callback:
                await websocket_callback({
                    "type": "processing_step", 
                    "step": "searching_pubmed",
                    "message": "Searching PubMed database..."
                })
            
            pubmed_results = await self.pubmed_service.search_recent_papers(
                expanded_query.search_terms,
                limit=settings.PUBMED_FETCH_LIMIT
            )
            
            # Step 3: Process and embed new papers
            if pubmed_results:
                if websocket_callback:
                    await websocket_callback({
                        "type": "processing_step",
                        "step": "processing_papers", 
                        "message": f"Processing {len(pubmed_results)} research papers..."
                    })
                
                await self.vector_db.add_documents(pubmed_results)
            
            # Step 4: Perform semantic search
            if websocket_callback:
                await websocket_callback({
                    "type": "processing_step",
                    "step": "semantic_search",
                    "message": "Performing semantic search..."
                })
            
            relevant_docs = await self.vector_db.similarity_search(
                query=expanded_query.enhanced_query,
                k=settings.MAX_SEARCH_RESULTS,
                filters=expanded_query.filters
            )
            
            # Step 5: Generate clinical recommendations
            if websocket_callback:
                await websocket_callback({
                    "type": "processing_step",
                    "step": "generating_recommendations",
                    "message": "Generating clinical recommendations..."
                })
            
            recommendations = await self.clinical_processor.generate_recommendations(
                query=query,
                patient_context=patient_context,
                relevant_documents=relevant_docs,
                model=self.pubmed_bert_model,
                tokenizer=self.pubmed_bert_tokenizer
            )
            
            # Compile final response
            response = {
                "query": query,
                "timestamp": datetime.now().isoformat(),
                "recommendations": recommendations,
                "sources": [
                    {
                        "pmid": doc.get("pmid"),
                        "title": doc.get("title"),
                        "authors": doc.get("authors"),
                        "journal": doc.get("journal"),
                        "pub_date": doc.get("pub_date"),
                        "relevance_score": doc.get("score", 0),
                        "url": f"https://pubmed.ncbi.nlm.nih.gov/{doc.get('pmid')}/"
                    }
                    for doc in relevant_docs[:5]  # Top 5 sources
                ],
                "processing_time": recommendations.get("processing_time", 0),
                "confidence_score": recommendations.get("confidence_score", 0)
            }
            
            logger.info("Query processed successfully")
            return response
            
        except Exception as e:
            logger.error(f"Error processing query: {e}")
            return {
                "query": query,
                "timestamp": datetime.now().isoformat(),
                "error": "Failed to process clinical query",
                "details": str(e)
            }
    
    async def get_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for texts using sentence transformer"""
        return self.sentence_transformer.encode(texts)
    
    async def cleanup(self):
        """Cleanup resources"""
        logger.info("Cleaning up RAG Service...")
        if self.vector_db:
            await self.vector_db.cleanup()
        self.is_initialized = False