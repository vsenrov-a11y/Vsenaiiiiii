import React, { useState } from 'react';
import { StorageConfig } from '../../types';
import { saveStorageConfig } from '../../utils/storage';
import { ShieldCheck, KeyRound, ExternalLink, CheckCircle2 } from 'lucide-react';

interface OnboardingScreenProps {
  storageConfig: StorageConfig;
  onContinue: () => void;
  theme?: 'dark' | 'light';
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  storageConfig,
  onContinue,
  theme = 'dark',
}) => {
  const [apiKey, setApiKey] = useState(storageConfig.apiKey || '');
  const [isSaved, setIsSaved] = useState(false);
  const isLight = theme === 'light';

  const handleSaveAndContinue = (e: React.FormEvent) => {
    e.preventDefault();
    saveStorageConfig({ apiKey: apiKey.trim() });
    setIsSaved(true);
    setTimeout(() => {
      onContinue();
    }, 400);
  };

  return (
    <div className={`flex-1 flex flex-col justify-between p-4 overflow-y-auto select-none animate-fadeIn transition-colors duration-200 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'}`}>
      <div className="mt-2 font-sans space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <KeyRound className={`w-5 h-5 ${isLight ? 'text-zinc-800' : 'text-white'}`} />
            <h2 className={`text-2xl font-extrabold tracking-tight font-sans ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Link Companion</h2>
          </div>
          <p className={`text-xs leading-relaxed font-normal tracking-wide ${isLight ? 'text-[#1C1C1E]/65' : 'text-white/50'}`}>
            Connect your Google Gemini account to activate high-fidelity immersive roleplay. Your token is encrypted via AES-256 GCM in your local secure vault.
          </p>
        </div>

        {/* Minimal Bulleted Guide */}
        <div className={`backdrop-blur-lg rounded-2xl p-6 border space-y-5 shadow-lg transition-all ${
          isLight 
            ? 'bg-white border-black/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.03)]' 
            : 'bg-white/[0.03] border-white/[0.08]'
        }`}>
          <div className={`text-[10px] font-sans font-bold uppercase tracking-widest ${isLight ? 'text-black/45' : 'text-white/44'}`}>
            Quick Setup Guide
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-sans font-bold flex-shrink-0 mt-0.5 border ${
                isLight 
                  ? 'bg-zinc-100 border-zinc-200 text-zinc-800' 
                  : 'bg-accent/10 border-accent/20 text-accent'
              }`}>
                1
              </div>
              <div className={`text-xs font-normal tracking-wide leading-relaxed ${isLight ? 'text-[#1C1C1E]/80' : 'text-white/75'}`}>
                Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className={`font-bold underline inline-flex items-center gap-1 transition-colors ${
                  isLight ? 'text-zinc-800 hover:text-black' : 'text-white hover:text-accent'
                }`}>Google AI Studio for API key <ExternalLink className="w-3 h-3 inline" /></a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-sans font-bold flex-shrink-0 mt-0.5 border ${
                isLight 
                  ? 'bg-zinc-100 border-zinc-200 text-zinc-800' 
                  : 'bg-accent/10 border-accent/20 text-accent'
              }`}>
                2
              </div>
              <div className={`text-xs font-normal tracking-wide leading-relaxed ${isLight ? 'text-[#1C1C1E]/80' : 'text-white/75'}`}>
                Create a API key
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-sans font-bold flex-shrink-0 mt-0.5 border ${
                isLight 
                  ? 'bg-zinc-100 border-zinc-200 text-zinc-800' 
                  : 'bg-accent/10 border-accent/20 text-accent'
              }`}>
                3
              </div>
              <div className={`text-xs font-normal tracking-wide leading-relaxed ${isLight ? 'text-[#1C1C1E]/80' : 'text-white/75'}`}>
                Copy the API key code after creating it
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-sans font-bold flex-shrink-0 mt-0.5 border ${
                isLight 
                  ? 'bg-zinc-100 border-zinc-200 text-zinc-800' 
                  : 'bg-accent/10 border-accent/20 text-accent'
              }`}>
                4
              </div>
              <div className={`text-xs font-normal tracking-wide leading-relaxed ${isLight ? 'text-[#1C1C1E]/80' : 'text-white/75'}`}>
                Paste the API key code to the box below
              </div>
            </div>
          </div>
        </div>

        {/* Encrypted Badge Info */}
        <div className={`flex items-center gap-2 text-[10px] backdrop-blur-md px-3.5 py-2.5 rounded-2xl border font-sans font-semibold uppercase tracking-wider shadow-sm transition-all ${
          isLight 
            ? 'text-[#1C1C1E]/65 bg-white border-black/[0.06]' 
            : 'text-white/50 bg-white/[0.02] border-white/[0.06]'
        }`}>
          <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`} />
          <span>Encrypted Vault (AES-256 GCM)</span>
        </div>
      </div>

      {/* Input Form & Action */}
      <form onSubmit={handleSaveAndContinue} className="mt-6 pt-2 font-sans space-y-4">
        <div>
          <label className={`text-[10px] font-sans font-bold uppercase tracking-widest mb-2 block px-1 transition-colors ${isLight ? 'text-black/45' : 'text-white/40'}`}>
            Gemini API Key
          </label>
          
          <div className="relative">
            <input
              type="password"
              value={apiKey || ''}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy... (or leave blank for server default)"
              className={`w-full px-4 py-3 rounded-2xl focus:outline-none transition-all font-sans text-sm sm:text-xs shadow-inner border ${
                isLight 
                  ? 'bg-white border-black/[0.12] text-[#1C1C1E] placeholder:text-[#1C1C1E]/30 focus:border-zinc-800/40' 
                  : 'bg-white/[0.03] backdrop-blur-md border-white/[0.08] text-white placeholder:text-white/20 focus:border-white/30'
              }`}
            />
          </div>
        </div>

        <button
          type="submit"
          className={`w-full py-3.5 rounded-2xl font-bold tracking-wide text-sm transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border-none ${
            isLight 
              ? 'bg-zinc-900 hover:bg-black text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]' 
              : 'bg-white hover:bg-zinc-200 text-black shadow-[0_4px_16px_rgba(255,255,255,0.05)]'
          }`}
        >
          {isSaved ? (
            <>
              <CheckCircle2 className={`w-4 h-4 ${isLight ? 'text-white' : 'text-black'}`} />
              <span className={isLight ? 'text-white' : 'text-black'}>Key Saved Locally!</span>
            </>
          ) : (
            <span>Save & Continue</span>
          )}
        </button>
      </form>
    </div>
  );
};
