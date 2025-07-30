#!/usr/bin/env python3
"""
FastAPI server for multi-model LLM service.
"""

import asyncio
import argparse
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import uvicorn
import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))

    from model_manager.service import get_model_service, initialize_service
    from routing.query_router import QueryRouter
    from query_classifier.embedding_classifier import HybridEmbeddingClassifier
    ML_MODULES_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import ML modules: {e}")
    print("Multi-model features will be limited")
    ML_MODULES_AVAILABLE = False

    # Create fallback functions
    def get_model_service():
        return None

    def initialize_service():
        return None

    class QueryRouter:
        pass

    class HybridEmbeddingClassifier:
        pass

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global model_service
    try:
        logger.info("Initializing model service...")
        if ML_MODULES_AVAILABLE:
            model_service = initialize_service()
            if model_service:
                model_service.start_service()
            logger.info("Model service started successfully")
        else:
            logger.warning("ML modules not available, using fallback mode")
            model_service = None
    except Exception as e:
        logger.error(f"Failed to initialize model service: {e}")
        model_service = None

    yield

    # Shutdown
    if model_service:
        logger.info("Shutting down model service...")
        try:
            model_service.stop_service()
        except:
            pass

app = FastAPI(title="Multi-Model LLM Service", version="1.0.0", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global service instance
model_service = None

class QueryRequest(BaseModel):
    query: str
    user_context: Optional[Dict[str, Any]] = None
    max_length: Optional[int] = 150
    temperature: Optional[float] = 0.7

class QueryResponse(BaseModel):
    response: str
    model_used: str
    confidence: float
    reasoning: str
    processing_time: float
    fallback_used: bool = False

class HealthResponse(BaseModel):
    status: str
    service_running: bool
    models_loaded: int
    uptime_seconds: float

# Startup and shutdown now handled by lifespan context manager

@app.get("/health", response_model=HealthResponse)
async def health_check():
    if not model_service:
        raise HTTPException(status_code=503, detail="Model service not available")
    
    status = model_service.get_service_status()
    
    return HealthResponse(
        status="healthy" if status["service_running"] else "unhealthy",
        service_running=status["service_running"],
        models_loaded=status["registered_models"],
        uptime_seconds=status["uptime_seconds"]
    )

@app.post("/query", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    if not model_service:
        raise HTTPException(status_code=503, detail="Model service not available")
    
    try:
        result = model_service.process_query(
            query=request.query,
            user_context=request.user_context
        )
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return QueryResponse(
            response=result["response"],
            model_used=result["model_used"],
            confidence=result["confidence"],
            reasoning=result["reasoning"],
            processing_time=result["processing_time"],
            fallback_used=result.get("fallback_used", False)
        )
        
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models/status")
async def get_model_status():
    if not model_service:
        raise HTTPException(status_code=503, detail="Model service not available")
    
    return model_service.get_service_status()

@app.post("/models/{subject}/load")
async def load_model(subject: str):
    if not model_service:
        raise HTTPException(status_code=503, detail="Model service not available")
    
    # This would trigger model loading
    # Implementation depends on the model service API
    return {"message": f"Model loading requested for {subject}"}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8001, help="Port to run the server on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to run the server on")
    args = parser.parse_args()
    
    print(f"Starting Multi-Model LLM Service on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
