from sentence_transformers import SentenceTransformer
import numpy as np
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(EmbeddingService, cls).__new__(cls, *args, **kwargs)
            cls._instance.model = None
        return cls._instance

    def get_model(self):
        if self.model is None:
            logger.info("Initializing SentenceTransformer model 'all-MiniLM-L6-v2'...")
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SentenceTransformer model loaded successfully.")
        return self.model

    def get_embeddings(self, texts: list[str]) -> np.ndarray:
        """Generates embedding vectors for a list of texts."""
        try:
            model = self.get_model()
            embeddings = model.encode(texts, convert_to_numpy=True)
            return embeddings
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            raise RuntimeError(f"Failed to generate embeddings: {str(e)}")

# Singleton instance
embedding_service = EmbeddingService()
