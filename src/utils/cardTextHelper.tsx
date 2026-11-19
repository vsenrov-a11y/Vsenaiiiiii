import React from 'react';
import { ChatHistory } from '../types';

export const isErrorMessage = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  return (
    lower.startsWith('**error:**') ||
    lower.startsWith('error:') ||
    lower.includes('all attempted api keys') ||
    lower.includes('service temporarily busy') ||
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('api key') ||
    (lower.includes('error') && (lower.includes('code:') || lower.includes('status:') || lower.includes('400') || lower.includes('500') || lower.includes('429')))
  );
};

export const getValidPreviewMessage = (chat: ChatHistory): string => {
  if (chat.messages && Array.isArray(chat.messages) && chat.messages.length > 0) {
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const msg = chat.messages[i];
      if (msg && msg.text && msg.text.trim() !== '' && !isErrorMessage(msg.text)) {
        return msg.text;
      }
    }
  }
  if (chat.lastMessage && chat.lastMessage.trim() !== '' && !isErrorMessage(chat.lastMessage)) {
    return chat.lastMessage;
  }
  return "No conversation history yet...";
};

export const renderCardPreviewText = (content: string, isLight: boolean = false): React.ReactNode => {
  if (!content) return null;

  const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|"[^"]*")/g);

  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2);
          return (
            <span key={idx} className={`font-normal tracking-wide ${isLight ? 'text-black/50' : 'text-white/40'}`}>
              {inner}
            </span>
          );
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          const inner = part.slice(1, -1);
          return (
            <span key={idx} className={`font-normal tracking-wide ${isLight ? 'text-black/50' : 'text-white/40'}`}>
              {inner}
            </span>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          const inner = part.slice(1, -1);
          return (
            <code key={idx} className={`font-mono px-1 rounded text-[10px] ${isLight ? 'bg-black/10 text-black' : 'bg-white/10 text-white'}`}>
              {inner}
            </code>
          );
        }
        if (part.startsWith('"') && part.endsWith('"')) {
          return (
            <span key={idx} className={`font-medium ${isLight ? 'text-black' : 'text-white'}`}>
              {part}
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
};
