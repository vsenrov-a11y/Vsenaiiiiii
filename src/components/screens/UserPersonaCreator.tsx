import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Info, Plus, Image as ImageIcon, Check } from 'lucide-react';
import { Persona } from '../../types';
import { ImageCropModal } from '../ImageCropModal';
import { storeAsset, useAsset } from '../../utils/fileDb';
import { SafeImage } from '../common/SafeImage';

interface UserPersonaCreatorProps {
  isLight: boolean;
  onClose: () => void;
  onSave: (persona: any) => void;
  initialData?: any | null;
}

export function UserPersonaCreator({ isLight, onClose, onSave, initialData }: UserPersonaCreatorProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [avatar, setAvatar] = useState(initialData?.avatar || '');
  const resolvedAvatar = useAsset(avatar);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [description, setDescription] = useState(initialData?.description || '');
  const [isDefault, setIsDefault] = useState(initialData?.isDefault || false);
  const [likes, setLikes] = useState(initialData?.likes || '');
  const [dislikes, setDislikes] = useState(initialData?.dislikes || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressAndGetBase64 = (file: File, maxWidth = 800, maxHeight = 800): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = () => {
          resolve(event.target?.result as string);
        };
      };
      reader.onerror = () => {
        resolve('');
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCropSrc(event.target.result as string);
          setIsCropOpen(true);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleCropComplete = async (croppedBase64: string) => {
    try {
      const assetId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const dbRef = await storeAsset(assetId, croppedBase64);
      setAvatar(dbRef);
    } catch (e) {
      setAvatar(croppedBase64);
    }
    setIsCropOpen(false);
    setCropSrc(null);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initialData?.id || `user-persona-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      avatar: avatar,
      isDefault: isDefault,
      likes: likes.trim(),
      dislikes: dislikes.trim(),
      updatedAt: Date.now(),
    });
  };

  const handleAppendDesc = (text: string) => {
    const newDesc = description ? `${description}\n${text}: ` : `${text}: `;
    setDescription(newDesc);
  };

  return (
    <div className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden animate-fadeIn ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
      <AnimatePresence>
        {isCropOpen && cropSrc && (
          <ImageCropModal
            isOpen={isCropOpen}
            imageSrc={cropSrc}
            isLight={isLight}
            onClose={() => setIsCropOpen(false)}
            onCrop={handleCropComplete}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-center relative border-b ${isLight ? 'text-black border-black/5' : 'text-white border-white/5'}`}>
        <button onClick={onClose} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-[16px] font-semibold">Persona</h2>
        <button className={`absolute right-4 p-2 -mr-2 rounded-full transition-colors ${isLight ? 'text-black/50 hover:bg-black/5' : 'text-white/50 hover:bg-white/5'}`}>
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24 space-y-6">
        
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`w-[100px] h-[100px] rounded-[1.5rem] flex items-center justify-center overflow-hidden cursor-pointer transition-opacity hover:opacity-90 ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'}`}
            >
              {avatar ? (
                <SafeImage src={avatar} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full mb-1 bg-current opacity-20`} />
                  <div className={`w-14 h-6 rounded-t-full bg-current opacity-20`} />
                </div>
              )}
            </div>
            {/* Pencil Badge */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 ${isLight ? 'bg-white border-[#F8F9FA] text-black' : 'bg-[#1C1C1E] border-[#0f0f10] text-white'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <label className={`text-[12px] font-bold ${isLight ? 'text-black' : 'text-white'}`}>Name</label>
          <div className="relative">
            <input
              type="text"
              value={name || ''}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name your Persona"
              className={`w-full p-3 pb-7 rounded-2xl text-[13px] focus:outline-none ${isLight ? 'bg-black/5 text-black placeholder-black/40' : 'bg-[#1C1C1E] text-white placeholder-white/40'}`}
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className={`text-[12px] font-bold ${isLight ? 'text-black' : 'text-white'}`}>Description</label>
          <div className="relative">
            <textarea
              value={description || ''}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe background details of what you want Characters to remember about you"
              className={`w-full h-[120px] p-3 pb-7 rounded-2xl resize-none text-[13px] focus:outline-none ${isLight ? 'bg-black/5 text-black placeholder-black/40' : 'bg-[#1C1C1E] text-white placeholder-white/40'}`}
            />
          </div>
        </div>

        {/* Quick Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
          {['Gender', 'Appearance', 'Species', 'Age', 'Height'].map(chip => (
            <button
              key={chip}
              onClick={() => handleAppendDesc(chip)}
              className={`whitespace-nowrap flex items-center gap-1 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors ${isLight ? 'border-black/10 text-black hover:bg-black/5' : 'border-white/10 text-white hover:bg-white/5'}`}
            >
              <Plus className={`w-3 h-3 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`} />
              {chip}
            </button>
          ))}
        </div>

        {/* Likes */}
        <div className="space-y-2">
          <label className={`text-[12px] font-bold ${isLight ? 'text-black' : 'text-white'}`}>Likes</label>
          <div className="relative">
            <textarea
              value={likes || ''}
              onChange={(e) => setLikes(e.target.value)}
              placeholder="What does your persona like?"
              className={`w-full h-[80px] p-3 pb-7 rounded-2xl resize-none text-[13px] focus:outline-none ${isLight ? 'bg-black/5 text-black placeholder-black/40' : 'bg-[#1C1C1E] text-white placeholder-white/40'}`}
            />
          </div>
        </div>

        {/* Dislikes */}
        <div className="space-y-2">
          <label className={`text-[12px] font-bold ${isLight ? 'text-black' : 'text-white'}`}>Dislikes</label>
          <div className="relative">
            <textarea
              value={dislikes || ''}
              onChange={(e) => setDislikes(e.target.value)}
              placeholder="What does your persona dislike?"
              className={`w-full h-[80px] p-3 pb-7 rounded-2xl resize-none text-[13px] focus:outline-none ${isLight ? 'bg-black/5 text-black placeholder-black/40' : 'bg-[#1C1C1E] text-white placeholder-white/40'}`}
            />
          </div>
        </div>

        {/* Default for all chats */}
        <div className="flex items-center gap-2 pt-2">
          <button 
            onClick={() => setIsDefault(!isDefault)}
            className={`w-5 h-5 flex items-center justify-center rounded border ${isDefault ? 'bg-black border-black text-white' : (isLight ? 'border-black/20' : 'border-white/20')}`}
          >
            {isDefault && <Check className="w-3 h-3" />}
          </button>
          <span className={`text-[13px] ${isLight ? 'text-black' : 'text-white'}`}>Default for all chats</span>
          <Info className={`w-3.5 h-3.5 ${isLight ? 'text-black/40' : 'text-white/40'}`} />
        </div>

      </div>

      {/* Footer */}
      <div className={`fixed bottom-0 left-0 right-0 p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
        <button 
          onClick={handleSave}
          disabled={!name.trim()}
          className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all
            ${!name.trim()
              ? (isLight ? 'bg-black/5 text-black/30' : 'bg-white/10 text-white/30') 
              : (isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90')}`}
        >
          Save
        </button>
      </div>
    </div>
  );
}
