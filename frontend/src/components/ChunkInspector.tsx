'use client';

import React from 'react';
import { Eye, ShieldAlert, Sparkles, X } from 'lucide-react';

interface Chunk {
  chunk_index: number;
  text: string;
  score: number;
}

interface ChunkInspectorProps {
  chunks: Chunk[] | null;
  onClose: () => void;
}

export default function ChunkInspector({ chunks, onClose }: ChunkInspectorProps) {
  if (!chunks) return null;

  return (
    <div className="w-full lg:w-96 glass-panel bg-zinc-900/35 border border-zinc-800 rounded-2xl p-6 flex flex-col h-[550px]">
      <div className="flex justify-between items-center pb-4 border-b border-zinc-800 mb-4">
        <div className="flex items-center gap-2 text-indigo-400">
          <Eye className="w-4 h-4" />
          <h3 className="font-semibold text-sm text-zinc-200">Chunk Inspector</h3>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        <p className="text-xs text-zinc-500 mb-3">
          Showing top {chunks.length} text chunks retrieved by FAISS similarity search for the last question:
        </p>

        {chunks.map((chunk, index) => {
          const relevance = (chunk.score * 100).toFixed(1);
          return (
            <div key={index} className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700/80 transition-all">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded">
                  Chunk #{chunk.chunk_index + 1}
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {relevance}% match
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap max-h-36 overflow-y-auto bg-zinc-950/40 p-2.5 rounded border border-zinc-900">
                {chunk.text}
              </p>
            </div>
          );
        })}

        {chunks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
            <ShieldAlert className="w-8 h-8 mb-2" />
            <p className="text-xs font-semibold">No chunks retrieved.</p>
          </div>
        )}
      </div>
    </div>
  );
}
