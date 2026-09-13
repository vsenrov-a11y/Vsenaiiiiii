import React from 'react';

const PearlIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={`relative rounded-full bg-gradient-to-br from-white via-slate-100 to-slate-300 shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.1),inset_2px_2px_6px_rgba(255,255,255,0.9),0_0_15px_rgba(255,255,255,0.2)] ${className}`}>
    <div className="absolute top-[15%] left-[15%] w-[30%] h-[30%] rounded-full bg-white opacity-80 blur-[1px]" />
  </div>
);

interface OrbBadgeProps {
  orbs?: number;
  accountCreatedAt?: number;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showAddButton?: boolean;
  className?: string;
}

export const OrbBadge: React.FC<OrbBadgeProps> = ({
  orbs = 50,
  onClick,
  className = '',
}) => {
  return (
    <div className={`relative inline-flex items-center select-none ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="group relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all cursor-pointer active:scale-95"
      >
        <PearlIcon className="w-4 h-4" />
        <div className="flex items-center gap-1 font-mono font-bold text-xs text-white">
          <span>{orbs}</span>
        </div>
      </button>
    </div>
  );
};
