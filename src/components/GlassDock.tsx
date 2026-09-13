import React from 'react';
import { MainTabType } from '../types';
import { Home, MessageSquare, User } from 'lucide-react';

interface GlassDockProps {
  activeTab: MainTabType;
  onTabChange: (tab: MainTabType) => void;
  theme?: 'dark' | 'light';
}

export const GlassDock: React.FC<GlassDockProps> = React.memo(({ activeTab, onTabChange, theme = 'dark' }) => {
  const isLight = theme === 'light';
  
  const tabs = [
    { id: 'personas', icon: Home, label: 'Home' },
    { id: 'history', icon: MessageSquare, label: 'Chats' },
    { id: 'profile', icon: User, label: 'Profile' },
  ] as const;

  return (
    <div className={`absolute bottom-0 left-0 right-0 z-40 py-2 flex justify-center border-t transition-all duration-200 ${
      isLight 
        ? 'bg-white/95 border-black/[0.05] shadow-[0_-4px_16px_rgba(0,0,0,0.03)]' 
        : 'bg-[#121214]/95 border-t border-white/[0.06] shadow-[0_-8px_24px_rgba(0,0,0,0.5)]'
    }`}>
      <div className="w-[85%] max-w-[240px] h-[36px] flex items-center justify-between relative px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="w-14 h-full flex justify-center items-center relative group outline-none active:scale-[0.88] transition-transform duration-150 rounded-2xl cursor-pointer"
              title={tab.label}
              type="button"
            >
              {/* Organic/Squircle Capsule Highlight for active tab */}
              {isActive && (
                <div 
                  className={`absolute inset-0 rounded-2xl animate-scaleIn border transition-all ${
                    isLight 
                      ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]' 
                      : 'bg-accent/10 border-accent/25 shadow-[0_2px_10px_rgba(170,170,170,0.15)]'
                  }`}
                />
              )}

              {/* Icon with scaling & interactive colors */}
              <div className="relative z-10 transition-all duration-300">
                <Icon 
                  className={`w-[16px] h-[16px] transition-all duration-300 ${
                    isActive 
                      ? isLight 
                        ? 'text-black scale-105 drop-shadow-[0_0_6px_rgba(0,0,0,0.1)]'
                        : 'text-accent scale-105 drop-shadow-[0_0_8px_rgba(170,170,170,0.3)]' 
                      : isLight 
                        ? 'text-black/35 group-hover:text-black/65'
                        : 'text-white/40 group-hover:text-white/75'
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
