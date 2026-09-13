import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Edit2, MessageSquare, MapPin, Music, Users, Globe } from 'lucide-react';
import { World } from '../../types';
import { SafeImage } from '../common/SafeImage';

interface WorldDetailScreenProps {
  world: World;
  onClose: () => void;
  onEdit: (worldId: string) => void;
  onEnterChat: (worldId: string) => void;
  theme?: 'dark' | 'light';
}

export const WorldDetailScreen: React.FC<WorldDetailScreenProps> = ({
  world,
  onClose,
  onEdit,
  onEnterChat,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`absolute inset-0 z-50 flex flex-col h-full overflow-hidden ${isLight ? 'bg-[#F8F9FA] text-black' : 'bg-[#0f0f10] text-white'}`}
    >
      <div className="relative w-full h-64 overflow-hidden">
        {world.coverImage ? (
          <SafeImage src={world.coverImage} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${isLight ? 'bg-black/10' : 'bg-white/10'}`}>
            <Globe className="w-16 h-16 opacity-20" />
          </div>
        )}
        <div className={`absolute inset-0 bg-gradient-to-t ${isLight ? 'from-[#F8F9FA]' : 'from-[#0f0f10]'} to-transparent`} />
        
        <button 
          onClick={onClose}
          className={`absolute top-4 left-4 p-2.5 rounded-full transition-colors ${isLight ? 'bg-black/10 hover:bg-black/20' : 'bg-black/40 hover:bg-black/60'} backdrop-blur-sm`}
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>

        <button 
          onClick={() => onEdit(world.id)}
          className={`absolute top-4 right-4 p-2.5 rounded-full transition-colors ${isLight ? 'bg-black/10 hover:bg-black/20' : 'bg-black/40 hover:bg-black/60'} backdrop-blur-sm`}
        >
          <Edit2 className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <h1 className="text-3xl font-black mb-2">{world.name}</h1>
        <p className={`text-lg font-medium mb-6 ${isLight ? 'text-black/70' : 'text-white/70'}`}>{world.tagline}</p>
        
        <div className={`p-4 rounded-2xl mb-8 ${isLight ? 'bg-black/5' : 'bg-white/5'}`}>
          <h3 className={`text-xs uppercase font-bold mb-2 ${isLight ? 'text-black/50' : 'text-white/40'}`}>Description</h3>
          <p className="text-sm leading-relaxed">{world.description}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className={`p-4 rounded-2xl flex flex-col items-center justify-center ${isLight ? 'bg-black/5' : 'bg-white/5'}`}>
            <MapPin className="w-5 h-5 mb-1 opacity-50" />
            <span className="text-lg font-bold">{world.places.length}</span>
            <span className="text-[10px] uppercase font-bold opacity-50">Places</span>
          </div>
          <div className={`p-4 rounded-2xl flex flex-col items-center justify-center ${isLight ? 'bg-black/5' : 'bg-white/5'}`}>
            <Music className="w-5 h-5 mb-1 opacity-50" />
            <span className="text-lg font-bold">{world.ambientSounds.length}</span>
            <span className="text-[10px] uppercase font-bold opacity-50">Sounds</span>
          </div>
          <div className={`p-4 rounded-2xl flex flex-col items-center justify-center ${isLight ? 'bg-black/5' : 'bg-white/5'}`}>
            <Users className="w-5 h-5 mb-1 opacity-50" />
            <span className="text-lg font-bold">{world.linkedCharacterIds?.length || 0}</span>
            <span className="text-[10px] uppercase font-bold opacity-50">Chars</span>
          </div>
        </div>
      </div>

      <div className={`p-6 border-t ${isLight ? 'bg-[#F8F9FA] border-black/5' : 'bg-[#0f0f10] border-white/5'}`}>
        <button 
          onClick={() => onEnterChat(world.id)}
          className={`w-full py-4 rounded-[28px] font-bold text-[16px] flex items-center justify-center gap-2 transition-all hover:opacity-90 ${
            isLight ? 'bg-[#2C2C2E] text-white' : 'bg-accent text-black'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          Enter World
        </button>
      </div>
    </motion.div>
  );
};
