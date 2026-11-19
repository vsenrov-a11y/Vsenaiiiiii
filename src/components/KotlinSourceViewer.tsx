import React, { useState } from 'react';
import { KOTLIN_FILES } from '../data/kotlinCode';
import { FLUTTER_FILES } from '../data/flutterCode';
import { X, Copy, Check, FileCode2, Terminal, Layers, Smartphone } from 'lucide-react';

interface KotlinSourceViewerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'flutter' | 'kotlin';
}

export const KotlinSourceViewer: React.FC<KotlinSourceViewerProps> = ({ isOpen, onClose, defaultTab = 'flutter' }) => {
  const [activeFramework, setActiveFramework] = useState<'flutter' | 'kotlin'>(defaultTab);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentFiles = activeFramework === 'flutter' ? FLUTTER_FILES : KOTLIN_FILES;
  const activeFile = currentFiles[activeFileIdx] || currentFiles[0];

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-[#0A0A0A]/95 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-5xl h-[85vh] bg-[#121212] rounded-[32px] border border-white/10 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#181818]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1E1E1E] border border-white/5 flex items-center justify-center shadow-lg">
              {activeFramework === 'flutter' ? (
                <Smartphone className="w-5 h-5 text-[#8B5CF6]" />
              ) : (
                <Layers className="w-5 h-5 text-[#E0E0E0]" />
              )}
            </div>
            <div className="font-sans">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide font-sans">
                  {activeFramework === 'flutter' ? 'Flutter & Firebase Production Codebase' : 'Kotlin & Jetpack Compose Core Architecture'}
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  activeFramework === 'flutter' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/10 text-white/80 border border-white/15'
                }`}>
                  {activeFramework === 'flutter' ? 'Flutter v3.19+' : 'Android'}
                </span>
              </div>
              <p className="text-xs text-[#888] font-light tracking-wide mt-0.5">
                {activeFramework === 'flutter'
                  ? 'Cloud Firestore subcollection streaming, unlimited offline cache & secure storage'
                  : 'Native source files compiled for Vsen.Ai on Android'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Framework Switcher */}
            <div className="flex items-center bg-[#141414] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => {
                  setActiveFramework('flutter');
                  setActiveFileIdx(0);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeFramework === 'flutter'
                    ? 'bg-[#8B5CF6] text-white shadow-sm'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                Flutter (Dart)
              </button>
              <button
                onClick={() => {
                  setActiveFramework('kotlin');
                  setActiveFileIdx(0);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeFramework === 'kotlin'
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                Kotlin
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-white/5 text-[#AAA] hover:text-white transition-all active:scale-95"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Content layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden font-sans">
          {/* File Sidebar */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 p-4 space-y-2 overflow-y-auto bg-[#141414] font-sans">
            <div className="text-[10px] font-sans font-light uppercase tracking-widest text-[#666] mb-3 px-2">
              Source Directory
            </div>
            {currentFiles.map((file, idx) => {
              const isActive = idx === activeFileIdx;
              return (
                <button
                  key={file.name}
                  onClick={() => setActiveFileIdx(idx)}
                  className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-left transition-all font-sans ${
                    isActive
                      ? 'bg-[#1E1E1E] text-white border border-white/15 shadow-sm font-sans'
                      : 'bg-transparent text-[#888] hover:text-[#CCC] hover:bg-white/5 border border-transparent font-sans'
                  }`}
                >
                  <FileCode2 className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#E0E0E0]' : 'text-[#666]'}`} />
                  <div className="truncate font-sans">
                    <div className="text-xs font-semibold font-sans">{file.name}</div>
                    <div className="text-[9px] opacity-70 truncate font-sans font-light tracking-wider">{file.path.split('/').slice(-2).join('/')}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Code panel */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0F0F0F] font-sans">
            {/* File Info Bar */}
            <div className="p-4 bg-[#141414]/80 border-b border-white/5 flex items-center justify-between font-sans">
              <div className="flex items-center gap-2 min-w-0 font-sans">
                <Terminal className="w-3.5 h-3.5 text-[#888] flex-shrink-0" />
                <span className="text-xs text-[#AAA] font-sans font-light tracking-wide truncate">{activeFile.path}</span>
              </div>

              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-white/5 text-xs font-bold text-white tracking-wide transition-all active:scale-95 font-sans"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#AAA]" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Description Card */}
            <div className="p-4 bg-[#1A1A1A]/40 border-b border-white/5 font-sans">
              <p className="text-xs text-[#AAA] leading-relaxed font-sans font-normal tracking-wide">
                <strong className="text-white font-medium">Description:</strong> {activeFile.description}
              </p>
            </div>

            {/* Code Highlight Box */}
            <div className="flex-1 overflow-auto p-5 font-mono text-[11px] sm:text-xs leading-relaxed text-[#DDD] bg-[#0A0A0A]">
              <pre className="whitespace-pre overflow-x-auto selection:bg-[#E0E0E0]/20">{activeFile.code}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
