import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Persona, SocialPost } from '../../types';
import { ImageCropModal } from '../ImageCropModal';
import { storeAsset, useAsset } from '../../utils/fileDb';
import { SafeImage } from '../common/SafeImage';
import { 
  ArrowLeft, 
  Image as ImageIcon, 
  Sparkles, 
  X, 
  Globe, 
  Link as LinkIcon, 
  Lock, 
  ChevronRight, 
  Hash, 
  PlusCircle, 
  Pencil, 
  Trash2, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown 
} from 'lucide-react';

interface CharacterCreatorProps {
  isLight: boolean;
  onClose: () => void;
  onSave: (persona: Persona) => void;
  initialData?: Persona | null;
}

export function CharacterCreator({ isLight, onClose, onSave, initialData }: CharacterCreatorProps) {
  const isEdit = !!initialData;
  const [step, setStep] = useState(1);
  
  // Form State
  const [name, setName] = useState(initialData?.name || '');
  const [avatar, setAvatar] = useState(initialData?.avatar || '');
  const resolvedAvatar = useAsset(avatar);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [greeting, setGreeting] = useState(initialData?.greeting || '');
  const [additionalGreetings, setAdditionalGreetings] = useState<string[]>(initialData?.additionalGreetings || []);
  const [aiGreetingsEnabled, setAiGreetingsEnabled] = useState(initialData?.aiGreetingsEnabled !== false);

  const [tagline, setTagline] = useState(initialData?.tagline || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [definition, setDefinition] = useState(initialData?.systemPrompt || '');
  const [keepPrivate, setKeepPrivate] = useState(true);

  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>(
    (initialData?.privacy as 'public' | 'unlisted' | 'private') || 'private'
  );
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [likes, setLikes] = useState(initialData?.characterLikes || '');
  const [dislikes, setDislikes] = useState(initialData?.characterDislikes || '');
  const [personalizedDetails, setPersonalizedDetails] = useState(initialData?.personalizedDetails || '');
  const [exampleDialogue, setExampleDialogue] = useState(initialData?.exampleDialogue || '');

  // Sub-pages state for Step 4 & Edit Layout
  const [subPage, setSubPage] = useState<'none' | 'tagline' | 'description' | 'definition' | 'likes' | 'dislikes' | 'greeting' | 'tags' | 'visibility' | 'personalizedDetails' | 'social' | 'exampleDialogue'>('none');
  const [editingGreetingIndex, setEditingGreetingIndex] = useState<number>(0);
  const [isReordering, setIsReordering] = useState(false);
  const [disclaimerExpanded, setDisclaimerExpanded] = useState(false);

  // Simulated Social Media States
  const [hasSocialMedia, setHasSocialMedia] = useState(initialData?.hasSocialMedia !== false);
  const [socialAvatar, setSocialAvatar] = useState(initialData?.socialAvatar || '');
  const [socialFollowers, setSocialFollowers] = useState<number>(initialData?.socialFollowers ?? Math.floor(Math.random() * 8000) + 1200);
  const [socialFollowing, setSocialFollowing] = useState<number>(initialData?.socialFollowing ?? Math.floor(Math.random() * 500) + 50);
  const [socialLikes, setSocialLikes] = useState<number>(initialData?.socialLikes ?? Math.floor(Math.random() * 50000) + 5000);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>(initialData?.socialPosts || []);

  // Post composer internal states inside settings
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState('');
  const [postLikes, setPostLikes] = useState(0);

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleCreate = () => {
    const newPersona: Persona = {
      id: initialData?.id || `custom-${Date.now()}`,
      name: name.trim(),
      subtitle: tagline.trim(),
      description: description.trim(),
      greeting: greeting.trim(),
      systemInstruction: definition.trim(),
      systemPrompt: definition.trim(),
      avatar: avatar,
      tags: tags,
      categories: tags,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      favorite: initialData?.favorite || false,
      isFavorite: initialData?.isFavorite || false,
      messageCount: initialData?.messageCount || 0,
      isCustom: true,
      tagline: tagline.trim(),
      avatarGradient: initialData?.avatarGradient || 'from-blue-600 to-indigo-600',
      accentColor: initialData?.accentColor || '#27272A',
      suggestedPrompts: initialData?.suggestedPrompts || [],
      characterLikes: likes.trim(),
      characterDislikes: dislikes.trim(),
      additionalGreetings: additionalGreetings.filter(g => g.trim().length > 0),
      aiGreetingsEnabled: aiGreetingsEnabled,
      privacy: privacy,
      personalizedDetails: personalizedDetails.trim(),
      exampleDialogue: exampleDialogue.trim(),
      hasSocialMedia: hasSocialMedia,
      socialFollowers: socialFollowers,
      socialFollowing: socialFollowing,
      socialLikes: socialLikes,
      socialPosts: socialPosts,
      socialAvatar: socialAvatar || avatar,
      updatedAt: Date.now(),
    };
    onSave(newPersona);
  };

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

  // Helper functions for multiple greetings editing
  const updateGreetingAt = (index: number, value: string) => {
    if (index === 0) {
      setGreeting(value);
    } else {
      const updated = [...additionalGreetings];
      updated[index - 1] = value;
      setAdditionalGreetings(updated);
    }
  };

  const removeGreetingAt = (index: number) => {
    if (index === 0) {
      if (additionalGreetings.length > 0) {
        setGreeting(additionalGreetings[0]);
        setAdditionalGreetings(additionalGreetings.slice(1));
      } else {
        setGreeting('');
      }
    } else {
      const updated = additionalGreetings.filter((_, i) => i !== index - 1);
      setAdditionalGreetings(updated);
    }
  };

  const handleAddGreeting = () => {
    const currentLength = [greeting, ...additionalGreetings].length;
    if (currentLength < 5) {
      setAdditionalGreetings([...additionalGreetings, '']);
      setEditingGreetingIndex(currentLength);
      setSubPage('greeting');
    }
  };

  const moveGreetingUp = (index: number) => {
    if (index === 0) return;
    const list = [greeting, ...additionalGreetings];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    
    setGreeting(list[0]);
    setAdditionalGreetings(list.slice(1));
  };

  const moveGreetingDown = (index: number) => {
    const list = [greeting, ...additionalGreetings];
    if (index >= list.length - 1) return;
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;

    setGreeting(list[0]);
    setAdditionalGreetings(list.slice(1));
  };

  const greetingsList = [greeting, ...additionalGreetings];

  const renderSubPage = () => {
    if (subPage === 'social') {
      return (
        <div className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden animate-fadeIn ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
          <div className={`px-4 py-3 flex items-center justify-center relative border-b ${isLight ? 'border-black/5 bg-white text-black' : 'border-white/5 bg-[#121214] text-white'}`}>
            <button onClick={() => setSubPage('none')} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold">Social Simulator Settings</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24">
            {/* Enable Toggle */}
            <div className={`p-4 rounded-2xl flex items-center justify-between border ${isLight ? 'bg-black/5 border-black/5' : 'bg-white/[0.03] border-white/5'}`}>
              <div>
                <h4 className={`font-bold text-[14px] ${isLight ? 'text-black' : 'text-white'}`}>Social Media Profile</h4>
                <p className={`text-[11px] mt-0.5 ${isLight ? 'text-black/60' : 'text-white/60'}`}>Should this character have a simulated social media account in the phone feed?</p>
              </div>
              <button 
                type="button"
                onClick={() => setHasSocialMedia(!hasSocialMedia)}
                className={`relative w-[46px] h-6 rounded-full transition-colors cursor-pointer border-none ${hasSocialMedia ? 'bg-indigo-600' : 'bg-white/20'}`}
              >
                <div className={`absolute top-[2px] left-[2px] w-5 h-5 rounded-full transition-transform bg-white ${
                  hasSocialMedia ? 'translate-x-[22px]' : ''
                }`} />
              </button>
            </div>

            {hasSocialMedia && (
              <div className="space-y-6">
                {/* Profile avatar customization */}
                <div className={`p-4 rounded-2xl border ${isLight ? 'bg-black/5 border-black/5 text-black' : 'bg-white/[0.03] border-white/5 text-white'} space-y-3`}>
                  <h4 className="font-bold text-[12px] uppercase tracking-wider text-indigo-400">Social Profile Avatar</h4>
                  <div className="flex items-center gap-4">
                    <SafeImage 
                      src={socialAvatar || avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full object-cover border border-indigo-500/20"
                    />
                    <div className="flex-1 space-y-1">
                      <p className={`text-[11px] ${isLight ? 'text-black/60' : 'text-white/60'}`}>Upload a specialized profile picture for social media, or leave blank to use the standard character avatar.</p>
                      <label className="inline-block px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors">
                        Upload Custom Avatar
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              compressAndGetBase64(file).then(res => setSocialAvatar(res));
                            }
                          }}
                        />
                      </label>
                      {socialAvatar && (
                        <button 
                          type="button" 
                          onClick={() => setSocialAvatar('')} 
                          className="text-xs text-rose-500 font-bold ml-2 hover:underline bg-transparent border-none cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile Stats */}
                <div className={`p-4 rounded-2xl border ${isLight ? 'bg-black/5 border-black/5 text-black' : 'bg-white/[0.03] border-white/5 text-white'} space-y-4`}>
                  <h4 className="font-bold text-[12px] uppercase tracking-wider text-indigo-400">Social Stats Simulator</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold ${isLight ? 'text-black/70' : 'text-white/70'}`}>Followers</label>
                      <input 
                        type="number"
                        value={socialFollowers}
                        onChange={(e) => setSocialFollowers(Math.max(0, parseInt(e.target.value) || 0))}
                        className={`w-full p-2 rounded-xl text-xs focus:outline-none ${isLight ? 'bg-white text-black border-black/10' : 'bg-white/5 text-white border-white/10'} border`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold ${isLight ? 'text-black/70' : 'text-white/70'}`}>Following</label>
                      <input 
                        type="number"
                        value={socialFollowing}
                        onChange={(e) => setSocialFollowing(Math.max(0, parseInt(e.target.value) || 0))}
                        className={`w-full p-2 rounded-xl text-xs focus:outline-none ${isLight ? 'bg-white text-black border-black/10' : 'bg-white/5 text-white border-white/10'} border`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold ${isLight ? 'text-black/70' : 'text-white/70'}`}>Likes</label>
                      <input 
                        type="number"
                        value={socialLikes}
                        onChange={(e) => setSocialLikes(Math.max(0, parseInt(e.target.value) || 0))}
                        className={`w-full p-2 rounded-xl text-xs focus:outline-none ${isLight ? 'bg-white text-black border-black/10' : 'bg-white/5 text-white border-white/10'} border`}
                      />
                    </div>
                  </div>
                </div>

                {/* Social Posts Section */}
                <div className={`p-4 rounded-2xl border ${isLight ? 'bg-black/5 border-black/5 text-black' : 'bg-[#121214] border-white/5 text-white'} space-y-4`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[12px] uppercase tracking-wider text-indigo-400">Preset Social Posts</h4>
                    <span className="text-xs opacity-60 font-mono">{socialPosts.length} posts</span>
                  </div>

                  {/* Add New Post Panel */}
                  <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-black/5 border-black/5 text-black' : 'bg-white/[0.02] border-white/5 text-white'} space-y-3`}>
                    <h5 className="text-[11px] font-bold uppercase text-indigo-300">Create New Preset Post</h5>
                    <textarea
                      placeholder="What is on their mind? Compose a post text..."
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      className={`w-full p-2.5 rounded-xl text-xs resize-none h-16 focus:outline-none ${isLight ? 'bg-white text-black border-black/10' : 'bg-black/50 text-white border-white/10'} border`}
                    />
                    
                    <div className="flex items-center justify-between gap-4">
                      {/* Image selector */}
                      <label className="flex items-center gap-1.5 p-2 bg-indigo-500/10 text-indigo-400 rounded-lg text-[10px] font-bold cursor-pointer transition-colors">
                        <span>Image / Asset</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              compressAndGetBase64(file).then(res => setPostImage(res));
                            }
                          }}
                        />
                      </label>

                      {/* Initial Likes Input */}
                      <div className="flex items-center gap-2">
                        <label className={`text-[10px] font-bold ${isLight ? 'text-black/60' : 'text-white/60'}`}>Likes:</label>
                        <input 
                          type="number"
                          value={postLikes}
                          onChange={(e) => setPostLikes(Math.max(0, parseInt(e.target.value) || 0))}
                          className={`w-16 p-1 rounded-lg text-xs text-center focus:outline-none ${isLight ? 'bg-white text-black border-black/10' : 'bg-black/50 text-white border-white/10'} border`}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!postContent.trim() && !postImage) return;
                          const newPost: SocialPost = {
                            id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            authorId: initialData?.id || 'char-created',
                            author: name || 'Character',
                            authorAvatar: socialAvatar || avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                            content: postContent,
                            image: postImage || undefined,
                            timestamp: Date.now() - (socialPosts.length * 3600000 * 24), // spread posts back in time
                            likes: postLikes,
                            comments: []
                          };
                          setSocialPosts([newPost, ...socialPosts]);
                          setPostContent('');
                          setPostImage('');
                          setPostLikes(0);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors border-none cursor-pointer"
                      >
                        Add Post
                      </button>
                    </div>

                    {postImage && (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10">
                        <SafeImage src={postImage} className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => setPostImage('')} 
                          className="absolute inset-0 bg-red-600/70 hover:bg-red-600 flex items-center justify-center text-white text-[9px] font-bold border-none cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* List of existing posts */}
                  <div className="space-y-3 pt-2">
                    {socialPosts.length === 0 ? (
                      <div className="text-center py-6 text-xs opacity-40 italic bg-white/[0.01] border border-white/5 rounded-xl">
                        No preset posts yet. Add one above!
                      </div>
                    ) : (
                      socialPosts.map((post) => (
                        <div key={post.id} className={`p-3 rounded-xl border ${isLight ? 'bg-black/[0.02] border-black/5 Text-black' : 'bg-white/[0.02] border-white/5 text-white'} space-y-3`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <SafeImage src={post.authorAvatar || socialAvatar || avatar} className="w-6 h-6 rounded-full object-cover" />
                              <div>
                                <h6 className="text-[11px] font-bold">{post.author}</h6>
                                <span className="text-[8px] opacity-40">Preset Post</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSocialPosts(socialPosts.filter(p => p.id !== post.id))}
                              className="text-rose-500 hover:text-rose-400 p-1 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-[10px] border-none cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>

                          <p className="text-xs whitespace-pre-wrap leading-relaxed">{post.content}</p>

                          {post.image && (
                            <SafeImage src={post.image} className="w-full max-h-28 object-cover rounded-lg border border-white/5" />
                          )}

                          <div className="flex items-center gap-3 text-[10px] opacity-60">
                            <span>❤️ {post.likes} Likes</span>
                            <span>💬 {post.comments.length} Comments</span>
                          </div>

                          {/* Comments builder inside this post */}
                          <div className={`p-2.5 rounded-lg ${isLight ? 'bg-black/[0.03]' : 'bg-black/40'} space-y-2`}>
                            <h6 className="text-[10px] font-bold uppercase text-indigo-400">Comments ({post.comments.length})</h6>
                            
                            {/* Existing comments list */}
                            {post.comments.length > 0 && (
                              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                                {post.comments.map(comment => (
                                  <div key={comment.id} className="text-[11px] leading-snug">
                                    <span className="font-bold text-indigo-300">@{comment.author.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()}: </span>
                                    <span className="opacity-85">{comment.content}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedComments = post.comments.filter(c => c.id !== comment.id);
                                        setSocialPosts(socialPosts.map(p => p.id === post.id ? { ...p, comments: updatedComments } : p));
                                      }}
                                      className="text-[8px] text-rose-500 font-bold ml-1.5 hover:underline bg-transparent border-none cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add a Comment to this specific post */}
                            <div className="flex gap-1.5 pt-1.5 border-t border-white/5">
                              <input 
                                type="text"
                                placeholder="Author (@alice)"
                                id={`com-author-${post.id}`}
                                className={`w-1/3 p-1 rounded text-[10px] focus:outline-none ${isLight ? 'bg-white text-black border-black/10' : 'bg-black/60 text-white border-white/10'} border`}
                              />
                              <input 
                                type="text"
                                placeholder="Write a preset comment..."
                                id={`com-text-${post.id}`}
                                className={`flex-1 p-1 rounded text-[10px] focus:outline-none ${isLight ? 'bg-white text-black border-black/10' : 'bg-black/60 text-white border-white/10'} border`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const authInp = document.getElementById(`com-author-${post.id}`) as HTMLInputElement;
                                  const textInp = document.getElementById(`com-text-${post.id}`) as HTMLInputElement;
                                  const authVal = authInp?.value.trim() || 'someone';
                                  const textVal = textInp?.value.trim() || '';
                                  if (!textVal) return;

                                  const commentObj = {
                                    id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                    authorId: authVal.toLowerCase(),
                                    author: authVal,
                                    authorAvatar: '',
                                    content: textVal,
                                    timestamp: Date.now()
                                  };

                                  const updatedComments = [...post.comments, commentObj];
                                  setSocialPosts(socialPosts.map(p => p.id === post.id ? { ...p, comments: updatedComments } : p));

                                  if (authInp) authInp.value = '';
                                  if (textInp) textInp.value = '';
                                }}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold border-none cursor-pointer"
                              >
                                Comment
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'} border-t border-white/5`}>
            <button 
              onClick={() => setSubPage('none')}
              className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer ${isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
            >
              Back to Wizard
            </button>
          </div>
        </div>
      );
    }

    if (subPage === 'tags') {
      return (
        <div className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden animate-fadeIn ${isLight ? 'bg-[#F8F9FA] text-black' : 'bg-[#0f0f10] text-white'}`}>
          <div className="px-4 py-3 flex items-center justify-center relative border-b border-black/5 dark:border-white/5">
            <button onClick={() => setSubPage('none')} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold">Edit Tags</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className={`text-xs mb-3 uppercase tracking-wider font-bold ${isLight ? 'text-black/50' : 'text-white/40'}`}>
              Active Tags ({tags.length})
            </div>

            {tags.length === 0 ? (
              <p className={`text-sm italic mb-6 ${isLight ? 'text-black/40' : 'text-white/30'}`}>No tags added yet. Add tags below to help users find your character!</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-6">
                {tags.map((tag, idx) => (
                  <span 
                    key={idx}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                      isLight ? 'bg-black/5 text-black' : 'bg-white/10 text-white'
                    }`}
                  >
                    #{tag}
                    <button 
                      type="button" 
                      onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                      className="hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className={`text-xs mb-2 uppercase tracking-wider font-bold ${isLight ? 'text-black/50' : 'text-white/40'}`}>
              Add New Tag
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag || ''}
                onChange={(e) => setNewTag(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                placeholder="tag-name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newTag.trim() && !tags.includes(newTag.trim())) {
                      setTags([...tags, newTag.trim()]);
                      setNewTag('');
                    }
                  }
                }}
                className={`flex-1 py-4 px-6 rounded-[28px] text-[14px] focus:outline-none focus:ring-1 ${
                  isLight 
                    ? 'bg-black/5 text-black placeholder-black/30 focus:ring-black/20' 
                    : 'bg-[#1C1C1E] text-white placeholder-white/30 focus:ring-white/20'
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  if (newTag.trim() && !tags.includes(newTag.trim())) {
                    setTags([...tags, newTag.trim()]);
                    setNewTag('');
                  }
                }}
                className={`px-6 py-4 rounded-[28px] font-bold text-sm transition-all cursor-pointer ${
                  isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                Add
              </button>
            </div>
            <p className={`text-[11px] mt-2 leading-relaxed ${isLight ? 'text-black/40' : 'text-white/30'}`}>
              Only letters, numbers, hyphens, and underscores are allowed. Press Enter or tap Add.
            </p>
          </div>

          <div className={`p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
            <button 
              onClick={() => setSubPage('none')}
              className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer ${isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
            >
              Save
            </button>
          </div>
        </div>
      );
    }

    if (subPage === 'visibility') {
      return (
        <div className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden animate-fadeIn ${isLight ? 'bg-[#F8F9FA] text-black' : 'bg-[#0f0f10] text-white'}`}>
          <div className="px-4 py-3 flex items-center justify-center relative border-b border-black/5 dark:border-white/5">
            <button onClick={() => setSubPage('none')} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold">Character Discovery</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <h3 className={`text-xs mb-3 uppercase tracking-wider font-bold ${isLight ? 'text-black/50' : 'text-white/40'}`}>Visibility</h3>
            
            <div className={`rounded-3xl overflow-hidden mb-6 ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'}`}>
              <button onClick={() => setPrivacy('public')} className={`w-full p-4 flex items-center gap-4 text-left border-b cursor-pointer ${isLight ? 'border-black/5' : 'border-white/5'}`}>
                <Globe className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Public</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Anyone can find, view, and chat.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'public' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
              
              <button onClick={() => setPrivacy('unlisted')} className={`w-full p-4 flex items-center gap-4 text-left border-b cursor-pointer ${isLight ? 'border-black/5' : 'border-white/5'}`}>
                <LinkIcon className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Unlisted</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Only people with a link can view and chat.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'unlisted' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
              
              <button onClick={() => setPrivacy('private')} className="w-full p-4 flex items-center gap-4 text-left cursor-pointer">
                <Lock className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Private</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Only you can view and chat.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'private' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
            </div>
          </div>

          <div className={`p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
            <button 
              onClick={() => setSubPage('none')}
              className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer ${isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
            >
              Save
            </button>
          </div>
        </div>
      );
    }

    const isTagline = subPage === 'tagline';
    const isDesc = subPage === 'description';
    const isDef = subPage === 'definition';
    const isLikes = subPage === 'likes';
    const isDislikes = subPage === 'dislikes';
    const isGreeting = subPage === 'greeting';
    const isPersonalized = subPage === 'personalizedDetails';
    const isExampleDiag = subPage === 'exampleDialogue';

    const title = isGreeting 
      ? `Greeting #${editingGreetingIndex + 1}`
      : isTagline 
      ? 'Tagline' 
      : isDesc 
      ? 'Description' 
      : isDef 
      ? 'Definition' 
      : isLikes 
      ? 'Character Likes' 
      : isDislikes
      ? 'Character Dislikes'
      : isPersonalized
      ? 'Personalized Items & Details'
      : 'Example Chats & Chat Style';

    const val = isGreeting
      ? (editingGreetingIndex === 0 ? greeting : additionalGreetings[editingGreetingIndex - 1] || '')
      : isTagline 
      ? tagline 
      : isDesc 
      ? description 
      : isDef 
      ? definition 
      : isLikes 
      ? likes 
      : isDislikes
      ? dislikes
      : isPersonalized
      ? personalizedDetails
      : exampleDialogue;

    const setter = (newValue: string) => {
      if (isGreeting) {
        updateGreetingAt(editingGreetingIndex, newValue);
      } else if (isTagline) {
        setTagline(newValue);
      } else if (isDesc) {
        setDescription(newValue);
      } else if (isDef) {
        setDefinition(newValue);
      } else if (isLikes) {
        setLikes(newValue);
      } else if (isDislikes) {
        setDislikes(newValue);
      } else if (isPersonalized) {
        setPersonalizedDetails(newValue);
      } else if (isExampleDiag) {
        setExampleDialogue(newValue);
      }
    };

    const maxChars = isGreeting ? 4096 : isTagline ? 50 : isDesc ? 500 : isDef ? 32000 : isPersonalized ? 10000 : isExampleDiag ? 32000 : 500;
    const example = isGreeting
      ? "Example: Took you long enough. I've been waiting."
      : isTagline 
      ? 'Example: A detective who solves crimes... before they happen.'
      : isDesc 
      ? "Example: She's a retired pirate queen who now runs a cozy seaside inn. But trouble still finds her."
      : isDef 
      ? 'Example: Always speaks with formal, poetic language. Avoids contractions. Never lies.'
      : isLikes
      ? 'Example: Coffee, solving puzzles, rainy days.'
      : isDislikes
      ? 'Example: Loud noises, dishonesty, early mornings.'
      : isPersonalized
      ? 'Example: He has a red cracked iPhone 6s, wears a vintage leather jacket, and keeps a silver pocketwatch in his front pocket.'
      : `<START>\n{{user}}: Hi! What are you doing?\n{{char}}: *looks up with a smirk* "Oh, just waiting for you. Care to join me?"`;

    const helpText = isGreeting
      ? "Your Character's initial message. You can create multiple greetings to give users a variety of starting options."
      : isTagline
      ? 'This is what people see before they tap to chat with your Character.'
      : isDesc
      ? 'This helps introduce your Character to people and will appear on their profile.'
      : isDef 
      ? 'The Character Definition shapes how your character thinks, speaks, or behaves. These details can be shown or hidden.'
      : isLikes
      ? 'Things your character likes or enjoys.'
      : isDislikes
      ? 'Things your character dislikes or avoids.'
      : isPersonalized
      ? 'Describe items, physical details, sizes, clothing, and details that belong to your character. These are used during roleplay chat to make interactions highly realistic and physically consistent.'
      : 'Define example dialogue snippets using {{user}} and {{char}} to teach the AI model your character\'s exact vocabulary, tone, length, and formatting style (asterisks for actions, quotes for dialogue).';

    return (
      <div className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden animate-fadeIn ${isLight ? 'bg-[#F8F9FA] text-black' : 'bg-[#0f0f10] text-white'}`}>
        <div className="px-4 py-3 flex items-center justify-center relative border-b border-black/5 dark:border-white/5">
          <button onClick={() => setSubPage('none')} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-[17px] font-semibold">{title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          {isDef && (
            <div className={`flex items-center justify-between p-4 mb-4 rounded-2xl ${isLight ? 'bg-black/5' : 'bg-white/[0.03]'}`}>
              <span className="font-medium text-sm">Keep definition private</span>
              <button 
                type="button"
                onClick={() => setKeepPrivate(!keepPrivate)}
                className={`relative w-[50px] h-7 rounded-full transition-colors ${keepPrivate ? 'bg-black' : (isLight ? 'bg-black/20' : 'bg-white/20')}`}
              >
                <div className={`absolute top-[2px] left-[2px] w-6 h-6 rounded-full transition-transform ${keepPrivate ? 'translate-x-[22px] bg-white' : (isLight ? 'bg-white' : 'bg-[#1C1C1E]')}`} />
              </button>
            </div>
          )}
          {isDef && (
            <div className={`text-xs mb-4 px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
              This will <strong className={isLight ? 'text-black' : 'text-white'}>hide</strong> Character's definition from everyone.
            </div>
          )}

          {isExampleDiag && (
            <div className="mb-4 space-y-2">
              <div className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-black/60' : 'text-white/60'}`}>
                Quick Dialogue Templates
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sample = `<START>\n{{user}}: Hello! How are you feeling today?\n{{char}}: *smirks softly, leaning back against the chair* "I'm doing splendidly. And what brings you here?"`;
                    setter(val ? `${val}\n\n${sample}` : sample);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${isLight ? 'bg-black/5 hover:bg-black/10 border-black/10 text-black' : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'}`}
                >
                  + Standard Turn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sample = `<START>\n{{user}}: What's in your hand?\n{{char}}: *slowly opens their palm, revealing a glowing silver key* "Take a look for yourself. Curious, isn't it?"`;
                    setter(val ? `${val}\n\n${sample}` : sample);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${isLight ? 'bg-black/5 hover:bg-black/10 border-black/10 text-black' : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'}`}
                >
                  + Action & Speech
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sample = `<START>\n{{user}}: Can you help me with this?\n{{char}}: *nods gently* "Of course. Tell me what you need."\n{{user}}: I'm looking for the ancient ruins.\n{{char}}: *eyes narrow in interest* "Ah, a seeker of secrets. Follow me closely."`;
                    setter(val ? `${val}\n\n${sample}` : sample);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${isLight ? 'bg-black/5 hover:bg-black/10 border-black/10 text-black' : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'}`}
                >
                  + Multi-Turn Example
                </button>
              </div>
            </div>
          )}

          <div className="relative">
            <textarea
              value={val || ''}
              onChange={(e) => setter(e.target.value)}
              placeholder={example}
              className={`w-full min-h-[220px] py-4 px-6 rounded-[28px] resize-none text-[15px] leading-relaxed focus:outline-none focus:ring-1 ${isLight ? 'bg-black/5 placeholder-black/30 focus:ring-black/20 text-black border border-black/5' : 'bg-[#1C1C1E] placeholder-white/30 focus:ring-white/20 text-white border border-white/5'}`}
            />
          </div>
          <div className={`mt-4 text-[13px] px-1 leading-relaxed ${isLight ? 'text-black/50' : 'text-white/50'}`}>
            {helpText}
          </div>
        </div>

        <div className={`p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
          <button 
            onClick={() => setSubPage('none')}
            className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer ${isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
          >
            Save
          </button>
        </div>
      </div>
    );
  };

  // If in Edit mode, render single-screen scrollable page
  if (isEdit) {
    return (
      <div className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden animate-fadeIn ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
        <AnimatePresence>
          {subPage !== 'none' && renderSubPage()}
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

        {/* Header: back arrow, "Edit Character" title, and a "Save" button in the top-right corner. */}
        <div className={`px-4 py-3 flex items-center justify-between relative border-b ${isLight ? 'text-black border-black/5 bg-[#F8F9FA]' : 'text-white border-white/5 bg-[#0f0f10]'}`}>
          <button onClick={onClose} className={`p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-[17px] font-semibold text-center flex-1 pr-4">Edit Character</h2>
          <button 
            onClick={handleCreate} 
            disabled={!name.trim()}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              !name.trim() 
                ? 'opacity-40 cursor-not-allowed bg-black/10 text-black/40 dark:bg-white/10 dark:text-white/40' 
                : (isLight ? 'bg-zinc-900 text-white hover:bg-black' : 'bg-white text-black hover:bg-zinc-200')
            }`}
          >
            Save
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24">
          {/* Avatar and Edit Badge */}
          <div className="flex flex-col items-center justify-center mb-8">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`relative w-28 h-28 rounded-[2rem] overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity border ${
                isLight ? 'bg-black/5 border-black/10 shadow-sm' : 'bg-[#1C1C1E] border-white/5'
              }`}
            >
              {avatar ? (
                <SafeImage src={avatar} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className={`w-10 h-10 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
              )}
              {/* Circular pencil-edit badge in bottom-right corner */}
              <div className={`absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all ${
                isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'
              }`}>
                <Pencil className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Name Section */}
          <div className="mb-6">
            <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Name</label>
            <input
              type="text"
              value={name || ''}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className={`w-full py-4 px-6 rounded-[28px] text-[15px] font-semibold focus:outline-none focus:ring-1 ${
                isLight 
                  ? 'bg-black/5 text-black placeholder-black/30 focus:ring-black/20 border border-black/5' 
                  : 'bg-[#1C1C1E] text-white placeholder-white/30 focus:ring-white/20 border border-white/5'
              }`}
            />
          </div>

          {/* In-chat experience Section */}
          <div className="mb-6">
            <div className="mb-2">
              <label className={`block text-[11px] font-extrabold uppercase tracking-wider ${isLight ? 'text-black/40' : 'text-white/30'}`}>In-chat experience</label>
              <span className={`block text-[11px] font-normal leading-tight mt-0.5 ${isLight ? 'text-black/50' : 'text-white/45'}`}>Landing experience for all chats with this Character</span>
            </div>

            <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-black/5 border-black/5' : 'bg-white/[0.03] border-white/5'}`}>
              {/* Row: Greeting header and Reorder */}
              <div className={`px-4 py-3 flex items-center justify-between border-b ${isLight ? 'border-black/5 bg-black/[0.02]' : 'border-white/5 bg-white/[0.01]'}`}>
                <span className={`text-[11px] font-extrabold uppercase tracking-wider ${isLight ? 'text-black/50' : 'text-white/40'}`}>Greeting</span>
                <button
                  type="button"
                  onClick={() => setIsReordering(!isReordering)}
                  className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {isReordering ? 'Done' : '↕ Reorder'}
                </button>
              </div>

              {/* Numbered greeting rows */}
              <div className={`divide-y ${isLight ? 'divide-black/5' : 'divide-white/5'}`}>
                {greetingsList.map((g, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      if (!isReordering) {
                        setEditingGreetingIndex(idx);
                        setSubPage('greeting');
                      }
                    }}
                    className={`px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-all ${
                      isReordering ? '' : 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex-1 flex items-start">
                      <span className={`font-bold font-mono text-[13px] mr-3 mt-0.5 select-none ${isLight ? 'text-black/30' : 'text-white/20'}`}>
                        {idx + 1}
                      </span>
                      <span className={`text-[14px] leading-relaxed break-words font-medium line-clamp-2 ${
                        g ? (isLight ? 'text-black' : 'text-white') : (isLight ? 'text-black/30 italic' : 'text-white/30 italic')
                      }`}>
                        {g || 'Empty greeting'}
                      </span>
                    </div>

                    {/* Right side controls */}
                    {isReordering ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveGreetingUp(idx)}
                          className={`p-1.5 rounded-lg transition-all ${
                            idx === 0 
                              ? 'opacity-25 cursor-not-allowed' 
                              : (isLight ? 'hover:bg-black/10 text-zinc-800' : 'hover:bg-white/10 text-zinc-200')
                          }`}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === greetingsList.length - 1}
                          onClick={() => moveGreetingDown(idx)}
                          className={`p-1.5 rounded-lg transition-all ${
                            idx === greetingsList.length - 1 
                              ? 'opacity-25 cursor-not-allowed' 
                              : (isLight ? 'hover:bg-black/10 text-zinc-800' : 'hover:bg-white/10 text-zinc-200')
                          }`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGreetingIndex(idx);
                            setSubPage('greeting');
                          }}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            isLight ? 'hover:bg-black/5 text-black/50 hover:text-black' : 'hover:bg-white/5 text-white/50 hover:text-white'
                          }`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => removeGreetingAt(idx)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500/70 hover:text-rose-500 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* + Add additional greeting row */}
                {greetingsList.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddGreeting}
                    className={`w-full px-4 py-4 flex items-center gap-2 text-left font-semibold text-[14px] text-zinc-800 dark:text-zinc-200 transition-all hover:bg-black/[0.02] dark:hover:bg-white/[0.01] cursor-pointer bg-transparent border-0`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add additional greeting</span>
                    <span className="text-xs font-mono font-normal opacity-50 ml-auto">{greetingsList.length} / 5</span>
                  </button>
                )}
              </div>
            </div>

            {/* AI greetings for new chats toggle */}
            <div className={`mt-3 rounded-2xl p-4 border ${isLight ? 'bg-black/5 border-black/5' : 'bg-white/[0.03] border-white/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className={`w-4 h-4 ${isLight ? 'text-black' : 'text-white'}`} />
                  <span className={`text-[14px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>AI greetings for new chats</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setAiGreetingsEnabled(!aiGreetingsEnabled)}
                  className={`relative w-[46px] h-6 rounded-full transition-colors cursor-pointer ${aiGreetingsEnabled ? (isLight ? 'bg-black' : 'bg-white') : (isLight ? 'bg-black/20' : 'bg-white/20')}`}
                >
                  <div className={`absolute top-[2px] left-[2px] w-5 h-5 rounded-full transition-transform ${
                    aiGreetingsEnabled 
                      ? 'translate-x-[22px] ' + (isLight ? 'bg-white' : 'bg-[#1C1C1E]') 
                      : (isLight ? 'bg-white' : 'bg-black')
                  }`} />
                </button>
              </div>
              <p className={`text-[11px] mt-2 leading-relaxed ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                For new chats, we'll show greetings inspired by your custom greetings instead of the original.
              </p>
            </div>
          </div>

          {/* Personality & Knowledge Section */}
          <div className="mb-6">
            <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Personality & Knowledge</label>
            
            <div className={`rounded-2xl border divide-y overflow-hidden ${
              isLight ? 'bg-black/5 border-black/5 divide-black/5' : 'bg-white/[0.03] border-white/5 divide-white/5'
            }`}>
              {/* Definition Row */}
              <button
                type="button"
                onClick={() => setSubPage('definition')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {definition ? (
                  <>
                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Character Definition</span>
                    <span className={`text-[14px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{definition}</span>
                  </>
                ) : (
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold text-[14px] flex items-center gap-2">
                    <span className="text-lg leading-none">+</span> Add Character Definition
                  </span>
                )}
              </button>

              {/* Likes Row */}
              <button
                type="button"
                onClick={() => setSubPage('likes')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {likes ? (
                  <>
                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Character Likes</span>
                    <span className={`text-[14px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{likes}</span>
                  </>
                ) : (
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold text-[14px] flex items-center gap-2">
                    <span className="text-lg leading-none">+</span> Character Likes
                  </span>
                )}
              </button>

              {/* Dislikes Row */}
              <button
                type="button"
                onClick={() => setSubPage('dislikes')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {dislikes ? (
                  <>
                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Character Dislikes</span>
                    <span className={`text-[14px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{dislikes}</span>
                  </>
                ) : (
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold text-[14px] flex items-center gap-2">
                    <span className="text-lg leading-none">+</span> Character Dislikes
                  </span>
                )}
              </button>

              {/* Personalized Items & Details Row */}
              <button
                type="button"
                onClick={() => setSubPage('personalizedDetails')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {personalizedDetails ? (
                  <>
                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Personalized Items & Details</span>
                    <span className={`text-[14px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{personalizedDetails}</span>
                  </>
                ) : (
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold text-[14px] flex items-center gap-2">
                    <span className="text-lg leading-none">+</span> Personalized Items & Details
                  </span>
                )}
              </button>

              {/* Example Chats & Chat Style Row */}
              <button
                type="button"
                onClick={() => setSubPage('exampleDialogue')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {exampleDialogue ? (
                  <>
                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Example Chats & Chat Style</span>
                    <span className={`text-[14px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{exampleDialogue}</span>
                  </>
                ) : (
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold text-[14px] flex items-center gap-2">
                    <span className="text-lg leading-none">+</span> Example Chats & Chat Style
                  </span>
                )}
              </button>

              {/* Social Media Customize Row */}
              <button
                type="button"
                onClick={() => setSubPage('social')}
                className="w-full px-4 py-4 flex items-center justify-between hover:bg-indigo-500/10 dark:hover:bg-indigo-900/20 transition-all cursor-pointer bg-transparent border-0 border-t border-black/5 dark:border-white/5"
              >
                <div className="flex flex-col items-start text-left">
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Social Media Simulator Profile</span>
                  <span className={`text-[14px] font-semibold text-indigo-500 dark:text-indigo-400`}>
                    {hasSocialMedia ? 'Active / Configured' : 'Disabled'}
                  </span>
                </div>
                <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">
                  {socialPosts.length} posts
                </span>
              </button>
            </div>
          </div>

          {/* Character Discovery Section */}
          <div className="mb-6">
            <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Character Discovery</label>
            
            <div className={`rounded-2xl border divide-y overflow-hidden ${
              isLight ? 'bg-black/5 border-black/5 divide-black/5' : 'bg-white/[0.03] border-white/5 divide-white/5'
            }`}>
              {/* Tagline Row */}
              <button
                type="button"
                onClick={() => setSubPage('tagline')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {tagline ? (
                  <>
                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Tagline</span>
                    <span className={`text-[14px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{tagline}</span>
                  </>
                ) : (
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold text-[14px] flex items-center gap-2">
                    <span className="text-lg leading-none">+</span> Add Tagline
                  </span>
                )}
              </button>

              {/* Description Row */}
              <button
                type="button"
                onClick={() => setSubPage('description')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {description ? (
                  <>
                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Description</span>
                    <span className={`text-[14px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{description}</span>
                  </>
                ) : (
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold text-[14px] flex items-center gap-2">
                    <span className="text-lg leading-none">+</span> Add Description
                  </span>
                )}
              </button>

              {/* Tags Row */}
              <button
                type="button"
                onClick={() => setSubPage('tags')}
                className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                <div className="flex flex-col items-start">
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Tags</span>
                  <span className={`text-[14px] font-medium ${isLight ? 'text-black' : 'text-white'}`}>
                    {tags.length > 0 ? tags.map(t => `#${t}`).join(', ') : 'No tags'}
                  </span>
                </div>
                <ChevronRight className={`w-5 h-5 ${isLight ? 'text-black/40' : 'text-white/30'}`} />
              </button>

              {/* Visibility Row */}
              <button
                type="button"
                onClick={() => setSubPage('visibility')}
                className="w-full px-4 py-4 flex items-center justify-between text-zinc-800 dark:text-zinc-200 text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                <div className="flex flex-col items-start">
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Visibility</span>
                  <span className={`text-[14px] font-semibold capitalize flex items-center gap-2 ${isLight ? 'text-black' : 'text-white'}`}>
                    {privacy === 'public' ? (
                      <Globe className="w-4 h-4" />
                    ) : privacy === 'unlisted' ? (
                      <LinkIcon className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    {privacy}
                  </span>
                </div>
                <ChevronRight className={`w-5 h-5 ${isLight ? 'text-black/40' : 'text-white/30'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback to beautiful step-by-step wizard for character creation
  return (
    <div className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden animate-fadeIn ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
      <AnimatePresence>
        {subPage !== 'none' && renderSubPage()}
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
      <div className={`px-4 py-3 flex items-center justify-center relative ${isLight ? 'text-black' : 'text-white'}`}>
        {step === 1 ? (
          <button onClick={onClose} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button onClick={() => setStep(step - 1)} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-[16px] font-semibold">Create Character</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-32">
        
        {/* Step 1: Name */}
        {step === 1 && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="flex flex-col items-center justify-center h-full max-h-[400px]">
            <h1 className={`text-2xl font-bold text-center mb-6 ${isLight ? 'text-black' : 'text-white'}`}>What's your<br/>character's name?</h1>
            <input
              type="text"
              value={name || ''}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className={`w-full py-4 px-6 rounded-[28px] text-[16px] focus:outline-none focus:ring-1 ${isLight ? 'bg-black/5 text-black placeholder-black/30 focus:ring-black/20' : 'bg-[#1C1C1E] text-white placeholder-white/30 focus:ring-white/20'}`}
            />
          </motion.div>
        )}

        {/* Step 2: Avatar */}
        {step === 2 && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="flex flex-col items-center">
            <h1 className={`text-2xl font-bold text-center mb-8 ${isLight ? 'text-black' : 'text-white'}`}>What do they<br/>look like?</h1>
            
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`w-40 h-40 rounded-[2rem] overflow-hidden flex items-center justify-center mb-6 cursor-pointer hover:opacity-90 transition-opacity ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E] border border-white/5'}`}
            >
              {avatar ? (
                <SafeImage src={avatar} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className={`w-12 h-12 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
              )}
            </div>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className={`px-6 py-3 rounded-full font-medium ${isLight ? 'bg-black/5 text-black hover:bg-black/10' : 'bg-white/10 text-white hover:bg-white/15'}`}
            >
              Upload an image
            </button>
          </motion.div>
        )}

        {/* Step 3: Greeting */}
        {step === 3 && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="flex flex-col">
            <div className="flex items-center justify-center mb-8 relative">
              <div className={`w-24 h-24 rounded-[1.5rem] flex items-center justify-center overflow-hidden ${isLight ? 'bg-black/10' : 'bg-white/10'}`}>
                {avatar ? <SafeImage src={avatar} className="w-full h-full object-cover" /> : <ImageIcon className={`w-8 h-8 ${isLight ? 'text-black/20' : 'text-white/20'}`} />}
              </div>
            </div>

            <label className={`text-[15px] font-bold mb-2 ${isLight ? 'text-black' : 'text-white'}`}>Greeting</label>
            <div className={`rounded-[28px] overflow-hidden ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'}`}>
              <div className="relative">
                <textarea
                  value={greeting || ''}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Example: Took you long enough. I've been waiting."
                  className={`w-full min-h-[160px] py-4 px-6 resize-none text-[15px] bg-transparent focus:outline-none ${isLight ? 'text-black placeholder-black/30' : 'text-white placeholder-white/30'}`}
                />
              </div>
              <div className={`border-t p-3 flex items-center ${isLight ? 'border-black/5' : 'border-white/5'}`}>
                <button className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-semibold text-sm px-2 bg-transparent border-0">
                  <Sparkles className="w-4 h-4" />
                  Write for me
                </button>
              </div>
            </div>

            <button className={`mt-4 p-4 rounded-2xl text-left font-semibold text-[15px] flex items-center gap-2 cursor-pointer bg-transparent border-0 ${isLight ? 'bg-black/5 text-black/50 hover:bg-black/10' : 'bg-[#1C1C1E] text-white/50 hover:bg-white/5'}`}>
              <PlusCircle className="w-5 h-5 opacity-50" />
              Add additional greeting
            </button>

            <p className={`text-[13px] mt-4 mb-6 leading-relaxed ${isLight ? 'text-black/50' : 'text-white/50'}`}>
              People can swipe to choose a greeting before chatting. You can add up to 5 - they'll appear in the order you set. We'll suggest more based on your character.
            </p>

            <div className={`rounded-2xl p-4 flex items-center justify-between ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'}`}>
              <div className="flex items-center gap-3">
                <Sparkles className={`w-5 h-5 ${isLight ? 'text-black' : 'text-white'}`} />
                <span className={`text-[15px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>AI greetings for new chats</span>
              </div>
              <button 
                type="button"
                onClick={() => setAiGreetingsEnabled(!aiGreetingsEnabled)}
                className={`relative w-[50px] h-7 rounded-full transition-colors cursor-pointer ${aiGreetingsEnabled ? 'bg-black' : (isLight ? 'bg-black/20' : 'bg-white/20')}`}
              >
                <div className={`absolute top-[2px] left-[2px] w-6 h-6 rounded-full transition-transform ${aiGreetingsEnabled ? 'translate-x-[22px] bg-white' : (isLight ? 'bg-white' : 'bg-black')}`} />
              </button>
            </div>
            <p className={`text-[13px] mt-3 leading-relaxed ${isLight ? 'text-black/50' : 'text-white/50'}`}>
              For new chats, we'll show greetings inspired by your custom greetings instead of the original.
            </p>
          </motion.div>
        )}

        {/* Step 4: Details */}
        {step === 4 && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="flex flex-col">
            <h3 className={`text-[15px] font-bold mb-3 ${isLight ? 'text-black' : 'text-white'}`}>Details</h3>
            
            <div className="space-y-6">
              {/* Tagline */}
              <div>
                <button 
                  onClick={() => setSubPage('tagline')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'
                  } ${tagline ? (isLight ? 'text-black' : 'text-white') : (isLight ? 'text-zinc-600' : 'text-zinc-400')}`}
                >
                  {!tagline && <span className="text-lg leading-none">+</span>}
                  <span>{tagline ? tagline : 'Add Tagline'}</span>
                </button>
                {!tagline && (
                  <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                    This is what people see before they tap to chat with your Character.
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <button 
                  onClick={() => setSubPage('description')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'
                  } ${description ? (isLight ? 'text-black' : 'text-white') : (isLight ? 'text-zinc-600' : 'text-zinc-400')}`}
                >
                  {!description && <span className="text-lg leading-none">+</span>}
                  <span className="truncate flex-1">{description ? description : 'Add Description'}</span>
                </button>
                {!description && (
                  <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                    This helps introduce your Character to people and will appear on their profile.
                  </p>
                )}
              </div>

              {/* Character Definition */}
              <div>
                <button 
                  onClick={() => setSubPage('definition')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'
                  } ${definition ? (isLight ? 'text-black' : 'text-white') : (isLight ? 'text-zinc-600' : 'text-zinc-400')}`}
                >
                  {!definition && <span className="text-lg leading-none">+</span>}
                  <span className="truncate flex-1">{definition ? definition : 'Add Character Definition'}</span>
                </button>
                {!definition && (
                  <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                    The Character Definition shapes how your character thinks, speaks, or behaves.
                  </p>
                )}
              </div>

              {/* Likes */}
              <div>
                <button 
                  onClick={() => setSubPage('likes')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'
                  } ${likes ? (isLight ? 'text-black' : 'text-white') : (isLight ? 'text-zinc-600' : 'text-zinc-400')}`}
                >
                  {!likes && <span className="text-lg leading-none">+</span>}
                  <span className="truncate flex-1">{likes ? likes : 'Character Likes'}</span>
                </button>
              </div>

              {/* Dislikes */}
              <div>
                <button 
                  onClick={() => setSubPage('dislikes')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'
                  } ${dislikes ? (isLight ? 'text-black' : 'text-white') : (isLight ? 'text-zinc-600' : 'text-zinc-400')}`}
                >
                  {!dislikes && <span className="text-lg leading-none">+</span>}
                  <span className="truncate flex-1">{dislikes ? dislikes : 'Character Dislikes'}</span>
                </button>
              </div>

              {/* Personalized Items & Details */}
              <div>
                <button 
                  onClick={() => setSubPage('personalizedDetails')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'
                  } ${personalizedDetails ? (isLight ? 'text-black' : 'text-white') : (isLight ? 'text-zinc-600' : 'text-zinc-400')}`}
                >
                  {!personalizedDetails && <span className="text-lg leading-none">+</span>}
                  <span className="truncate flex-1">{personalizedDetails ? personalizedDetails : 'Personalized Items & Details'}</span>
                </button>
                {!personalizedDetails && (
                  <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                    Describe items, sizes, clothing, or physical traits (e.g. cracked iPhone 6s, boxer size) to make roleplay highly realistic.
                  </p>
                )}
              </div>

              {/* Example Chats & Chat Style */}
              <div>
                <button 
                  onClick={() => setSubPage('exampleDialogue')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'
                  } ${exampleDialogue ? (isLight ? 'text-black' : 'text-white') : (isLight ? 'text-zinc-600' : 'text-zinc-400')}`}
                >
                  {!exampleDialogue && <span className="text-lg leading-none">+</span>}
                  <span className="truncate flex-1">{exampleDialogue ? 'Example Chats (Configured)' : 'Example Chats & Chat Style'}</span>
                  {exampleDialogue && <span className="text-[10px] font-mono opacity-60 bg-white/10 px-2 py-0.5 rounded-full">{exampleDialogue.length} chars</span>}
                </button>
                {!exampleDialogue && (
                  <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                    Define sample conversations showing how your character answers, speech patterns, and action formatting.
                  </p>
                )}
              </div>

              {/* Social Media Settings */}
              <div>
                <button 
                  onClick={() => setSubPage('social')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center justify-between cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-indigo-950/40 text-indigo-400 hover:bg-indigo-900/40 border border-indigo-500/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📱</span>
                    <span>Customize Social Profile</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-80 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                    {hasSocialMedia ? `${socialPosts.length} posts` : 'Disabled'}
                  </span>
                </button>
                <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                  Configure follower counts, profile picture, and individual preset posts with custom comments!
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 5: Visibility & Tags */}
        {step === 5 && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="flex flex-col">
            <h3 className={`text-[15px] font-bold mb-3 ${isLight ? 'text-black' : 'text-white'}`}>Visibility</h3>
            
            <div className={`rounded-3xl overflow-hidden mb-6 ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'}`}>
              <button onClick={() => setPrivacy('public')} className={`w-full p-4 flex items-center gap-4 text-left border-b cursor-pointer border-0 ${isLight ? 'border-black/5' : 'border-white/5'}`}>
                <Globe className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Public</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Anyone can find, view, and chat.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'public' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
              
              <button onClick={() => setPrivacy('unlisted')} className={`w-full p-4 flex items-center gap-4 text-left border-b cursor-pointer border-0 ${isLight ? 'border-black/5' : 'border-white/5'}`}>
                <LinkIcon className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Unlisted</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Only people with a link can view and chat.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'unlisted' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
              
              <button onClick={() => setPrivacy('private')} className="w-full p-4 flex items-center gap-4 text-left cursor-pointer border-0 bg-transparent">
                <Lock className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Private</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Only you can view and chat.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'private' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
            </div>

            <h3 className={`text-[15px] font-bold mb-3 ${isLight ? 'text-black' : 'text-white'}`}>Tags</h3>
            <button onClick={() => setSubPage('tags')} className={`w-full py-4 px-6 rounded-[28px] flex items-center justify-between text-left cursor-pointer border-0 ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]'}`}>
              <div className="flex items-center gap-3">
                <Hash className={`w-5 h-5 ${isLight ? 'text-black' : 'text-white'}`} />
                <span className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Tags ({tags.length})</span>
              </div>
              <div className={`flex items-center gap-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                <span className="text-[15px] truncate max-w-[120px]">{tags.length > 0 ? tags.join(', ') : 'All'}</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>
            <p className={`text-[13px] mt-3 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
              Tags help people discover your Character.
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer Nav */}
      <div className={`fixed bottom-0 left-0 right-0 p-4 pb-6 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'} flex flex-col gap-2`}>
        <button 
          onClick={step === 5 ? handleCreate : handleNext}
          disabled={step === 1 && !name.trim()}
          className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer border-0
            ${(step === 1 && !name.trim()) 
              ? (isLight ? 'bg-black/5 text-black/30' : 'bg-white/10 text-white/30') 
              : (isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90')}`}
        >
          {step === 5 ? 'Create' : 'Next'}
        </button>
      </div>
      
      <AnimatePresence>
        {isCropOpen && cropSrc && (
          <ImageCropModal
            isOpen={isCropOpen}
            imageSrc={cropSrc}
            isLight={isLight}
            onClose={() => {
              setIsCropOpen(false);
              setCropSrc(null);
            }}
            onCrop={handleCropComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
