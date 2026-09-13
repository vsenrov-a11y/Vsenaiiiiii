import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ChatMessage } from '../types';

interface EditMessageModalProps {
  message: ChatMessage | null;
  onClose: () => void;
  onSave: (newText: string) => void;
}

export const EditMessageModal: React.FC<EditMessageModalProps> = ({
  message,
  onClose,
  onSave,
}) => {
  const [text, setText] = useState(message?.text || '');

  useEffect(() => {
    if (message) {
      setText(message.text || '');
    }
  }, [message]);

  if (!message) return null;

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 font-sans animate-none">
      <div className="bg-[#121214] border border-white/15 rounded-3xl p-5 w-full max-w-md shadow-2xl flex flex-col gap-4 animate-none">
        {/* Top Drag Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <h3 className="text-sm font-bold text-white tracking-wide">Edit message</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Textarea container */}
        <div className="bg-[#18181b] border border-white/15 rounded-2xl p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-white text-xs sm:text-sm focus:outline-none resize-none min-h-[140px] max-h-[300px] font-sans leading-relaxed"
            placeholder="Edit your message..."
          />
        </div>

        {/* Bottom Buttons: Cancel & Save */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white/90 text-xs font-bold transition-all active:scale-98 cursor-pointer border border-white/10 text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(text)}
            className="py-3 rounded-2xl bg-white hover:bg-white/90 text-black text-xs font-bold transition-all active:scale-98 cursor-pointer text-center shadow-lg"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
