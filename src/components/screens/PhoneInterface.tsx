import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Camera, Image as ImageIcon, Users, Lock, ChevronLeft, Wifi, Battery, Signal, Send, 
  Heart, MapPin, RefreshCw, Upload, ImagePlus, Settings, Palette, Check, Trash2, Smartphone, 
  FileText, Wallet as WalletIcon, CloudSun, Clock, Music, ChevronUp, LockKeyhole, Sparkles, X, ShieldAlert, Maximize2
} from 'lucide-react';
import { Persona } from '@/src/types';
import { SafeImage } from '../common/SafeImage';

interface PhoneInterfaceProps {
  onClose: () => void;
  characterState: any;
  onUpdateCharacterState: (category: string, field: string, value: any) => void;
  personas: Persona[];
  onSendMessage: (characterId: string, text: string, userMsg?: any) => void;
  worldName?: string;
  wallpaperUrl?: string | null;
  onSetCustomWallpaper?: (url: string | null) => void;
  isPerformanceMode?: boolean;
  linkedCharacterIds?: string[];
  typingContactId?: string | null;
  deadCharacterIds?: Set<string>;
  onPostSocialUpdate?: (content: string, image?: string) => void;
  triggerHaptic?: () => void;
  activeUserPersona?: any;
  currentPersonaName?: string;
}

const DEFAULT_WALLPAPER = 'linear-gradient(to bottom, #090a0f, #12131a)';

export function PhoneInterface({ 
  onClose, 
  characterState, 
  onUpdateCharacterState, 
  personas = [], 
  onSendMessage, 
  worldName,
  wallpaperUrl,
  onSetCustomWallpaper,
  isPerformanceMode = false,
  linkedCharacterIds = [],
  typingContactId = null,
  deadCharacterIds = new Set(),
  onPostSocialUpdate,
  triggerHaptic: triggerHapticProp,
  activeUserPersona,
  currentPersonaName
}: PhoneInterfaceProps) {
  // Safe state mapping
  const phoneData = characterState?.phone || {};
  
  const triggerHaptic = () => {
    if (triggerHapticProp) {
      triggerHapticProp();
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };
  const threads = phoneData.threads || {};
  const gallery = Array.isArray(phoneData.gallery) ? phoneData.gallery : [];
  const socialFeed = Array.isArray(phoneData.socialFeed) ? phoneData.socialFeed : [];
  const savedPasscode = phoneData.password || '1234';
  const customContacts = Array.isArray(phoneData.customContacts) ? phoneData.customContacts : [];

  // Filter visible personas to only show linked characters (or current active chat character) plus custom contacts
  const visiblePersonas = [
    ...personas.filter(p => {
      if (linkedCharacterIds && linkedCharacterIds.length > 0) {
        return linkedCharacterIds.includes(p.id);
      }
      return true;
    }),
    ...customContacts
  ];

  // Dynamic Feed Initialization
  const defaultSocialFeed = [
    {
      id: 'post-1',
      authorId: visiblePersonas[0]?.id || 'char-1',
      author: visiblePersonas[0]?.name || 'Alice',
      authorAvatar: visiblePersonas[0]?.socialAvatar || visiblePersonas[0]?.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
      content: "Just arrived at the central gardens. The atmosphere here is absolutely ethereal today... 🌸✨ Let's see who else is wandering around.",
      image: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80",
      timestamp: Date.now() - 3600000 * 2, // 2 hours ago
      likes: 42,
      likedByUser: false,
      comments: [
        {
          id: 'c-1',
          authorId: visiblePersonas[1]?.id || 'char-2',
          author: visiblePersonas[1]?.name || 'Bob',
          authorAvatar: visiblePersonas[1]?.socialAvatar || visiblePersonas[1]?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
          content: "Looks stunning! Save some of those flowers for the lab.",
          timestamp: Date.now() - 3600000 * 1.5
        }
      ]
    },
    {
      id: 'post-2',
      authorId: visiblePersonas[1]?.id || 'char-2',
      author: visiblePersonas[1]?.name || 'Bob',
      authorAvatar: visiblePersonas[1]?.socialAvatar || visiblePersonas[1]?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      content: "Deep in the archives looking for clues on the temporal shifts. The coffee machine is my only ally right now. ☕⏳",
      image: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&w=600&q=80",
      timestamp: Date.now() - 3600000 * 5, // 5 hours ago
      likes: 28,
      likedByUser: false,
      comments: []
    }
  ];

  // Dynamically resolve the feed, injecting configured character preset posts and filtering out disabled profiles
  const characterPresetPosts = visiblePersonas.flatMap((char: any) => {
    if (char.hasSocialMedia === false) return [];
    const posts = Array.isArray(char.socialPosts) ? char.socialPosts : [];
    return posts.map((post: any) => ({
      ...post,
      authorId: char.id,
      author: char.name,
      authorAvatar: char.socialAvatar || char.avatar || post.authorAvatar
    }));
  });

  const filteredDefaultFeed = defaultSocialFeed.filter((post: any) => {
    const author = visiblePersonas.find(p => p.id === post.authorId);
    if (author && author.hasSocialMedia === false) return false;
    return true;
  });

  const uniqueInitialFeed = Array.from(
    new Map([...characterPresetPosts, ...filteredDefaultFeed].map(item => [item.id, item])).values()
  ).sort((a: any, b: any) => b.timestamp - a.timestamp);

  const resolvedFeed = socialFeed.length > 0 ? socialFeed : uniqueInitialFeed;

  const getCharacterStats = (charId: string) => {
    const char = visiblePersonas.find(p => p.id === charId);
    const hash = charId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const baseFollowers = char?.socialFollowers ?? ((hash % 800) + 150);
    const baseFollowing = char?.socialFollowing ?? ((hash % 200) + 50);
    const baseLikes = char?.socialLikes ?? ((hash % 3000) + 400);
    const followingList = Array.isArray(phoneData.following) ? phoneData.following : [];
    const isFollowing = followingList.includes(charId);
    
    return {
      followers: baseFollowers + (isFollowing ? 1 : 0),
      following: baseFollowing,
      likes: baseLikes,
      isFollowing
    };
  };

  // Screen navigation state: 'lockscreen' | 'passcode' | 'homescreen'
  const [screen, setScreen] = useState<'lockscreen' | 'passcode' | 'homescreen'>('lockscreen');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  
  // App states
  const [activeMessageThread, setActiveMessageThread] = useState<string | null>(null);
  const [socialInput, setSocialInput] = useState('');
  const [socialTab, setSocialTab] = useState<'feed' | 'discover' | 'myprofile'>('feed');
  const [selectedSocialProfile, setSelectedSocialProfile] = useState<string | null>(null);
  const [socialCommentInput, setSocialCommentInput] = useState<{[postId: string]: string}>({});
  const [socialImage, setSocialImage] = useState<string | null>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  
  // Camera state
  const [cameraImage, setCameraImage] = useState<string>('');
  const [cameraCaption, setCameraCaption] = useState<string>('');
  const [cameraDesc, setCameraDesc] = useState<string>('');
  const [cameraPeople, setCameraPeople] = useState<string>('');
  const [cameraLoc, setCameraLoc] = useState<string>('');
  const [cameraTime] = useState<string>('Day 1');
  const [cameraPriv] = useState<string>('Shared');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Settings local state (prevents the cursor jump/re-render sync bug)
  const [settingsPasscode, setSettingsPasscode] = useState(savedPasscode);
  const [isFaceScanning, setIsFaceScanning] = useState(false);
  const [isFaceUnlocked, setIsFaceUnlocked] = useState(false);

  // Real-time scale tracking that freezes when keyboard is open
  const [phoneScale, setPhoneScale] = useState(1);
  const [fixedHeight, setFixedHeight] = useState(() => window.innerHeight);
  const [fixedWidth, setFixedWidth] = useState(() => window.innerWidth);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [isGlobalComposerOpen, setIsGlobalComposerOpen] = useState(false);
  const [inlineMsgText, setInlineMsgText] = useState<string>('');
  const [inlineAttachedImage, setInlineAttachedImage] = useState<string | null>(null);
  const inlineTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const isTouchDevice = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setFixedWidth(window.innerWidth);
      setFixedHeight(window.visualViewport ? window.visualViewport.height : window.innerHeight);
    };
    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const calcScale = () => {
      const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const currentWidth = window.innerWidth;
      
      const hScale = (currentHeight * 0.88) / 740;
      const wScale = (currentWidth * 0.92) / 370;
      
      const newScale = Math.min(1, hScale, wScale);
      setPhoneScale(Math.max(0.4, newScale));
    };
    calcScale();
    window.visualViewport?.addEventListener('resize', calcScale);
    window.addEventListener('resize', calcScale);
    return () => {
      window.visualViewport?.removeEventListener('resize', calcScale);
      window.removeEventListener('resize', calcScale);
    };
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        setIsKeyboardActive(true);
      }
    };
    const handleBlur = () => {
      // Small timeout to prevent flickering during active element transitions
      setTimeout(() => {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setIsKeyboardActive(false);
        }
      }, 80);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);
    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  const [currentTime, setCurrentTime] = useState(() => 
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  const [currentDate, setCurrentDate] = useState(() =>
    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
      setCurrentDate(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Scroll to bottom when thread updates or typing starts
  useEffect(() => {
    if (activeApp === 'Messages' && activeMessageThread) {
      setTimeout(() => {
        if (messagesEndRef.current) {
          const container = messagesEndRef.current.parentElement;
          if (container) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
          }
        }
      }, 50);
    }
  }, [activeMessageThread && threads ? threads[activeMessageThread]?.length : 0, typingContactId, activeMessageThread, activeApp]);

  // Mark messages as read when entering a thread
  useEffect(() => {
    if (activeApp === 'Messages' && activeMessageThread) {
      const charThreads = Array.isArray(threads?.[activeMessageThread]) ? threads[activeMessageThread] : [];
      const hasUnread = charThreads.some((m: any) => !m.isUser && m.unread);
      if (hasUnread) {
        const updated = charThreads.map((m: any) => m.unread ? { ...m, unread: false } : m);
        const newThreads = {
          ...threads,
          [activeMessageThread]: updated
        };
        onUpdateCharacterState('phone', 'threads', newThreads);
      }
    }
  }, [activeMessageThread, activeApp]);

  const handleKeypadPress = (digit: string) => {
    setPasscodeInput(prev => {
      if (prev.length >= 4) return prev;
      const nextPasscode = prev + digit;
      setPasscodeError(false);

      if (nextPasscode.length === 4) {
        if (nextPasscode === savedPasscode) {
          // Success haptic
          if (window.navigator?.vibrate) window.navigator.vibrate([10, 30]);
          setTimeout(() => {
            setScreen('homescreen');
            setPasscodeInput('');
            setPasscodeError(false);
          }, 150);
        } else {
          // Error haptic
          if (window.navigator?.vibrate) window.navigator.vibrate([50, 50, 50]);
          setPasscodeError(true);
          setTimeout(() => {
            setPasscodeInput('');
            setPasscodeError(false);
          }, 600);
        }
      }
      return nextPasscode;
    });
  };

  const handleBackspace = () => {
    setPasscodeInput(prev => {
      if (prev.length === 0) return prev;
      setPasscodeError(false);
      return prev.slice(0, -1);
    });
  };

  const [quickUnlockError, setQuickUnlockError] = useState(false);

  const handleQuickUnlock = () => {
    if (isFaceScanning || isFaceUnlocked) return;
    setIsFaceScanning(true);
    setQuickUnlockError(false);
    if (window.navigator?.vibrate) window.navigator.vibrate(20);
    
    setTimeout(() => {
      setIsFaceScanning(false);
      
      setIsFaceUnlocked(true);
      if (window.navigator?.vibrate) window.navigator.vibrate([10, 50]);
      
      setTimeout(() => {
        setScreen('homescreen');
        setPasscodeInput('');
        setPasscodeError(false);
        setIsFaceUnlocked(false);
      }, 400);
    }, 1200);
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
    { num: '', letters: '', empty: true },
    { num: '0', letters: '' },
    { num: 'delete', letters: '', action: 'delete' },
  ];

  // The phone background itself is ALWAYS the current location's wallpaper for maximum immersion
  const rawWallpaper = wallpaperUrl || DEFAULT_WALLPAPER;
  const isImageUrl = rawWallpaper.startsWith('url') || rawWallpaper.startsWith('data:') || rawWallpaper.startsWith('http') || rawWallpaper.startsWith('/');

  const phoneInsideWallpaper = phoneData.customInsideWallpaper || 'linear-gradient(135deg, #050608 0%, #0d0f14 40%, #170d24 80%, #08111a 100%)';
  const isPhoneInsideImageUrl = phoneInsideWallpaper.startsWith('url') || phoneInsideWallpaper.startsWith('data:') || phoneInsideWallpaper.startsWith('http') || phoneInsideWallpaper.startsWith('/');

  const paddingTopVal = Math.max(16, (fixedHeight - (740 * phoneScale)) / 2);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed top-0 left-0 w-full z-[250] flex flex-col items-center justify-start select-none overflow-hidden transition-all duration-500 bg-cover bg-center bg-no-repeat"
      style={{ 
        height: `${fixedHeight}px`,
        background: isImageUrl
          ? (rawWallpaper.startsWith('url(') ? rawWallpaper : `url("${rawWallpaper}") center/cover no-repeat`)
          : rawWallpaper,
        paddingTop: `${paddingTopVal}px`
      }}
    >
      {/* 
        Sleek, transparent dark overlay (NO HEAVY BLURS to ensure the active roleplay location wallpaper in the background shines through beautifully!) 
        We use bg-black/30 so that the wallpaper remains completely visible, vivid, and beautiful behind the phone frame.
      */}
      <div className={`absolute inset-0 bg-black/30 ${isPerformanceMode ? '' : 'backdrop-blur-[2px]'} pointer-events-none`} />

      {/* Tap outside to close phone */}
      <div className="absolute inset-0 z-0" onClick={onClose} />

      {/* PERFECTLY NON-SQUISHABLE AUTO-SCALED WRAPPER */}
      <div
        className="relative z-10 w-[370px] flex-shrink-0 flex items-center justify-center origin-top"
        style={{
          transform: `scale(${phoneScale})`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sleek Close Button placed inside scaled wrapper - always perfectly aligned next to the phone frame, never overlapping! */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-12 z-[260] w-10 h-10 rounded-full bg-black/85 hover:bg-black text-white/90 hover:text-white flex items-center justify-center border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)] transition-all hover:scale-110 active:scale-95 cursor-pointer group"
          title="Close Companion Device"
        >
          <X className="w-4.5 h-4.5 group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* PHONE FRAME - Beautiful thicker black bezel with perfectly rounded corners to prevent visual glitches */}
        <motion.div
          initial={isPerformanceMode ? undefined : { scale: 0.9, y: 30 }}
          animate={isPerformanceMode ? undefined : { scale: 1, y: 0 }}
          exit={isPerformanceMode ? undefined : { scale: 0.9, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 240 }}
          className="w-[370px] bg-[#050608] rounded-[48px] p-3 shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col relative ring-1 ring-white/15 transition-all duration-300"
          style={{
            height: '740px',
            transformOrigin: 'top center'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Inner viewport screen with mathematically exact corner rendering (Outer Radius - Padding = 36px) */}
          <div className="relative w-full h-full bg-[#090a0f] rounded-[36px] overflow-hidden flex flex-col z-10">
        {/* Dynamic Island Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-between px-2.5 border border-white/5 shadow-md">
          <div className="w-2.5 h-2.5 rounded-full bg-[#111116] border border-white/10" />
          <div className="w-3 h-3 rounded-full bg-[#0a0a0f] border border-white/10 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-900/40" />
          </div>
        </div>

        {/* Stable premium OS wallpaper layer inside the phone */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-500"
          style={{ 
            background: isPhoneInsideImageUrl
              ? (phoneInsideWallpaper.startsWith('url(') ? phoneInsideWallpaper : `url("${phoneInsideWallpaper}") center/cover no-repeat`)
              : phoneInsideWallpaper 
          }}
        >
          {/* Subtle lighting/ambient glow for the phone OS background */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/50 pointer-events-none" />
          {!isPerformanceMode && (
            <>
              <div className="absolute -top-16 -left-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
              <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
            </>
          )}
        </div>

        {/* STATUS BAR */}
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-6 pt-3.5 pb-1 text-white text-[12px] font-semibold tracking-tight pointer-events-none bg-transparent">
          <span>{currentTime}</span>
          <div className="flex items-center gap-1.5 text-white/95 pointer-events-auto">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-0.5 bg-white/15 border border-white/20 rounded-sm px-1 py-0.5 text-[9px] font-bold">
              <span>98%</span>
              <Battery className="w-3 h-3 text-emerald-400 fill-emerald-400" />
            </div>
          </div>
        </div>

        {/* DISPLAY ROOT CONTAINER */}
        <div 
          className="relative flex-1 z-10 flex flex-col overflow-hidden"
        >
          <AnimatePresence mode="wait">
            
            {/* ==================== LOCKSCREEN ==================== */}
            {screen === 'lockscreen' && (
              <motion.div
                key="lockscreen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col justify-between pt-16 pb-12 px-6 z-20 cursor-pointer"
                onClick={() => setScreen('passcode')}
              >
                {/* Date & Big Time */}
                <div className="flex flex-col items-center pt-8 space-y-1">
                  <div className="text-xs font-bold text-white/90 drop-shadow-md tracking-wider uppercase">
                    {currentDate}
                  </div>
                  <div className="text-6xl font-light tracking-tight text-white drop-shadow-xl font-sans">
                    {currentTime}
                  </div>
                  <div className={`flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full border border-white/10 text-[10px] text-white/80 ${isPerformanceMode ? '' : 'backdrop-blur-sm'}`}>
                    <MapPin className="w-3 h-3 text-purple-400" />
                    <span className="font-semibold">{worldName || 'Realm Active'}</span>
                  </div>
                </div>

                {/* Face Scan / Lock status */}
                <div className="flex flex-col items-center space-y-1 my-auto pt-16">
                  <Lock className="w-6 h-6 text-white/80 animate-pulse" />
                  <span className="text-[10px] text-white/50">Encrypted Vsen OS</span>
                </div>

                {/* Bottom Guide */}
                <motion.div 
                  animate={isPerformanceMode ? undefined : { y: [-3, 3, -3] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="flex flex-col items-center space-y-1"
                >
                  <ChevronUp className="w-5 h-5 text-white/80" />
                  <span className={`text-xs font-semibold text-white/95 tracking-wide bg-black/50 px-4 py-1.5 rounded-full ${isPerformanceMode ? '' : 'backdrop-blur-md'} border border-white/10 shadow-lg`}>
                    Swipe or Tap to unlock
                  </span>
                </motion.div>
              </motion.div>
            )}

            {/* ==================== PASSCODE SCREEN ==================== */}
            {screen === 'passcode' && (
              <motion.div
                key="passcode"
                initial={isPerformanceMode ? undefined : { opacity: 0, scale: 0.95 }}
                animate={isPerformanceMode ? undefined : { opacity: 1, scale: 1 }}
                exit={isPerformanceMode ? undefined : { opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`absolute inset-0 flex flex-col justify-between px-6 pt-16 pb-12 z-20 bg-black/80 ${isPerformanceMode ? '' : 'backdrop-blur-xl'}`}
              >
                {/* Header */}
                <div className="flex flex-col items-center space-y-2.5 pt-4">
                  {isFaceScanning ? (
                    <div className="w-12 h-12 rounded-full border-2 border-indigo-500 flex items-center justify-center animate-spin">
                      <Sparkles className="w-6 h-6 text-indigo-400" />
                    </div>
                  ) : isFaceUnlocked ? (
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                      <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-full bg-white/10 ${isPerformanceMode ? '' : 'backdrop-blur-xl'} flex items-center justify-center border border-white/20 shadow-md`}>
                      <LockKeyhole className="w-5 h-5 text-white/90" />
                    </div>
                  )}

                  <div className="text-lg font-bold text-white tracking-tight">
                    {isFaceScanning 
                      ? 'Scanning Face...' 
                      : isFaceUnlocked 
                        ? 'Face ID Verified' 
                        : quickUnlockError 
                          ? 'Passcode Required' 
                          : 'Enter Passcode'}
                  </div>
                  <div className={`text-[11px] ${quickUnlockError ? 'text-rose-400 font-semibold' : 'text-white/60'} text-center max-w-[200px]`}>
                    {isFaceScanning 
                      ? 'Positioning security camera...' 
                      : quickUnlockError 
                        ? 'Face ID bypassed. Enter custom passcode.' 
                        : `Unlock ${worldName || 'Companion Device'}`}
                  </div>

                  {/* Password Indicator Dots */}
                  {!isFaceScanning && !isFaceUnlocked && (
                    <div className={`flex gap-4 pt-3 ${passcodeError ? 'animate-shake' : ''}`}>
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                            i < passcodeInput.length
                              ? 'bg-white border-white shadow-[0_0_10px_rgba(255,255,255,0.8)] scale-110'
                              : 'bg-white/10 border-white/25'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Keypad */}
                {!isFaceScanning && !isFaceUnlocked && (
                  <div className="w-full max-w-[260px] mx-auto grid grid-cols-3 gap-y-3.5 gap-x-4 py-2">
                    {KEYPAD_BUTTONS.map((btn, idx) => {
                      if (btn.empty) {
                        return <div key={`keypad-empty-${idx}`} className="w-14 h-14" />;
                      }
                      if (btn.action === 'delete') {
                        return (
                          <button
                            key="keypad-delete"
                            type="button"
                            onClick={handleBackspace}
                            className="w-14 h-14 flex flex-col items-center justify-center text-white/70 hover:text-white transition-all active:scale-90 mx-auto cursor-pointer"
                          >
                            <span className="text-[11px] font-semibold tracking-wide uppercase">Delete</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={`keypad-num-${btn.num}`}
                          type="button"
                          onClick={() => handleKeypadPress(btn.num)}
                          className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex flex-col items-center justify-center text-white transition-all shadow-sm mx-auto group cursor-pointer"
                        >
                          <span className="text-xl font-light text-white">{btn.num}</span>
                          {btn.letters && (
                            <span className="text-[7px] font-bold text-white/40 tracking-widest leading-none uppercase">
                              {btn.letters}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center px-4 pt-2">
                  <button 
                    type="button"
                    onClick={handleQuickUnlock}
                    disabled={isFaceScanning || isFaceUnlocked}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors cursor-pointer bg-white/10 hover:bg-white/15 px-3.5 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Quick Unlock</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setScreen('lockscreen'); setPasscodeInput(''); }} 
                    className="text-xs font-medium text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}

            {/* ==================== HOMESCREEN & APPS ==================== */}
            {screen === 'homescreen' && (
              <motion.div
                key="homescreen"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col justify-between z-20"
              >
                {!activeApp ? (
                  /* APP GRID & QUICK DOCK */
                  <div className="flex-1 flex flex-col justify-between px-5 pt-8 pb-4">
                    {/* Top Status Banner */}
                    <div className="flex items-center justify-between text-white/80 px-1 py-1">
                      <span className={`text-[10px] font-bold tracking-widest uppercase text-purple-300 bg-purple-950/40 px-2.5 py-1 rounded-full ${isPerformanceMode ? '' : 'backdrop-blur-sm'} border border-purple-500/20 shadow-sm flex items-center gap-1`}>
                        <Sparkles className="w-3 h-3 text-indigo-400" /> VSEN OS
                      </span>
                      <button 
                        type="button"
                        onClick={() => setScreen('lockscreen')}
                        className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all border border-white/15 cursor-pointer shadow-sm"
                        title="Lock Phone"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* App Icons Grid */}
                    <div className="grid grid-cols-4 gap-y-4 gap-x-3 pt-4">
                      {/* 1. Messages */}
                      <button 
                        type="button"
                        onClick={() => setActiveApp('Messages')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[15px] bg-gradient-to-b from-emerald-400 to-emerald-600 flex items-center justify-center text-white border border-white/20 relative overflow-hidden shadow-md">
                          <MessageSquare className="w-6 h-6 fill-white/25 text-white" />
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow-md tracking-tight">Messages</span>
                      </button>

                      {/* 2. Gallery */}
                      <button 
                        type="button"
                        onClick={() => setActiveApp('Gallery')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[15px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white border border-white/20 relative overflow-hidden shadow-md">
                          <ImageIcon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow-md tracking-tight">Gallery</span>
                      </button>

                      {/* 3. Social */}
                      <button 
                        type="button"
                        onClick={() => setActiveApp('Social')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[15px] bg-gradient-to-tr from-purple-600 via-rose-500 to-amber-400 flex items-center justify-center text-white border border-white/20 relative overflow-hidden shadow-md">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow-md tracking-tight">Social</span>
                      </button>

                      {/* 4. Settings */}
                      <button 
                        type="button"
                        onClick={() => setActiveApp('Settings')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[15px] bg-gradient-to-b from-zinc-500 to-zinc-800 flex items-center justify-center text-white border border-white/20 relative overflow-hidden shadow-md">
                          <Settings className="w-6 h-6 text-zinc-100" />
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow-md tracking-tight">Settings</span>
                      </button>

                      {/* 5. Notes */}
                      <button 
                        type="button"
                        onClick={() => setActiveApp('Notes')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[15px] bg-gradient-to-b from-amber-300 to-amber-500 flex items-center justify-center text-zinc-900 border border-white/20 relative overflow-hidden shadow-md">
                          <FileText className="w-6 h-6 text-zinc-900" />
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow-md tracking-tight">Notes</span>
                      </button>

                      {/* 6. Wallet */}
                      <button 
                        type="button"
                        onClick={() => setActiveApp('Wallet')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[15px] bg-gradient-to-b from-zinc-800 to-black flex items-center justify-center text-white border border-amber-500/30 relative overflow-hidden shadow-md">
                          <WalletIcon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow-md tracking-tight">Wallet</span>
                      </button>

                      {/* 7. Weather */}
                      <button 
                        type="button"
                        onClick={() => setActiveApp('Weather')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[15px] bg-gradient-to-b from-blue-400 via-sky-500 to-indigo-600 flex items-center justify-center text-white border border-white/20 relative overflow-hidden shadow-md">
                          <CloudSun className="w-6 h-6 text-amber-300" />
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow-md tracking-tight">Weather</span>
                      </button>

                      {/* 8. Clock */}
                      <button 
                        type="button"
                        onClick={() => setActiveApp('Clock')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[15px] bg-gradient-to-b from-zinc-100 to-zinc-400 flex items-center justify-center text-zinc-900 border border-white/20 relative overflow-hidden shadow-md">
                          <Clock className="w-6 h-6 text-zinc-900" />
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow-md tracking-tight">Clock</span>
                      </button>

                      {/* 9. Music */}
                      <button 
                        type="button"
                        onClick={() => setActiveApp('Music')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[15px] bg-gradient-to-b from-rose-400 to-rose-600 flex items-center justify-center text-white border border-white/20 relative overflow-hidden shadow-md">
                          <Music className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow-md tracking-tight">Music</span>
                      </button>

                      {/* 10. Camera */}
                      <button 
                        type="button"
                        onClick={() => setActiveApp('Camera')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[15px] bg-gradient-to-b from-zinc-700 to-zinc-950 flex items-center justify-center text-zinc-200 border border-white/20 relative overflow-hidden shadow-md">
                          <Camera className="w-6 h-6 text-zinc-200" />
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow-md tracking-tight">Camera</span>
                      </button>
                    </div>

                    {/* Translucent Glass Dock */}
                    <div className={`w-full ${isPerformanceMode ? 'bg-[#0f1115]/95' : 'bg-black/45 backdrop-blur-3xl'} border border-white/15 rounded-[28px] p-2 px-3 flex justify-around shadow-2xl mb-1 mt-auto`}>
                      <button type="button" onClick={() => setActiveApp('Messages')} className="active:scale-90 transition-transform cursor-pointer">
                        <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-emerald-400 to-emerald-600 flex items-center justify-center text-white border border-white/20">
                          <MessageSquare className="w-5.5 h-5.5 fill-white/15 text-white" />
                        </div>
                      </button>
                      <button type="button" onClick={() => setActiveApp('Camera')} className="active:scale-90 transition-transform cursor-pointer">
                        <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-zinc-700 to-zinc-950 flex items-center justify-center text-zinc-200 border border-white/20">
                          <Camera className="w-5.5 h-5.5 text-zinc-200" />
                        </div>
                      </button>
                      <button type="button" onClick={() => setActiveApp('Gallery')} className="active:scale-90 transition-transform cursor-pointer">
                        <div className="w-11 h-11 rounded-[13px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white border border-white/20">
                          <ImageIcon className="w-5 h-5 text-white" />
                        </div>
                      </button>
                      <button type="button" onClick={() => setActiveApp('Settings')} className="active:scale-90 transition-transform cursor-pointer">
                        <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-zinc-500 to-zinc-800 flex items-center justify-center text-white border border-white/20">
                          <Settings className="w-5.5 h-5.5 text-zinc-100" />
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* OPENED APP VIEWPORT */
                  <div className={`flex-1 flex flex-col ${isPerformanceMode ? 'bg-[#0d0e12]' : 'bg-[#0b0c10]/95 backdrop-blur-3xl'} overflow-hidden z-30 pt-10 ${activeApp === 'Messages' && activeMessageThread ? 'pb-0' : 'pb-8'}`}>
                    {/* App Navbar */}
                    <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeMessageThread) {
                            setActiveMessageThread(null);
                          } else {
                            setActiveApp(null);
                          }
                        }}
                        className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>
                      <span className="font-bold text-[11px] text-white/95 uppercase tracking-wider truncate max-w-[150px]">
                        {activeMessageThread 
                          ? [...personas, ...customContacts].find(p => p.id === activeMessageThread)?.name || 'Companion' 
                          : activeApp}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setActiveApp(null); setActiveMessageThread(null); }}
                        className="text-[10px] text-white/80 hover:text-white px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 transition-all font-semibold border border-white/10 cursor-pointer"
                      >
                        Home
                      </button>
                    </div>

                    {/* App Sub-Screens */}
                    <div className={`flex-1 ${
                      activeApp === 'Messages' && activeMessageThread 
                        ? 'flex flex-col overflow-hidden' 
                        : 'overflow-y-auto pb-4'
                    }`}>
                      
                      {/* MESSAGES APP - THREAD LIST */}
                      {activeApp === 'Messages' && !activeMessageThread && (
                        <div className="p-3.5 space-y-2 flex flex-col h-full">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Companions & Contacts</span>
                            <button
                              type="button"
                              onClick={() => setIsAddingContact(true)}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 px-2.5 py-1 rounded-full transition-all"
                            >
                              <span>+ Add Contact</span>
                            </button>
                          </div>

                          {/* Add Contact Modal/Inline Form */}
                          {isAddingContact && (
                            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 mb-2">
                              <div className="text-[10px] font-bold text-white uppercase tracking-wider">New Custom Contact</div>
                              <input
                                type="text"
                                value={newContactName || ''}
                                onChange={(e) => setNewContactName(e.target.value)}
                                placeholder="Contact Name (e.g. Delivery)"
                                className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-white/30"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAddingContact(false);
                                    setNewContactName('');
                                  }}
                                  className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-semibold cursor-pointer transition-all"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (newContactName.trim()) {
                                      const newContact = {
                                        id: `custom-contact-${Date.now()}`,
                                        name: newContactName.trim(),
                                        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', // elegant default image
                                      };
                                      const nextContacts = [...customContacts, newContact];
                                      onUpdateCharacterState('phone', 'customContacts', nextContacts);
                                      
                                      // Auto select the new contact's thread to send a message immediately!
                                      setActiveMessageThread(newContact.id);
                                      
                                      setIsAddingContact(false);
                                      setNewContactName('');
                                    }
                                  }}
                                  className="flex-1 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition-all"
                                >
                                  Save Contact
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
                            {visiblePersonas.length === 0 ? (
                              <div className="text-center py-6 text-[11px] text-white/40 italic">
                                No linked companions in this world. Click "+ Add Contact" to create custom contacts.
                              </div>
                            ) : (
                              visiblePersonas.map(p => {
                                const charThreads = Array.isArray(threads?.[p.id]) ? threads[p.id] : [];
                                const lastMsg = charThreads[charThreads.length - 1];
                                const hasUnread = charThreads.some((m: any) => !m.isUser && m.unread);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setActiveMessageThread(p.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                                      hasUnread 
                                        ? 'bg-indigo-500/[0.08] border-indigo-500/25 shadow-sm' 
                                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-white/10'
                                    }`}
                                  >
                                    <div className="relative">
                                      <SafeImage src={p.avatar} referrerPolicy="no-referrer" className={`w-10 h-10 rounded-xl object-cover bg-white/10 border border-white/10 ${deadCharacterIds.has(p.id) ? 'grayscale opacity-60' : ''}`} alt="" />
                                      {deadCharacterIds.has(p.id) ? (
                                        <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">💀</span>
                                      ) : null}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                      <div className="flex items-center justify-between mb-0.5">
                                        <div className="font-bold text-xs text-white">{p.name}</div>
                                        {hasUnread && (
                                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
                                        )}
                                      </div>
                                      <div className={`text-[10px] truncate ${hasUnread ? 'text-indigo-300 font-medium' : 'text-white/50'}`}>
                                        {lastMsg ? (lastMsg.image ? '📷 [Photo] ' + (lastMsg.text || '') : lastMsg.text) : 'Tap to start direct messaging...'}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* MESSAGES APP - DIRECT MESSAGE CHAT */}
                      {activeApp === 'Messages' && activeMessageThread && (() => {
                        const activeContact = [...personas, ...customContacts].find(p => p.id === activeMessageThread);

                        const handleSendInline = () => {
                          if (inlineMsgText.trim() || inlineAttachedImage) {
                            const currentThread = Array.isArray(threads?.[activeMessageThread]) ? threads[activeMessageThread] : [];
                            const textToSend = inlineMsgText.trim();
                            const imageToSend = inlineAttachedImage || undefined;
                            const userMsg = { text: textToSend, image: imageToSend, isUser: true, timestamp: Date.now() };
                            const newThreads = {
                              ...threads,
                              [activeMessageThread]: [
                                ...currentThread,
                                userMsg
                              ]
                            };
                            onUpdateCharacterState('phone', 'threads', newThreads);
                            
                            let finalMsg = textToSend;
                            if (imageToSend) {
                              finalMsg = `*[Sent a photo via messenger]:* ${textToSend || '(Sent an image attachment)'}`;
                            }
                            onSendMessage(activeMessageThread, finalMsg, userMsg);
                            setInlineMsgText('');
                            setInlineAttachedImage(null);
                            if (inlineTextareaRef.current) {
                              inlineTextareaRef.current.style.height = 'auto';
                            }
                          }
                        };

                        return (
                          <div className="flex flex-col flex-1 overflow-hidden h-full">
                            {/* Contact Header Bar (Status / Online) */}
                            <div className="px-3.5 py-2 bg-black/30 border-b border-white/5 flex items-center gap-2 flex-shrink-0">
                              <div className="relative flex-shrink-0">
                                <SafeImage 
                                  src={activeContact?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                                  referrerPolicy="no-referrer"
                                  className={`w-7 h-7 rounded-lg object-cover border border-white/10 ${activeContact && deadCharacterIds.has(activeContact.id) ? 'grayscale opacity-60' : ''}`} 
                                  alt="" 
                                />
                                {activeContact && deadCharacterIds.has(activeContact.id) ? (
                                  <span className="absolute -bottom-1 -right-1 text-[10px] leading-none">💀</span>
                                ) : null}
                              </div>
                              <div className="overflow-hidden">
                                <div className="text-[11px] font-bold text-white leading-tight truncate">
                                  {activeContact?.name || 'Companion'}
                                </div>
                                {activeContact && deadCharacterIds.has(activeContact.id) ? (
                                  <div className="text-[9px] text-rose-400 font-semibold leading-none flex items-center gap-1 mt-0.5">Deceased 💀</div>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                              <div className="text-center py-1">
                                <span className="text-[8px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-medium tracking-wider uppercase">
                                  Encrypted Direct Chat
                                </span>
                              </div>
                              {(Array.isArray(threads?.[activeMessageThread]) ? threads[activeMessageThread] : []).map((msg: any, i: number) => {
                                const rawText = typeof msg.text === 'string' ? msg.text : '';
                                // Separate message text by empty spaces / double newlines into distinct bubble boxes
                                const textBlocks = rawText.trim()
                                  ? rawText.split(/\n\s*\n+/).map((b: string) => b.trim()).filter(Boolean)
                                  : [];

                                return (
                                  <div key={i} className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'} gap-1`}>
                                    {msg.image && (
                                      <div className={`max-w-[82%] rounded-2xl p-1 shadow-sm ${msg.isUser ? 'bg-indigo-600 rounded-br-sm' : 'bg-white/10 rounded-bl-sm border border-white/10'}`}>
                                        <SafeImage 
                                          src={msg.image} 
                                          referrerPolicy="no-referrer" 
                                          className="w-full max-w-[170px] rounded-xl object-cover border border-white/10 shadow-sm" 
                                          alt="Sent file" 
                                        />
                                      </div>
                                    )}
                                    {textBlocks.length > 0 ? (
                                      textBlocks.map((block: string, blockIdx: number) => (
                                        <div 
                                          key={blockIdx} 
                                          className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-md backdrop-blur-md ${
                                            msg.isUser 
                                              ? 'bg-indigo-600/90 text-white rounded-br-sm border border-indigo-400/30' 
                                              : 'bg-white/15 text-white/95 rounded-bl-sm border border-white/20'
                                          }`}
                                        >
                                          <p className="whitespace-pre-wrap">{block}</p>
                                        </div>
                                      ))
                                    ) : (
                                      !msg.image && (
                                        <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                                          msg.isUser 
                                            ? 'bg-indigo-600 text-white rounded-br-sm' 
                                            : 'bg-white/10 text-white/95 rounded-bl-sm border border-white/10'
                                        }`}>
                                          <p className="whitespace-pre-wrap opacity-60">...</p>
                                        </div>
                                      )
                                    )}
                                  </div>
                                );
                              })}

                              {/* Real-time typing indicator */}
                              {typingContactId === activeMessageThread && (
                                <div className="flex justify-start">
                                  <div className="bg-white/10 text-white/70 rounded-2xl rounded-bl-none px-3 py-2 text-xs border border-white/5 flex items-center gap-1.5 shadow-sm">
                                    <span className="font-medium text-[10px]">typing</span>
                                    <span className="flex gap-1">
                                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div ref={messagesEndRef} />
                            </div>

                            {/* Direct Message Input Bar with Multiline and Send */}
                            <div className="p-2 bg-black/70 border-t border-white/10 flex flex-col gap-1.5 mt-auto">
                              {inlineAttachedImage && (
                                <div className="relative self-start bg-white/5 border border-white/15 p-1 rounded-xl">
                                  <SafeImage src={inlineAttachedImage} className="w-14 h-14 rounded-lg object-cover" alt="Attached preview" />
                                  <button
                                    type="button"
                                    onClick={() => setInlineAttachedImage(null)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs shadow-md"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                              <div className="flex items-end gap-1.5">
                                <label className="p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center cursor-pointer transition-colors border border-white/10 flex-shrink-0" title="Attach Photo">
                                  <ImagePlus className="w-4 h-4 text-indigo-400" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                          if (ev.target?.result) setInlineAttachedImage(ev.target.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>

                                <textarea
                                  ref={inlineTextareaRef}
                                  rows={1}
                                  value={inlineMsgText}
                                  onChange={(e) => {
                                    setInlineMsgText(e.target.value);
                                    if (inlineTextareaRef.current) {
                                      inlineTextareaRef.current.style.height = 'auto';
                                      inlineTextareaRef.current.style.height = `${Math.min(inlineTextareaRef.current.scrollHeight, 90)}px`;
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSendInline();
                                    }
                                  }}
                                  placeholder="Message (Enter for new line)..."
                                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-indigo-500/50 resize-none max-h-24 min-h-[36px] leading-relaxed"
                                />

                                <button
                                  type="button"
                                  onClick={() => setIsGlobalComposerOpen(true)}
                                  title="Open Full Composer"
                                  className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center cursor-pointer transition-colors border border-white/10 flex-shrink-0"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={handleSendInline}
                                  disabled={!inlineMsgText.trim() && !inlineAttachedImage}
                                  className={`p-2 rounded-xl text-white transition-all flex items-center justify-center flex-shrink-0 shadow-sm ${
                                    inlineMsgText.trim() || inlineAttachedImage
                                      ? 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 cursor-pointer'
                                      : 'bg-white/10 text-white/30 cursor-not-allowed'
                                  }`}
                                  title="Send Message"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* CAMERA APP */}
                      {activeApp === 'Camera' && (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Camera className="w-5 h-5 text-emerald-400" />
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Realm Capture Engine</h3>
                          </div>

                          {saveSuccess && (
                            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 animate-bounce" /> Photo saved to Realm Gallery!
                            </div>
                          )}

                          {cameraError && (
                            <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-2">
                              <ShieldAlert className="w-3.5 h-3.5" /> {cameraError}
                            </div>
                          )}

                          <div className="space-y-2">
                            {!cameraImage ? (
                              <label className="border-2 border-dashed border-white/10 hover:border-indigo-500/40 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                                <Upload className="w-6 h-6 text-indigo-400" />
                                <span className="text-[11px] font-bold text-white/90">Select Photo to Import</span>
                                <span className="text-[9px] text-white/45">Supports PNG, JPG, GIF</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    setCameraError(null);
                                    handleFileUpload(e, (res) => setCameraImage(res));
                                  }}
                                />
                              </label>
                            ) : (
                              <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40">
                                <SafeImage src={cameraImage} referrerPolicy="no-referrer" className="w-full h-36 object-cover" alt="" />
                                <button
                                  type="button"
                                  onClick={() => setCameraImage('')}
                                  className="absolute top-2 right-2 px-2.5 py-1 bg-rose-600/90 hover:bg-rose-600 text-white font-bold rounded-lg text-[9px] cursor-pointer shadow-md"
                                >
                                  Remove
                                </button>
                              </div>
                            )}

                            <input
                              type="text"
                              value={cameraCaption || ''}
                              onChange={(e) => {
                                setCameraError(null);
                                setCameraCaption(e.target.value);
                              }}
                              placeholder="Photo Title (Required) *"
                              className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/40"
                            />

                            <textarea
                              value={cameraDesc || ''}
                              onChange={(e) => setCameraDesc(e.target.value)}
                              placeholder="Share your companion story notes..."
                              className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/40 h-14 resize-none"
                            />

                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={cameraPeople || ''}
                                onChange={(e) => setCameraPeople(e.target.value)}
                                placeholder="With whom?"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white placeholder-white/30 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={cameraLoc || ''}
                                onChange={(e) => setCameraLoc(e.target.value)}
                                placeholder="Location name"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white placeholder-white/30 focus:outline-none"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (!cameraCaption.trim()) {
                                  setCameraError('Photo Title is required to save.');
                                  return;
                                }
                                const finalUrl = (cameraImage || '').trim() || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600';
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
                                setCameraImage('');
                                setCameraCaption('');
                                setCameraDesc('');
                                setCameraPeople('');
                                setCameraLoc('');
                                setTimeout(() => {
                                  setSaveSuccess(false);
                                  setActiveApp('Gallery');
                                }, 500);
                              }}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md"
                            >
                              Save to Gallery Memory
                            </button>
                          </div>
                        </div>
                      )}

                      {/* GALLERY APP */}
                      {activeApp === 'Gallery' && (
                        <div className="p-3 space-y-3">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-bold text-white/55 tracking-wider uppercase">Gallery ({gallery.length})</span>
                            <button
                              type="button"
                              onClick={() => setActiveApp('Camera')}
                              className="text-[10px] text-indigo-400 font-bold flex items-center gap-1 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-500/20 px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                            >
                              <ImagePlus className="w-3 h-3" /> Add Memories
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {gallery.length > 0 ? gallery.map((img: any, i: number) => (
                              <div key={i} className="bg-white/[0.03] rounded-xl overflow-hidden border border-white/5 flex flex-col relative group">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = gallery.filter((_: any, idx: number) => idx !== i);
                                    onUpdateCharacterState('phone', 'gallery', updated);
                                  }}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                                  title="Delete Photo"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                                <div className="h-24 bg-black/40 relative">
                                  <SafeImage src={img.url} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                                </div>
                                <div className="p-2 space-y-0.5">
                                  <div className="font-bold text-[10px] text-white truncate">{img.caption}</div>
                                  <div className="text-[8px] text-white/50 truncate">{img.location || 'Realm Location'}</div>
                                </div>
                              </div>
                            )) : (
                              <div className="col-span-2 py-16 text-center text-white/40 text-xs flex flex-col items-center gap-2">
                                <ImageIcon className="w-8 h-8 text-white/20" />
                                <span>No memories here yet. Capture files using Camera.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* SOCIAL APP */}
                      {activeApp === 'Social' && (() => {
                        const followingList = Array.isArray(phoneData.following) ? phoneData.following : [];
                        const userPosts = resolvedFeed.filter((p: any) => p.authorId === 'user' || p.author === 'You');
                        const userTotalLikes = userPosts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0);

                        return (
                          <div className="flex flex-col flex-1 overflow-hidden h-full">
                            {/* App Header */}
                            <div className="px-3.5 py-2.5 bg-black/40 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                              <span className="text-[12px] font-extrabold text-white tracking-wider font-mono flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                RealmConnect
                              </span>
                              
                              {selectedSocialProfile && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSocialProfile(null)}
                                  className="text-[10px] text-white/50 hover:text-white flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded-lg border border-white/5 cursor-pointer"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                  Back
                                </button>
                              )}
                            </div>

                            {/* Sub Tabs Navigation */}
                            {!selectedSocialProfile && (
                              <div className="flex border-b border-white/5 bg-black/15 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => { setSocialTab('feed'); }}
                                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-all ${socialTab === 'feed' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-white/[0.02]' : 'text-white/40 hover:text-white/70'}`}
                                >
                                  Feed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setSocialTab('discover'); }}
                                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-all ${socialTab === 'discover' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-white/[0.02]' : 'text-white/40 hover:text-white/70'}`}
                                >
                                  Discover
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setSocialTab('myprofile'); }}
                                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-all ${socialTab === 'myprofile' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-white/[0.02]' : 'text-white/40 hover:text-white/70'}`}
                                >
                                  My Profile
                                </button>
                              </div>
                            )}

                            {/* Main Content Area */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
                              {/* 1. DETAILED PROFILE VIEW */}
                              {selectedSocialProfile ? (() => {
                                const isUser = selectedSocialProfile === 'user';
                                const companion = [...personas, ...customContacts].find(p => p.id === selectedSocialProfile);
                                
                                const name = isUser ? (currentPersonaName || activeUserPersona?.name ? `${currentPersonaName || activeUserPersona?.name} (You)` : 'You') : (companion?.name || 'Unknown');
                                const avatar = isUser ? (activeUserPersona?.avatar || '') : (companion?.avatar || '');
                                const bio = isUser 
                                  ? "Wandering explorer of dynamic realms. Crafting my own journey in this world." 
                                  : (companion?.description || companion?.personality || "A mysterious soul of this realm.");
                                
                                const stats = isUser 
                                  ? { followers: 142, following: followingList.length, likes: userTotalLikes, isFollowing: false }
                                  : getCharacterStats(selectedSocialProfile);
                                
                                const posts = resolvedFeed.filter((p: any) => p.authorId === selectedSocialProfile || (!isUser && p.author === name));

                                return (
                                  <div className="space-y-4">
                                    {/* Profile Card Header */}
                                    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl space-y-3">
                                      <div className="flex items-center gap-3.5">
                                        <div className="relative">
                                          <SafeImage 
                                            src={avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                                            referrerPolicy="no-referrer"
                                            className={`w-14 h-14 rounded-2xl object-cover border border-white/10 ${!isUser && deadCharacterIds.has(selectedSocialProfile) ? 'grayscale opacity-60' : ''}`}
                                            alt="" 
                                          />
                                          {!isUser && deadCharacterIds.has(selectedSocialProfile) && (
                                            <span className="absolute -bottom-1 -right-1 text-base leading-none">💀</span>
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <h4 className="text-xs font-extrabold text-white truncate flex items-center gap-1.5">
                                            {name}
                                            {!isUser && deadCharacterIds.has(selectedSocialProfile) && (
                                              <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30">Deceased</span>
                                            )}
                                          </h4>
                                          <p className="text-[9px] text-white/40 mt-0.5 truncate font-mono">@realm_{name.toLowerCase().replace(/[^a-z0-9]/g, '')}</p>
                                        </div>
                                      </div>

                                      {/* Instagram Style Statistics Row */}
                                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5 text-center bg-black/10 rounded-xl">
                                        <div>
                                          <div className="text-xs font-bold text-white">{stats.followers}</div>
                                          <div className="text-[8px] text-white/40 uppercase tracking-wider font-semibold">Followers</div>
                                        </div>
                                        <div>
                                          <div className="text-xs font-bold text-white">{stats.following}</div>
                                          <div className="text-[8px] text-white/40 uppercase tracking-wider font-semibold">Following</div>
                                        </div>
                                        <div>
                                          <div className="text-xs font-bold text-white">{stats.likes}</div>
                                          <div className="text-[8px] text-white/40 uppercase tracking-wider font-semibold">Likes</div>
                                        </div>
                                      </div>

                                      {/* Bio Section */}
                                      <div className="text-[10px] text-white/70 leading-relaxed italic bg-white/[0.01] p-2.5 rounded-xl border border-white/5">
                                        {bio}
                                      </div>

                                      {/* Follow/Unfollow Button (Only for other characters) */}
                                      {!isUser && !deadCharacterIds.has(selectedSocialProfile) && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            triggerHaptic();
                                            let nextFollowing = [...followingList];
                                            if (stats.isFollowing) {
                                              nextFollowing = nextFollowing.filter(id => id !== selectedSocialProfile);
                                            } else {
                                              nextFollowing.push(selectedSocialProfile);
                                            }
                                            onUpdateCharacterState('phone', 'following', nextFollowing);
                                          }}
                                          className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            stats.isFollowing 
                                              ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                          }`}
                                        >
                                          {stats.isFollowing ? '✓ Following' : '+ Follow'}
                                        </button>
                                      )}
                                    </div>

                                    {/* Posts Listing Header */}
                                    <h5 className="text-[9px] font-bold text-white/40 uppercase tracking-wider pl-1 font-mono">Posts</h5>

                                    {/* Posts List */}
                                    <div className="space-y-3">
                                      {posts.length === 0 ? (
                                        <div className="p-8 text-center text-white/30 text-[10px] bg-white/[0.02] border border-white/5 rounded-2xl italic">
                                          No posts created yet.
                                        </div>
                                      ) : (
                                        posts.map((post: any, i: number) => (
                                          <div key={post.id || i} className="p-3 bg-white/[0.03] border border-white/5 rounded-2xl space-y-2.5">
                                            <div className="flex items-center gap-2">
                                              <SafeImage 
                                                src={avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                                                referrerPolicy="no-referrer"
                                                className={`w-6 h-6 rounded-lg object-cover border border-white/10 ${!isUser && deadCharacterIds.has(selectedSocialProfile) ? 'grayscale opacity-60' : ''}`}
                                                alt="" 
                                              />
                                              <div>
                                                <div className="font-bold text-[10px] text-white">{name}</div>
                                                <div className="text-[7px] text-white/30">Just now</div>
                                              </div>
                                            </div>
                                            
                                            <p className="text-[10px] text-white/85 leading-relaxed">{post.content}</p>
                                            
                                            {post.image && (
                                              <div className="rounded-xl overflow-hidden border border-white/5 max-h-48 bg-black/20">
                                                <SafeImage src={post.image} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                                              </div>
                                            )}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                );
                              })() : (
                                <>
                                  {/* 2. FEED TAB */}
                                  {socialTab === 'feed' && (
                                    <div className="space-y-3">
                                      {/* New Post Box */}
                                      <div className="p-3 bg-white/[0.03] border border-white/5 rounded-2xl space-y-2.5">
                                        <textarea
                                          value={socialInput || ''}
                                          onChange={(e) => setSocialInput(e.target.value)}
                                          placeholder="What's on your mind? Broadcast to the realm..."
                                          className="w-full bg-transparent text-xs text-white resize-none focus:outline-none min-h-[50px] placeholder-white/30 font-sans"
                                        />

                                        {/* Attachment Preview */}
                                        {socialImage && (
                                          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40 max-h-36">
                                            <SafeImage src={socialImage} className="w-full h-full object-cover" alt="Selected Attachment" />
                                            <button
                                              type="button"
                                              onClick={() => setSocialImage(null)}
                                              className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-black/90 rounded-full text-white/80 hover:text-white border border-white/15 cursor-pointer"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        )}

                                        <div className="flex justify-between items-center pt-1 border-t border-white/5">
                                          {/* File upload trigger */}
                                          <label className="p-1.5 text-white/50 hover:text-white bg-white/[0.04] border border-white/5 rounded-xl flex items-center justify-center cursor-pointer transition-all">
                                            <ImagePlus className="w-4 h-4 text-indigo-400" />
                                            <span className="text-[9px] font-bold text-white/60 ml-1">Photo</span>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              onChange={(e) => {
                                                handleFileUpload(e, (res) => {
                                                  setSocialImage(res);
                                                });
                                              }}
                                            />
                                          </label>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (socialInput.trim() || socialImage) {
                                                const authorName = currentPersonaName || activeUserPersona?.name || 'You';
                                                const newPost: any = {
                                                  id: `post-${Date.now()}`,
                                                  authorId: 'user',
                                                  author: authorName,
                                                  authorAvatar: activeUserPersona?.avatar || '',
                                                  content: socialInput.trim(),
                                                  image: socialImage || undefined,
                                                  timestamp: Date.now(),
                                                  likes: 0,
                                                  likedByUser: false,
                                                  comments: []
                                                };
                                                
                                                const updatedFeed = [newPost, ...resolvedFeed];
                                                onUpdateCharacterState('phone', 'socialFeed', updatedFeed);
                                                
                                                // Trigger global world effect and companion reaction
                                                if (onPostSocialUpdate) {
                                                  onPostSocialUpdate(socialInput.trim(), socialImage || undefined);
                                                }
                                                
                                                setSocialInput('');
                                                setSocialImage(null);

                                                // Trigger automatic dynamic comment from random linked companion
                                                setTimeout(() => {
                                                  const aliveCompanions = visiblePersonas.filter(p => p.id !== 'user' && !deadCharacterIds.has(p.id));
                                                  if (aliveCompanions.length > 0) {
                                                    const commenter = aliveCompanions[Math.floor(Math.random() * aliveCompanions.length)];
                                                    const latestFeed = characterState?.phone?.socialFeed || defaultSocialFeed;
                                                    
                                                    const commentsList = [
                                                      "Wow, this is incredibly fascinating! 😮✨",
                                                      "Fascinating. The parameters of this world continue to surprise us.",
                                                      "Absolutely spectacular! Let's talk about this soon.",
                                                      "I saw this! We should totally explore this further next time.",
                                                      "This represents a significant development, doesn't it?"
                                                    ];
                                                    const randomComment = commentsList[Math.floor(Math.random() * commentsList.length)];

                                                    const feedWithComment = latestFeed.map((p: any) => {
                                                      if (p.id === newPost.id) {
                                                        return {
                                                          ...p,
                                                          likes: p.likes + 1,
                                                          comments: [
                                                            ...p.comments,
                                                            {
                                                              id: `c-${Date.now()}`,
                                                              authorId: commenter.id,
                                                              author: commenter.name,
                                                              authorAvatar: commenter.avatar,
                                                              content: randomComment,
                                                              timestamp: Date.now()
                                                            }
                                                          ]
                                                        };
                                                      }
                                                      return p;
                                                    });
                                                    onUpdateCharacterState('phone', 'socialFeed', feedWithComment);
                                                  }
                                                }, 3000);
                                              }
                                            }}
                                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-bold text-white cursor-pointer shadow-md transition-all active:scale-95"
                                          >
                                            Post Update
                                          </button>
                                        </div>
                                      </div>

                                      {/* Feed Posts List */}
                                      <div className="space-y-3">
                                        {resolvedFeed.map((post: any, i: number) => {
                                          const isDeadAuthor = post.authorId !== 'user' && deadCharacterIds.has(post.authorId);
                                          const authorContact = [...personas, ...customContacts].find(p => p.id === post.authorId);

                                          return (
                                            <div key={post.id || i} className="p-3 bg-white/[0.03] border border-white/5 rounded-2xl space-y-2.5">
                                              {/* Post Header */}
                                              <div className="flex items-center justify-between">
                                                <button
                                                  type="button"
                                                  onClick={() => setSelectedSocialProfile(post.authorId || 'user')}
                                                  className="flex items-center gap-2 group text-left cursor-pointer"
                                                >
                                                  <div className="relative">
                                                    <SafeImage 
                                                      src={post.authorAvatar || authorContact?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                                                      referrerPolicy="no-referrer"
                                                      className={`w-7 h-7 rounded-lg object-cover border border-white/10 ${isDeadAuthor ? 'grayscale opacity-60' : ''}`} 
                                                      alt="" 
                                                    />
                                                    {isDeadAuthor && (
                                                      <span className="absolute -bottom-1 -right-1 text-[9px] leading-none">💀</span>
                                                    )}
                                                  </div>
                                                  <div>
                                                    <div className="font-bold text-[10px] text-white group-hover:text-indigo-400 transition-colors flex items-center gap-1">
                                                      {post.author}
                                                      {isDeadAuthor && (
                                                        <span className="text-[8px] scale-90 leading-none">💀</span>
                                                      )}
                                                    </div>
                                                    <div className="text-[7px] text-white/30 font-mono">@realm_{post.author.toLowerCase().replace(/[^a-z0-9]/g, '')}</div>
                                                  </div>
                                                </button>
                                              </div>

                                              {/* Post Content */}
                                              <p className="text-[10px] text-white/80 leading-relaxed">{post.content}</p>

                                              {/* Post Image */}
                                              {post.image && (
                                                <div className="rounded-xl overflow-hidden border border-white/5 max-h-48 bg-black/20">
                                                  <SafeImage src={post.image} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                                                </div>
                                              )}

                                              {/* Action Buttons (Like / Comment) */}
                                              <div className="flex items-center gap-4 pt-1 border-t border-white/5 text-[9px] font-bold text-white/40">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    triggerHaptic();
                                                    const updatedFeed = resolvedFeed.map((p: any) => {
                                                      if (p.id === post.id) {
                                                        const liked = !p.likedByUser;
                                                        return {
                                                          ...p,
                                                          likedByUser: liked,
                                                          likes: liked ? (p.likes || 0) + 1 : Math.max(0, (p.likes || 0) - 1)
                                                        };
                                                      }
                                                      return p;
                                                    });
                                                    onUpdateCharacterState('phone', 'socialFeed', updatedFeed);
                                                  }}
                                                  className={`flex items-center gap-1 cursor-pointer transition-colors ${post.likedByUser ? 'text-rose-500' : 'hover:text-white'}`}
                                                >
                                                  <Heart className={`w-3.5 h-3.5 ${post.likedByUser ? 'fill-rose-500 text-rose-500' : ''}`} />
                                                  <span>{post.likes || 0} Likes</span>
                                                </button>

                                                <div className="flex items-center gap-1">
                                                  <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                                                  <span>{post.comments?.length || 0} Comments</span>
                                                </div>
                                              </div>

                                              {/* Comments List & Input */}
                                              <div className="space-y-2 pt-2 border-t border-white/5 bg-black/10 -mx-3 -mb-3 p-3 rounded-b-2xl">
                                                {/* Actual Comments */}
                                                {post.comments && post.comments.length > 0 && (
                                                  <div className="space-y-2 max-h-24 overflow-y-auto pr-0.5">
                                                    {post.comments.map((comment: any, cIdx: number) => {
                                                      const isDeadCommenter = comment.authorId && deadCharacterIds.has(comment.authorId);
                                                      return (
                                                        <div key={comment.id || cIdx} className="flex gap-1.5 text-[9px]">
                                                          <SafeImage 
                                                            src={comment.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                                                            referrerPolicy="no-referrer"
                                                            className={`w-4 h-4 rounded object-cover flex-shrink-0 ${isDeadCommenter ? 'grayscale opacity-60' : ''}`} 
                                                            alt="" 
                                                          />
                                                          <div className="bg-white/[0.02] border border-white/5 p-1.5 rounded-lg flex-1 leading-normal">
                                                            <span className="font-extrabold text-white mr-1 flex items-center gap-0.5">
                                                              {comment.author}
                                                              {isDeadCommenter && <span>💀</span>}
                                                            </span>
                                                            <span className="text-white/70">{comment.content}</span>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}

                                                {/* Comment Input */}
                                                <div className="flex gap-1.5 items-center">
                                                  <input
                                                    type="text"
                                                    value={socialCommentInput[post.id] || ''}
                                                    onChange={(e) => setSocialCommentInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                                                    placeholder="Write a comment..."
                                                    className="bg-white/[0.03] border border-white/5 rounded-lg px-2 py-1 text-[10px] text-white flex-1 focus:outline-none placeholder-white/20"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const text = socialCommentInput[post.id]?.trim();
                                                      if (text) {
                                                        const userName = currentPersonaName || activeUserPersona?.name || 'You';
                                                        const newComment = {
                                                          id: `c-${Date.now()}`,
                                                          authorId: 'user',
                                                          author: userName,
                                                          authorAvatar: activeUserPersona?.avatar || '',
                                                          content: text,
                                                          timestamp: Date.now()
                                                        };

                                                        const updatedFeed = resolvedFeed.map((p: any) => {
                                                          if (p.id === post.id) {
                                                            return {
                                                              ...p,
                                                              comments: [...(p.comments || []), newComment]
                                                            };
                                                          }
                                                          return p;
                                                        });

                                                        onUpdateCharacterState('phone', 'socialFeed', updatedFeed);
                                                        setSocialCommentInput(prev => ({ ...prev, [post.id]: '' }));

                                                        // Trigger character reply comment if user commented on character's post
                                                        if (post.authorId !== 'user' && !isDeadAuthor) {
                                                          setTimeout(() => {
                                                            const latestFeed = characterState?.phone?.socialFeed || defaultSocialFeed;
                                                            const currentPost = latestFeed.find((p: any) => p.id === post.id);
                                                            if (currentPost) {
                                                              const replyComment = {
                                                                id: `c-${Date.now() + 1}`,
                                                                authorId: post.authorId,
                                                                author: post.author,
                                                                authorAvatar: post.authorAvatar,
                                                                content: `Thank you for commenting, ${userName}! It means so much. ✨❤️`,
                                                                timestamp: Date.now()
                                                              };
                                                              const feedWithReply = latestFeed.map((p: any) => {
                                                                if (p.id === post.id) {
                                                                  return {
                                                                    ...p,
                                                                    comments: [...(p.comments || []), replyComment]
                                                                  };
                                                                }
                                                                return p;
                                                              });
                                                              onUpdateCharacterState('phone', 'socialFeed', feedWithReply);
                                                            }
                                                          }, 1500);
                                                        }
                                                      }
                                                    }}
                                                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold cursor-pointer transition-all active:scale-95 flex items-center justify-center border-none"
                                                  >
                                                    <Send className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* 3. DISCOVER TAB */}
                                  {socialTab === 'discover' && (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-2">
                                        {visiblePersonas.map((char) => {
                                          const stats = getCharacterStats(char.id);
                                          const isDead = deadCharacterIds.has(char.id);
                                          return (
                                            <div 
                                              key={char.id} 
                                              className="p-3 bg-white/[0.03] border border-white/5 rounded-2xl flex flex-col items-center text-center space-y-2"
                                            >
                                              <div className="relative">
                                                <SafeImage 
                                                  src={char.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                                                  referrerPolicy="no-referrer"
                                                  className={`w-12 h-12 rounded-xl object-cover border border-white/10 ${isDead ? 'grayscale opacity-60' : ''}`} 
                                                  alt="" 
                                                />
                                                {isDead && (
                                                  <span className="absolute -bottom-1 -right-1 text-xs leading-none">💀</span>
                                                )}
                                              </div>
                                              <div className="min-w-0 w-full">
                                                <div className="font-bold text-[10px] text-white truncate flex items-center justify-center gap-1">
                                                  {char.name}
                                                  {isDead && <span className="text-[8px]">💀</span>}
                                                </div>
                                                <div className="text-[7.5px] text-white/40 font-mono truncate">@realm_{char.name.toLowerCase().replace(/[^a-z0-9]/g, '')}</div>
                                              </div>

                                              <div className="flex gap-2 text-[8px] text-white/50 w-full justify-around pt-1 border-t border-white/5">
                                                <div>
                                                  <div className="font-bold text-white/80">{stats.followers}</div>
                                                  <div>Followers</div>
                                                </div>
                                                <div>
                                                  <div className="font-bold text-white/80">{stats.likes}</div>
                                                  <div>Likes</div>
                                                </div>
                                              </div>

                                              <button
                                                type="button"
                                                onClick={() => { setSelectedSocialProfile(char.id); }}
                                                className="w-full py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-[9px] font-bold text-white transition-all cursor-pointer"
                                              >
                                                View Profile
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* 4. MY PROFILE TAB */}
                                  {socialTab === 'myprofile' && (() => {
                                    const uName = currentPersonaName || activeUserPersona?.name || 'Explorer';
                                    const uAvatar = activeUserPersona?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
                                    const uBio = activeUserPersona?.description || "Wandering explorer of dynamic realms. Crafting my own journey in this world.";
                                    const uHandle = uName.toLowerCase().replace(/[^a-z0-9]/g, '');

                                    return (
                                      <div className="space-y-4">
                                        {/* User Profile Info Card */}
                                        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl space-y-3">
                                          <div className="flex items-center gap-3.5">
                                            <SafeImage 
                                              src={uAvatar} 
                                              referrerPolicy="no-referrer"
                                              className="w-14 h-14 rounded-2xl object-cover border border-white/10 bg-white/5" 
                                              alt="" 
                                            />
                                            <div className="flex-1 min-w-0">
                                              <h4 className="text-xs font-extrabold text-white truncate">
                                                {uName} (You)
                                              </h4>
                                              <p className="text-[9px] text-white/40 mt-0.5 truncate font-mono">@realm_{uHandle}</p>
                                            </div>
                                          </div>

                                          {/* Stats Row */}
                                          <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5 text-center bg-black/10 rounded-xl">
                                            <div>
                                              <div className="text-xs font-bold text-white">142</div>
                                              <div className="text-[8px] text-white/40 uppercase tracking-wider font-semibold">Followers</div>
                                            </div>
                                            <div>
                                              <div className="text-xs font-bold text-white">{followingList.length}</div>
                                              <div className="text-[8px] text-white/40 uppercase tracking-wider font-semibold">Following</div>
                                            </div>
                                            <div>
                                              <div className="text-xs font-bold text-white">{userTotalLikes}</div>
                                              <div className="text-[8px] text-white/40 uppercase tracking-wider font-semibold">Likes</div>
                                            </div>
                                          </div>

                                          <div className="text-[10px] text-white/60 leading-relaxed italic bg-white/[0.01] p-2.5 rounded-xl border border-white/5">
                                            {uBio}
                                          </div>
                                        </div>

                                        {/* User's Created Posts Header */}
                                        <h5 className="text-[9px] font-bold text-white/40 uppercase tracking-wider pl-1 font-mono">My Posts</h5>

                                        {/* User's Posts list */}
                                        <div className="space-y-3">
                                          {userPosts.length === 0 ? (
                                            <div className="p-8 text-center text-white/30 text-[10px] bg-white/[0.02] border border-white/5 rounded-2xl italic">
                                              You haven't posted anything yet. Write a post on the Feed tab!
                                            </div>
                                          ) : (
                                            userPosts.map((post: any, i: number) => (
                                              <div key={post.id || i} className="p-3 bg-white/[0.03] border border-white/5 rounded-2xl space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <SafeImage 
                                                      src={uAvatar} 
                                                      referrerPolicy="no-referrer"
                                                      className="w-6 h-6 rounded-lg object-cover border border-white/10" 
                                                      alt="" 
                                                    />
                                                    <div>
                                                      <div className="font-bold text-[10px] text-white">{uName}</div>
                                                      <div className="text-[7px] text-white/30">Just now</div>
                                                    </div>
                                                  </div>

                                                {/* Delete Post Button */}
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    triggerHaptic();
                                                    const updatedFeed = resolvedFeed.filter((p: any) => p.id !== post.id);
                                                    onUpdateCharacterState('phone', 'socialFeed', updatedFeed);
                                                  }}
                                                  className="p-1 text-white/40 hover:text-red-400 bg-white/[0.04] rounded-lg border border-white/5 cursor-pointer transition-colors"
                                                  title="Delete Post"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                              
                                              <p className="text-[10px] text-white/85 leading-relaxed">{post.content}</p>
                                              
                                              {post.image && (
                                                <div className="rounded-xl overflow-hidden border border-white/5 max-h-48 bg-black/20">
                                                  <SafeImage src={post.image} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                                                </div>
                                              )}

                                              {/* Action display */}
                                              <div className="flex items-center gap-3 text-[9px] font-bold text-white/40 pt-1 border-t border-white/5">
                                                <div className="flex items-center gap-1">
                                                  <Heart className="w-3 h-3 fill-rose-500/20 text-rose-400" />
                                                  <span>{post.likes || 0} Likes</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <MessageSquare className="w-3 h-3 text-indigo-400" />
                                                  <span>{post.comments?.length || 0} Comments</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* SETTINGS APP */}
                      {activeApp === 'Settings' && (
                        <div className="p-3.5 space-y-4">
                          <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-sky-400" />
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Device Settings</h3>
                          </div>

                          {/* Wallpaper Section (Updates Phone's Inside Wallpaper) */}
                          <div className="space-y-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-white/50 uppercase tracking-widest">
                              <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Phone Home Screen Wallpaper</span>
                            </div>
                            
                            <div className="relative h-28 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
                              <div 
                                className="absolute inset-0 bg-cover bg-center"
                                style={{ 
                                  background: isPhoneInsideImageUrl
                                    ? (phoneInsideWallpaper.startsWith('url(') ? phoneInsideWallpaper : `url("${phoneInsideWallpaper}") center/cover no-repeat`)
                                    : phoneInsideWallpaper 
                                }}
                              />
                              <div className="absolute inset-0 bg-black/45" />
                              <span className={`relative z-10 text-[9px] font-bold text-white/90 bg-black/60 px-2.5 py-1 rounded-lg ${isPerformanceMode ? '' : 'backdrop-blur-sm'} border border-white/5`}>
                                Inside Wallpaper Preview
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <label className="border border-white/10 hover:border-indigo-500/50 hover:bg-white/[0.05] rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-white/[0.02]">
                                <Upload className="w-4 h-4 text-indigo-400" />
                                <span className="text-[10px] font-bold text-white">Upload Custom</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    handleFileUpload(e, (res) => {
                                      onUpdateCharacterState('phone', 'customInsideWallpaper', res);
                                    });
                                  }}
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateCharacterState('phone', 'customInsideWallpaper', null);
                                }}
                                className="border border-white/10 hover:border-rose-500/50 hover:bg-rose-500/5 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 transition-all bg-white/[0.02] text-rose-400 hover:text-rose-300 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="text-[10px] font-bold">Reset Wallpaper</span>
                              </button>
                            </div>
                          </div>

                          {/* Passcode Configuration Settings */}
                          <div className="space-y-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                            <label className="text-[9px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                              <LockKeyhole className="w-3.5 h-3.5 text-white" />
                              <span>4-Digit Lock Passcode</span>
                            </label>
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                maxLength={4}
                                placeholder="1234"
                                value={settingsPasscode || ''}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                  setSettingsPasscode(val);
                                  // Update key only if 4 digits
                                  if (val.length === 4) {
                                    onUpdateCharacterState('phone', 'password', val);
                                  }
                                }}
                                className="w-20 bg-white/5 border border-white/10 rounded-xl p-2 text-center text-xs font-mono text-white tracking-widest focus:outline-none focus:border-indigo-500/40"
                              />
                              <span className="text-[9px] text-white/45 leading-tight flex-1">
                                Lock passcode determines lockscreen access. Defaults to 1234.
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* NOTES APP */}
                      {activeApp === 'Notes' && (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-white" />
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Companion Journal</h3>
                          </div>
                          <div className="p-3.5 bg-white/[0.02] rounded-xl border border-white/5 space-y-2">
                            <div className="text-xs font-bold text-amber-300">Realm Chronicles</div>
                            <p className="text-xs text-white/70 leading-relaxed">
                              "Keep track of hidden secrets, bonds, and upcoming realm quests in this encrypted pad. Everything stored here remains privately bound to your system storage."
                            </p>
                          </div>
                        </div>
                      )}

                      {/* WALLET APP */}
                      {activeApp === 'Wallet' && (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <WalletIcon className="w-5 h-5 text-white" />
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Pass & Credits</h3>
                          </div>
                          <div className="p-4 bg-gradient-to-r from-white/10 to-white/5 rounded-2xl border border-white/15 space-y-2">
                            <div className="text-[10px] text-white/70 font-bold uppercase tracking-widest">Realm Pass</div>
                            <div className="text-lg font-extrabold text-white">Unlimited VIP Access</div>
                            <div className="text-[9px] text-white/50 leading-relaxed">
                              Connected Realm: {worldName || 'Active Companion Realm'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* WEATHER APP */}
                      {activeApp === 'Weather' && (
                        <div className="p-6 text-center space-y-3">
                          <CloudSun className="w-12 h-12 text-sky-400 mx-auto animate-pulse" />
                          <div className="text-3xl font-light text-white">72°F</div>
                          <div className="text-xs text-white/70 leading-relaxed font-semibold uppercase tracking-wider">
                            Atmosphere: Clear & Serene
                          </div>
                          <div className="text-[10px] text-white/50 max-w-[180px] mx-auto">
                            The weather is perfectly harmonized with the active companion location.
                          </div>
                        </div>
                      )}

                      {/* CLOCK APP */}
                      {activeApp === 'Clock' && (
                        <div className="p-6 text-center space-y-3">
                          <Clock className="w-12 h-12 text-indigo-400 mx-auto" />
                          <div className="text-3xl font-mono text-white tracking-widest">{currentTime}</div>
                          <div className="text-xs text-white/50">{currentDate}</div>
                        </div>
                      )}

                      {/* MUSIC APP */}
                      {activeApp === 'Music' && (
                        <div className="p-6 text-center space-y-3">
                          <Music className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
                          <div className="text-xs font-bold text-white uppercase tracking-widest">Ambient Frequencies</div>
                          <div className="text-[11px] text-white/50">Playing active atmospheric background track...</div>
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* BOTTOM HOME HOMEBAR */}
        <div className="absolute bottom-0 left-0 right-0 z-40 py-3.5 flex justify-center bg-transparent pointer-events-none">
          <button 
            type="button"
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
            className="w-32 h-1 bg-white/60 hover:bg-white rounded-full transition-colors cursor-pointer pointer-events-auto"
            title="Home Bar"
          />
        </div>
        </div>
        </motion.div>
      </div>

      {/* Global Message Composer Overlay */}
      <AnimatePresence>
        {isGlobalComposerOpen && activeApp === 'Messages' && activeMessageThread && (
          <GlobalMessageComposer
            onClose={() => setIsGlobalComposerOpen(false)}
            onSend={(text, image) => {
              const currentThread = Array.isArray(threads?.[activeMessageThread]) ? threads[activeMessageThread] : [];
              const userMsg = { text, image, isUser: true, timestamp: Date.now() };
              const newThreads = {
                ...threads,
                [activeMessageThread]: [
                  ...currentThread,
                  userMsg
                ]
              };
              onUpdateCharacterState('phone', 'threads', newThreads);
              
              let finalMsg = text;
              if (image) {
                finalMsg = `*[Sent a photo via messenger]:* ${text || '(Sent an image attachment)'}`;
              }
              onSendMessage(activeMessageThread, finalMsg, userMsg);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function GlobalMessageComposer({ onSend, onClose }: { onSend: (text: string, image?: string) => void, onClose: () => void }) {
  const [text, setText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto focus with a small delay so keyboard animation plays nicely
    setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 100);
  }, []);

  const handleSend = () => {
    if (text.trim() || attachedImage) {
      onSend(text.trim(), attachedImage || undefined);
      setText('');
      setAttachedImage(null);
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachedImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 z-[1000] bg-[#111218] border-t border-white/10 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
    >
      <div className="max-w-xl mx-auto flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Messenger Composer</span>
            <span className="text-[10px] text-indigo-300/80 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
              Enter = New line ↵ • Send button = Deliver
            </span>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-white/50 hover:text-white p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {attachedImage && (
          <div className="relative self-start bg-white/5 border border-white/15 p-1 rounded-xl">
            <SafeImage src={attachedImage} className="w-20 h-20 rounded-lg object-cover" alt="Attached preview" />
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center font-extrabold cursor-pointer transition-transform active:scale-90 shadow-lg"
            >
              ×
            </button>
          </div>
        )}
        
        <div className="flex items-end gap-3">
          <label className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-white/10 flex-shrink-0" title="Attach Photo">
            <ImagePlus className="w-5 h-5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          <textarea
            ref={textareaRef}
            rows={2}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
              }
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message (Enter creates new line / paragraph)..."
            className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder-white/30 resize-none min-h-[48px] max-h-36 leading-relaxed"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() && !attachedImage}
            className={`p-3 rounded-xl text-white transition-all flex items-center justify-center shadow-md active:scale-90 flex-shrink-0 ${
              text.trim() || attachedImage
                ? 'bg-indigo-600 hover:bg-indigo-500 cursor-pointer'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
            title="Send Message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
