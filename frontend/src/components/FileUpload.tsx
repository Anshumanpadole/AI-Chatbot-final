'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface FileUploadProps {
  onUploadSuccess: (data: { documentId: string; tokenCount: number; processingMode: 'prompt' | 'rag'; filename: string }) => void;
  onUploadStart: () => void;
}

export default function FileUpload({ onUploadSuccess, onUploadStart }: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [docInfo, setDocInfo] = useState<{ filename: string; tokenCount: number; processingMode: 'prompt' | 'rag' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      setStatus('error');
      setErrorMsg('Unsupported file type. Only PDF and DOCX files are allowed.');
      return;
    }

    onUploadStart();
    setStatus('uploading');
    setErrorMsg('');
    setDocInfo(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to upload document.');
      }

      const data = await response.json();
      setStatus('success');
      setDocInfo({
        filename: file.name,
        tokenCount: data.tokenCount,
        processingMode: data.processingMode,
      });
      onUploadSuccess({
        documentId: data.documentId,
        tokenCount: data.tokenCount,
        processingMode: data.processingMode,
        filename: file.name,
      });
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'An error occurred during upload.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`glass-panel glass-panel-hover cursor-pointer p-8 rounded-2xl border-2 border-dashed text-center flex flex-col items-center justify-center min-h-[200px] transition-all duration-300 ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileInput}
          className="hidden"
        />

        {status === 'idle' && (
          <>
            <div className="p-4 rounded-full bg-zinc-800/80 text-zinc-400 mb-4 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-indigo-400 animate-bounce" />
            </div>
            <p className="text-zinc-200 font-medium mb-1">
              Drag & drop document here, or <span className="text-indigo-400 font-semibold underline decoration-2 decoration-indigo-400/30 hover:decoration-indigo-400">browse</span>
            </p>
            <p className="text-zinc-500 text-xs mt-1">Supports PDF & DOCX formats</p>
          </>
        )}

        {status === 'uploading' && (
          <div className="flex flex-col items-center">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <p className="text-zinc-200 font-medium animate-pulse">Parsing document & analyzing tokens...</p>
            <p className="text-zinc-500 text-xs mt-1">Generating vectors if document exceeds 3k tokens</p>
          </div>
        )}

        {status === 'success' && docInfo && (
          <div className="flex flex-col items-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-4" />
            <p className="text-zinc-200 font-semibold mb-2">{docInfo.filename}</p>
            
            <div className="flex items-center gap-3 mt-1">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                {docInfo.tokenCount.toLocaleString()} Tokens
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                docInfo.processingMode === 'prompt' 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              }`}>
                Mode: {docInfo.processingMode === 'prompt' ? 'Simple Prompting' : 'RAG Pipeline'}
              </span>
            </div>
            <p className="text-zinc-500 text-xs mt-4 hover:underline">Click or drop another file to replace</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
            <p className="text-zinc-200 font-medium mb-1">Failed to upload file</p>
            <p className="text-red-400/90 text-sm max-w-sm">{errorMsg}</p>
            <button
              onClick={triggerFileInput}
              className="mt-4 px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
