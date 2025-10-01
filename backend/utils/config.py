"""
Configuration settings for CDSS
"""

import os
from typing import List
from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # App settings
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
    ]
    
    # PubMed API settings
    PUBMED_API_KEY: str = ""  # Optional, but recommended for higher rate limits
    PUBMED_EMAIL: str = "your-email@example.com"  # Required by NCBI
    
    # Model settings
    PUBMED_BERT_MODEL: str = "microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext"
    SENTENCE_TRANSFORMER_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # Vector Database settings
    VECTOR_DB_PATH: str = "./data/vector_db"
    CHROMA_PERSIST_DIRECTORY: str = "./data/chroma_db"
    
    # Cache settings
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL: int = 3600  # 1 hour
    
    # RAG settings
    MAX_SEARCH_RESULTS: int = 10
    MAX_CONTEXT_LENGTH: int = 4000
    SIMILARITY_THRESHOLD: float = 0.7
    
    # Real-time settings
    PUBMED_FETCH_LIMIT: int = 20
    WEBSOCKET_PING_INTERVAL: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()