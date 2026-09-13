import React from 'react';
import { ScreenType } from '../types';
import { Wifi, Battery, Signal, Code2, Sparkles, Smartphone } from 'lucide-react';

interface PhoneFrameProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  onOpenCodeViewer: () => void;
  children: React.ReactNode;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  currentScreen,
  onNavigate,
  onOpenCodeViewer,
  children,
}) => {
  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A] text-white p-4 sm:p-8 font-sans selection:bg-[#E0E0E0] selection:text-[#121212]">
      {/* Top App Bar / Control Rail */}
      <div className="w-full max-w-5xl mb-6 flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1E1E1E] border border-white/10 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-white flex items-center gap-2 font-sans">
              Vsen.Ai <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1E1E1E] text-[#888] border border-white/5 font-sans font-light uppercase tracking-widest">Kotlin / Jetpack Compose</span>
            </h1>
            <p className="text-xs text-[#888] font-sans font-normal tracking-wide">Native Android AI Architecture Simulation</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#121212] p-1.5 rounded-2xl border border-white/10 font-sans">
          <button
            onClick={onOpenCodeViewer}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1E1E1E] hover:bg-[#2A2A2A] text-xs font-bold text-white transition-all border border-white/5 shadow-sm active:scale-95 font-sans tracking-wide"
          >
            <Code2 className="w-3.5 h-3.5 text-[#E0E0E0]" />
            <span>View Kotlin Source Code</span>
          </button>
        </div>
      </div>

      {/* Main Workplace: Phone Simulator + Side Navigator */}
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 font-sans">
        {/* Step Indicator / Quick Navigation Rail */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto w-full lg:w-48 pb-2 lg:pb-0 font-sans">
          <div className="text-[11px] font-sans font-light uppercase tracking-widest text-[#666] mb-1 hidden lg:block px-2">
            App Screens
          </div>
          {[
            { id: 'welcome', label: '1. Welcome', desc: 'Sleek squircle landing' },
            { id: 'onboarding', label: '2. Onboarding', desc: 'Secure Key Vault' },
            { id: 'main', label: '3. Premium App', desc: 'Frosted Glass Workspace' },
          ].map((item) => {
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as ScreenType)}
                className={`flex flex-col text-left p-3 rounded-2xl transition-all flex-shrink-0 lg:flex-shrink border font-sans ${
                  isActive
                    ? 'bg-[#1E1E1E] border-white/20 text-white shadow-md font-sans'
                    : 'bg-transparent border-transparent text-[#666] hover:text-[#AAA] hover:bg-[#121212] font-sans'
                }`}
              >
                <div className="text-xs font-bold tracking-wide font-sans">{item.label}</div>
                <div className="text-[10px] opacity-70 hidden sm:block mt-0.5 font-sans font-light tracking-wide">{item.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Squircle Phone Frame Container */}
        <div className="relative flex-shrink-0 font-sans">
          {/* Subtle Outer Glow */}
          <div className="absolute -inset-1 bg-gradient-to-b from-white/10 to-transparent rounded-[50px] blur-xl opacity-50 pointer-events-none" />

          {/* Phone Hardware Outer Bezel */}
          <div className="w-[340px] sm:w-[380px] h-[700px] sm:h-[760px] bg-[#121212] rounded-[46px] border-[10px] border-[#222222] relative flex flex-col shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden font-sans">
            {/* Native Mobile Status Bar */}
            <div className="w-full pt-3 pb-2 px-6 flex items-center justify-between text-white/80 select-none z-30 bg-[#121212] font-sans">
              <span className="text-xs font-bold tracking-widest font-sans text-white/90">{formatTime()}</span>
              
              {/* Camera Hole Punch (Samsung One UI / Dynamic Island style) */}
              <div className="w-4 h-4 rounded-full bg-black border border-white/5 mx-auto" />

              <div className="flex items-center gap-1.5 text-white/80">
                <Signal className="w-3.5 h-3.5" />
                <Wifi className="w-3.5 h-3.5" />
                <Battery className="w-4 h-4 rotate-90" />
              </div>
            </div>

            {/* Screen Content Container */}
            <div className="flex-1 flex flex-col overflow-hidden relative bg-[#121212] font-sans">
              {children}
            </div>

            {/* Native Gesture Navigation Pill Bar */}
            <div className="w-full py-2 bg-[#121212] flex items-center justify-center z-30 select-none">
              <div className="w-32 h-1 bg-white/30 rounded-full hover:bg-white/50 transition-colors cursor-pointer" onClick={() => onNavigate('welcome')} />
            </div>
          </div>
        </div>

        {/* Architectural Highlights Info Panel */}
        <div className="w-full lg:w-72 bg-[#121212] rounded-3xl p-6 border border-[#222] flex flex-col justify-between self-stretch font-sans">
          <div>
            <div className="flex items-center gap-2 text-xs font-sans font-light uppercase tracking-widest text-[#888] mb-4">
              <Smartphone className="w-4 h-4 text-[#E0E0E0]" />
              <span>One UI & iOS Specs</span>
            </div>
            
            <ul className="space-y-4 text-xs text-[#AAA] leading-relaxed font-sans font-normal tracking-wide">
              <li className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E0E0E0] mt-1.5 flex-shrink-0" />
                <span><strong className="text-white font-medium">Squircle Geometry:</strong> Standardized 24dp corner radius across all containers.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E0E0E0] mt-1.5 flex-shrink-0" />
                <span><strong className="text-white font-medium">Deep Slate Palette:</strong> #121212 base layer with #1E1E1E elevated cards.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E0E0E0] mt-1.5 flex-shrink-0" />
                <span><strong className="text-white font-medium">Local Security:</strong> EncryptedSharedPreferences AES256 simulation.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E0E0E0] mt-1.5 flex-shrink-0" />
                <span><strong className="text-white font-medium">Pill Input Bar:</strong> 999px rounded bottom bar for effortless native ergonomics.</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 text-[10px] text-[#666] flex items-center justify-between font-sans font-light tracking-wider">
            <span>Kotlin v2.1</span>
            <span>Jetpack Compose BOM</span>
          </div>
        </div>
      </div>
    </div>
  );
};
