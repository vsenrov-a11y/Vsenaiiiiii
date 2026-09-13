export type ScreenType = 'welcome' | 'onboarding' | 'main';
export type MainTabType = 'history' | 'personas' | 'profile';

export interface SocialPost {
  id: string;
  authorId: string;
  author: string;
  authorAvatar?: string;
  content: string;
  image?: string;
  timestamp: number;
  likes: number;
  likedByUser?: boolean;
  comments: Array<{
    id: string;
    authorId: string;
    author: string;
    authorAvatar?: string;
    content: string;
    timestamp: number;
  }>;
}

export interface Persona {
  id: string;
  name: string;
  subtitle: string;
  tagline?: string;
  description: string;
  systemInstruction: string;
  systemPrompt?: string;
  greeting?: string;
  avatarGradient: string;
  avatar?: string;
  accentColor: string;
  suggestedPrompts: string[];
  isCustom?: boolean;
  creator?: string;
  chatsCount?: string;
  messageCount?: number;
  tags?: string[];
  categories?: string[];
  createdAt?: string;
  favorite?: boolean;
  isFavorite?: boolean;
  privacy?: string;
  isDefinitionPrivate?: boolean;
  avatarEmoji?: string;
  voice?: string;
  likesCount?: string;
  characterLikes?: string;
  characterDislikes?: string;
  additionalGreetings?: string[];
  aiGreetingsEnabled?: boolean;
  personalizedDetails?: string;
  exampleDialogue?: string;
  
  // Social Media Preset Configurations
  hasSocialMedia?: boolean;
  socialFollowers?: number;
  socialFollowing?: number;
  socialLikes?: number;
  socialPosts?: SocialPost[];
  socialAvatar?: string;
  updatedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
  isPinned?: boolean;
  alternatives?: string[];
  activeAlternativeIndex?: number;
  image?: string;
}

export interface WorldEvent {
  id: string;
  name: string;
  time: string;
  description: string;
  isCompleted?: boolean;
}

export interface InterCharacterRelation {
  char1Id: string;
  char1Name: string;
  char2Id: string;
  char2Name: string;
  affinity: number; // 1 to 10
  status: string; // e.g. "Allies", "Rivals", "Enemies", "Lovers", "Friends"
  notes?: string;
}

export interface ChatHistory {
  id: string;
  personaId: string;
  personaName: string;
  avatarGradient: string;
  lastMessage: string;
  timestamp: string;
  messages: ChatMessage[];
  updatedAt: number;
  isPinned?: boolean;
  isArchived?: boolean;
  linkedWorldId?: string;
  linkedCharacterIds?: string[];
  userPersonaId?: string;
  enableSceneDetection?: boolean;
  activePlaceName?: string;
  activeAmbientName?: string;
  isAmbientMuted?: boolean;
  activeChatStyle?: 'narrative' | 'descriptive' | 'fast' | 'classic';
  activePerspective?: '1st' | '3rd';
  customWallpaper?: string;
  worldCalendar?: string;
  worldLocation?: string;
  worldWeather?: string;
  worldReputation?: string;
  worldSceneMood?: string;
  storyMemories?: string[];
  pinnedMessages?: string[];
  worldEvents?: WorldEvent[];
  relationshipScores?: Record<string, Record<string, number>>;
  interCharacterRelationships?: Record<string, Record<string, { affinity: number; status: string; notes?: string }>>;
  characterState?: {
    status?: {
      health?: number;
      hunger?: number;
      energy?: number;
      hygiene?: number;
      mood?: string;
      custom?: Record<string, number>;
    };
    activity?: {
      job?: string;
      successRate?: number;
      schedule?: string;
    };
    inventory?: {
      money?: number;
      items?: string[];
      customCategories?: Record<string, string[]>;
    };
    appearance?: {
      outfit?: string;
      accessories?: string;
      hairstyle?: string;
      makeup?: string;
      products?: string;
      specialFeatures?: string;
    };
    phone?: {
      hasLock?: boolean;
      password?: string;
      threads?: Record<string, any[]>;
      gallery?: any[];
      socialFeed?: any[];
    };
  };
}

export interface UserPersona {
  id: string;
  name: string;
  description: string;
  avatarGradient?: string;
  avatar?: string;
  isDefault?: boolean;
  likes?: string;
  dislikes?: string;
}

export interface UserProfile {
  name: string;
  username: string;
  description: string;
  avatarGradient?: string;
  avatar?: string;
}

export interface StorageConfig {
  apiKey: string;
  apiKeys?: string[];
  useServerKeyFallback: boolean;
  selectedPersonaId: string;
  customPersonas: Persona[];
  characters?: Persona[];
  chatHistories: ChatHistory[];
  likedPersonaIds?: string[];
  likedWorldIds?: string[];
  userPersonas?: UserPersona[];
  activeUserPersonaId?: string;
  userProfile?: UserProfile;
  isHapticEnabled?: boolean;
  isPerformanceMode?: boolean;
  isRepliesEnabled?: boolean;
  isCacheEnabled?: boolean;
  isSafeFilterEnabled?: boolean;
  isVoiceRepliesEnabled?: boolean;
  samplerMaxContext?: number;
  samplerGeneratedTokens?: number;
  samplerIsStreaming?: boolean;
  samplerTemperature?: number;
  samplerTopP?: number;
  samplerPresencePenalty?: number;
  samplerFrequencyPenalty?: number;
  samplerSeed?: number;
  apiProvider?: 'gemini' | 'openai';
  theme?: 'dark' | 'light';
  messageTextSize?: number;
  chatLayout?: 'standard' | 'compact' | 'immersive';
  customAppLogo?: string;
  worldApiKey?: string;
  useSameApiKey?: boolean;
  worlds?: World[];
  activeWorldId?: string;
  selectedModel?: string;
  hasOnboarded?: boolean;
  orbs?: number;
  lastDailyClaimTimestamp?: number;
  accountCreatedAt?: number;
  orbTransactions?: Array<{
    id: string;
    amount: number;
    reason: string;
    timestamp: number;
  }>;
}

export interface Place {
  id?: string;
  name: string;
  image: string; // cover image or place image url/base64
  triggerDescription?: string; // Optional for "General", required for custom places
}

export interface AmbientSound {
  id?: string;
  name: string;
  audioFile: string; // audio file url or base64 or descriptor
  triggerDescription?: string; // Optional for "General", required for custom ambient sounds
}

export interface World {
  id: string;
  name: string;
  tagline: string;
  description: string;
  worldDefinition: string; // longer text field describing the setting, rules, atmosphere
  coverImage: string;
  creator: string; // e.g. '@you' or system
  visibility: 'Public' | 'Unlisted' | 'Private';
  greeting?: string; // Custom greeting message that comes as the first message of the world
  places: Place[]; // exactly one mandatory Place called "General", up to 50 custom places
  ambientSounds: AmbientSound[]; // exactly one mandatory "General" ambient sound, up to 10 custom ambient sounds
  linkedCharacterIds?: string[]; // Relationship to characters
  linkedChatIds?: string[]; // Relationship to specific chats
  defaultAtmosphere?: string; // Default weather or atmosphere
  defaultCalendar?: string; // Default calendar / time of day
  defaultLocation?: string; // Default location name
  defaultReputation?: string; // Default player world reputation
  initialInterCharacterRelationships?: Record<string, Record<string, { affinity: number; status: string; notes?: string }>>;
  createdAt?: string;
  updatedAt?: number;
  chatsCount?: string;
  likesCount?: string;
  exampleDialogue?: string;
  
  // World Specific Social Media Overrides & Feeds
  worldSocialFeed?: SocialPost[];
  worldSocialConfigs?: Record<string, {
    hasSocialMedia?: boolean;
    socialFollowers?: number;
    socialFollowing?: number;
    socialLikes?: number;
    socialAvatar?: string;
  }>;
}

