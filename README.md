# AI Document Q&A Application (Production-Ready)

An intelligent, full-stack document assistant that enables users to upload PDF and DOCX files and ask natural language questions. The application automatically and dynamically switches between a **Simple Prompting** pipeline (for documents under 3000 tokens) and a **Retrieval-Augmented Generation (RAG)** pipeline (for documents 3000 tokens or larger).

---

## Architecture Overview

```text
               +-----------------------------------+
               |           Next.js UI              |
               +-----------------+-----------------+
                                 |
                                 v
               +-----------------+-----------------+
               |         FastAPI Backend           |
               +-----------------+-----------------+
                                 |
                                 v
               +-----------------+-----------------+
               |         Document Parser           |
               +-----------------+-----------------+
                                 |
                                 v
               +-----------------+-----------------+
               |          Token Counter            |
               +-----------------+-----------------+
                                 |
                     Is Token Count < 3000?
                     /                  \
                   YES                   NO
                   /                       \
                  v                         v
        +---------+---------+     +---------+---------+
        |  Prompt Pipeline  |     | Text Chunking     |
        |  (Passes full text|     | (Size: 1000,      |
        |  to Groq API)     |     |  Overlap: 200)    |
        +---------+---------+     +---------+---------+
                  |                         |
                  v                         v
        +---------+---------+     +---------+---------+
        |   Groq API call   |     | Embedding Gen     |
        | (Direct Prompt)   |     | (all-MiniLM-L6-v2)|
        +---------+---------+     +---------+---------+
                  |                         |
                  v                         v
        +---------+---------+     +---------+---------+
        |  Answer Returned  |     | FAISS Vector DB   |
        +-------------------+     +---------+---------+
                                            |
                                            v
                                  +---------+---------+
                                  | Similarity Search |
                                  | (Retrieve Top 5)  |
                                  +---------+---------+
                                            |
                                            v
                                  +---------+---------+
                                  |   Groq API call   |
                                  |   (RAG Context)   |
                                  +---------+---------+
                                            |
                                            v
                                  +---------+---------+
                                  |  Answer + Citations|
                                  +-------------------+
```

---

## Tech Stack Explanation

### Frontend
- **Next.js 15 (App Router)**: Offers Server-Side Rendering (SSR) capabilities, simplified App Directory structure, and optimal production building.
- **TypeScript**: Ensures type safety across components and API responses.
- **Tailwind CSS**: Fast utility styling with custom animation extensions.
- **shadcn/ui**: Accessible and fully customizable pre-built components.
- **TanStack Query (React Query)**: Caching, automatic refetching, and state synchronization of document upload/queries.
- **React Hook Form & Zod**: Fast, schema-based client-side validation.

### Backend
- **FastAPI**: Exceptionally fast Python web framework built on ASGI standard with automatic OpenAPI schema generation.
- **Uvicorn**: Lightning-fast ASGI web server.
- **PyMuPDF & python-docx**: Production-grade document parsing libraries for processing PDFs and Word files safely.
- **SlowAPI**: Rate limiting mechanism to prevent abuse.

### AI Layer
- **Groq API**: Selected for extreme performance (sub-second token generation times).
- **sentence-transformers (`all-MiniLM-L6-v2`)**: Generates high-quality sentence embeddings in a compact format (384 dimensions), optimized for speed and accuracy.
- **FAISS (Facebook AI Similarity Search)**: Industry-standard index optimized for fast similarity searches in vector spaces. We run FAISS fully in-memory for zero-friction deployment and low latency.

---

## Why Groq?
Groq's **LPU (Language Processing Unit)** technology delivers unprecedented inference speeds (often exceeding 500-800 tokens per second). This reduces the Q&A latency from several seconds (standard Cloud LLM providers) to sub-seconds, enhancing overall UX responsiveness.

---

## Installation & Setup

### Prerequisites
- Node.js (v18.x or newer)
- Python (v3.10 or newer)
- Groq API Key (Sign up at [Groq Console](https://console.groq.com/))

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure Environment Variables
cp .env.example .env
# Open .env and add your GROQ_API_KEY
```

To run the backend:
```bash
python main.py
```
The server will start at `http://localhost:8000`.

### 2. Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Run the dev server
npm run dev
```
The client app will be accessible at `http://localhost:3000`.

---

## API Documentation

### 1. Health Check
- **Endpoint**: `GET /health`
- **Response**:
  ```json
  {
    "status": "healthy",
    "timestamp": 1718178822.45,
    "model_configured": "llama-3.3-70b-versatile",
    "api_key_configured": true
  }
  ```

### 2. Upload Document
- **Endpoint**: `POST /upload`
- **Request**: Multipart Form Data with a `file` field containing a `.pdf` or `.docx` file.
- **Response**:
  ```json
  {
    "documentId": "4a28bbbc-ff1d-4eb4-b9c1-419b1613eb51",
    "tokenCount": 1420,
    "processingMode": "prompt"
  }
  ```

### 3. Ask Question
- **Endpoint**: `POST /ask`
- **Request Body**:
  ```json
  {
    "documentId": "4a28bbbc-ff1d-4eb4-b9c1-419b1613eb51",
    "question": "What is the warranty period?",
    "sessionId": "optional-custom-session-id"
  }
  ```
- **Response**:
  ```json
  {
    "answer": "The warranty period is 2 years from purchase...",
    "method": "prompt",
    "sessionId": "optional-custom-session-id",
    "citations": [
      "Direct Document Prompting (Full Text)"
    ],
    "chunks": []
  }
  ```

---

## Deployment Guide

### Backend (Railway / Render / Fly.io)
1. Set up a Python Web Service.
2. Link the repository.
3. Configure Environment Variables:
   - `GROQ_API_KEY`: Your key
   - `GROQ_MODEL`: `llama-3.3-70b-versatile`
   - `PORT`: `8080` (or leave default)
4. Use Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.

### Frontend (Vercel)
1. Add a new project on Vercel.
2. Configure the Root Directory to `frontend`.
3. Set the build command: `npm run build`.
4. Configure Environment Variables if any (e.g. `NEXT_PUBLIC_API_URL` pointing to backend).
