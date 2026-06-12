import os
import logging
from typing import List, Dict, Any, Optional
from groq import Groq
from backend.services.rag_service import document_store, retrieve_top_k

logger = logging.getLogger(__name__)

# Simple in-memory session history: { session_id: [ {"role": "user"/"assistant", "content": str} ] }
session_history: Dict[str, List[Dict[str, str]]] = {}

def get_session_history(session_id: str) -> List[Dict[str, str]]:
    if session_id not in session_history:
        session_history[session_id] = []
    return session_history[session_id]

def add_message_to_history(session_id: str, role: str, content: str):
    history = get_session_history(session_id)
    history.append({"role": role, "content": content})
    # Keep last 10 turns to stay within context windows
    if len(history) > 20:
        session_history[session_id] = history[-20:]

def query_groq_api(prompt: str, history: Optional[List[Dict[str, str]]] = None) -> str:
    """Queries the Groq API using the client. Falls back to mock responses if API key is missing."""
    api_key = os.getenv("GROQ_API_KEY")
    model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    
    if not api_key:
        logger.warning("GROQ_API_KEY environment variable is not set. Returning a mock response.")
        return f"[DEMO MODE - No Groq API Key set] Here is a simulated answer to your question based on the document:\n\nBased on the context, the document indicates key topics corresponding to: '{prompt[-100:]}'. Please configure GROQ_API_KEY in `backend/.env` to get live AI answers."
        
    try:
        client = Groq(api_key=api_key)
        
        # Build chat messages
        messages = []
        if history:
            # Append history (excluding system prompt instructions if already formatted)
            messages.extend(history)
            
        messages.append({"role": "user", "content": prompt})
        
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error calling Groq API: {e}")
        return f"Error contacting AI Provider: {str(e)}"

def answer_document_question(
    document_id: str, 
    question: str, 
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """Decides between Simple Prompting and RAG, queries Groq, and updates session history."""
    if document_id not in document_store:
        raise ValueError("Document not found or has been cleared from memory.")
        
    doc_info = document_store[document_id]
    token_count = doc_info.get("token_count", 0)
    raw_text = doc_info.get("raw_text", "")
    
    # Generate/Retrieve session ID for history
    active_session_id = session_id or f"session_{document_id}"
    history = get_session_history(active_session_id)
    
    method = "prompt" if token_count < 3000 else "rag"
    retrieved_chunks = []
    citations = []
    
    if method == "prompt":
        # Simple Prompting Pipeline
        prompt = f"""You are a document assistant.

Answer ONLY from the document.

If information is unavailable, say:
"I couldn't find that information in the document."

DOCUMENT:
{raw_text}

QUESTION:
{question}"""
        
        citations.append("Direct Document Prompting (Full Text)")
    else:
        # RAG Pipeline
        top_chunks = retrieve_top_k(document_id, question, top_k=5)
        retrieved_chunks = top_chunks
        
        context_parts = []
        for i, chunk in enumerate(top_chunks):
            context_parts.append(f"--- Chunk {i+1} (Relevance: {chunk['score']:.4f}) ---\n{chunk['text']}")
            citations.append(f"Chunk #{chunk['chunk_index']+1} (Relevance: {chunk['score']:.2%})")
            
        context_text = "\n\n".join(context_parts)
        
        prompt = f"""You are a document assistant.

Answer ONLY using the retrieved context.

If the answer does not exist in the context,
respond with:

"I couldn't find that information in the document."

CONTEXT:
{context_text}

QUESTION:
{question}"""
        
    # Get response from Groq
    answer = query_groq_api(prompt, history=history)
    
    # Store turn in session history
    add_message_to_history(active_session_id, "user", question)
    add_message_to_history(active_session_id, "assistant", answer)
    
    return {
        "answer": answer,
        "method": method,
        "sessionId": active_session_id,
        "citations": citations,
        "chunks": retrieved_chunks
    }
