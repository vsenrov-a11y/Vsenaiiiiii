import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Persona, StorageConfig, World } from '../../types';
import { PERSONAS } from '../../data/personas';
import { SafeImage } from '../common/SafeImage';
import { storeAsset } from '../../utils/fileDb';
import { CharacterProfileScreen } from './CharacterProfileScreen';
import { CharacterCreator } from './CharacterCreator';
import { UserPersonaCreator } from './UserPersonaCreator';
import { WorldCreator } from './WorldCreator';
import { WorldProfileScreen } from './WorldProfileScreen';
import { OrbBadge } from '../common/OrbBadge';
import { OrbWalletModal } from '../common/OrbWalletModal';

import { 
  Search, 
  Bell, 
  Sparkles, 
  Check, 
  Globe,
  User,
  Users,
  UserCircle,
  ArrowRight, 
  ArrowLeft,
  PlusCircle, 
  Heart, 
  Info, 
  Clock, 
  Play, 
  X, 
  Compass, 
  Palette, 
  BookOpen, 
  MessageSquare, 
  MessageCircle, 
  ChevronRight, 
  Share2, 
  HelpCircle,
  Volume2,
  Lock,
  EyeOff,
  Trash2,
  Plus
} from 'lucide-react';

const getPrimaryCategory = (persona: Persona) => {
  if (persona.isCustom) return 'Created';
  if (['tech-mentor', 'language-coach', 'creative-designer'].includes(persona.id)) return 'Specialist';
  if (['arranged-marriage', 'dads-best-friend', 'your-enemy', 'biker-boyfriend'].includes(persona.id)) return 'Trending';
  
  if (persona.categories && persona.categories.length > 0) {
    return persona.categories[0];
  }
  if (persona.tags && persona.tags.length > 0) {
    return persona.tags[0];
  }
  return 'Featured';
};

const getRealMessageCount = (persona: Persona, histories: any[] = []) => {
  const matchingHistories = histories.filter(h => h.personaId === persona.id);
  let localMessageCount = 0;
  matchingHistories.forEach(h => {
    if (h.messages && Array.isArray(h.messages)) {
      localMessageCount += h.messages.length;
    }
  });

  // Calculate base chats
  let baseChats = 0;
  if (persona.chatsCount) {
    const cleanStr = String(persona.chatsCount).toLowerCase().trim();
    const parsed = parseInt(cleanStr.replace(/[^0-9.]/g, ''), 10);
    if (!isNaN(parsed)) {
      if (cleanStr.includes('k')) {
        baseChats = Math.round(parsed * 1000);
      } else if (cleanStr.includes('m')) {
        baseChats = Math.round(parsed * 1000000);
      } else {
        baseChats = parsed;
      }
    }
  } else {
    // If no chatsCount on system, let's make a beautiful, stable base based on character type
    if (persona.isCustom) {
      baseChats = 0; // Starts at 0 for custom characters
    } else {
      // Predefined system characters get a stable premium starting value
      let hash = 0;
      for (let i = 0; i < persona.id.length; i++) {
        hash += persona.id.charCodeAt(i);
      }
      baseChats = (hash % 450) + 120; // Stable, premium base
    }
  }

  const finalCount = baseChats + localMessageCount;
  if (finalCount >= 1000000) return `${(finalCount / 1000000).toFixed(1)}M`;
  if (finalCount >= 1000) return `${(finalCount / 1000).toFixed(1)}K`;
  return String(finalCount);
};

const getRealLikesCount = (persona: Persona, isLiked: boolean) => {
  let baseLikes = 0;
  if (persona.likesCount) {
    const cleanStr = String(persona.likesCount).toLowerCase().trim();
    const parsed = parseInt(cleanStr.replace(/[^0-9.]/g, ''), 10);
    if (!isNaN(parsed)) {
      if (cleanStr.includes('k')) {
        baseLikes = Math.round(parsed * 1000);
      } else if (cleanStr.includes('m')) {
        baseLikes = Math.round(parsed * 1000000);
      } else {
        baseLikes = parsed;
      }
    }
  } else {
    if (persona.isCustom) {
      baseLikes = 0;
    } else {
      let hash = 0;
      for (let i = 0; i < persona.id.length; i++) {
        hash += persona.id.charCodeAt(i);
      }
      baseLikes = (hash % 90) + 18; // Stable, premium base
    }
  }

  const finalCount = baseLikes + (isLiked ? 1 : 0);
  if (finalCount >= 1000000) return `${(finalCount / 1000000).toFixed(1)}M`;
  if (finalCount >= 1000) return `${(finalCount / 1000).toFixed(1)}K`;
  return String(finalCount);
};

const getWorldMessageCount = (world: World, histories: any[] = []) => {
  const matchingHistories = histories.filter(h => h.linkedWorldId === world.id);
  let localMessageCount = 0;
  matchingHistories.forEach(h => {
    if (h.messages && Array.isArray(h.messages)) {
      localMessageCount += h.messages.length;
    }
  });

  let baseChats = 0;
  if (world.chatsCount) {
    const cleanStr = String(world.chatsCount).toLowerCase().trim();
    const parsed = parseInt(cleanStr.replace(/[^0-9.]/g, ''), 10);
    if (!isNaN(parsed)) {
      if (cleanStr.includes('k')) {
        baseChats = Math.round(parsed * 1000);
      } else if (cleanStr.includes('m')) {
        baseChats = Math.round(parsed * 1000000);
      } else {
        baseChats = parsed;
      }
    }
  } else {
    if (world.creator === '@you' || world.id.startsWith('custom-')) {
      baseChats = 0;
    } else {
      let hash = 0;
      for (let i = 0; i < world.id.length; i++) {
        hash += world.id.charCodeAt(i);
      }
      baseChats = (hash % 350) + 80;
    }
  }

  const finalCount = baseChats + localMessageCount;
  if (finalCount >= 1000000) return `${(finalCount / 1000000).toFixed(1)}M`;
  if (finalCount >= 1000) return `${(finalCount / 1000).toFixed(1)}K`;
  return String(finalCount);
};

const getRealWorldLikesCount = (world: World, isLiked: boolean) => {
  let baseLikes = 0;
  if (world.likesCount) {
    const cleanStr = String(world.likesCount).toLowerCase().trim();
    const parsed = parseInt(cleanStr.replace(/[^0-9.]/g, ''), 10);
    if (!isNaN(parsed)) {
      if (cleanStr.includes('k')) {
        baseLikes = Math.round(parsed * 1000);
      } else if (cleanStr.includes('m')) {
        baseLikes = Math.round(parsed * 1000000);
      } else {
        baseLikes = parsed;
      }
    }
  } else {
    if (world.creator === '@you' || world.id.startsWith('custom-')) {
      baseLikes = 0;
    } else {
      let hash = 0;
      for (let i = 0; i < world.id.length; i++) {
        hash += world.id.charCodeAt(i);
      }
      baseLikes = (hash % 70) + 15;
    }
  }

  const finalCount = baseLikes + (isLiked ? 1 : 0);
  if (finalCount >= 1000000) return `${(finalCount / 1000000).toFixed(1)}M`;
  if (finalCount >= 1000) return `${(finalCount / 1000).toFixed(1)}K`;
  return String(finalCount);
};

const getLastChattedTime = (personaId: string, histories: any[] = []) => {
  const matchingHistories = histories.filter(h => h.personaId === personaId);
  if (matchingHistories.length === 0) return null;
  
  const getSessionTime = (h: any) => h.updatedAt || parseInt(h.id?.split('-')[1]) || 0;
  const sorted = [...matchingHistories].sort((a, b) => getSessionTime(b) - getSessionTime(a));
  
  const lastHistory = sorted[0];
  if (!lastHistory) return null;
  const lastTime = getSessionTime(lastHistory);
  if (!lastTime) return "chatted recently";
  
  const diffMs = Date.now() - lastTime;
  if (isNaN(diffMs) || diffMs < 0) return "chatted recently";
  
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return "chatted recently";
};

interface PersonaHubScreenProps {
  selectedPersonaId: string;
  customPersonas: Persona[];
  characters?: Persona[];
  likedPersonaIds: string[];
  onSelectPersona: (persona: Persona) => void;
  onSelectWorld?: (worldId: string) => void;
  onStartChat: (personaId?: string) => void;
  onCreateCustomPersona: (newPersona: Persona) => void;
  onToggleLikePersona: (personaId: string) => void;
  activeCategory?: 'foryou' | 'following' | 'trending' | 'specialists' | 'create';
  setActiveCategory?: (category: 'foryou' | 'following' | 'trending' | 'specialists' | 'create') => void;
  storageConfig?: StorageConfig;
  onDeletePersona?: (personaId: string) => void;
  onResumeChat?: (historyId: string) => void;
  onUpdateConfig?: (updates: Partial<StorageConfig>) => void;
  initialEditingPersonaId?: string | null;
  initialCreationType?: 'character' | 'persona' | 'world' | null;
  onCloseCreation?: () => void;
  profilePersonaId?: string | null;
  profileWorldId?: string | null;
  onClearProfileRequest?: () => void;
  onOpenGlobalProfile?: (persona: Persona) => void;
  onOpenGlobalWorldProfile?: (world: World) => void;
  onOpenCharacterCreator?: () => void;
  onOpenWorldCreator?: () => void;
  onOpenPersonaCreator?: () => void;
}

type CategoryType = 'foryou' | 'following' | 'trending' | 'specialists' | 'create';

export const PersonaHubScreen: React.FC<PersonaHubScreenProps> = React.memo(({
  selectedPersonaId,
  customPersonas,
  characters,
  likedPersonaIds = [],
  onSelectPersona,
  onSelectWorld,
  onStartChat,
  onCreateCustomPersona,
  onToggleLikePersona,
  activeCategory: propActiveCategory,
  setActiveCategory: propSetActiveCategory,
  storageConfig,
  onDeletePersona,
  onResumeChat,
  onUpdateConfig,
  initialEditingPersonaId,
  initialCreationType,
  onCloseCreation,
  onOpenGlobalProfile,
  onOpenGlobalWorldProfile,
  onOpenCharacterCreator,
  onOpenWorldCreator,
  onOpenPersonaCreator,
}) => {
  const [localCategory, setLocalCategory] = useState<CategoryType>('foryou');
  const activeCategory = propActiveCategory !== undefined ? propActiveCategory : localCategory;
  const setActiveCategory = propSetActiveCategory !== undefined ? propSetActiveCategory : setLocalCategory;
  const isLight = storageConfig?.theme === 'light';
  const [homeSection, setHomeSection] = useState<'characters' | 'worlds'>('characters');

  const [searchQuery, setSearchQuery] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🤖');

  // Orb Economy Modals State
  const [showOrbWallet, setShowOrbWallet] = useState(false);

  // States for Hold Gesture & Profile Modal overlay
  const [holdingPersona, setHoldingPersona] = useState<Persona | null>(null);
  const touchTimerRef = useRef<any>(null);
  const isHoldingRef = useRef<boolean>(false);
  const touchStartCoords = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [activeCreationType, setActiveCreationType] = useState<'character' | 'persona' | 'world' | 'world-detail' | null>(initialCreationType || null);

  // Advanced Fields for 4-Step Custom Character Creator Wizard
  const [name, setName] = useState('');
  const [avatarDescription, setAvatarDescription] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<'blue' | 'purple' | 'emerald' | 'amber'>('purple');
  const [voice, setVoice] = useState<'sultry' | 'baritone' | 'hyper' | 'cozy'>('cozy');
  const [greetingText, setGreetingText] = useState('');
  const [additionalGreetings, setAdditionalGreetings] = useState<string[]>([]);
  const [isAiGreetingsEnabled, setIsAiGreetingsEnabled] = useState(true);
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('private');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagText, setNewTagText] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [definition, setDefinition] = useState('');
  const [isDefinitionPrivate, setIsDefinitionPrivate] = useState(true);

  // Personality Tuning Controls
  const [formality, setFormality] = useState<number>(3); // 1-5 scale
  const [warmth, setWarmth] = useState<number>(3); // 1-5 scale
  const [talkativeness, setTalkativeness] = useState<number>(3); // 1-5 scale
  const [speechQuirks, setSpeechQuirks] = useState('');
  
  const [creationStep, setCreationStep] = useState<1 | 2 | 3 | 4>(1);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(initialEditingPersonaId || null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialEditingPersonaId !== undefined) {
      setEditingPersonaId(initialEditingPersonaId);
    }
  }, [initialEditingPersonaId]);

  React.useEffect(() => {
    if (initialCreationType !== undefined) {
      setActiveCreationType(initialCreationType);
    }
  }, [initialCreationType]);

  // Handle personality tuning if needed
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG/JPEG/etc.).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const base64 = event.target.result as string;
        try {
          const assetId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const dbRef = await storeAsset(assetId, base64);
          setAvatar(dbRef);
        } catch (e) {
          setAvatar(base64);
        }
        triggerToast('Profile photo uploaded successfully!');
      }
    };
    reader.readAsDataURL(file);
  };

  // Auto-save & Restore Draft character data from localStorage
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('vsenai_character_creation_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.name) setName(parsed.name);
        if (parsed.avatarDescription) setAvatarDescription(parsed.avatarDescription);
        if (parsed.selectedTheme) setSelectedTheme(parsed.selectedTheme);
        if (parsed.voice) setVoice(parsed.voice);
        if (parsed.greetingText) setGreetingText(parsed.greetingText);
        if (parsed.additionalGreetings && Array.isArray(parsed.additionalGreetings)) {
          setAdditionalGreetings(parsed.additionalGreetings.filter((g: any) => typeof g === 'string'));
        }
        if (parsed.isAiGreetingsEnabled !== undefined) setIsAiGreetingsEnabled(parsed.isAiGreetingsEnabled);
        if (parsed.privacy) setPrivacy(parsed.privacy);
        if (parsed.tags) setTags(parsed.tags);
        if (parsed.tagline) setTagline(parsed.tagline);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.definition) setDefinition(parsed.definition);
        if (parsed.avatar) setAvatar(parsed.avatar);
        if (parsed.formality !== undefined) setFormality(parsed.formality);
        if (parsed.warmth !== undefined) setWarmth(parsed.warmth);
        if (parsed.talkativeness !== undefined) setTalkativeness(parsed.talkativeness);
        if (parsed.speechQuirks !== undefined) setSpeechQuirks(parsed.speechQuirks);
      }
    } catch (e) {
      console.error('Failed to restore character draft', e);
    }
  }, []);

  // Debounced auto-save effect
  useEffect(() => {
    if (editingPersonaId) return; // Don't overwrite draft while actively editing an existing companion
    const timer = setTimeout(() => {
      try {
        const draftObj = {
          name,
          avatarDescription,
          selectedTheme,
          voice,
          greetingText,
          additionalGreetings,
          isAiGreetingsEnabled,
          privacy,
          tags,
          tagline,
          description,
          definition,
          avatar,
          formality,
          warmth,
          talkativeness,
          speechQuirks
        };
        try {
          localStorage.setItem('vsenai_character_creation_draft', JSON.stringify(draftObj));
        } catch (e) {
          // Silently ignore if localStorage quota is reached
        }
      } catch (e) {
        // Outer safety catch
      }
    }, 1000); // 1-second debounce to prevent constant disk writes while typing

    return () => clearTimeout(timer);
  }, [
    name,
    avatarDescription,
    selectedTheme,
    voice,
    greetingText,
    additionalGreetings,
    isAiGreetingsEnabled,
    privacy,
    tags,
    tagline,
    description,
    definition,
    avatar,
    formality,
    warmth,
    talkativeness,
    speechQuirks,
    editingPersonaId
  ]);

  // Reset creationStep to 1 whenever entering the custom creation flow
  useEffect(() => {
    if (activeCategory === 'create') {
      setCreationStep(1);
    }
  }, [activeCategory]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Handle generation simulation state
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [generatedAvatarStatus, setGeneratedAvatarStatus] = useState<string | null>(null);

  const handleGenerateAvatar = async () => {
    if (!avatarDescription.trim()) {
      alert('Please describe what the avatar should look like first!');
      return;
    }
    setIsGeneratingAvatar(true);
    setGeneratedAvatarStatus('Analyzing prompt keywords...');
    try {
      const customApiKey = storageConfig?.apiKey;
      
      setGeneratedAvatarStatus('Generating high-quality 1:1 portrait...');
      
      const response = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: `${avatarDescription.trim()}. Portrait, cinematic lighting, highly detailed avatar.`,
          customApiKey: customApiKey
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP Error ${response.status}`);
      }

      const data = await response.json();
      if (data.imageUrl) {
        let finalImgUrl = data.imageUrl;
        if (data.imageUrl.startsWith('data:')) {
          try {
            const assetId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            finalImgUrl = await storeAsset(assetId, data.imageUrl);
          } catch (e) {
            console.error("Failed to store generated avatar", e);
          }
        }
        setAvatar(finalImgUrl);
        setGeneratedAvatarStatus('Avatar generation complete!');
        
        // Match gradient theme as secondary backdrop fallback
        const keywords = avatarDescription.toLowerCase();
        if (keywords.includes('neon') || keywords.includes('cyber') || keywords.includes('pink') || keywords.includes('purple')) {
          setSelectedTheme('purple');
        } else if (keywords.includes('water') || keywords.includes('blue') || keywords.includes('tech') || keywords.includes('sky')) {
          setSelectedTheme('blue');
        } else if (keywords.includes('nature') || keywords.includes('green') || keywords.includes('forest') || keywords.includes('emerald')) {
          setSelectedTheme('emerald');
        } else if (keywords.includes('fire') || keywords.includes('amber') || keywords.includes('gold') || keywords.includes('sun') || keywords.includes('warm')) {
          setSelectedTheme('amber');
        }
      } else {
        throw new Error('Image URL not received.');
      }
    } catch (err: any) {
      console.error(err);
      setGeneratedAvatarStatus(`Error: ${err.message || 'Failed to generate image.'}`);
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleCreatePersona = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      alert('Companion name is required!');
      return;
    }

    let avatarGradient = 'from-purple-500/20 to-pink-500/30 border-purple-400/30 text-purple-300';
    let accentColor = '#D946EF';

    if (selectedTheme === 'blue') {
      avatarGradient = 'from-blue-500/20 to-cyan-500/30 border-blue-400/30 text-blue-300';
      accentColor = '#3B82F6';
    } else if (selectedTheme === 'emerald') {
      avatarGradient = 'from-emerald-500/20 to-teal-500/30 border-emerald-400/30 text-emerald-300';
      accentColor = '#10B981';
    } else if (selectedTheme === 'amber') {
      avatarGradient = 'from-amber-500/20 to-orange-500/30 border-amber-400/30 text-amber-300';
      accentColor = '#F59E0B';
    }

    // Combine main greeting with additional greetings
    const allOpeners = [greetingText, ...(additionalGreetings || [])]
      .filter((g): g is string => typeof g === 'string')
      .map(g => g.trim())
      .filter(g => g.length > 0);
    const promptsList = allOpeners.length > 0 ? allOpeners : [`Introduce yourself, ${name.trim()}.`, "How can you help me today?"];

    // Synthesize system instructions cleanly incorporating slider behaviors
    let synthesizedInstruction = `You are ${name.trim()}.\n`;
    synthesizedInstruction += `Core Personality & Backstory:\n${definition.trim()}\n\n`;

    // Append Formality
    if (formality <= 2) {
      synthesizedInstruction += `Tone/Formality Instructions: Speak extremely casually, loose, using informal phrasing, contractions, and modern slang where natural.\n`;
    } else if (formality >= 4) {
      synthesizedInstruction += `Tone/Formality Instructions: Maintain an elegant, highly formal, eloquent, precise, and articulate mode of speech without using overly casual abbreviations.\n`;
    } else {
      synthesizedInstruction += `Tone/Formality Instructions: Keep your conversational formality balanced and naturally approachable.\n`;
    }

    // Append Warmth
    if (warmth <= 2) {
      synthesizedInstruction += `Warmth/Empathy Instructions: Remain relatively distant, cold, emotionally detached, highly objective, and blunt in conversation.\n`;
    } else if (warmth >= 4) {
      synthesizedInstruction += `Warmth/Empathy Instructions: Speak with absolute warmth, high empathy, kindness, nurturing interest, and compassionate validation.\n`;
    } else {
      synthesizedInstruction += `Warmth/Empathy Instructions: Sound balanced, neutral, objective, and helpful.\n`;
    }

    // Append Talkativeness
    if (talkativeness <= 2) {
      synthesizedInstruction += `Talkativeness Instructions: Keep your replies very concise, terse, and straight to the point. Speak with short, dynamic sentence structures.\n`;
    } else if (talkativeness >= 4) {
      synthesizedInstruction += `Talkativeness Instructions: Give rich, highly elaborate, comprehensive, and descriptive replies filled with narrative depth and expressive detail.\n`;
    } else {
      synthesizedInstruction += `Talkativeness Instructions: Answer with balanced sentence length, adapting to the pace of user prompts.\n`;
    }

    // Append Speech Quirks
    if (speechQuirks.trim()) {
      synthesizedInstruction += `Conversational Speech Quirks: ${speechQuirks.trim()}\n`;
    }

    if (allOpeners.length > 0) {
      synthesizedInstruction += `\n\nYour approved greetings and openers are:\n${allOpeners.map(o => `- "${o}"`).join('\n')}\nAdopt one to start the chat.`;
    }

    const isEditing = !!editingPersonaId;
    const isEditingCustom = isEditing && editingPersonaId.startsWith('custom-');
    const targetId = isEditingCustom ? editingPersonaId : `custom-${Date.now()}`;

    let finalAvatarDbRef = avatar;
    if (avatar && avatar.startsWith('data:')) {
      try {
        const assetId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const storedRef = await storeAsset(assetId, avatar);
        finalAvatarDbRef = storedRef;
      } catch (err) {
        console.error('Failed to store custom persona avatar', err);
      }
    }

    const newPersona: Persona = {
      id: targetId,
      name: name.trim().substring(0, 30), // strict 30 char limit
      subtitle: tagline.trim().substring(0, 60) || 'Custom Companion', // strict 60 tagline limit
      description: description.trim().substring(0, 500) || 'Custom instruction companion.', // strict description limit
      systemInstruction: synthesizedInstruction,
      avatarGradient,
      accentColor,
      creator: '@you',
      chatsCount: isEditing ? (customPersonas.find(p => p.id === editingPersonaId)?.chatsCount || '1.2k') : '0',
      likesCount: isEditing ? (customPersonas.find(p => p.id === editingPersonaId)?.likesCount || '248') : '0',
      suggestedPrompts: promptsList,
      isCustom: true,
      tags: tags,
      privacy: privacy,
      isDefinitionPrivate: isDefinitionPrivate,
      avatar: finalAvatarDbRef || (isEditing ? (customPersonas.find(p => p.id === editingPersonaId)?.avatar || '') : ''),
      avatarEmoji: avatarEmoji || '🤖',
      voice,
    };

    onCreateCustomPersona(newPersona);
    
    triggerToast(isEditing ? "Customizations saved successfully!" : "Companion assembled successfully!");
    setEditingPersonaId(null);
    
    // Clear draft storage
    try {
      localStorage.removeItem('vsenai_character_creation_draft');
    } catch (e) {
      console.error(e);
    }

    // Reset fields
    setName('');
    setAvatar('');
    setAvatarEmoji('🤖');
    setAvatarDescription('');
    setVoice('cozy');
    setGreetingText('');
    setAdditionalGreetings([]);
    setIsAiGreetingsEnabled(true);
    setPrivacy('private');
    setTags([]);
    setNewTagText('');
    setTagline('');
    setDescription('');
    setDefinition('');
    setIsDefinitionPrivate(true);
    setFormality(3);
    setWarmth(3);
    setTalkativeness(3);
    setSpeechQuirks('');
    setCreationStep(1);
    
    // Switch to custom list
    setActiveCategory('following');
  };

  const allCompanions = characters || [...PERSONAS, ...customPersonas];
  const allPresets = allCompanions.filter(p => !p.isCustom);
  const allCustom = allCompanions.filter(p => p.isCustom);

  // Filters mapping based on selection
  const getFilteredList = () => {
    let list: Persona[] = [];
    if (activeCategory === 'foryou') {
      list = [...allPresets, ...allCustom];
    } else if (activeCategory === 'following') {
      list = allCustom;
    } else if (activeCategory === 'trending') {
      list = [...allPresets, ...allCustom].filter(p => 
        ['arranged-marriage', 'dads-best-friend', 'your-enemy', 'biker-boyfriend'].includes(p.id)
      );
      if (list.length === 0) list = allPresets;
    } else if (activeCategory === 'specialists') {
      list = [...allPresets, ...allCustom].filter(p => 
        ['tech-mentor', 'language-coach', 'creative-designer'].includes(p.id)
      );
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      list = list.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    return list;
  };

  const getFilteredWorldsList = () => {
    let list: World[] = storageConfig?.worlds || [];
    
    // Categorize
    if (activeCategory === 'foryou') {
      list = storageConfig?.worlds || [];
    } else if (activeCategory === 'following') {
      list = (storageConfig?.worlds || []).filter(w => w.creator === '@you' || !w.creator || w.creator === 'system');
    } else if (activeCategory === 'trending') {
      // Return first few worlds as trending, or all of them if small
      list = storageConfig?.worlds || [];
    } else if (activeCategory === 'specialists') {
      list = storageConfig?.worlds || [];
    }

    // Apply search filter
    if (searchQuery.trim()) {
      list = list.filter(w => 
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    return list;
  };

  const currentList = getFilteredList();
  const currentWorldsList = getFilteredWorldsList();

  const categories = [
    { id: 'foryou', label: 'For You' },
    { id: 'following', label: homeSection === 'characters' ? 'My Characters' : 'My Worlds' },
    { id: 'trending', label: 'Trending' },
    { id: 'specialists', label: 'Specialists' },
  ] as const;

  return (
    <div className={`flex-1 flex flex-col overflow-hidden select-none h-full relative ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'}`}>
      <div className="flex-1 flex flex-col overflow-hidden h-full relative">
      
      {/* Dynamic Toast Feedback Overlay */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[150] px-3.5 py-1.5 font-sans font-medium text-[11px] rounded-xl shadow-lg border border-white/15 bg-black/70 backdrop-blur-xl text-white flex items-center gap-2 animate-fadeIn max-w-[90vw]">
          <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}
      
      {activeCreationType === 'character' ? (
        <CharacterCreator
          isLight={isLight}
          onClose={() => {
            setActiveCreationType(null);
            setEditingPersonaId(null);
            if (onCloseCreation) {
              onCloseCreation();
            }
          }}
          onSave={(persona) => {
            onCreateCustomPersona(persona);
            setActiveCreationType(null);
            setEditingPersonaId(null);
            if (onCloseCreation) {
              onCloseCreation();
            }
          }}
          initialData={editingPersonaId ? [...(customPersonas || []), ...(characters || [])].find(p => p.id === editingPersonaId) : null}
        />
      ) : activeCreationType === 'persona' ? (
        <UserPersonaCreator
          isLight={isLight}
          onClose={() => setActiveCreationType(null)}
          onSave={(newPersona) => {
            if (onUpdateConfig) {
              const currentPersonas = storageConfig?.userPersonas || [];
              let updatedPersonas = [...currentPersonas, newPersona];
              
              if (newPersona.isDefault) {
                updatedPersonas = updatedPersonas.map(p => ({
                  ...p,
                  isDefault: p.id === newPersona.id
                }));
                onUpdateConfig({ 
                  userPersonas: updatedPersonas,
                  activeUserPersonaId: newPersona.id 
                });
              } else {
                onUpdateConfig({ userPersonas: updatedPersonas });
              }
            }
            setActiveCreationType(null);
          }}
        />
      ) : false ? (<div />
      ) : activeCreationType === 'world' ? (
        <WorldCreator
          isLight={isLight}
          storageConfig={storageConfig || { apiKey: '', useServerKeyFallback: true, selectedPersonaId: '', customPersonas: [], chatHistories: [] }}
          onClose={() => {
            setActiveCreationType(null);
            setEditingPersonaId(null);
            if (onCloseCreation) {
              onCloseCreation();
            }
          }}
          onSave={(newWorld) => {
            if (onUpdateConfig) {
              const currentWorlds = storageConfig?.worlds || [];
              const exists = currentWorlds.some(w => w.id === newWorld.id);
              let updatedWorlds;
              if (exists) {
                updatedWorlds = currentWorlds.map(w => w.id === newWorld.id ? newWorld : w);
              } else {
                updatedWorlds = [...currentWorlds, newWorld];
              }
              onUpdateConfig({ worlds: updatedWorlds });
            }
            setActiveCreationType(null);
            setEditingPersonaId(null);
            if (onCloseCreation) {
              onCloseCreation();
            }
          }}
          initialData={editingPersonaId ? (storageConfig?.worlds || []).find(w => w.id === editingPersonaId) : null}
        />
      ) : (
        <>
        {/* Top Fixed Area for Header, Search and Tabs */}
      <div className={`px-5 pt-3.5 pb-1.5 flex-shrink-0 ${isLight ? 'bg-white' : 'bg-[#121214]'}`}>
        {/* Top Header - Authentic branding & Standalone Create Button */}
        <div className="flex items-center justify-between mb-4 mt-1">
          <div className="flex items-center gap-2">
            <span className={`font-extrabold text-2xl tracking-tight font-sans ${isLight ? 'text-black' : 'text-white'}`}>
              Vsen.ai
            </span>
          </div>
          <div className="flex items-center gap-2">
            <OrbBadge
              orbs={storageConfig?.orbs !== undefined ? storageConfig.orbs : 50}
              accountCreatedAt={storageConfig?.accountCreatedAt}
              onClick={() => setShowOrbWallet(true)}
            />
            {/* Standalone "+ Create" Button */}
            <button
              type="button"
              onClick={() => setShowCreateOptions(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold tracking-widest uppercase transition-all duration-300 active:scale-95 cursor-pointer border ${
                isLight 
                  ? 'bg-white border-black/15 text-black hover:bg-black/5 active:bg-black/10 active:border-black/30' 
                  : 'bg-black/20 border-white/[0.08] text-white/90 shadow-[0_0_12px_rgba(170,170,170,0.08)] hover:bg-white/[0.02] active:border-accent/50 active:bg-white/[0.04] active:shadow-[0_0_20px_rgba(170,170,170,0.2)] active:text-accent'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create</span>
            </button>
          </div>
        </div>

        {/* Search Input - Rounded 16dp styled like in the design direction */}
        <div className="relative w-full mb-3">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${isLight ? 'text-black/35' : 'text-white/30'}`} />
          <input
            type="text"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={homeSection === 'characters' ? "Search characters..." : "Search worlds..."}
            className={`w-full pl-10 pr-9 py-2.5 rounded-2xl focus:outline-none transition-all font-sans tracking-wide text-sm sm:text-xs border ${
              isLight 
                ? 'bg-white border-black/15 text-black placeholder:text-black/40 focus:border-black/30 focus:shadow-[0_4px_15px_rgba(0,0,0,0.05)]' 
                : 'bg-black/20 border-white/[0.08] text-white placeholder:text-white/30 focus:border-accent/50 focus:bg-white/[0.04] shadow-[0_0_12px_rgba(170,170,170,0.08)] focus:shadow-[0_0_20px_rgba(170,170,170,0.2)]'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer transition-colors ${isLight ? 'text-black/40 hover:text-black hover:bg-black/5' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Section Toggle Selector (Characters vs Worlds) */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl mb-4 relative bg-transparent border-none">
          <button
            type="button"
            onClick={() => {
              setHomeSection('characters');
            }}
            className={`relative py-2.5 text-[10px] font-extrabold tracking-widest uppercase rounded-xl transition-all duration-300 cursor-pointer z-10 ${
              homeSection === 'characters'
                ? isLight
                  ? 'text-black font-extrabold'
                  : 'text-accent scale-105 drop-shadow-[0_0_8px_rgba(170,170,170,0.3)]'
                : isLight
                  ? 'text-black/50 hover:text-black/80'
                  : 'text-white/45 hover:text-white/80'
            }`}
          >
            Characters
            {homeSection === 'characters' && (
              <motion.div
                layoutId="activeHomeSectionPill"
                className={`absolute inset-0 rounded-xl -z-10 border ${
                  isLight 
                    ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]' 
                    : 'bg-accent/10 border-accent/25 shadow-[0_2px_10px_rgba(170,170,170,0.15)]'
                }`}
                transition={{ duration: 0.22, ease: "easeOut" }}
              />
            )}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setHomeSection('worlds');
            }}
            className={`relative py-2.5 text-[10px] font-extrabold tracking-widest uppercase rounded-xl transition-all duration-300 cursor-pointer z-10 ${
              homeSection === 'worlds'
                ? isLight
                  ? 'text-black font-extrabold'
                  : 'text-accent scale-105 drop-shadow-[0_0_8px_rgba(170,170,170,0.3)]'
                : isLight
                  ? 'text-black/50 hover:text-black/80'
                  : 'text-white/45 hover:text-white/80'
            }`}
          >
            Worlds
            {homeSection === 'worlds' && (
              <motion.div
                layoutId="activeHomeSectionPill"
                className={`absolute inset-0 rounded-xl -z-10 border ${
                  isLight 
                    ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]' 
                    : 'bg-accent/10 border-accent/25 shadow-[0_2px_10px_rgba(170,170,170,0.15)]'
                }`}
                transition={{ duration: 0.22, ease: "easeOut" }}
              />
            )}
          </button>
        </div>

        {/* Horizontal Categories Scroll Menu */}
        <div className={`flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none border-b ${isLight ? 'border-black/[0.05]' : 'border-white/[0.03]'}`}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  if (setActiveCategory) {
                    setActiveCategory(cat.id);
                  }
                }}
                className="relative py-2 px-4 text-[10px] font-extrabold tracking-widest whitespace-nowrap transition-all duration-300 flex-shrink-0 active:scale-95 cursor-pointer uppercase font-sans"
              >
                <span className={`transition-all duration-300 relative z-10 ${
                  isActive 
                    ? isLight 
                      ? 'text-black font-extrabold scale-105' 
                      : 'text-accent scale-105 drop-shadow-[0_0_8px_rgba(170,170,170,0.3)]'
                    : isLight 
                      ? 'text-black/55 hover:text-black/85' 
                      : 'text-white/45 hover:text-white/80'
                }`}>
                  {cat.label}
                </span>
                
                {/* Visual filled pill accent highlight */}
                {isActive && (
                  <motion.div 
                    layoutId="activeTabPill"
                    className={`absolute inset-0 rounded-xl -z-0 border ${
                      isLight 
                        ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]' 
                        : 'bg-accent/10 border-accent/25 shadow-[0_2px_10px_rgba(170,170,170,0.15)]'
                    }`}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>


          {/* Main Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-5 pb-28">
            <AnimatePresence mode="wait">
              {homeSection === 'characters' ? (
                currentList.length === 0 ? (
                  /* Empty State for category search */
                  <motion.div
                    key="characters-empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.18 }}
                    className={`text-center p-8 backdrop-blur-md rounded-[28px] border py-14 my-4 ${
                      isLight ? 'bg-white border-black/[0.06] shadow-sm' : 'bg-white/[0.01] border-white/[0.06]'
                    }`}
                  >
                <Search className={`w-10 h-10 mx-auto mb-3.5 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
                <h4 className={`text-xs font-bold ${isLight ? 'text-black' : 'text-white'}`}>No Companions Found</h4>
                <p className={`text-[11px] max-w-[200px] mx-auto mt-1 leading-relaxed ${isLight ? 'text-black/55' : 'text-[#555555]'}`}>
                  We couldn't find any companions matching your query.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('foryou');
                  }}
                  className={`mt-4 px-4 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                    isLight 
                      ? 'bg-black/[0.04] hover:bg-black/[0.08] text-black border-black/[0.08]' 
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-white border-white/[0.08]'
                  }`}
                >
                  Reset Filters
                </button>
              </motion.div>
            ) : (
              /* Character 2-Column Grid exactly like the screenshot */
              <motion.div
                key="characters-grid"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3.5 gap-y-5 pt-2"
              >
                {currentList.map((persona) => {
                  const isSelected = persona.id === selectedPersonaId;
                  const isLiked = likedPersonaIds.includes(persona.id);
                  const primaryCategory = getPrimaryCategory(persona);
                  const lastChatted = getLastChattedTime(persona.id, storageConfig?.chatHistories || []);

                  // Setup Hold & Click Gestures cleanly to isolate hold and tap actions
                  const handleTouchStart = (e: React.TouchEvent) => {
                    isHoldingRef.current = false;
                    hasMovedRef.current = false;
                    if (e.touches && e.touches[0]) {
                      touchStartCoords.current = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY
                      };
                    }
                    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
                    touchTimerRef.current = setTimeout(() => {
                      isHoldingRef.current = true;
                      if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(12);
                      }
                      onOpenGlobalProfile?.(persona);
                    }, 500);
                  };

                  const handleTouchEnd = () => {
                    if (touchTimerRef.current) {
                      clearTimeout(touchTimerRef.current);
                      touchTimerRef.current = null;
                    }
                    if (!isHoldingRef.current && !hasMovedRef.current) {
                      onOpenGlobalProfile?.(persona);
                    }
                    isHoldingRef.current = false;
                    hasMovedRef.current = false;
                    touchStartCoords.current = null;
                  };

                  const handleTouchMove = (e: React.TouchEvent) => {
                    if (touchStartCoords.current && e.touches && e.touches[0]) {
                      const deltaX = Math.abs(e.touches[0].clientX - touchStartCoords.current.x);
                      const deltaY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);
                      if (deltaX > 10 || deltaY > 10) {
                        hasMovedRef.current = true;
                        if (touchTimerRef.current) {
                          clearTimeout(touchTimerRef.current);
                          touchTimerRef.current = null;
                        }
                      }
                    } else {
                      if (touchTimerRef.current) {
                        clearTimeout(touchTimerRef.current);
                        touchTimerRef.current = null;
                      }
                    }
                  };

                  const handleMouseDown = () => {
                    isHoldingRef.current = false;
                    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
                    touchTimerRef.current = setTimeout(() => {
                      isHoldingRef.current = true;
                      if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(12);
                      }
                      onOpenGlobalProfile?.(persona);
                    }, 500);
                  };

                  const handleMouseUp = () => {
                    if (touchTimerRef.current) {
                      clearTimeout(touchTimerRef.current);
                      touchTimerRef.current = null;
                    }
                    if (!isHoldingRef.current) {
                      onOpenGlobalProfile?.(persona);
                    }
                    isHoldingRef.current = false;
                  };

                  const handleMouseLeave = () => {
                    if (touchTimerRef.current) {
                      clearTimeout(touchTimerRef.current);
                      touchTimerRef.current = null;
                    }
                  };

                  return (
                    <div
                      key={persona.id}
                      onClick={(e) => {
                        if (!isHoldingRef.current && !hasMovedRef.current) {
                          onOpenGlobalProfile?.(persona);
                        }
                      }}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                      onMouseDown={handleMouseDown}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseLeave}
                      className="flex flex-col cursor-pointer group active:scale-[0.98] transition-all duration-200 relative"
                      title="Tap to view details"
                    >
                      {/* Portrait Sized Rounded Card */}
                      <div className={`relative w-full aspect-[3/4.4] overflow-hidden rounded-[28px] transition-all duration-300 ${
                        isSelected 
                          ? isLight
                            ? 'shadow-[0_8px_24px_rgba(0,0,0,0.15)] bg-black/[0.01]'
                            : 'shadow-[0_8px_32px_rgba(0,0,0,0.6)] bg-white/[0.02] border border-accent/20'
                          : isLight 
                            ? 'bg-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]' 
                            : 'bg-[#121214] border border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.8)] hover:shadow-[0_12px_24px_rgba(0,0,0,1)] hover:border-white/[0.15]'
                      }`}>
                        {/* Visual gradient or background image filling most of the card */}
                        {persona.avatar ? (
                          <SafeImage 
                            src={persona.avatar} 
                            referrerPolicy="no-referrer" 
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" 
                          />
                        ) : (
                          <div className="absolute inset-0 w-full h-full">
                            {/* Proper styled fallback background - always guaranteed to be a beautiful gradient even if avatarGradient is missing */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${isLight ? 'from-zinc-200 to-zinc-300' : (persona.avatarGradient || 'from-zinc-850 to-zinc-950')} opacity-[0.95]`} />
                          </div>
                        )}

                        {/* Ambient gradient overlay for maximum readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent z-10 pointer-events-none" />

                        {/* Smooth backdrop blur fading up to 40% of the card height */}
                        <div 
                          className="absolute inset-0 bg-black/20 backdrop-blur-[12px] pointer-events-none z-10"
                          style={{
                            maskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)',
                            WebkitMaskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)'
                          }}
                        />

                        {/* Info & Text Overlay near the bottom */}
                        <div className="absolute inset-x-0 bottom-0 p-3.5 pb-3 z-20 flex flex-col justify-end">
                          <div className="text-white text-[13.5px] font-bold tracking-tight mb-0.5 line-clamp-1 drop-shadow-sm font-sans">
                            {persona.name}
                          </div>
                          
                          {/* Tagline in smaller text below the name */}
                          <p className="text-[10px] text-white/75 leading-normal tracking-wide line-clamp-2 min-h-[28px] font-sans drop-shadow-sm mb-2.5">
                            {persona.subtitle || persona.tagline || persona.description}
                          </p>

                          {/* Bottom metrics and Action Button Row */}
                          <div className="flex items-center justify-between gap-1">
                            {/* Metrics: Chat & Likes count */}
                            <div className="flex items-center gap-2.5 text-white/85 font-medium font-sans">
                              <div className="flex items-center gap-1">
                                <MessageCircle className="w-3.5 h-3.5 text-white/85 stroke-[2.2]" />
                                <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getRealMessageCount(persona, storageConfig?.chatHistories || [])}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Heart className={`w-3.5 h-3.5 stroke-[2.2] ${isLiked ? 'text-white fill-white' : 'text-white/75'}`} />
                                <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getRealLikesCount(persona, isLiked)}</span>
                              </div>
                            </div>

                            {/* Quick-Chat Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPersona(persona);
                                
                                // If there is an existing chat history, resume it; otherwise start fresh
                                const matchingHistories = (storageConfig?.chatHistories || []).filter(h => h.personaId === persona.id);
                                if (matchingHistories.length > 0) {
                                  const getSessionTime = (h: any) => h.updatedAt || parseInt(h.id?.split('-')[1]) || 0;
                                  const sorted = [...matchingHistories].sort((a, b) => getSessionTime(b) - getSessionTime(a));
                                  if (sorted[0] && onResumeChat) {
                                    onResumeChat(sorted[0].id);
                                    return;
                                  }
                                }
                                onStartChat(persona.id);
                              }}
                              className={`px-2.5 py-1 rounded-xl font-extrabold tracking-wider uppercase text-[9px] flex items-center gap-0.5 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer z-30 border ${
                                isLight 
                                  ? 'bg-white/80 text-zinc-800 border-black/[0.06] hover:bg-white' 
                                  : 'bg-black/40 border-white/[0.15] text-white/90 hover:bg-black/60'
                              }`}
                            >
                              <span>Chat</span>
                              <Plus className={`w-2.5 h-2.5 stroke-[3.5] ${isLight ? 'text-zinc-800' : 'text-white/90'}`} />
                            </button>
                          </div>
                        </div>

                        {/* Selection glow highlight (frameless, elegant) */}
                        {isSelected && (
                          <div className={`absolute inset-0 rounded-[28px] pointer-events-none z-30 ${
                            isLight
                              ? 'shadow-[inset_0_0_15px_rgba(0,0,0,0.06)] bg-black/[0.01]'
                              : 'shadow-[inset_0_0_15px_rgba(255,255,255,0.1)] bg-white/[0.01]'
                          }`} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )
          ) : (
            currentWorldsList.length === 0 ? (
              /* Empty State for worlds category search */
              <motion.div
                key="worlds-empty"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
                className={`text-center p-8 backdrop-blur-md rounded-[28px] border py-14 my-4 ${
                  isLight ? 'bg-white border-black/[0.06] shadow-sm' : 'bg-white/[0.01] border-white/[0.06]'
                }`}
              >
                <Search className={`w-10 h-10 mx-auto mb-3.5 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
                <h4 className={`text-xs font-bold ${isLight ? 'text-black' : 'text-white'}`}>No Worlds Found</h4>
                <p className={`text-[11px] max-w-[200px] mx-auto mt-1 leading-relaxed ${isLight ? 'text-black/55' : 'text-[#555555]'}`}>
                  We couldn't find any worlds matching your query.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('foryou');
                  }}
                  className={`mt-4 px-4 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                    isLight 
                      ? 'bg-black/[0.04] hover:bg-black/[0.08] text-black border-black/[0.08]' 
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-white border-white/[0.08]'
                  }`}
                >
                  Reset Filters
                </button>
              </motion.div>
            ) : (
              /* Worlds 2-Column Grid exactly like the screenshot */
              <motion.div
                key="worlds-grid"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3.5 gap-y-5 pt-2"
              >
                {currentWorldsList.map((world) => {
                  const isWorldSelected = (storageConfig?.activeWorldId === world.id) || (selectedPersonaId === `world-${world.id}`);

                  const handleTouchStart = (e: React.TouchEvent) => {
                    isHoldingRef.current = false;
                    hasMovedRef.current = false;
                    if (e.touches && e.touches[0]) {
                      touchStartCoords.current = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY
                      };
                    }
                    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
                    touchTimerRef.current = setTimeout(() => {
                      isHoldingRef.current = true;
                      if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(12);
                      }
                      onOpenGlobalWorldProfile?.(world);
                    }, 500);
                  };

                  const handleTouchMove = (e: React.TouchEvent) => {
                    if (touchStartCoords.current && e.touches && e.touches[0]) {
                      const deltaX = Math.abs(e.touches[0].clientX - touchStartCoords.current.x);
                      const deltaY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);
                      if (deltaX > 10 || deltaY > 10) {
                        hasMovedRef.current = true;
                        if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
                      }
                    }
                  };

                  const handleTouchEnd = () => {
                    if (touchTimerRef.current) {
                      clearTimeout(touchTimerRef.current);
                      touchTimerRef.current = null;
                    }
                    if (!isHoldingRef.current && !hasMovedRef.current) {
                      onOpenGlobalWorldProfile?.(world);
                    }
                    isHoldingRef.current = false;
                    hasMovedRef.current = false;
                    touchStartCoords.current = null;
                  };

                  const handleMouseDown = () => {
                    isHoldingRef.current = false;
                    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
                    touchTimerRef.current = setTimeout(() => {
                      isHoldingRef.current = true;
                      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
                      onOpenGlobalWorldProfile?.(world);
                    }, 500);
                  };

                  const handleMouseUp = () => {
                    if (touchTimerRef.current) {
                      clearTimeout(touchTimerRef.current);
                      touchTimerRef.current = null;
                    }
                    if (!isHoldingRef.current) {
                      onOpenGlobalWorldProfile?.(world);
                    }
                    isHoldingRef.current = false;
                  };

                  return (
                    <div
                      key={world.id}
                      className="flex flex-col cursor-pointer group active:scale-[0.98] transition-all duration-200 relative"
                      onClick={(e) => {
                          e.preventDefault();
                          if (isHoldingRef.current) return;
                          onOpenGlobalWorldProfile?.(world);
                      }}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onMouseDown={handleMouseDown}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      <div className={`relative w-full aspect-[3/4.4] overflow-hidden rounded-[28px] transition-all duration-300 ${
                        isWorldSelected 
                          ? isLight
                            ? 'shadow-[0_8px_24px_rgba(0,0,0,0.15)] bg-black/[0.01]'
                            : 'shadow-[0_8px_32px_rgba(0,0,0,0.6)] bg-white/[0.02] border border-accent/20'
                          : isLight 
                            ? 'bg-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]' 
                            : 'bg-[#121214] border border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.8)] hover:shadow-[0_12px_24px_rgba(0,0,0,1)] hover:border-white/[0.15]'
                      }`}>
                        {world.coverImage ? (
                          <SafeImage 
                            src={world.coverImage} 
                            referrerPolicy="no-referrer" 
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" 
                          />
                        ) : (
                          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#6B21A8]/20 to-[#06B6D4]/10" />
                        )}

                        {/* Ambient gradient overlay for maximum readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent z-10 pointer-events-none" />

                        {/* Smooth backdrop blur fading up to 40% of the card height */}
                        <div 
                          className="absolute inset-0 bg-black/20 backdrop-blur-[12px] pointer-events-none z-10"
                          style={{
                            maskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)',
                            WebkitMaskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)'
                          }}
                        />

                        {/* Info & Text Overlay near the bottom */}
                        <div className="absolute inset-x-0 bottom-0 p-3.5 pb-3 z-20 flex flex-col justify-end">
                          <div className="text-white text-[13.5px] font-bold tracking-tight mb-0.5 line-clamp-1 drop-shadow-sm font-sans">
                            {world.name}
                          </div>
                          
                          {/* Tagline in smaller text below the name */}
                          <p className="text-[10px] text-white/75 leading-normal tracking-wide line-clamp-2 min-h-[28px] font-sans drop-shadow-sm mb-2.5">
                            {world.tagline || world.description}
                          </p>

                          {/* Bottom metrics and Action Button Row */}
                          <div className="flex items-center justify-between gap-1">
                            {/* Metrics: Chat, Likes, and Companions count */}
                            <div className="flex items-center gap-2.5 text-white/85 font-medium font-sans">
                              <div className="flex items-center gap-1">
                                <MessageCircle className="w-3.5 h-3.5 text-white/85 stroke-[2.2]" />
                                <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getWorldMessageCount(world, storageConfig?.chatHistories || [])}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Heart className={`w-3.5 h-3.5 stroke-[2.2] ${(storageConfig?.likedWorldIds || []).includes(world.id) ? 'text-white fill-white' : 'text-white/75'}`} />
                                <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getRealWorldLikesCount(world, (storageConfig?.likedWorldIds || []).includes(world.id))}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-white/85 stroke-[2.2]" />
                                <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{world.linkedCharacterIds?.length || 0}</span>
                              </div>
                            </div>

                            {/* Removed Quick-Enter Button */}
                          </div>
                        </div>

                        {/* Selection glow highlight (frameless, elegant) */}
                        {isWorldSelected && (
                          <div className={`absolute inset-0 rounded-[28px] pointer-events-none z-30 ${
                            isLight
                              ? 'shadow-[inset_0_0_15px_rgba(0,0,0,0.06)] bg-black/[0.01]'
                              : 'shadow-[inset_0_0_15px_rgba(255,255,255,0.1)] bg-white/[0.01]'
                          }`} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )
          )}
        </AnimatePresence>



          </div>
        </>
      )}
      </div>

      {/* RENDER DYNAMIC HOVER/HOLD PROFILE MODAL */}
      <AnimatePresence>
        {holdingPersona && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-5 font-sans">
            {/* Blurry dark overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHoldingPersona(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md cursor-pointer"
            />

            {/* Profile Frosted Glass Card Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="relative w-full max-w-[290px] bg-[#111112]/95 border border-white/10 rounded-[28px] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.95)] z-10 p-5 flex flex-col items-center"
            >
              {/* Colored ambient glow matched to character gradient */}
              <div className={`absolute -top-16 -left-16 w-36 h-36 rounded-full bg-gradient-to-br ${holdingPersona.avatarGradient} opacity-20 blur-3xl pointer-events-none`} />

              {/* Close Button top-right */}
              <button
                onClick={() => setHoldingPersona(null)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white transition-all active:scale-90 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Persona Avatar stack inside modal */}
              <div className="w-16 h-16 rounded-[20px] relative overflow-hidden mt-3 shadow-lg border border-white/15">
                {holdingPersona.avatar ? (
                  <SafeImage src={holdingPersona.avatar} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 w-full h-full">
                    <div className={`absolute inset-0 bg-gradient-to-br ${holdingPersona.avatarGradient} opacity-[0.85]`} />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    </div>
                  </div>
                )}
              </div>

              {/* Character Header Details */}
              <div className="text-center mt-3.5 w-full z-10">
                <h3 className="text-sm font-black text-white leading-tight tracking-wide font-sans">{holdingPersona.name}</h3>
                <p className="text-[10px] text-zinc-300 font-semibold mt-0.5 tracking-tight font-sans">
                  {holdingPersona.subtitle}
                </p>
                
                {/* Meta stats bar */}
                <div className="flex items-center justify-center gap-3 mt-2.5 text-[9px] text-[#888] font-sans font-medium uppercase tracking-wider bg-white/[0.02] py-1.5 px-3 rounded-xl border border-white/[0.05] max-w-[95%] mx-auto">
                  <div className="flex items-center gap-1 text-white/70">
                    <span className="opacity-90">💬</span>
                    <span className="font-bold">{holdingPersona.chatsCount || '14.2K'}</span>
                  </div>
                  <span className="text-white/10">•</span>
                  <div className="flex items-center gap-1 text-white/70">
                    <span className="opacity-90">👤</span>
                    <span className="font-bold">{holdingPersona.creator || '@system'}</span>
                  </div>
                </div>
              </div>

              {/* Scrollable details wrapper */}
              <div className="w-full mt-4 space-y-3 max-h-[160px] overflow-y-auto scrollbar-none pr-0.5 font-sans z-10">
                {/* Character Long Biography */}
                <div className="space-y-1">
                  <div className="text-[8px] uppercase tracking-widest text-white/40 font-bold px-0.5">Biography & Instincts</div>
                  <p className="text-[10px] text-[#A0A0AB] leading-relaxed font-normal bg-white/[0.02] p-3 rounded-xl border border-white/[0.04] text-left">
                    {holdingPersona.description || "A highly specialized conversational intelligence customized with complex rules and system prompt alignment benchmarks."}
                  </p>
                </div>

                {/* Suggested Starters list */}
                {holdingPersona.suggestedPrompts && holdingPersona.suggestedPrompts.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="text-[8px] uppercase tracking-widest text-white/40 font-bold px-0.5">Suggested starters</div>
                    <div className="flex flex-col gap-1.5 pt-1">
                      {holdingPersona.suggestedPrompts.map((p, idx) => (
                        <div key={idx} className="px-3 py-2 bg-white/[0.02] border border-white/[0.04] text-[9.5px] text-[#D4D4D8] rounded-xl leading-snug text-left truncate italic">
                          "{p}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Customize Companion Behavior Button */}
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(12);
                  }
                  
                  // Pre-fill fields for customization / editing
                  setName(holdingPersona.name);
                  setTagline(holdingPersona.subtitle || '');
                  setDescription(holdingPersona.description || '');
                  setAvatar(holdingPersona.avatar || '');
                  setAvatarEmoji(holdingPersona.avatarEmoji || '🤖');
                  
                  // Extract raw system instruction if exists
                  const systemInst = holdingPersona.systemInstruction || '';
                  setDefinition(systemInst);
                  
                  setGreetingText(holdingPersona.suggestedPrompts?.[0] || '');
                  setAdditionalGreetings(holdingPersona.suggestedPrompts?.slice(1) || []);
                  setTags(holdingPersona.tags || []);
                  setPrivacy(holdingPersona.privacy as any || 'public');
                  setIsDefinitionPrivate(holdingPersona.isDefinitionPrivate !== false);
                  
                  // Extract theme based on gradient
                  if (holdingPersona.avatarGradient?.includes('blue')) {
                    setSelectedTheme('blue');
                  } else if (holdingPersona.avatarGradient?.includes('emerald')) {
                    setSelectedTheme('emerald');
                  } else if (holdingPersona.avatarGradient?.includes('amber') || holdingPersona.avatarGradient?.includes('orange')) {
                    setSelectedTheme('amber');
                  } else {
                    setSelectedTheme('purple');
                  }
                  
                  setEditingPersonaId(holdingPersona.id);
                  setHoldingPersona(null);
                  setActiveCategory('create');
                  setCreationStep(1);
                  triggerToast(`Customizing "${holdingPersona.name}"`);
                }}
                className="w-full mt-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-zinc-300 hover:text-zinc-100 text-[10px] font-extrabold tracking-wider uppercase transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer z-10"
              >
                <Palette className="w-3.5 h-3.5 text-zinc-400" />
                <span>Customize Companion Behavior</span>
              </button>

              {/* Start Chat primary glowing action button */}
              <div className="w-full mt-3.5 z-10">
                <button
                  type="button"
                  onClick={() => {
                    onSelectPersona(holdingPersona);
                    const pid = holdingPersona.id;
                    setHoldingPersona(null);
                    onStartChat(pid);
                  }}
                  className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-900 border border-white/10 text-white font-extrabold text-xs tracking-wider shadow-[0_4px_16px_rgba(255,255,255,0.05)] transition-all active:scale-[0.97] flex items-center justify-center gap-1 cursor-pointer font-sans"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-white" />
                  <span>Start Chat</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}

        
      </AnimatePresence>


      {/* Create Options Full-Page Overlay */}
      <AnimatePresence>
        {showCreateOptions && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className={`absolute inset-0 z-[200] flex flex-col ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Full Page Header */}
            <div className={`flex items-center justify-between px-4 py-4 border-b ${
              isLight ? 'border-black/[0.05] bg-white' : 'border-white/[0.03] bg-[#121214]'
            }`}>
              <button
                onClick={() => setShowCreateOptions(false)}
                className={`p-2 -ml-2 rounded-xl transition-all ${
                  isLight ? 'text-black/60 hover:text-black hover:bg-black/5' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className={`text-sm font-bold tracking-wide ${isLight ? 'text-black' : 'text-white'}`}>Create New</h2>
              <div className="w-10" /> {/* Balance spacer */}
            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md mx-auto w-full">
              <div className="text-center mb-8">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                  isLight ? 'bg-zinc-800/10 text-zinc-800 border border-zinc-800/15' : 'bg-accent/10 text-accent border border-accent/15'
                }`}>
                  <PlusCircle className="w-6 h-6 stroke-[2]" />
                </div>
                <h1 className={`text-xl font-sans font-black tracking-tight ${isLight ? 'text-black' : 'text-white'}`}>
                  What would you like to build?
                </h1>
                <p className={`text-xs mt-2 font-sans font-light max-w-xs mx-auto leading-relaxed ${
                  isLight ? 'text-black/50' : 'text-white/40'
                }`}>
                  Choose an AI entity, define a user personality background, or set up a custom environment.
                </p>
              </div>

              <div className="space-y-3.5">
                {/* CHARACTER */}
                <button 
                  onClick={() => { 
                    setShowCreateOptions(false); 
                    if (onOpenCharacterCreator) {
                      onOpenCharacterCreator();
                    } else {
                      setActiveCreationType('character'); 
                    }
                  }} 
                  className={`w-full flex items-center gap-4.5 p-5 rounded-[24px] transition-all duration-200 active:scale-[0.98] border ${
                    isLight 
                      ? 'border-black/[0.06] bg-white hover:bg-black/[0.01] hover:border-black/[0.12] shadow-sm' 
                      : 'border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-zinc-800/10 text-zinc-800 border border-zinc-800/15' : 'bg-accent/10 text-accent border border-accent/15'
                  }`}>
                    <User className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <h3 className={`font-sans font-bold text-[14px] leading-snug ${isLight ? 'text-black' : 'text-white'}`}>
                      Character
                    </h3>
                    <p className={`text-[11px] font-sans mt-0.5 leading-normal ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                      Create an AI companion with a custom greeting, personality, and prompt.
                    </p>
                  </div>
                </button>

                {/* PERSONA */}
                <button 
                  onClick={() => { 
                    setShowCreateOptions(false); 
                    if (onOpenPersonaCreator) {
                      onOpenPersonaCreator();
                    } else {
                      setActiveCreationType('persona'); 
                    }
                  }} 
                  className={`w-full flex items-center gap-4.5 p-5 rounded-[24px] transition-all duration-200 active:scale-[0.98] border ${
                    isLight 
                      ? 'border-black/[0.06] bg-white hover:bg-black/[0.01] hover:border-black/[0.12] shadow-sm' 
                      : 'border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-zinc-800/10 text-zinc-800 border border-zinc-800/15' : 'bg-accent/10 text-accent border border-accent/15'
                  }`}>
                    <UserCircle className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <h3 className={`font-sans font-bold text-[14px] leading-snug ${isLight ? 'text-black' : 'text-white'}`}>
                      Persona
                    </h3>
                    <p className={`text-[11px] font-sans mt-0.5 leading-normal ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                      Define your own background details and personality for characters to adapt to.
                    </p>
                  </div>
                </button>

                {/* WORLD */}
                <button 
                  onClick={() => { 
                    setShowCreateOptions(false); 
                    if (onOpenWorldCreator) {
                      onOpenWorldCreator();
                    } else {
                      setActiveCreationType('world'); 
                    }
                  }} 
                  className={`w-full flex items-center gap-4.5 p-5 rounded-[24px] transition-all duration-200 active:scale-[0.98] border ${
                    isLight 
                      ? 'border-black/[0.06] bg-white hover:bg-black/[0.01] hover:border-black/[0.12] shadow-sm' 
                      : 'border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-zinc-800/10 text-zinc-800 border border-zinc-800/15' : 'bg-accent/10 text-accent border border-accent/15'
                  }`}>
                    <Globe className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <h3 className={`font-sans font-bold text-[14px] leading-snug ${isLight ? 'text-black' : 'text-white'}`}>
                      World
                    </h3>
                    <p className={`text-[11px] font-sans mt-0.5 leading-normal ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                      Create a shared immersive environment, standard guidelines, or deep lore.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orb Economy Modals */}
      {storageConfig && onUpdateConfig && (
        <>
          <OrbWalletModal
            isOpen={showOrbWallet}
            onClose={() => setShowOrbWallet(false)}
            storageConfig={storageConfig}
            onUpdateConfig={onUpdateConfig}
          />

        </>
      )}
    </div>
  );
});
