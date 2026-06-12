import numpy as np
import logging
from typing import Dict, List, Tuple, Any
from backend.services.embedding_service import embedding_service

logger = logging.getLogger(__name__)

# Try importing FAISS; if it fails, use a pure NumPy fallback
try:
    import faiss
    HAS_FAISS = True
    logger.info("FAISS successfully imported and will be used for similarity search.")
except ImportError:
    HAS_FAISS = False
    logger.warning("FAISS could not be imported. Falling back to a high-performance pure NumPy implementation for similarity search.")

class NumPyIndexFallback:
    """A pure NumPy drop-in replacement for faiss.IndexFlatIP."""
    def __init__(self, dimension: int):
        self.dimension = dimension
        self.vectors: List[np.ndarray] = []

    def add(self, vectors: np.ndarray):
        # vectors is expected to be shape (num_chunks, dimension)
        self.vectors.append(vectors)

    def search(self, query_vector: np.ndarray, k: int) -> Tuple[np.ndarray, np.ndarray]:
        """Calculates cosine similarity via dot product (assuming vectors are L2-normalized)."""
        if not self.vectors:
            return np.array([[]]), np.array([[]])
            
        all_vectors = np.vstack(self.vectors)  # shape: (N, D)
        # query_vector shape is (1, D)
        # dot product yields similarity scores: shape (N,)
        scores = np.dot(all_vectors, query_vector.T).squeeze(axis=1)
        
        # In case N < k
        k = min(k, len(scores))
        
        # Get indices of top k elements in descending order
        top_k_indices = np.argsort(scores)[::-1][:k]
        top_k_scores = scores[top_k_indices]
        
        # Reshape to match FAISS output format: (1, k)
        return np.array([top_k_scores]), np.array([top_k_indices])

# Simple in-memory document store
# Structure: { document_id: { "chunks": [str], "index": FAISS/NumPy, "token_count": int, "raw_text": str } }
document_store: Dict[str, Dict[str, Any]] = {}

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Splits a document's text into overlapping chunks of character length."""
    if not text:
        return []
    
    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunks.append(text[start:end])
        # Move forward by chunk_size - overlap
        if end == text_len:
            break
        start += (chunk_size - overlap)
        
    return chunks

def build_faiss_index(document_id: str, chunks: List[str]):
    """Generates embeddings for chunks and builds an in-memory similarity search index."""
    if not chunks:
        logger.warning(f"No chunks provided for document {document_id}")
        return
    
    logger.info(f"Generating embeddings for document: {document_id}")
    embeddings = embedding_service.get_embeddings(chunks)
    
    # L2 normalize embeddings for Cosine Similarity
    # We implement L2 normalization using NumPy so it works with or without FAISS
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    # Prevent division by zero
    norms = np.where(norms == 0, 1e-10, norms)
    normalized_embeddings = embeddings / norms
    
    dimension = normalized_embeddings.shape[1]
    
    if HAS_FAISS:
        index = faiss.IndexFlatIP(dimension)
        index.add(normalized_embeddings)
    else:
        index = NumPyIndexFallback(dimension)
        index.add(normalized_embeddings)
    
    # Store in memory
    if document_id in document_store:
        document_store[document_id]["index"] = index
        document_store[document_id]["chunks"] = chunks
    else:
        document_store[document_id] = {
            "chunks": chunks,
            "index": index,
            "token_count": 0,
            "raw_text": ""
        }
    logger.info(f"Index built successfully with {len(chunks)} chunks.")

def retrieve_top_k(document_id: str, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Retrieves top_k relevant chunks for a query from the index."""
    if document_id not in document_store or "index" not in document_store[document_id]:
        logger.error(f"Document {document_id} or Index not found.")
        return []
    
    store = document_store[document_id]
    index = store["index"]
    chunks = store["chunks"]
    
    if not chunks:
        return []
        
    # Generate query embedding
    query_emb = embedding_service.get_embeddings([query])
    query_norm = np.linalg.norm(query_emb, axis=1, keepdims=True)
    query_norm = np.where(query_norm == 0, 1e-10, query_norm)
    normalized_query_emb = query_emb / query_norm
    
    # Search the index
    k = min(top_k, len(chunks))
    similarities, indices = index.search(normalized_query_emb, k)
    
    results = []
    if len(similarities) > 0 and len(indices) > 0:
        for score, idx in zip(similarities[0], indices[0]):
            if idx < 0 or idx >= len(chunks):
                continue
            results.append({
                "chunk_index": int(idx),
                "text": chunks[idx],
                "score": float(score)
            })
        
    return results
