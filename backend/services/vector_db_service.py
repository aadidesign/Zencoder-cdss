"""
Vector Database Service using ChromaDB for semantic search
"""

import asyncio
from typing import List, Dict, Optional
import hashlib
import json
from datetime import datetime
from loguru import logger

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
import numpy as np

from utils.config import settings


class VectorDBService:
    """Service for vector storage and semantic search"""
    
    def __init__(self):
        self.client: Optional[chromadb.Client] = None
        self.collection = None
        self.embedding_model = None
        self.collection_name = "clinical_papers"
        
    async def initialize(self):
        """Initialize ChromaDB and embedding model"""
        logger.info("Initializing Vector Database...")
        
        try:
            # Initialize ChromaDB client
            self.client = chromadb.PersistentClient(
                path=settings.CHROMA_PERSIST_DIRECTORY,
                settings=ChromaSettings(
                    allow_reset=True,
                    anonymized_telemetry=False
                )
            )
            
            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"description": "Clinical research papers from PubMed"}
            )
            
            # Initialize embedding model
            self.embedding_model = SentenceTransformer(
                settings.SENTENCE_TRANSFORMER_MODEL
            )
            
            logger.info(f"Vector DB initialized with {self.collection.count()} documents")
            
        except Exception as e:
            logger.error(f"Error initializing Vector DB: {e}")
            raise
    
    async def add_documents(self, documents: List[Dict]) -> bool:
        """Add documents to the vector database"""
        
        if not documents:
            return True
        
        try:
            # Filter out documents that already exist
            new_documents = await self._filter_new_documents(documents)
            
            if not new_documents:
                logger.info("No new documents to add")
                return True
            
            logger.info(f"Adding {len(new_documents)} new documents to vector DB")
            
            # Prepare data for ChromaDB
            texts = []
            metadatas = []
            ids = []
            
            for doc in new_documents:
                # Create unique ID
                doc_id = self._generate_doc_id(doc)
                
                # Prepare text for embedding
                text_content = self._prepare_text_for_embedding(doc)
                
                # Prepare metadata (ChromaDB requires string values)
                metadata = {
                    "pmid": str(doc.get("pmid", "")),
                    "title": doc.get("title", "")[:1000],  # Limit length
                    "journal": doc.get("journal", "")[:500],
                    "pub_date": doc.get("pub_date", ""),
                    "source": doc.get("source", "pubmed"),
                    "retrieved_at": doc.get("retrieved_at", datetime.now().isoformat()),
                    "authors": json.dumps(doc.get("authors", [])[:10]),  # Limit authors
                    "keywords": json.dumps(doc.get("keywords", [])[:20]),  # Limit keywords
                    "mesh_terms": json.dumps(doc.get("mesh_terms", [])[:20])  # Limit MeSH terms
                }
                
                texts.append(text_content)
                metadatas.append(metadata)
                ids.append(doc_id)
            
            # Generate embeddings
            embeddings = await self._generate_embeddings(texts)
            
            # Add to ChromaDB
            self.collection.add(
                documents=texts,
                metadatas=metadatas,
                embeddings=embeddings.tolist(),
                ids=ids
            )
            
            logger.info(f"Successfully added {len(new_documents)} documents")
            return True
            
        except Exception as e:
            logger.error(f"Error adding documents to vector DB: {e}")
            return False
    
    async def similarity_search(
        self,
        query: str,
        k: int = 10,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """Perform similarity search"""
        
        try:
            logger.info(f"Performing similarity search for: {query}")
            
            # Generate query embedding
            query_embedding = await self._generate_embeddings([query])
            
            # Prepare where clause for filtering
            where_clause = {}
            if filters:
                # Add date filters, source filters, etc.
                if "min_date" in filters:
                    where_clause["pub_date"] = {"$gte": filters["min_date"]}
            
            # Perform search
            results = self.collection.query(
                query_embeddings=query_embedding.tolist(),
                n_results=min(k, self.collection.count()),
                where=where_clause if where_clause else None,
                include=["documents", "metadatas", "distances"]
            )
            
            # Process results
            documents = []
            if results["documents"] and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    metadata = results["metadatas"][0][i]
                    distance = results["distances"][0][i]
                    
                    # Convert back from ChromaDB format
                    processed_doc = {
                        "pmid": metadata.get("pmid"),
                        "title": metadata.get("title"),
                        "journal": metadata.get("journal"),
                        "pub_date": metadata.get("pub_date"),
                        "source": metadata.get("source"),
                        "content": doc,
                        "score": 1 - distance,  # Convert distance to similarity score
                        "authors": json.loads(metadata.get("authors", "[]")),
                        "keywords": json.loads(metadata.get("keywords", "[]")),
                        "mesh_terms": json.loads(metadata.get("mesh_terms", "[]"))
                    }
                    
                    documents.append(processed_doc)
            
            # Filter by similarity threshold
            filtered_docs = [
                doc for doc in documents
                if doc["score"] >= settings.SIMILARITY_THRESHOLD
            ]
            
            logger.info(f"Found {len(filtered_docs)} relevant documents")
            return filtered_docs
            
        except Exception as e:
            logger.error(f"Error in similarity search: {e}")
            return []
    
    async def _filter_new_documents(self, documents: List[Dict]) -> List[Dict]:
        """Filter out documents that already exist in the database"""
        
        new_documents = []
        existing_ids = set()
        
        # Get existing document IDs in batches
        try:
            # Get all IDs (for small collections)
            if self.collection.count() < 10000:
                all_docs = self.collection.get(include=[])
                existing_ids = set(all_docs["ids"]) if all_docs["ids"] else set()
        except Exception as e:
            logger.warning(f"Could not retrieve existing IDs: {e}")
            # If we can't get existing IDs, assume all documents are new
            existing_ids = set()
        
        # Filter new documents
        for doc in documents:
            doc_id = self._generate_doc_id(doc)
            if doc_id not in existing_ids:
                new_documents.append(doc)
        
        return new_documents
    
    def _generate_doc_id(self, document: Dict) -> str:
        """Generate unique ID for document"""
        # Use PMID if available, otherwise hash content
        pmid = document.get("pmid")
        if pmid:
            return f"pmid_{pmid}"
        
        # Fallback: hash title + abstract
        content = document.get("title", "") + document.get("abstract", "")
        return hashlib.md5(content.encode()).hexdigest()
    
    def _prepare_text_for_embedding(self, document: Dict) -> str:
        """Prepare document text for embedding"""
        parts = []
        
        # Title (weighted higher)
        title = document.get("title", "")
        if title:
            parts.append(f"Title: {title}")
        
        # Abstract
        abstract = document.get("abstract", "")
        if abstract:
            parts.append(f"Abstract: {abstract}")
        
        # Keywords
        keywords = document.get("keywords", [])
        if keywords:
            parts.append(f"Keywords: {', '.join(keywords)}")
        
        # MeSH terms
        mesh_terms = document.get("mesh_terms", [])
        if mesh_terms:
            parts.append(f"MeSH Terms: {', '.join(mesh_terms)}")
        
        return " ".join(parts)
    
    async def _generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for texts"""
        return self.embedding_model.encode(texts, convert_to_numpy=True)
    
    async def get_collection_stats(self) -> Dict:
        """Get collection statistics"""
        try:
            count = self.collection.count()
            return {
                "total_documents": count,
                "collection_name": self.collection_name
            }
        except Exception as e:
            logger.error(f"Error getting collection stats: {e}")
            return {"total_documents": 0, "collection_name": self.collection_name}
    
    async def cleanup(self):
        """Cleanup resources"""
        logger.info("Cleaning up Vector DB...")
        # ChromaDB handles cleanup automatically