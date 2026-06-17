import os
import uuid
import time
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("document-qa-backend")

# Initialize SlowAPI Rate Limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="AI Document Q&A API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
# Reads allowed origins from ALLOWED_ORIGINS env var (comma-separated).
# Falls back to permissive wildcard if not set (useful for local dev).
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
_allow_origins = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom logging middleware to trace requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"Completed request: {request.method} {request.url.path} - Status: {response.status_code} - Duration: {duration:.4f}s")
    return response

# Import Services after environment load
from backend.services.parser_service import parse_pdf, parse_docx, count_tokens
from backend.services.rag_service import document_store, chunk_text, build_faiss_index
from backend.services.groq_service import answer_document_question

# Request schema for ask API
class AskRequest(BaseModel):
    documentId: str
    question: str
    sessionId: Optional[str] = None

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "model_configured": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "api_key_configured": bool(os.getenv("GROQ_API_KEY"))
    }

@app.post("/upload")
@limiter.limit("20/minute")
async def upload_file(request: Request, file: UploadFile = File(...)):
    """Uploads, parses, counts tokens, and indexes a PDF or DOCX file."""
    filename = file.filename or ""
    extension = os.path.splitext(filename)[1].lower()
    
    if extension not in [".pdf", ".docx"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type '{extension}'. Only PDF and DOCX files are allowed."
        )
        
    try:
        file_bytes = await file.read()
        logger.info(f"Processing uploaded file '{filename}' ({len(file_bytes)} bytes)")
        
        # Parse content based on file type
        if extension == ".pdf":
            raw_text = parse_pdf(file_bytes)
        else:
            raw_text = parse_docx(file_bytes)
            
        if not raw_text.strip():
            raise HTTPException(
                status_code=400,
                detail="The document appears to be empty or contains no readable text."
            )
            
        # Count tokens
        token_count = count_tokens(raw_text)
        logger.info(f"File parsed. Token count: {token_count}")
        
        # Decide processing mode
        processing_mode = "prompt" if token_count < 3000 else "rag"
        document_id = str(uuid.uuid4())
        
        # Store in document_store
        document_store[document_id] = {
            "raw_text": raw_text,
            "token_count": token_count,
            "chunks": []
        }
        
        # If RAG pipeline is needed, split text and index chunks in FAISS
        if processing_mode == "rag":
            chunks = chunk_text(raw_text)
            build_faiss_index(document_id, chunks)
            
        return {
            "documentId": document_id,
            "tokenCount": token_count,
            "processingMode": processing_mode
        }
        
    except ValueError as ve:
        logger.error(f"Validation/parsing error: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Unexpected error processing upload: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@app.post("/ask")
@limiter.limit("60/minute")
async def ask_question(request: Request, body: AskRequest):
    """Asks a question about a parsed document using Prompt or RAG logic."""
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
        
    if body.documentId not in document_store:
        raise HTTPException(
            status_code=404, 
            detail="Document ID not found. Please upload the document first."
        )
        
    try:
        logger.info(f"Answering question for document {body.documentId} using session {body.sessionId}")
        result = answer_document_question(
            document_id=body.documentId,
            question=body.question,
            session_id=body.sessionId
        )
        return result
    except ValueError as ve:
        logger.error(f"Value error answering question: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Unexpected error answering question: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to query AI assistant: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Load settings from environment.
    # Run with: python -m backend.main  (from project root)
    # or:       uvicorn backend.main:app --host 0.0.0.0 --port 8000
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)
