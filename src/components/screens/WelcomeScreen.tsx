import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface WelcomeScreenProps {
  theme: 'dark' | 'light';
  onSetUp: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  theme,
  onSetUp,
}) => {
  const isLight = theme === 'light';

  return (
    <div className={`flex-1 flex flex-col items-center justify-between p-8 text-center select-none overflow-hidden transition-colors duration-200 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'}`}>
      
      {/* Centered branding details */}
      <div className="w-full flex-1 flex flex-col items-center justify-center">
        <motion.h1 
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
          className={`text-5xl font-extrabold tracking-tight mb-4 font-sans ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}
        >
          Vsen.Ai
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
          className={`text-sm max-w-[280px] mx-auto leading-relaxed font-normal tracking-wide font-sans ${isLight ? 'text-[#1C1C1E]/70' : 'text-white/60'}`}
        >
          Your premium native Android intelligence companion, refined.
        </motion.p>
      </div>

      {/* CTA Button */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="w-full pt-6 pb-2"
      >
        <button
          onClick={onSetUp}
          className={`w-full py-4 rounded-2xl font-bold tracking-wide text-sm transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 font-sans cursor-pointer ${
            isLight 
              ? 'bg-zinc-900 hover:bg-black text-white shadow-[0_4px_20px_rgba(0,0,0,0.12)]' 
              : 'bg-white hover:bg-zinc-200 text-black shadow-[0_4px_20px_rgba(255,255,255,0.05)]'
          }`}
        >
          <span>Set Up App</span>
          <ArrowRight className={`w-4 h-4 ${isLight ? 'text-white' : 'text-black'}`} />
        </button>
      </motion.div>
    </div>
  );
};

