import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Camera, Image as ImageIcon, Users, Lock, ChevronLeft, Wifi, Battery, Signal, Send, 
  Heart, MapPin, RefreshCw, Upload, ImagePlus, Settings, Palette, Check, Trash2, Smartphone, 
  FileText, Wallet as WalletIcon, CloudSun, Clock, Music, ChevronUp, LockKeyhole, Sparkles
} from 'lucide-react';
import { Persona } from '@/src/types';

interface PhoneInterfaceProps {
  onClose: () => void;
  characterState: any;
  onUpdateCharacterState: (category: string, field: string, value: any) => void;
  personas: Persona[];
  onSendMessage: (characterId: string, text: string) => void;
  worldName?: string;
}

const PRESET_WALLPAPERS = [
  { 
    name: 'Aura Purple-Orange', 
    value: 'linear-gradient(135deg, #3b0764 0%, #6b21a8 30%, #d97706 70%, #0f172a 100%)',
    preview: 'bg-gradient-to-br from-purple-900 via-amber-600 to-slate-900'
  },
  { 
    name: 'Cyber Neon', 
    value: 'linear-gradient(to bottom, #1e1b4b, #311042, #0f172a)',
    preview: 'bg-gradient-to-b from-indigo-950 via-purple-900 to-slate-900'
  },
  { 
    name: 'Emerald Forest', 
    value: 'linear-gradient(to bottom, #064e3b, #022c22, #09090b)',
    preview: 'bg-gradient-to-b from-emerald-900 via-teal-950 to-zinc-950'
  },
  { 
    name: 'Sunset Crimson', 
    value: 'linear-gradient(to bottom, #4c0519, #3b0764, #09090b)',
    preview: 'bg-gradient-to-b from-rose-950 via-purple-950 to-zinc-950'
  },
  { 
    name: 'Midnight Deep', 
    value: 'linear-gradient(to bottom, #0f172a, #1e293b, #020617)',
    preview: 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950'
  },
];

export function PhoneInterface({ onClose, characterState, onUpdateCharacterState, personas, onSendMessage, worldName }: PhoneInterfaceProps) {
  // Screen state: 'lockscreen' | 'passcode' | 'homescreen'
  const [screen, setScreen] = useState<'lockscreen' | 'passcode' | 'homescreen'>('lockscreen');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  
  // App states
  const [activeMessageThread, setActiveMessageThread] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  
  // Camera state
  const [cameraImage, setCameraImage] = useState<string>('');
  const [cameraCaption, setCameraCaption] = useState<string>('');
  const [cameraDesc, setCameraDesc] = useState<string>('');
  const [cameraPeople, setCameraPeople] = useState<string>('');
  const [cameraLoc, setCameraLoc] = useState<string>('');
  const [cameraTime, setCameraTime] = useState<string>('Day 1');
  const [cameraPriv, setCameraPriv] = useState<string>('Shared');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const currentDate = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  const phoneData = characterState?.phone || {};
  const currentWallpaper = phoneData.wallpaper || PRESET_WALLPAPERS[0].value;
  const threads = phoneData.threads || {};
  const gallery = phoneData.gallery || [];
  const socialFeed = phoneData.socialFeed || [];

  const handleKeypadPress = (digit: string) => {
    if (passcodeInput.length >= 4) return;
    const newPasscode = passcodeInput + digit;
    setPasscodeInput(newPasscode);
    setPasscodeError(false);

    if (newPasscode.length === 4) {
      const correctPasscode = phoneData.password || '1234';
      // Unlock if matches or default passcode 1234
      if (newPasscode === correctPasscode || correctPasscode === '1234') {
        setTimeout(() => {
          setScreen('homescreen');
          setPasscodeInput('');
        }, 150);
      } else {
        setPasscodeError(true);
        setTimeout(() => {
          setPasscodeInput('');
          setPasscodeError(false);
        }, 600);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (result: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          callback(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Keypad configuration matching iOS passcode screen
  const KEYPAD_BUTTONS = [
    { num: '1', letters: '' },
    { num: '2', letters: 'A B C' },
    { num: '3', letters: 'D E F' },
    { num: '4', letters: 'G H I' },
    { num: '5', letters: 'J K L' },
    { num: '6', letters: 'M N O' },
    { num: '7', letters: 'P Q R S' },
    { num: '8', letters: 'T U V' },
    { num: '9', letters: 'W X Y Z' },
    { num: '0', letters: '' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 select-none overflow-hidden"
    >
      {/* Background Overlay dismiss click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* PHONE DEVICE FRAME CONTAINER */}
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 240 }}
        className="relative z-10 w-full max-w-[380px] h-[780px] max-h-[94vh] bg-[#0c0d12] rounded-[48px] border-[8px] border-[#252830] shadow-[0_25px_70px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Phone Top Dynamic Island Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-between px-2.5 border border-white/5 shadow-md">
          <div className="w-2.5 h-2.5 rounded-full bg-[#111116] border border-white/10" />
          <div className="w-3 h-3 rounded-full bg-[#0a0a0f] border border-white/10 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-900/40" />
          </div>
        </div>

        {/* Wallpaper Layer */}
        <div 
          className="absolute inset-0 z-0 transition-all duration-700 bg-cover bg-center"
          style={{ 
            background: currentWallpaper.startsWith('url') || currentWallpaper.startsWith('data:') 
              ? `url(${currentWallpaper}) center/cover no-repeat` 
              : currentWallpaper 
          }}
        >
          {/* Decorative glowing organic curves overlay matching design screenshots */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50 pointer-events-none" />
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* PHONE TOP STATUS BAR */}
        <div className="relative z-40 flex items-center justify-between px-6 pt-3.5 pb-1 text-white text-[13px] font-semibold tracking-tight">
          <span>{currentTime}</span>
          <div className="flex items-center gap-1.5 text-white/90">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-0.5 bg-white/20 border border-white/30 rounded-sm px-1 py-0.5 text-[10px]">
              <span className="font-bold text-[9px]">98%</span>
              <Battery className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            </div>
          </div>
        </div>

        {/* MAIN DISPLAY VIEWPORT */}
        <div className="relative flex-1 z-10 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            
            {/* ==================== SCREEN 1: LOCKSCREEN ==================== */}
            {screen === 'lockscreen' && (
              <motion.div
                key="lockscreen"
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -80 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col justify-between p-6 z-20 cursor-pointer"
                onClick={() => setScreen('passcode')}
              >
                {/* Date & Large Clock */}
                <div className="flex flex-col items-center pt-8 space-y-1">
                  <div className="text-sm font-medium text-white/90 drop-shadow-md tracking-wide">
                    {currentDate}
                  </div>
                  <div className="text-7xl font-semibold tracking-tight text-white drop-shadow-2xl font-sans">
                    {currentTime}
                  </div>
                </div>

                {/* Bottom Swipe Up to Unlock */}
                <motion.div 
                  initial={{ y: 0 }}
                  animate={{ y: [-3, 3, -3] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="flex flex-col items-center pb-6 space-y-3"
                >
                  <ChevronUp className="w-5 h-5 text-white/80" />
                  <span className="text-xs font-medium text-white/80 tracking-wide drop-shadow-md">
                    Swipe up or tap to unlock
                  </span>
                </motion.div>
              </motion.div>
            )}

            {/* ==================== SCREEN 2: PASSCODE SCREEN ==================== */}
            {screen === 'passcode' && (
              <motion.div
                key="passcode"
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col justify-between px-6 pt-4 pb-6 z-20 bg-black/40 backdrop-blur-md"
              >
                {/* Lock Header */}
                <div className="flex flex-col items-center pt-4 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
                    <LockKeyhole className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-lg font-semibold text-white drop-shadow-md">
                    Enter Passcode
                  </div>
                  <div className="text-[11px] text-white/70 font-normal tracking-wide text-center">
                    Your passcode is required to unlock device
                  </div>

                  {/* Passcode Indicator Dots */}
                  <div className={`flex gap-4 pt-3 ${passcodeError ? 'animate-bounce' : ''}`}>
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-3.5 h-3.5 rounded-full border border-white/60 transition-all duration-200 ${
                          i < passcodeInput.length
                            ? 'bg-white border-white shadow-[0_0_12px_rgba(255,255,255,0.9)]'
                            : 'bg-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Circular Numeric Keypad */}
                <div className="w-full max-w-[280px] mx-auto grid grid-cols-3 gap-y-4 gap-x-5 py-2">
                  {KEYPAD_BUTTONS.map((btn) => (
                    <button
                      key={btn.num}
                      onClick={() => handleKeypadPress(btn.num)}
                      className="w-16 h-16 rounded-full bg-white/15 hover:bg-white/30 active:scale-90 border border-white/10 backdrop-blur-xl flex flex-col items-center justify-center text-white transition-all shadow-md mx-auto"
                    >
                      <span className="text-2xl font-normal leading-none">{btn.num}</span>
                      {btn.letters && (
                        <span className="text-[9px] font-semibold text-white/70 tracking-widest leading-tight mt-0.5 uppercase">
                          {btn.letters}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Bottom Emergency & Cancel Actions */}
                <div className="flex justify-between items-center px-4 pt-2">
                  <button 
                    onClick={() => alert('Emergency companion distress beacon activated.')} 
                    className="text-xs font-medium text-white/70 hover:text-white transition-colors"
                  >
                    Emergency
                  </button>
                  <button 
                    onClick={() => { setScreen('lockscreen'); setPasscodeInput(''); }} 
                    className="text-xs font-medium text-white/70 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}

            {/* ==================== SCREEN 3: HOMESCREEN & APPS ==================== */}
            {screen === 'homescreen' && (
              <motion.div
                key="homescreen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col justify-between z-20"
              >
                {!activeApp ? (
                  /* HOMESCREEN APP GRID & DOCK */
                  <div className="flex-1 flex flex-col justify-between p-5 pt-3">
                    {/* Top Status Header */}
                    <div className="flex items-center justify-between text-white/80 px-1 py-1">
                      <span className="text-xs font-bold tracking-wider uppercase text-white/60">Vsen OS</span>
                      <button 
                        onClick={() => setScreen('lockscreen')}
                        className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10"
                        title="Lock Phone"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* App Grid (4 Columns iOS Style) */}
                    <div className="grid grid-cols-4 gap-y-6 gap-x-3 my-auto pt-2">
                      {/* 1. Messages */}
                      <button 
                        onClick={() => setActiveApp('Messages')}
                        className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-[18px] bg-emerald-500 shadow-lg flex items-center justify-center text-white border border-white/20 group-hover:brightness-110 transition-all">
                          <MessageSquare className="w-7 h-7 fill-white/20 text-white" />
                        </div>
                        <span className="text-[11px] font-medium text-white drop-shadow-md">Messages</span>
                      </button>

                      {/* 2. Gallery */}
                      <button 
                        onClick={() => setActiveApp('Gallery')}
                        className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-[18px] bg-white shadow-lg flex items-center justify-center border border-white/20 group-hover:brightness-110 transition-all relative overflow-hidden">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-500 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-white drop-shadow-md">Gallery</span>
                      </button>

                      {/* 3. Social */}
                      <button 
                        onClick={() => setActiveApp('Social')}
                        className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-[18px] bg-sky-500 shadow-lg flex items-center justify-center text-white border border-white/20 group-hover:brightness-110 transition-all">
                          <Users className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-[11px] font-medium text-white drop-shadow-md">Social</span>
                      </button>

                      {/* 4. Settings */}
                      <button 
                        onClick={() => setActiveApp('Settings')}
                        className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-[18px] bg-zinc-700 shadow-lg flex items-center justify-center text-white border border-white/20 group-hover:brightness-110 transition-all">
                          <Settings className="w-7 h-7 text-zinc-200" />
                        </div>
                        <span className="text-[11px] font-medium text-white drop-shadow-md">Settings</span>
                      </button>

                      {/* 5. Notes */}
                      <button 
                        onClick={() => setActiveApp('Notes')}
                        className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-[18px] bg-amber-400 shadow-lg flex items-center justify-center text-zinc-900 border border-white/20 group-hover:brightness-110 transition-all">
                          <FileText className="w-7 h-7 text-zinc-900" />
                        </div>
                        <span className="text-[11px] font-medium text-white drop-shadow-md">Notes</span>
                      </button>

                      {/* 6. Wallet */}
                      <button 
                        onClick={() => setActiveApp('Wallet')}
                        className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-[18px] bg-zinc-900 shadow-lg flex items-center justify-center text-amber-400 border border-amber-500/30 group-hover:brightness-110 transition-all">
                          <WalletIcon className="w-7 h-7 text-amber-400" />
                        </div>
                        <span className="text-[11px] font-medium text-white drop-shadow-md">Wallet</span>
                      </button>

                      {/* 7. Weather */}
                      <button 
                        onClick={() => setActiveApp('Weather')}
                        className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-[18px] bg-sky-400 shadow-lg flex items-center justify-center text-white border border-white/20 group-hover:brightness-110 transition-all">
                          <CloudSun className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-[11px] font-medium text-white drop-shadow-md">Weather</span>
                      </button>

                      {/* 8. Clock */}
                      <button 
                        onClick={() => setActiveApp('Clock')}
                        className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-[18px] bg-zinc-100 shadow-lg flex items-center justify-center text-zinc-900 border border-white/20 group-hover:brightness-110 transition-all">
                          <Clock className="w-7 h-7 text-zinc-900" />
                        </div>
                        <span className="text-[11px] font-medium text-white drop-shadow-md">Clock</span>
                      </button>

                      {/* 9. Music */}
                      <button 
                        onClick={() => setActiveApp('Music')}
                        className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-[18px] bg-rose-500 shadow-lg flex items-center justify-center text-white border border-white/20 group-hover:brightness-110 transition-all">
                          <Music className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-[11px] font-medium text-white drop-shadow-md">Music</span>
                      </button>

                      {/* 10. Camera */}
                      <button 
                        onClick={() => setActiveApp('Camera')}
                        className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-[18px] bg-zinc-800 shadow-lg flex items-center justify-center text-zinc-200 border border-white/20 group-hover:brightness-110 transition-all">
                          <Camera className="w-7 h-7 text-zinc-200" />
                        </div>
                        <span className="text-[11px] font-medium text-white drop-shadow-md">Camera</span>
                      </button>
                    </div>

                    {/* Bottom Translucent Glass Dock */}
                    <div className="w-full bg-white/20 backdrop-blur-2xl border border-white/20 rounded-[28px] p-2.5 flex justify-around shadow-2xl mb-2">
                      <button onClick={() => setActiveApp('Messages')} className="active:scale-90 transition-transform">
                        <div className="w-12 h-12 rounded-[15px] bg-emerald-500 flex items-center justify-center text-white shadow-md">
                          <MessageSquare className="w-6 h-6 fill-white/20 text-white" />
                        </div>
                      </button>
                      <button onClick={() => setActiveApp('Camera')} className="active:scale-90 transition-transform">
                        <div className="w-12 h-12 rounded-[15px] bg-zinc-800 flex items-center justify-center text-zinc-200 shadow-md">
                          <Camera className="w-6 h-6 text-zinc-200" />
                        </div>
                      </button>
                      <button onClick={() => setActiveApp('Gallery')} className="active:scale-90 transition-transform">
                        <div className="w-12 h-12 rounded-[15px] bg-white flex items-center justify-center shadow-md">
                          <Sparkles className="w-5 h-5 text-amber-500" />
                        </div>
                      </button>
                      <button onClick={() => setActiveApp('Settings')} className="active:scale-90 transition-transform">
                        <div className="w-12 h-12 rounded-[15px] bg-zinc-700 flex items-center justify-center text-white shadow-md">
                          <Settings className="w-6 h-6 text-zinc-200" />
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* OPENED APP INTERFACE */
                  <div className="flex-1 flex flex-col bg-[#0f0f14]/95 backdrop-blur-2xl overflow-hidden z-30">
                    {/* App Header Navigation */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#16161d] border-b border-white/10">
                      <button
                        onClick={() => {
                          if (activeMessageThread) {
                            setActiveMessageThread(null);
                          } else {
                            setActiveApp(null);
                          }
                        }}
                        className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1 text-xs font-semibold"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back</span>
                      </button>
                      <span className="font-bold text-xs text-white uppercase tracking-wider">
                        {activeMessageThread 
                          ? personas.find(p => p.id === activeMessageThread)?.name || 'Chat' 
                          : activeApp}
                      </span>
                      <button
                        onClick={() => { setActiveApp(null); setActiveMessageThread(null); }}
                        className="text-[11px] text-white/70 hover:text-white px-2.5 py-1 rounded-xl bg-white/10 transition-colors font-semibold border border-white/10"
                      >
                        Home
                      </button>
                    </div>

                    {/* App Body Content */}
                    <div className="flex-1 overflow-y-auto">
                      
                      {/* MESSAGES APP */}
                      {activeApp === 'Messages' && !activeMessageThread && (
                        <div className="p-4 space-y-2">
                          <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2 px-1">Linked Companions</div>
                          {personas.map(p => {
                            const lastMsg = threads[p.id]?.[threads[p.id].length - 1];
                            return (
                              <button
                                key={p.id}
                                onClick={() => setActiveMessageThread(p.id)}
                                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left"
                              >
                                <img src={p.avatar} referrerPolicy="no-referrer" className="w-11 h-11 rounded-xl object-cover bg-white/10 border border-white/15" alt="" />
                                <div className="flex-1 overflow-hidden">
                                  <div className="font-bold text-xs text-white mb-0.5">{p.name}</div>
                                  <div className="text-[11px] text-white/50 truncate">
                                    {lastMsg ? lastMsg.text : 'Tap to send a direct message...'}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {activeApp === 'Messages' && activeMessageThread && (
                        <div className="flex flex-col h-full">
                          <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                            <div className="text-center py-1">
                              <span className="text-[9px] bg-white/10 text-white/60 px-2.5 py-0.5 rounded-full">
                                Encrypted Companion Direct Feed
                              </span>
                            </div>
                            {(threads[activeMessageThread] || []).map((msg: any, i: number) => (
                              <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs ${msg.isUser ? 'bg-indigo-600 text-white rounded-br-xs shadow-md' : 'bg-white/10 text-white/90 rounded-bl-xs border border-white/10'}`}>
                                  {msg.text}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="p-2.5 bg-[#16161d] border-t border-white/10 flex items-center gap-2">
                            <input
                              type="text"
                              value={messageInput}
                              onChange={(e) => setMessageInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && messageInput.trim()) {
                                  const newThreads = {
                                    ...threads,
                                    [activeMessageThread]: [
                                      ...(threads[activeMessageThread] || []),
                                      { text: messageInput, isUser: true, timestamp: Date.now() }
                                    ]
                                  };
                                  onUpdateCharacterState('phone', 'threads', newThreads);
                                  onSendMessage(activeMessageThread, messageInput);
                                  setMessageInput('');
                                }
                              }}
                              placeholder="Type a message..."
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                            />
                            <button
                              onClick={() => {
                                if (messageInput.trim()) {
                                  const newThreads = {
                                    ...threads,
                                    [activeMessageThread]: [
                                      ...(threads[activeMessageThread] || []),
                                      { text: messageInput, isUser: true, timestamp: Date.now() }
                                    ]
                                  };
                                  onUpdateCharacterState('phone', 'threads', newThreads);
                                  onSendMessage(activeMessageThread, messageInput);
                                  setMessageInput('');
                                }
                              }}
                              className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* CAMERA APP */}
                      {activeApp === 'Camera' && (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Camera className="w-5 h-5 text-emerald-400" />
                            <h3 className="text-sm font-bold text-white">Capture Memory</h3>
                          </div>

                          {saveSuccess && (
                            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2">
                              <Check className="w-3.5 h-3.5" /> Saved to Gallery!
                            </div>
                          )}

                          <div className="space-y-2">
                            {!cameraImage ? (
                              <label className="border-2 border-dashed border-white/20 hover:border-indigo-500/60 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-white/5 transition-all">
                                <Upload className="w-5 h-5 text-indigo-400" />
                                <span className="text-xs font-bold text-white">Upload Memory Image</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, (res) => setCameraImage(res))}
                                />
                              </label>
                            ) : (
                              <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black/40">
                                <img src={cameraImage} referrerPolicy="no-referrer" className="w-full h-36 object-cover" alt="" />
                                <button
                                  type="button"
                                  onClick={() => setCameraImage('')}
                                  className="absolute top-2 right-2 px-2 py-1 bg-rose-600 text-white font-bold rounded-lg text-[10px]"
                                >
                                  Remove
                                </button>
                              </div>
                            )}

                            <input
                              type="text"
                              value={cameraCaption}
                              onChange={(e) => setCameraCaption(e.target.value)}
                              placeholder="Caption *"
                              className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                            />

                            <textarea
                              value={cameraDesc}
                              onChange={(e) => setCameraDesc(e.target.value)}
                              placeholder="Backstory notes..."
                              className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none h-16 resize-none"
                            />

                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={cameraPeople}
                                onChange={(e) => setCameraPeople(e.target.value)}
                                placeholder="People present"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                              />
                              <input
                                type="text"
                                value={cameraLoc}
                                onChange={(e) => setCameraLoc(e.target.value)}
                                placeholder="Location"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                              />
                            </div>

                            <button
                              onClick={() => {
                                if (!cameraCaption.trim()) {
                                  alert('Please enter a photo caption.');
                                  return;
                                }
                                const finalUrl = cameraImage.trim() || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600';
                                const newPhoto = { 
                                  url: finalUrl, 
                                  caption: cameraCaption.trim(), 
                                  description: cameraDesc.trim(), 
                                  people: cameraPeople.trim(), 
                                  location: cameraLoc.trim(), 
                                  time: cameraTime.trim(), 
                                  privacy: cameraPriv, 
                                  timestamp: Date.now() 
                                };
                                const newGallery = [newPhoto, ...gallery];
                                onUpdateCharacterState('phone', 'gallery', newGallery);
                                setSaveSuccess(true);
                                setTimeout(() => {
                                  setSaveSuccess(false);
                                  setActiveApp('Gallery');
                                }, 600);
                              }}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all"
                            >
                              Save to Gallery
                            </button>
                          </div>
                        </div>
                      )}

                      {/* GALLERY APP */}
                      {activeApp === 'Gallery' && (
                        <div className="p-3 space-y-3">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-bold text-white/50 uppercase">Gallery ({gallery.length})</span>
                            <button
                              onClick={() => setActiveApp('Camera')}
                              className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-xl"
                            >
                              <ImagePlus className="w-3.5 h-3.5" /> Add Photo
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {gallery.length > 0 ? gallery.map((img: any, i: number) => (
                              <div key={i} className="bg-white/5 rounded-xl overflow-hidden border border-white/10 flex flex-col relative group">
                                <button
                                  onClick={() => {
                                    if (confirm('Delete photo?')) {
                                      const updated = gallery.filter((_: any, idx: number) => idx !== i);
                                      onUpdateCharacterState('phone', 'gallery', updated);
                                    }
                                  }}
                                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <div className="h-28 bg-black/40 relative">
                                  <img src={img.url} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                                </div>
                                <div className="p-2 space-y-0.5">
                                  <div className="font-bold text-[11px] text-white truncate">{img.caption}</div>
                                  <div className="text-[9px] text-white/50 truncate">{img.location || 'Unknown'}</div>
                                </div>
                              </div>
                            )) : (
                              <div className="col-span-2 py-12 text-center text-white/40 text-xs flex flex-col items-center gap-2">
                                <ImageIcon className="w-8 h-8 text-white/20" />
                                <span>No photos in gallery. Use Camera to add memories.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* SOCIAL APP */}
                      {activeApp === 'Social' && (
                        <div className="p-3 space-y-3">
                          <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2">
                            <textarea
                              id="social_input_app"
                              placeholder="Share an update..."
                              className="w-full bg-transparent text-xs text-white resize-none focus:outline-none min-h-[50px]"
                            />
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() => {
                                  const input = document.getElementById('social_input_app') as HTMLTextAreaElement;
                                  if (input && input.value.trim()) {
                                    const newPost = { author: 'You', content: input.value.trim(), timestamp: Date.now(), likes: 0 };
                                    const newFeed = [newPost, ...socialFeed];
                                    onUpdateCharacterState('phone', 'socialFeed', newFeed);
                                    input.value = '';
                                  }
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white"
                              >
                                Post
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {socialFeed.map((post: any, i: number) => (
                              <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1">
                                <div className="font-semibold text-xs text-white">{post.author}</div>
                                <div className="text-xs text-white/80">{post.content}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SETTINGS APP */}
                      {activeApp === 'Settings' && (
                        <div className="p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-sky-400" />
                            <h3 className="text-sm font-bold text-white">Settings</h3>
                          </div>

                          <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10">
                            <label className="text-[10px] font-bold text-white/60 uppercase">Wallpaper Preset</label>
                            <div className="grid grid-cols-2 gap-2">
                              {PRESET_WALLPAPERS.map((preset, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => onUpdateCharacterState('phone', 'wallpaper', preset.value)}
                                  className={`h-14 rounded-lg p-2 flex items-center justify-between border text-left text-xs font-bold text-white ${
                                    currentWallpaper === preset.value ? 'border-indigo-400 ring-1 ring-indigo-500' : 'border-white/10'
                                  }`}
                                  style={{ background: preset.value }}
                                >
                                  <span className="truncate">{preset.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10">
                            <label className="text-[10px] font-bold text-white/60 uppercase">4-Digit Passcode</label>
                            <input
                              type="text"
                              maxLength={4}
                              defaultValue={phoneData.password || '1234'}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                if (val.length === 4) {
                                  onUpdateCharacterState('phone', 'password', val);
                                }
                              }}
                              className="w-24 bg-white/5 border border-white/10 rounded-xl p-2 text-center text-xs font-mono text-white tracking-widest focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* NOTES APP */}
                      {activeApp === 'Notes' && (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-amber-400" />
                            <h3 className="text-sm font-bold text-white">Personal Notes</h3>
                          </div>
                          <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                            <div className="text-xs font-bold text-amber-300">Companion Journal</div>
                            <p className="text-xs text-white/70 leading-relaxed">
                              "Keep track of shared secrets, emotional bonds, and upcoming realm quests in this encrypted notepad."
                            </p>
                          </div>
                        </div>
                      )}

                      {/* WALLET APP */}
                      {activeApp === 'Wallet' && (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <WalletIcon className="w-5 h-5 text-amber-400" />
                            <h3 className="text-sm font-bold text-white">Vsen Pass & Credits</h3>
                          </div>
                          <div className="p-4 bg-gradient-to-r from-amber-600/30 to-purple-600/30 rounded-2xl border border-amber-500/30 space-y-2">
                            <div className="text-xs text-amber-200 font-bold uppercase tracking-wider">Realm Pass</div>
                            <div className="text-xl font-extrabold text-white">Unlimited VIP Access</div>
                            <div className="text-[10px] text-white/60">Connected Realm: {worldName || 'Active Companion World'}</div>
                          </div>
                        </div>
                      )}

                      {/* WEATHER APP */}
                      {activeApp === 'Weather' && (
                        <div className="p-4 space-y-3 text-center">
                          <CloudSun className="w-12 h-12 text-sky-400 mx-auto" />
                          <div className="text-3xl font-light text-white">72°F</div>
                          <div className="text-xs text-white/70">Realm Atmosphere: Clear & Serene</div>
                        </div>
                      )}

                      {/* CLOCK APP */}
                      {activeApp === 'Clock' && (
                        <div className="p-4 space-y-3 text-center">
                          <Clock className="w-12 h-12 text-indigo-400 mx-auto" />
                          <div className="text-4xl font-extralight text-white font-mono">{currentTime}</div>
                          <div className="text-xs text-white/60">{currentDate}</div>
                        </div>
                      )}

                      {/* MUSIC APP */}
                      {activeApp === 'Music' && (
                        <div className="p-4 space-y-3 text-center">
                          <Music className="w-12 h-12 text-rose-500 mx-auto animate-pulse" />
                          <div className="text-sm font-bold text-white">Companion Ambient Audio</div>
                          <div className="text-xs text-white/60">Playing realm background frequency</div>
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* BOTTOM HOME BAR INDICATOR */}
        <div className="relative z-40 py-2 flex justify-center bg-black/30 backdrop-blur-md">
          <button 
            onClick={() => {
              if (screen === 'homescreen') {
                if (activeApp) setActiveApp(null);
                else setScreen('lockscreen');
              } else if (screen === 'passcode') {
                setScreen('lockscreen');
              } else {
                onClose();
              }
            }}
            className="w-32 h-1 bg-white/60 hover:bg-white rounded-full transition-colors cursor-pointer"
            title="Home Bar"
          />
        </div>

      </motion.div>
    </motion.div>
  );
}
