'use client';

import React, { useState } from 'react';
import { FileText, Shield, Trash2, Cpu, HelpCircle } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import ChatBox from '@/components/ChatBox';
import ChunkInspector from '@/components/ChunkInspector';
import ThemeToggle from '@/components/ThemeToggle';

interface DocData {
  documentId: string;
  tokenCount: number;
  processingMode: 'prompt' | 'rag';
  filename: string;
}

interface Chunk {
  chunk_index: number;
  text: string;
  score: number;
}

export default function Home() {
  const [doc, setDoc] = useState<DocData | null>(null);
  const [activeChunks, setActiveChunks] = useState<Chunk[] | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadSuccess = (data: DocData) => {
    setDoc(data);
    setIsUploading(false);
  };

  const handleUploadStart = () => {
    setIsUploading(true);
    setDoc(null);
    setActiveChunks(null);
  };

  const handleClear = () => {
    setDoc(null);
    setActiveChunks(null);
  };

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-between">
      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-900 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              AuraDoc Q&A <span className="text-xs font-normal text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Groq LPU Engine</span>
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Context-Aware AI Document Intelligence Server</p>
          </div>
        </div>

        {/* Global Controls & Stats */}
        <div className="flex items-center gap-3">
          {doc && (
            <div className="flex items-center gap-4 bg-zinc-100/80 dark:bg-zinc-900/60 p-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span className="font-semibold text-zinc-800 dark:text-zinc-300 truncate max-w-[150px]">{doc.filename}</span>
              </div>
              <button
                onClick={handleClear}
                className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition"
                title="Clear current document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col justify-center items-center">
        {!doc ? (
          <div className="w-full flex flex-col items-center justify-center py-12 space-y-6">
            <div className="text-center max-w-xl mb-4">
              <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 tracking-tight sm:text-4xl mb-4">
                Chat with Any Document, Instantly.
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
                Upload a PDF or DOCX file. AuraDoc parses the content, counts the tokens, and intelligently decides between direct prompts or custom RAG vectors.
              </p>
            </div>
            
            <FileUpload onUploadSuccess={handleUploadSuccess} onUploadStart={handleUploadStart} />

            {/* Pipeline info cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-900">
              <div className="p-4 rounded-xl bg-zinc-100/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-900">
                <h3 className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider mb-1">Simple Prompting Pipeline</h3>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-500 leading-relaxed">
                  Documents &lt; 3,000 tokens are loaded directly into context for 100% accurate, low-latency recall.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-100/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-900">
                <h3 className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1">RAG Similarity Search</h3>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-500 leading-relaxed">
                  Larger documents are split into overlapping chunks, vectorized, and indexed in-memory using FAISS cosine similarity.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col lg:flex-row gap-6 items-stretch">
            {/* Chat Pane */}
            <div className="flex-1 min-w-0">
              <ChatBox documentId={doc.documentId} onSelectChunks={setActiveChunks} />
            </div>

            {/* Expandable Debug Inspector */}
            {activeChunks && (
              <div className="shrink-0">
                <ChunkInspector chunks={activeChunks} onClose={() => setActiveChunks(null)} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-900/60 text-center flex flex-col sm:flex-row justify-between items-center gap-2 text-zinc-500 dark:text-zinc-600 text-xs">
        <p>© 2026 AuraDoc AI. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-zinc-800 dark:hover:text-zinc-400 transition">GitHub</a>
          <a href="#" className="hover:text-zinc-800 dark:hover:text-zinc-400 transition">FastAPI Docs</a>
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-500/80" /> Fully Encrypted In-Memory Storage
          </span>
        </div>
      </footer>
    </main>
  );
}
