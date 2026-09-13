import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StorageConfig, World, Place, AmbientSound } from '../../types';
import { PERSONAS } from '../../data/personas';
import { storeAsset, getAsset, useAsset } from '../../utils/fileDb';
import { SafeImage } from '../common/SafeImage';
import { ImageCropModal } from '../ImageCropModal';
import { 
  ArrowLeft, 
  Image as ImageIcon, 
  X, 
  Globe, 
  Link as LinkIcon, 
  Lock, 
  ChevronRight, 
  Hash, 
  Pencil, 
  Trash2, 
  Music, 
  Users, 
  MapPin, 
  Plus,
  Play,
  Square,
  FileAudio
} from 'lucide-react';

interface WorldCreatorProps {
  isLight: boolean;
  storageConfig: StorageConfig;
  onClose: () => void;
  onSave: (world: World) => void;
  initialData?: World | null;
}

export function WorldCreator({ isLight, storageConfig, onClose, onSave, initialData }: WorldCreatorProps) {
  const isEdit = !!initialData;
  const [step, setStep] = useState(1);

  // Form Core State
  const [name, setName] = useState(initialData?.name || '');
  const [avatar, setAvatar] = useState(initialData?.coverImage || '');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tagline, setTagline] = useState(initialData?.tagline || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [definition, setDefinition] = useState(initialData?.worldDefinition || '');
  const [exampleDialogue, setExampleDialogue] = useState(initialData?.exampleDialogue || '');
  const [greeting, setGreeting] = useState(initialData?.greeting || '');

  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>(() => {
    if (!initialData?.visibility) return 'private';
    const v = initialData.visibility.toLowerCase();
    if (v === 'public') return 'public';
    if (v === 'unlisted') return 'unlisted';
    return 'private';
  });

  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // World specific rosters
  const [places, setPlaces] = useState<Place[]>(() => {
    const p = initialData?.places;
    if (Array.isArray(p) && p.length > 0) {
      return p.map((item, idx) => ({
        ...item,
        id: item.id || (idx === 0 ? 'place-general' : `place-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`),
      }));
    }
    return [{ id: 'place-general', name: 'General', image: '' }];
  });

  const [ambientSounds, setAmbientSounds] = useState<AmbientSound[]>(() => {
    const s = initialData?.ambientSounds;
    if (Array.isArray(s) && s.length > 0) {
      return s.map((item, idx) => ({
        ...item,
        id: item.id || (idx === 0 ? 'sound-general' : `sound-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`),
      }));
    }
    return [{ id: 'sound-general', name: 'General', audioFile: '' }];
  });

  const [linkedCharacterIds, setLinkedCharacterIds] = useState<string[]>(
    Array.isArray(initialData?.linkedCharacterIds) ? initialData.linkedCharacterIds : []
  );

  // Sub-pages state
  const [subPage, setSubPage] = useState<
    'none' | 'tagline' | 'description' | 'definition' | 'places' | 'ambientSounds' | 'characters' | 'tags' | 'visibility' | 'exampleDialogue' | 'greeting'
  >('none');

  // Custom Place Form State
  const [placeFormMode, setPlaceFormMode] = useState<'none' | 'add' | 'edit'>('none');
  const [editingPlaceIndex, setEditingPlaceIndex] = useState<number | null>(null);
  const [placeNameInput, setPlaceNameInput] = useState('');
  const [placeImageInput, setPlaceImageInput] = useState('');
  const [placeTriggerInput, setPlaceTriggerInput] = useState('');
  const placeFileInputRef = useRef<HTMLInputElement>(null);
  const generalPlaceFileInputRef = useRef<HTMLInputElement>(null);

  // Custom Sound Form State
  const [soundFormMode, setSoundFormMode] = useState<'none' | 'add' | 'edit'>('none');
  const [editingSoundIndex, setEditingSoundIndex] = useState<number | null>(null);
  const [soundNameInput, setSoundNameInput] = useState('');
  const [soundAudioInput, setSoundAudioInput] = useState('');
  const [soundAudioName, setSoundAudioName] = useState('');
  const [soundTriggerInput, setSoundTriggerInput] = useState('');
  const soundFileInputRef = useRef<HTMLInputElement>(null);
  const generalSoundFileInputRef = useRef<HTMLInputElement>(null);

  // Audio Playback Preview State
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio preview on unmount
  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
    };
  }, []);

  const stopAudioPreview = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }
    setPlayingAudioId(null);
  };

  const resetPlaceForm = () => {
    setPlaceFormMode('none');
    setEditingPlaceIndex(null);
    setPlaceNameInput('');
    setPlaceImageInput('');
    setPlaceTriggerInput('');
  };

  const resetSoundForm = () => {
    setSoundFormMode('none');
    setEditingSoundIndex(null);
    setSoundNameInput('');
    setSoundAudioInput('');
    setSoundAudioName('');
    setSoundTriggerInput('');
  };

  // Companion library list for linked characters
  const allCompanions = storageConfig.characters || [...PERSONAS, ...(storageConfig.customPersonas || [])];

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleCreate = () => {
    if (!name.trim()) return;

    stopAudioPreview();

    // Ensure places has at least the default General item
    const finalPlaces = places.length > 0 ? places : [{ name: 'General', image: '' }];
    // Ensure ambientSounds has at least the default General item
    const finalSounds = ambientSounds.length > 0 ? ambientSounds : [{ name: 'General', audioFile: '' }];

    const newWorld: World = {
      id: initialData?.id || `world-${Date.now()}`,
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      worldDefinition: definition.trim(),
      exampleDialogue: exampleDialogue.trim(),
      greeting: greeting.trim(),
      coverImage: avatar,
      creator: initialData?.creator || '@you',
      visibility: privacy === 'public' ? 'Public' : (privacy === 'unlisted' ? 'Unlisted' : 'Private'),
      places: finalPlaces,
      ambientSounds: finalSounds,
      linkedCharacterIds: linkedCharacterIds,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: Date.now(),
    };

    onSave(newWorld);
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
            resolve(event.target?.result as string || '');
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          resolve(dataUrl);
        };
        img.onerror = () => {
          resolve(event.target?.result as string || '');
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

  const handlePlaceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isGeneral: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const inputElement = e.target;

    try {
      let imageSource = '';
      try {
        imageSource = await compressAndGetBase64(file, 1280, 960);
      } catch (cErr) {
        console.warn("Place image compression error, using direct FileReader:", cErr);
      }

      if (!imageSource) {
        imageSource = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve((r.result as string) || '');
          r.onerror = () => resolve('');
          r.readAsDataURL(file);
        });
      }

      if (imageSource) {
        const assetId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let dbRef = imageSource;
        try {
          dbRef = await storeAsset(assetId, imageSource);
        } catch (dbErr) {
          console.warn("Failed to store place image in IndexedDB, using inline string:", dbErr);
        }

        if (isGeneral) {
          setPlaces(prev => {
            const updated = [...prev];
            if (updated.length === 0) {
              updated.push({ id: 'place-general', name: 'General', image: dbRef });
            } else {
              updated[0] = { ...updated[0], image: dbRef };
            }
            return updated;
          });
        } else {
          setPlaceImageInput(dbRef);
        }
      }
    } catch (err) {
      console.error("Place image upload failed", err);
    } finally {
      inputElement.value = "";
    }
  };

  const handleSoundAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>, isGeneral: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const inputElement = e.target;
    const fileName = file.name || 'Audio Track';

    try {
      const assetId = `sound-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      // Direct Blob/File storage in IndexedDB (bypasses atob & base64 bloat, handles large MP3s natively)
      const dbRef = await storeAsset(assetId, file);
      
      if (isGeneral) {
        setAmbientSounds(prev => {
          const updated = [...prev];
          if (updated.length === 0) {
            updated.push({ id: 'sound-general', name: 'General', audioFile: dbRef });
          } else {
            updated[0] = { ...updated[0], audioFile: dbRef };
          }
          return updated;
        });
      } else {
        setSoundAudioInput(dbRef);
        setSoundAudioName(fileName);
        if (!soundNameInput.trim()) {
          setSoundNameInput(fileName.replace(/\.[^/.]+$/, ""));
        }
      }
    } catch (err) {
      console.error("Audio direct upload failed, trying data URL fallback", err);
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target?.result) {
            const audioData = event.target.result as string;
            const assetId = `sound-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            let fallbackRef = audioData;
            try {
              fallbackRef = await storeAsset(assetId, audioData);
            } catch (sErr) {
              console.warn("storeAsset fallback error", sErr);
            }

            if (isGeneral) {
              setAmbientSounds(prev => {
                const updated = [...prev];
                if (updated.length === 0) {
                  updated.push({ id: 'sound-general', name: 'General', audioFile: fallbackRef });
                } else {
                  updated[0] = { ...updated[0], audioFile: fallbackRef };
                }
                return updated;
              });
            } else {
              setSoundAudioInput(fallbackRef);
              setSoundAudioName(fileName);
              if (!soundNameInput.trim()) {
                setSoundNameInput(fileName.replace(/\.[^/.]+$/, ""));
              }
            }
          }
        };
        reader.readAsDataURL(file);
      } catch (fErr) {
        console.error("FileReader audio fallback failed", fErr);
      }
    } finally {
      inputElement.value = "";
    }
  };

  const togglePlayAudio = async (audioData: string, id: string) => {
    if (playingAudioId === id) {
      stopAudioPreview();
    } else {
      stopAudioPreview();
      try {
        const resolvedData = await getAsset(audioData);
        if (!resolvedData || resolvedData.startsWith('db:')) return;

        const audio = new Audio(resolvedData);
        audioPreviewRef.current = audio;
        setPlayingAudioId(id);

        audio.onended = () => {
          setPlayingAudioId(null);
        };
        audio.onerror = (e) => {
          console.error("Audio playback error", e);
          setPlayingAudioId(null);
        };
        
        await audio.play();
      } catch (err) {
        console.error("Failed to play audio preview", err);
        setPlayingAudioId(null);
      }
    }
  };

  const handleSavePlace = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      const pName = placeNameInput.trim();
      const pTrigger = placeTriggerInput.trim();

      if (placeFormMode === 'add') {
        const newPlace: Place = { 
          id: `place-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: pName || `Place ${places.length}`, 
          image: placeImageInput, 
          triggerDescription: pTrigger 
        };
        setPlaces(prev => [...prev, newPlace]);
      } else if (placeFormMode === 'edit' && editingPlaceIndex !== null && editingPlaceIndex >= 0) {
        setPlaces(prev => {
          const updated = [...prev];
          if (updated[editingPlaceIndex]) {
            updated[editingPlaceIndex] = {
              ...updated[editingPlaceIndex],
              id: updated[editingPlaceIndex].id || `place-${Date.now()}-${editingPlaceIndex}`,
              name: pName || updated[editingPlaceIndex].name,
              image: placeImageInput,
              triggerDescription: pTrigger
            };
          }
          return updated;
        });
      }
      resetPlaceForm();
    } catch (err) {
      console.error("Failed to save place:", err);
      resetPlaceForm();
    }
  };

  const handleSaveSound = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      const sName = soundNameInput.trim();
      const sTrigger = soundTriggerInput.trim();

      if (soundFormMode === 'add') {
        const defaultName = soundAudioName ? soundAudioName.replace(/\.[^/.]+$/, "") : `Ambient ${ambientSounds.length}`;
        const newSound: AmbientSound = { 
          id: `sound-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: sName || defaultName, 
          audioFile: soundAudioInput, 
          triggerDescription: sTrigger 
        };
        setAmbientSounds(prev => [...prev, newSound]);
      } else if (soundFormMode === 'edit' && editingSoundIndex !== null && editingSoundIndex >= 0) {
        setAmbientSounds(prev => {
          const updated = [...prev];
          if (updated[editingSoundIndex]) {
            updated[editingSoundIndex] = {
              ...updated[editingSoundIndex],
              id: updated[editingSoundIndex].id || `sound-${Date.now()}-${editingSoundIndex}`,
              name: sName || updated[editingSoundIndex].name,
              audioFile: soundAudioInput || updated[editingSoundIndex].audioFile,
              triggerDescription: sTrigger
            };
          }
          return updated;
        });
      }
      resetSoundForm();
    } catch (err) {
      console.error("Failed to save sound:", err);
      resetSoundForm();
    }
  };

  const renderSubPageContent = () => {
    if (subPage === 'none') return null;

    if (subPage === 'tags') {
      return (
        <motion.div 
          key="subpage-tags"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          transition={{ duration: 0.18 }}
          className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden ${isLight ? 'bg-[#F8F9FA] text-black' : 'bg-[#0f0f10] text-white'}`}
        >
          <div className="px-4 py-3 flex items-center justify-center relative border-b border-black/5 dark:border-white/5">
            <button type="button" onClick={() => setSubPage('none')} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold">Edit Tags</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className={`text-xs mb-3 uppercase tracking-wider font-bold ${isLight ? 'text-black/50' : 'text-white/40'}`}>
              Active Tags ({tags.length})
            </div>

            {tags.length === 0 ? (
              <p className={`text-sm italic mb-6 ${isLight ? 'text-black/40' : 'text-white/30'}`}>No tags added yet. Add tags below to help users find your world!</p>
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
                    : 'bg-[#1C1C1E]/80 backdrop-blur-md text-white placeholder-white/30 focus:ring-white/20'
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
          </div>

          <div className={`p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
            <button 
              type="button"
              onClick={() => setSubPage('none')}
              className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer ${isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
            >
              Save
            </button>
          </div>
        </motion.div>
      );
    }

    if (subPage === 'visibility') {
      return (
        <motion.div 
          key="subpage-visibility"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          transition={{ duration: 0.18 }}
          className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden ${isLight ? 'bg-[#F8F9FA] text-black' : 'bg-[#0f0f10] text-white'}`}
        >
          <div className="px-4 py-3 flex items-center justify-center relative border-b border-black/5 dark:border-white/5">
            <button type="button" onClick={() => setSubPage('none')} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold">World Discovery</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <h3 className={`text-xs mb-3 uppercase tracking-wider font-bold ${isLight ? 'text-black/50' : 'text-white/40'}`}>Visibility</h3>
            
            <div className={`rounded-3xl overflow-hidden mb-6 ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'}`}>
              <button type="button" onClick={() => setPrivacy('public')} className={`w-full p-4 flex items-center gap-4 text-left border-b cursor-pointer ${isLight ? 'border-black/5' : 'border-white/5'}`}>
                <Globe className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Public</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Anyone can find and explore this World.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'public' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
              
              <button type="button" onClick={() => setPrivacy('unlisted')} className={`w-full p-4 flex items-center gap-4 text-left border-b cursor-pointer ${isLight ? 'border-black/5' : 'border-white/5'}`}>
                <LinkIcon className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Unlisted</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Only people with a link can view this World.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'unlisted' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
              
              <button type="button" onClick={() => setPrivacy('private')} className="w-full p-4 flex items-center gap-4 text-left cursor-pointer">
                <Lock className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Private</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Only you can view and use this World.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'private' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
            </div>
          </div>

          <div className={`p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
            <button 
              type="button"
              onClick={() => setSubPage('none')}
              className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer ${isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
            >
              Save
            </button>
          </div>
        </motion.div>
      );
    }

    if (subPage === 'places') {
      const customPlaces = places.slice(1);
      const isEditingForm = placeFormMode !== 'none';

      return (
        <motion.div 
          key="subpage-places"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          transition={{ duration: 0.18 }}
          className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden ${isLight ? 'bg-[#F8F9FA] text-black' : 'bg-[#0f0f10] text-white'}`}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between relative border-b border-black/5 dark:border-white/5">
            <button 
              type="button"
              onClick={() => {
                if (isEditingForm) {
                  resetPlaceForm();
                } else {
                  setSubPage('none');
                }
              }} 
              className={`p-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold">
              {isEditingForm ? (placeFormMode === 'add' ? 'Add Custom Location' : 'Edit Location') : 'World Places'}
            </h2>
            {isEditingForm ? (
              <button
                type="button"
                onClick={handleSavePlace}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-accent text-black hover:bg-accent/85 transition-all cursor-pointer"
              >
                Save
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            {isEditingForm ? (
              /* Add / Edit Custom Place Form */
              <div className="space-y-5">
                <div>
                  <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isLight ? 'text-black/40' : 'text-white/30'}`}>
                    Location Name
                  </label>
                  <input 
                    type="text"
                    value={placeNameInput || ''}
                    onChange={(e) => setPlaceNameInput(e.target.value)}
                    placeholder="e.g. Neon Supermarket, Dark Forest"
                    className={`w-full py-4 px-6 rounded-[28px] text-[14px] font-semibold focus:outline-none focus:ring-1 ${
                      isLight ? 'bg-black/5 text-black placeholder-black/30 border border-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md text-white placeholder-white/30 border border-white/5'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isLight ? 'text-black/40' : 'text-white/30'}`}>
                    Trigger Description
                  </label>
                  <input 
                    type="text"
                    value={placeTriggerInput || ''}
                    onChange={(e) => setPlaceTriggerInput(e.target.value)}
                    placeholder="Show this backdrop when they enter the store"
                    className={`w-full py-4 px-6 rounded-[28px] text-[14px] focus:outline-none focus:ring-1 ${
                      isLight ? 'bg-black/5 text-black placeholder-black/30 border border-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md text-white placeholder-white/30 border border-white/5'
                    }`}
                  />
                  <p className={`text-[11px] mt-1 px-1 ${isLight ? 'text-black/40' : 'text-white/40'}`}>
                    Helps the AI system detect when to change the backdrop image dynamically during roleplay.
                  </p>
                </div>

                <div>
                  <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isLight ? 'text-black/40' : 'text-white/30'}`}>
                    Location Cover Photo
                  </label>
                  <input 
                    type="file" 
                    accept="image/*,.png,.jpg,.jpeg,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" 
                    ref={placeFileInputRef} 
                    onChange={(e) => handlePlaceImageUpload(e, false)} 
                    className="hidden" 
                  />
                  
                  <div 
                    onClick={() => placeFileInputRef.current?.click()}
                    className={`w-full h-40 rounded-2xl overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity border ${
                      isLight ? 'bg-black/5 border-black/10' : 'bg-[#1C1C1E]/80 backdrop-blur-md border-white/5'
                    }`}
                  >
                    {placeImageInput ? (
                      <SafeImage src={placeImageInput} className="w-full h-full object-cover" alt="Place cover" />
                    ) : (
                      <>
                        <ImageIcon className={`w-8 h-8 mb-2 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
                        <span className={`text-xs ${isLight ? 'text-black/40' : 'text-white/40'}`}>Upload landscape or scene image</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={resetPlaceForm}
                    className={`flex-1 py-3.5 rounded-2xl font-bold text-xs cursor-pointer border ${isLight ? 'border-black/10 text-black hover:bg-black/5' : 'border-white/10 text-white hover:bg-white/5'}`}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleSavePlace}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-xs cursor-pointer bg-accent text-black hover:bg-accent/85"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              /* Main Places Roster List */
              <div className="space-y-6">
                {/* Default General Place */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-xs uppercase tracking-wider font-extrabold ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                      Default Setting
                    </h3>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isLight ? 'text-zinc-700 bg-zinc-100' : 'text-zinc-300 bg-white/[0.04]'}`}>General / Main Cover</span>
                  </div>

                  <input 
                    type="file" 
                    accept="image/*,.png,.jpg,.jpeg,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" 
                    ref={generalPlaceFileInputRef} 
                    onChange={(e) => handlePlaceImageUpload(e, true)} 
                    className="hidden" 
                  />

                  <div 
                    onClick={() => generalPlaceFileInputRef.current?.click()}
                    className={`relative w-full h-44 rounded-2xl overflow-hidden border cursor-pointer hover:opacity-95 transition-opacity flex flex-col items-center justify-center ${
                      isLight ? 'bg-black/[0.02] border-black/[0.08]' : 'bg-[#1C1C1E]/80 backdrop-blur-md border-white/5'
                    }`}
                  >
                    {places[0]?.image ? (
                      <>
                        <SafeImage src={places[0].image} className="w-full h-full object-cover" alt="General backdrop" />
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-bold flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full">
                            <Pencil className="w-3.5 h-3.5" />
                            Change Cover Image
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <ImageIcon className={`w-10 h-10 mb-2 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
                        <span className={`text-[12px] font-bold ${isLight ? 'text-black/60' : 'text-white/60'}`}>Upload Main World Photo</span>
                        <span className={`text-[10px] text-center max-w-[220px] leading-relaxed mt-1 ${isLight ? 'text-black/40' : 'text-white/30'}`}>
                          Serves as the default backdrop cover for your world.
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Custom Sub-Locations list */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-xs uppercase tracking-wider font-extrabold ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                      Custom Sub-Locations ({customPlaces.length} / 50)
                    </h3>
                  </div>

                  {customPlaces.length === 0 ? (
                    <div className={`p-6 text-center border-2 border-dashed rounded-2xl ${isLight ? 'bg-black/[0.01] border-black/5' : 'bg-white/[0.01] border-white/[0.03]'}`}>
                      <MapPin className={`w-6 h-6 mx-auto mb-2 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
                      <p className={`text-xs font-medium ${isLight ? 'text-black/40' : 'text-white/30'}`}>No sub-locations added yet.</p>
                      <p className={`text-[10px] mt-0.5 leading-relaxed ${isLight ? 'text-black/35' : 'text-white/25'}`}>
                        Add sub-locations like shops, secret rooms, or parks with dynamic triggers.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {places.map((place, index) => {
                        if (index === 0) return null; // skip default general
                        return (
                          <div 
                            key={place.id || `place-${index}-${place.name}`}
                            className={`p-3 rounded-2xl border flex items-center gap-3 relative ${
                              isLight ? 'bg-white border-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md border-white/5'
                            }`}
                          >
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/10 flex-shrink-0">
                              {place.image ? (
                                <SafeImage src={place.image} className="w-full h-full object-cover" alt={place.name} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <MapPin className="w-5 h-5 text-white/20" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-xs font-extrabold ${isLight ? 'text-black' : 'text-white'}`}>{place.name}</h4>
                              <p className={`text-[11px] truncate leading-normal italic ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                                "{place.triggerDescription || 'No trigger specified'}"
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setPlaceFormMode('edit');
                                  setEditingPlaceIndex(index);
                                  setPlaceNameInput(place.name || '');
                                  setPlaceImageInput(place.image || '');
                                  setPlaceTriggerInput(place.triggerDescription || '');
                                }}
                                className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-black/5 text-black/50 hover:text-black' : 'hover:bg-white/5 text-white/50 hover:text-white'}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPlaces(prev => prev.filter((_, i) => i !== index));
                                }}
                                className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500/70 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add button */}
                  {places.length < 51 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlaceFormMode('add');
                        setEditingPlaceIndex(null);
                        setPlaceNameInput('');
                        setPlaceImageInput('');
                        setPlaceTriggerInput('');
                      }}
                      className="w-full mt-4 p-4 border border-dashed rounded-2xl flex items-center justify-center gap-2 font-bold text-xs text-accent hover:bg-black/[0.01] dark:hover:bg-white/[0.01] cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Custom Location</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {!isEditingForm && (
            <div className={`p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
              <button 
                type="button"
                onClick={() => setSubPage('none')}
                className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer ${isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
              >
                Save places roster
              </button>
            </div>
          )}
        </motion.div>
      );
    }

    if (subPage === 'ambientSounds') {
      const customSounds = ambientSounds.slice(1);
      const isEditingForm = soundFormMode !== 'none';

      return (
        <motion.div 
          key="subpage-ambientSounds"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          transition={{ duration: 0.18 }}
          className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden ${isLight ? 'bg-[#F8F9FA] text-black' : 'bg-[#0f0f10] text-white'}`}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between relative border-b border-black/5 dark:border-white/5">
            <button 
              type="button"
              onClick={() => {
                if (isEditingForm) {
                  resetSoundForm();
                } else {
                  setSubPage('none');
                }
              }} 
              className={`p-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold">
              {isEditingForm ? (soundFormMode === 'add' ? 'Add Ambient Sound' : 'Edit Ambient Sound') : 'Ambient Sounds'}
            </h2>
            {isEditingForm ? (
              <button
                type="button"
                onClick={handleSaveSound}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-accent text-black hover:bg-accent/85 transition-all cursor-pointer"
              >
                Save
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            {isEditingForm ? (
              /* Add / Edit Custom Sound Form */
              <div className="space-y-5">
                <div>
                  <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isLight ? 'text-black/40' : 'text-white/30'}`}>
                    Sound Name
                  </label>
                  <input 
                    type="text"
                    value={soundNameInput || ''}
                    onChange={(e) => setSoundNameInput(e.target.value)}
                    placeholder="e.g. Dynamic Battle Theme, Cozy Tavern Lute"
                    className={`w-full py-4 px-6 rounded-[28px] text-[14px] font-semibold focus:outline-none focus:ring-1 ${
                      isLight ? 'bg-black/5 text-black placeholder-black/30 border border-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md text-white placeholder-white/30 border border-white/5'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isLight ? 'text-black/40' : 'text-white/30'}`}>
                    Trigger Description
                  </label>
                  <input 
                    type="text"
                    value={soundTriggerInput || ''}
                    onChange={(e) => setSoundTriggerInput(e.target.value)}
                    placeholder="Play this track when scenes turn tense or action occurs"
                    className={`w-full py-4 px-6 rounded-[28px] text-[14px] focus:outline-none focus:ring-1 ${
                      isLight ? 'bg-black/5 text-black placeholder-black/30 border border-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md text-white placeholder-white/30 border border-white/5'
                    }`}
                  />
                  <p className={`text-[11px] mt-1 px-1 ${isLight ? 'text-black/40' : 'text-white/40'}`}>
                    Helps the AI system select this music track when roleplay mood shifts.
                  </p>
                </div>

                <div>
                  <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isLight ? 'text-black/40' : 'text-white/30'}`}>
                    Upload Audio Track
                  </label>
                  <input 
                    type="file" 
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/aac,audio/x-m4a" 
                    ref={soundFileInputRef} 
                    onChange={(e) => handleSoundAudioUpload(e, false)} 
                    className="hidden" 
                  />
                  
                  <div 
                    onClick={() => soundFileInputRef.current?.click()}
                    className={`w-full p-6 rounded-2xl overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity border ${
                      isLight ? 'bg-black/5 border-black/10' : 'bg-[#1C1C1E]/80 backdrop-blur-md border-white/5'
                    }`}
                  >
                    {soundAudioInput ? (
                      <div className="flex flex-col items-center">
                        <FileAudio className="w-10 h-10 mb-2 text-zinc-400" />
                        <span className={`text-xs font-bold text-center break-all max-w-[240px] ${isLight ? 'text-black' : 'text-white'}`}>
                          {soundAudioName || 'Audio Track Selected'}
                        </span>
                        <span className={`text-[10px] font-mono mt-1 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Upload Completed</span>
                      </div>
                    ) : (
                      <>
                        <Music className={`w-8 h-8 mb-2 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
                        <span className={`text-xs ${isLight ? 'text-black/40' : 'text-white/40'}`}>Select background audio file (.mp3, .wav)</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={resetSoundForm}
                    className={`flex-1 py-3.5 rounded-2xl font-bold text-xs cursor-pointer border ${isLight ? 'border-black/10 text-black hover:bg-black/5' : 'border-white/10 text-white hover:bg-white/5'}`}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveSound}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-xs cursor-pointer bg-accent text-black hover:bg-accent/85"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              /* Main Ambient Sounds List */
              <div className="space-y-6">
                {/* Mandatory General Sound */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-xs uppercase tracking-wider font-extrabold ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                      Default Setting
                    </h3>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isLight ? 'text-zinc-700 bg-zinc-100' : 'text-zinc-300 bg-white/[0.04]'}`}>General / Fallback Track</span>
                  </div>

                  <input 
                    type="file" 
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/aac,audio/x-m4a" 
                    ref={generalSoundFileInputRef} 
                    onChange={(e) => handleSoundAudioUpload(e, true)} 
                    className="hidden" 
                  />

                  <div 
                    onClick={() => generalSoundFileInputRef.current?.click()}
                    className={`relative w-full p-6 rounded-2xl border cursor-pointer hover:opacity-95 transition-opacity flex flex-col items-center justify-center ${
                      isLight ? 'bg-black/[0.02] border-black/[0.08]' : 'bg-[#1C1C1E]/80 backdrop-blur-md border-white/5'
                    }`}
                  >
                    {ambientSounds[0]?.audioFile ? (
                      <div className="flex flex-col items-center text-center">
                        <FileAudio className="w-10 h-10 mb-2 text-zinc-400" />
                        <span className={`text-xs font-bold text-center ${isLight ? 'text-black/70' : 'text-white/70'}`}>
                          General Background Music Loaded
                        </span>
                        <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => togglePlayAudio(ambientSounds[0]?.audioFile || '', 'general')}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
                              playingAudioId === 'general' ? 'bg-zinc-800 text-white dark:bg-white dark:text-black' : (isLight ? 'bg-black/10 text-black hover:bg-black/20' : 'bg-white/10 text-white hover:bg-white/15')
                            }`}
                          >
                            {playingAudioId === 'general' ? (
                              <>
                                <Square className={`w-3 h-3 ${isLight ? 'fill-white' : 'fill-black'}`} />
                                Pause Preview
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-current" />
                                Preview Track
                              </>
                            )}
                          </button>
                          <button 
                            type="button"
                            onClick={() => generalSoundFileInputRef.current?.click()}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}
                          >
                            Change File
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Music className={`w-10 h-10 mb-2 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
                        <span className={`text-[12px] font-bold ${isLight ? 'text-black/60' : 'text-white/60'}`}>Upload General Sound Track</span>
                        <span className={`text-[10px] text-center max-w-[220px] leading-relaxed mt-1 ${isLight ? 'text-black/40' : 'text-white/30'}`}>
                          Plays when no specialized triggers are active.
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Custom Ambient Sounds */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-xs uppercase tracking-wider font-extrabold ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                      Custom Dynamic Tracks ({customSounds.length} / 10)
                    </h3>
                  </div>

                  {customSounds.length === 0 ? (
                    <div className={`p-6 text-center border-2 border-dashed rounded-2xl ${isLight ? 'bg-black/[0.01] border-black/5' : 'bg-white/[0.01] border-white/[0.03]'}`}>
                      <Music className={`w-6 h-6 mx-auto mb-2 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
                      <p className={`text-xs font-medium ${isLight ? 'text-black/40' : 'text-white/30'}`}>No dynamic tracks added yet.</p>
                      <p className={`text-[10px] mt-0.5 leading-relaxed ${isLight ? 'text-black/35' : 'text-white/25'}`}>
                        Add battle, tension, or atmospheric soundtracks triggered by scenes.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ambientSounds.map((sound, index) => {
                        if (index === 0) return null; // skip default general
                        return (
                          <div 
                            key={sound.id || `sound-${index}-${sound.name}`}
                            className={`p-3 rounded-2xl border flex items-center gap-3 relative ${
                              isLight ? 'bg-white border-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md border-white/5'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => togglePlayAudio(sound.audioFile, `sound-${index}`)}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                                playingAudioId === `sound-${index}` ? 'bg-zinc-800 text-white dark:bg-white dark:text-black animate-pulse' : (isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/10 hover:bg-white/15')
                              }`}
                            >
                              {playingAudioId === `sound-${index}` ? (
                                <Square className={`w-4 h-4 ${isLight ? 'fill-white' : 'fill-black'}`} />
                              ) : (
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              )}
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-xs font-extrabold ${isLight ? 'text-black' : 'text-white'}`}>{sound.name}</h4>
                              <p className={`text-[11px] truncate leading-normal italic ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                                "{sound.triggerDescription || 'No trigger specified'}"
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSoundFormMode('edit');
                                  setEditingSoundIndex(index);
                                  setSoundNameInput(sound.name || '');
                                  setSoundAudioInput(sound.audioFile || '');
                                  setSoundAudioName('Audio Track Ready');
                                  setSoundTriggerInput(sound.triggerDescription || '');
                                }}
                                className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-black/5 text-black/50 hover:text-black' : 'hover:bg-white/5 text-white/50 hover:text-white'}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAmbientSounds(prev => prev.filter((_, i) => i !== index));
                                }}
                                className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500/70 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add button */}
                  {ambientSounds.length < 11 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSoundFormMode('add');
                        setEditingSoundIndex(null);
                        setSoundNameInput('');
                        setSoundAudioInput('');
                        setSoundAudioName('');
                        setSoundTriggerInput('');
                      }}
                      className="w-full mt-4 p-4 border border-dashed rounded-2xl flex items-center justify-center gap-2 font-bold text-xs text-accent hover:bg-black/[0.01] dark:hover:bg-white/[0.01] cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Ambient Sound</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {!isEditingForm && (
            <div className={`p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
              <button 
                type="button"
                onClick={() => setSubPage('none')}
                className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer ${isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
              >
                Save audio library
              </button>
            </div>
          )}
        </motion.div>
      );
    }

    if (subPage === 'characters') {
      const activeLinked = allCompanions.filter(c => linkedCharacterIds.includes(c.id));
      const unlinkedCompanions = allCompanions.filter(c => !linkedCharacterIds.includes(c.id));

      return (
        <motion.div 
          key="subpage-characters"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          transition={{ duration: 0.18 }}
          className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden ${isLight ? 'bg-[#F8F9FA] text-black' : 'bg-[#0f0f10] text-white'}`}
        >
          <div className="px-4 py-3 flex items-center justify-center relative border-b border-black/5 dark:border-white/5">
            <button type="button" onClick={() => setSubPage('none')} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold">World Characters</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
            {/* World Roster */}
            <div>
              <h3 className={`text-xs mb-3 uppercase tracking-wider font-extrabold ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                Linked Characters ({linkedCharacterIds.length})
              </h3>

              {activeLinked.length === 0 ? (
                <div className={`p-6 text-center border rounded-2xl border-dashed ${isLight ? 'bg-black/[0.01] border-black/5' : 'bg-white/[0.01] border-white/[0.03]'}`}>
                  <Users className={`w-5 h-5 mx-auto mb-1.5 ${isLight ? 'text-black/25' : 'text-white/25'}`} />
                  <p className={`text-[11px] font-bold ${isLight ? 'text-black/50' : 'text-white/40'}`}>Roster Empty</p>
                  <p className={`text-[10px] leading-relaxed mt-0.5 max-w-[200px] mx-auto ${isLight ? 'text-black/40' : 'text-white/30'}`}>
                    Add characters below to populate this world setting. Linked characters can dynamically participate in dialogue.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeLinked.map((char) => (
                    <div 
                      key={char.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                        isLight ? 'bg-white border-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/10 flex-shrink-0">
                          {char.avatar ? (
                            <SafeImage src={char.avatar} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt={char.name} />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${char.avatarGradient || 'from-blue-600 to-indigo-600'}`}>
                              <span className="text-white font-extrabold text-sm">{char.avatarEmoji || char.name.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className={`text-xs font-extrabold ${isLight ? 'text-black' : 'text-white'}`}>{char.name}</div>
                          <div className={`text-[10px] font-medium leading-normal ${isLight ? 'text-black/50' : 'text-white/40'}`}>{char.subtitle || 'AI Companion'}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setLinkedCharacterIds(linkedCharacterIds.filter(id => id !== char.id))}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold cursor-pointer hover:bg-rose-500/10 text-rose-500 transition-colors border ${
                          isLight ? 'border-black/5' : 'border-white/5'
                        }`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available Characters library */}
            <div>
              <h3 className={`text-xs mb-3 uppercase tracking-wider font-extrabold ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                Available Companion Roster ({unlinkedCompanions.length})
              </h3>

              {unlinkedCompanions.length === 0 ? (
                <p className={`text-[11px] italic leading-relaxed ${isLight ? 'text-black/40' : 'text-white/30'}`}>
                  No more characters found in your companion library. Build new characters in the main tab!
                </p>
              ) : (
                <div className="space-y-2">
                  {unlinkedCompanions.map((char) => (
                    <div 
                      key={char.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                        isLight ? 'bg-white border-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/10 flex-shrink-0">
                          {char.avatar ? (
                            <SafeImage src={char.avatar} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt={char.name} />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${char.avatarGradient || 'from-blue-600 to-indigo-600'}`}>
                              <span className="text-white font-extrabold text-sm">{char.avatarEmoji || char.name.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className={`text-xs font-extrabold ${isLight ? 'text-black' : 'text-white'}`}>{char.name}</div>
                          <div className={`text-[10px] font-medium leading-normal ${isLight ? 'text-black/50' : 'text-white/40'}`}>{char.subtitle || 'AI Companion'}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setLinkedCharacterIds([...linkedCharacterIds, char.id])}
                        className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold cursor-pointer text-accent hover:bg-accent/10 transition-colors border ${
                          isLight ? 'border-black/5' : 'border-white/5'
                        }`}
                      >
                        Add to World
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
            <button 
              type="button"
              onClick={() => setSubPage('none')}
              className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer ${isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
            >
              Save Roster Setup
            </button>
          </div>
        </motion.div>
      );
    }

    const isTagline = subPage === 'tagline';
    const isDesc = subPage === 'description';
    const isDef = subPage === 'definition';
    const isExampleDiag = subPage === 'exampleDialogue';
    const isGreeting = subPage === 'greeting';

    const title = isTagline 
      ? 'World Tagline' 
      : isDesc 
      ? 'World Description' 
      : isDef 
      ? 'World Definition' 
      : isExampleDiag
      ? 'Example World Chats & Atmospheric Style'
      : 'World Opening Greeting';

    const val = isTagline ? tagline : isDesc ? description : isDef ? definition : isExampleDiag ? exampleDialogue : greeting;

    const setter = (newValue: string) => {
      if (isTagline) setTagline(newValue);
      else if (isDesc) setDescription(newValue);
      else if (isDef) setDefinition(newValue);
      else if (isExampleDiag) setExampleDialogue(newValue);
      else if (isGreeting) setGreeting(newValue);
    };

    const example = isTagline 
      ? 'Example: A futuristic neo-noir metropolis covered in neon rain.'
      : isDesc 
      ? "Example: In the year 2088, Mega-City One is the last bastion of human civilization. Corporate greed controls the sky, while cyber-criminals rule the neon-lit streets."
      : isDef
      ? 'Example: Always rainy and dark. Gravity is 20% lower than Earth. High-tech cybernetics are common, but resources are extremely scarce.'
      : isExampleDiag
      ? `<START>\n[Location: Central Plaza]\n{{user}}: What's happening around here?\n{{char}}: *The rain patters heavily against neon signs as a hover-car glides past overhead.* "The city never sleeps. What brings a outsider like you to Sector 4?"`
      : 'Example: Welcome to Neo-Veridia. Heavy smog hangs low over shimmering skyscrapers as sirens wail in the distance. What will you do first?';

    const helpText = isTagline
      ? 'This is what people see before they tap to view your World.'
      : isDesc
      ? 'This helps introduce your World to people and will appear on their profile.'
      : isDef
      ? 'The World Definition shapes how your world feels, its rules, and its setting.'
      : isExampleDiag
      ? 'Define example conversations and atmospheric narration snippets to show how characters and the environment respond inside this World.'
      : 'The initial opening greeting or scene narration that appears as the very first message when entering this World.';

    return (
      <motion.div 
        key={`subpage-${subPage}`}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.18 }}
        className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden ${isLight ? 'bg-[#F8F9FA] text-black' : 'bg-[#0f0f10] text-white'}`}
      >
        <div className="px-4 py-3 flex items-center justify-center relative border-b border-black/5 dark:border-white/5">
          <button type="button" onClick={() => setSubPage('none')} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-[15px] font-semibold">{title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          {isExampleDiag && (
            <div className="mb-4 space-y-2">
              <div className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-black/60' : 'text-white/60'}`}>
                Quick World Templates
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sample = `<START>\n[Scene: Rainy Alleyway]\n{{user}}: Is anyone there?\n{{char}}: *Footsteps echo against wet pavement as steam rises from a nearby grate.* "Quiet! The enforcers are patrolling nearby."`;
                    setter(val ? `${val}\n\n${sample}` : sample);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${isLight ? 'bg-black/5 hover:bg-black/10 border-black/10 text-black' : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'}`}
                >
                  + Scene & Atmospheric Response
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sample = `<START>\n{{user}}: What kind of technology exists in this realm?\n{{char}}: *A blue holographic display flickers to life, showing crystal-powered airships.* "We harness arcana-tech. High magic blended with mechanical engineering."`;
                    setter(val ? `${val}\n\n${sample}` : sample);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${isLight ? 'bg-black/5 hover:bg-black/10 border-black/10 text-black' : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'}`}
                >
                  + World Lore & Q&A
                </button>
              </div>
            </div>
          )}

          <div className="relative">
            <textarea
              value={val || ''}
              onChange={(e) => setter(e.target.value)}
              placeholder={example}
              className={`w-full min-h-[220px] py-4 px-6 rounded-[28px] resize-none text-[13px] leading-relaxed focus:outline-none focus:ring-1 ${isLight ? 'bg-black/5 placeholder-black/30 focus:ring-black/20 text-black border border-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md placeholder-white/30 focus:ring-white/20 text-white border border-white/5'}`}
            />
          </div>
          <div className={`mt-4 text-[11px] px-1 leading-relaxed ${isLight ? 'text-black/50' : 'text-white/50'}`}>
            {helpText}
          </div>
        </div>

        <div className={`p-4 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
          <button 
            type="button"
            onClick={() => setSubPage('none')}
            className={`w-full py-4 rounded-[28px] font-bold text-[14px] transition-all cursor-pointer ${isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
          >
            Save
          </button>
        </div>
      </motion.div>
    );
  };

  // If in Edit mode, render single-screen scrollable page
  if (isEdit) {
    return (
      <div className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden animate-fadeIn ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
        <AnimatePresence mode="wait">
          {renderSubPageContent()}
        </AnimatePresence>

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
        <div className={`px-4 py-3 flex items-center justify-between relative border-b ${isLight ? 'text-black border-black/5 bg-[#F8F9FA]' : 'text-white border-white/5 bg-[#0f0f10]'}`}>
          <button type="button" onClick={onClose} className={`p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-[17px] font-semibold text-center flex-1 pr-4">Edit World</h2>
          <button 
            type="button"
            onClick={handleCreate} 
            disabled={!name.trim()}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              !name.trim() 
                ? 'opacity-40 cursor-not-allowed bg-black/10 text-black/40 dark:bg-white/10 dark:text-white/40' 
                : (isLight ? 'bg-zinc-800 text-white hover:bg-black' : 'bg-accent text-black hover:bg-accent/85')
            }`}
          >
            Save
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24">
          {/* Cover Photo Upload */}
          <div className="flex flex-col items-center justify-center mb-8">
            <input type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`relative w-28 h-28 rounded-[2rem] overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity border ${
                isLight ? 'bg-black/5 border-black/10 shadow-sm' : 'bg-[#1C1C1E]/80 backdrop-blur-md border-white/5'
              }`}
            >
              {avatar ? (
                <SafeImage src={avatar} className="w-full h-full object-cover" alt="World cover" />
              ) : (
                <ImageIcon className={`w-10 h-10 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
              )}
              <div className={`absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all ${
                isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'
              }`}>
                <Pencil className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Name Section */}
          <div className="mb-6">
            <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2 ${isLight ? 'text-black/40' : 'text-white/30'}`}>World Name</label>
            <input
              type="text"
              value={name || ''}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className={`w-full py-4 px-6 rounded-[28px] text-[15px] font-semibold focus:outline-none focus:ring-1 ${
                isLight 
                  ? 'bg-black/5 text-black placeholder-black/30 focus:ring-black/20 border border-black/5' 
                  : 'bg-[#1C1C1E]/80 backdrop-blur-md text-white placeholder-white/30 focus:ring-white/20 border border-white/5'
              }`}
            />
          </div>

          {/* Details & Roster section */}
          <div className="mb-6">
            <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>World Settings & Roster</label>
            
            <div className={`rounded-2xl border divide-y overflow-hidden ${
              isLight ? 'bg-black/5 border-black/5 divide-black/5' : 'bg-white/[0.03] border-white/5 divide-white/5'
            }`}>
              {/* Tagline row */}
              <button
                type="button"
                onClick={() => setSubPage('tagline')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {tagline.trim().length > 0 ? (
                  <div className="flex flex-col items-start">
                    <span className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>World Tagline</span>
                    <span className={`text-[12px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{tagline}</span>
                  </div>
                ) : (
                  <span className="text-accent font-semibold text-[12px] flex items-center gap-2">
                    <span className="text-base leading-none">+</span> Add Tagline
                  </span>
                )}
              </button>

              {/* Description row */}
              <button
                type="button"
                onClick={() => setSubPage('description')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {description.trim().length > 0 ? (
                  <div className="flex flex-col items-start">
                    <span className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>World Description</span>
                    <span className={`text-[12px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{description}</span>
                  </div>
                ) : (
                  <span className="text-accent font-semibold text-[12px] flex items-center gap-2">
                    <span className="text-base leading-none">+</span> Add Description
                  </span>
                )}
              </button>

              {/* World Definition row */}
              <button
                type="button"
                onClick={() => setSubPage('definition')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {definition.trim().length > 0 ? (
                  <div className="flex flex-col items-start">
                    <span className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>World Definition</span>
                    <span className={`text-[12px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{definition}</span>
                  </div>
                ) : (
                  <span className="text-accent font-semibold text-[12px] flex items-center gap-2">
                    <span className="text-base leading-none">+</span> Add World Definition
                  </span>
                )}
              </button>

              {/* Example World Chats & Atmospheric Style row */}
              <button
                type="button"
                onClick={() => setSubPage('exampleDialogue')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {exampleDialogue.trim().length > 0 ? (
                  <div className="flex flex-col items-start">
                    <span className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Example World Chats & Atmospheric Style</span>
                    <span className={`text-[12px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{exampleDialogue}</span>
                  </div>
                ) : (
                  <span className="text-accent font-semibold text-[12px] flex items-center gap-2">
                    <span className="text-base leading-none">+</span> Add Example World Chats & Atmospheric Style
                  </span>
                )}
              </button>

              {/* World Opening Greeting row */}
              <button
                type="button"
                onClick={() => setSubPage('greeting')}
                className="w-full px-4 py-4 flex flex-col items-start text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                {greeting.trim().length > 0 ? (
                  <div className="flex flex-col items-start">
                    <span className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>World Opening Greeting</span>
                    <span className={`text-[12px] font-medium line-clamp-1 ${isLight ? 'text-black' : 'text-white'}`}>{greeting}</span>
                  </div>
                ) : (
                  <span className="text-accent font-semibold text-[12px] flex items-center gap-2">
                    <span className="text-base leading-none">+</span> Add World Opening Greeting
                  </span>
                )}
              </button>

              {/* Places row */}
              <button
                type="button"
                onClick={() => setSubPage('places')}
                className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                <div className="flex flex-col items-start">
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>World Places</span>
                  <span className={`text-[14px] font-medium ${isLight ? 'text-black' : 'text-white'}`}>
                    {places.length > 1 ? `${places.length - 1} custom places, 1 general` : 'General default setting only'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-accent" />
                  <ChevronRight className={`w-5 h-5 ${isLight ? 'text-black/40' : 'text-white/30'}`} />
                </div>
              </button>

              {/* Ambient Sounds row */}
              <button
                type="button"
                onClick={() => setSubPage('ambientSounds')}
                className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                <div className="flex flex-col items-start">
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Ambient Sounds</span>
                  <span className={`text-[14px] font-medium ${isLight ? 'text-black' : 'text-white'}`}>
                    {ambientSounds.length > 1 ? `${ambientSounds.length - 1} custom audio files, 1 general` : 'General fallback track only'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-accent" />
                  <ChevronRight className={`w-5 h-5 ${isLight ? 'text-black/40' : 'text-white/30'}`} />
                </div>
              </button>

              {/* Characters row */}
              <button
                type="button"
                onClick={() => setSubPage('characters')}
                className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
              >
                <div className="flex flex-col items-start">
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>Characters</span>
                  <span className={`text-[14px] font-medium ${isLight ? 'text-black' : 'text-white'}`}>
                    {linkedCharacterIds.length > 0 ? `${linkedCharacterIds.length} characters linked` : 'No characters linked'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-accent" />
                  <ChevronRight className={`w-5 h-5 ${isLight ? 'text-black/40' : 'text-white/30'}`} />
                </div>
              </button>
            </div>
          </div>

          {/* Visibility Section */}
          <div className="mb-6">
            <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-2.5 ${isLight ? 'text-black/40' : 'text-white/30'}`}>World Discovery</label>
            
            <div className={`rounded-2xl border divide-y overflow-hidden ${
              isLight ? 'bg-black/5 border-black/5 divide-black/5' : 'bg-white/[0.03] border-white/5 divide-white/5'
            }`}>
              {/* Tags row */}
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
                className="w-full px-4 py-4 flex items-center justify-between text-accent text-left hover:bg-black/5 dark:hover:bg-white/[0.02] transition-all cursor-pointer bg-transparent border-0"
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

  // Step-by-step Wizard for World Creation
  return (
    <div className={`fixed inset-0 z-[250] flex flex-col h-full overflow-hidden animate-fadeIn ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'}`}>
      <AnimatePresence mode="wait">
        {renderSubPageContent()}
      </AnimatePresence>

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

      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-center relative ${isLight ? 'text-black' : 'text-white'}`}>
        {step === 1 ? (
          <button type="button" onClick={onClose} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button type="button" onClick={() => setStep(step - 1)} className={`absolute left-4 p-2 -ml-2 rounded-full transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-[16px] font-semibold">Create World</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-32">
        {/* Step 1: Name */}
        {step === 1 && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="flex flex-col items-center justify-center h-full max-h-[400px]">
            <h1 className={`text-2xl font-bold text-center mb-6 ${isLight ? 'text-black' : 'text-white'}`}>What's your<br/>World's name?</h1>
            <input
              type="text"
              value={name || ''}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className={`w-full py-4 px-6 rounded-[28px] text-[16px] focus:outline-none focus:ring-1 ${isLight ? 'bg-black/5 text-black placeholder-black/30 focus:ring-black/20' : 'bg-[#1C1C1E]/80 backdrop-blur-md text-white placeholder-white/30 focus:ring-white/20'}`}
            />
          </motion.div>
        )}

        {/* Step 2: Cover photo */}
        {step === 2 && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="flex flex-col items-center">
            <h1 className={`text-2xl font-bold text-center mb-8 ${isLight ? 'text-black' : 'text-white'}`}>What does the world<br/>look like in one frame?</h1>
            
            <input type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`w-40 h-40 rounded-[2rem] overflow-hidden flex items-center justify-center mb-6 cursor-pointer hover:opacity-90 transition-opacity ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md border border-white/5'}`}
            >
              {avatar ? (
                <SafeImage src={avatar} className="w-full h-full object-cover" alt="World avatar" />
              ) : (
                <ImageIcon className={`w-12 h-12 ${isLight ? 'text-black/20' : 'text-white/20'}`} />
              )}
            </div>

            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`px-6 py-3 rounded-full font-medium ${isLight ? 'bg-black/5 text-black hover:bg-black/10' : 'bg-white/10 text-white hover:bg-white/15'}`}
            >
              Upload an image
            </button>
          </motion.div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="flex flex-col">
            <h3 className={`text-[15px] font-bold mb-3 ${isLight ? 'text-black' : 'text-white'}`}>Details</h3>
            
            <div className="space-y-6">
              {/* Tagline */}
              <div>
                <button 
                  type="button"
                  onClick={() => setSubPage('tagline')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'
                  } ${tagline ? (isLight ? 'text-black' : 'text-white') : 'text-accent'}`}
                >
                  {!tagline && <span className="text-lg leading-none">+</span>}
                  <span>{tagline ? tagline : 'Add Tagline'}</span>
                </button>
                {!tagline && (
                  <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                    This is what people see before they tap to view your World.
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <button 
                  type="button"
                  onClick={() => setSubPage('description')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'
                  } ${description ? (isLight ? 'text-black' : 'text-white') : 'text-accent'}`}
                >
                  {!description && <span className="text-lg leading-none">+</span>}
                  <span className="truncate flex-1">{description ? description : 'Add Description'}</span>
                </button>
                {!description && (
                  <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                    This helps introduce your World to people and will appear on their profile.
                  </p>
                )}
              </div>

              {/* World Definition */}
              <div>
                <button 
                  type="button"
                  onClick={() => setSubPage('definition')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'
                  } ${definition ? (isLight ? 'text-black' : 'text-white') : 'text-accent'}`}
                >
                  {!definition && <span className="text-lg leading-none">+</span>}
                  <span className="truncate flex-1">{definition ? definition : 'Add World Definition'}</span>
                </button>
                {!definition && (
                  <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                    The World Definition shapes how your world feels, its rules, and its setting.
                  </p>
                )}
              </div>

              {/* Example World Chats & Atmospheric Style */}
              <div>
                <button 
                  type="button"
                  onClick={() => setSubPage('exampleDialogue')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'
                  } ${exampleDialogue ? (isLight ? 'text-black' : 'text-white') : 'text-accent'}`}
                >
                  {!exampleDialogue && <span className="text-lg leading-none">+</span>}
                  <span className="truncate flex-1">{exampleDialogue ? 'Example World Chats (Configured)' : 'Example World Chats & Atmospheric Style'}</span>
                  {exampleDialogue && <span className="text-[10px] font-mono opacity-60 bg-white/10 px-2 py-0.5 rounded-full">{exampleDialogue.length} chars</span>}
                </button>
                {!exampleDialogue && (
                  <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                    Define sample dialogue and narration showing how characters and the environment speak and respond inside this World.
                  </p>
                )}
              </div>

              {/* World Opening Greeting */}
              <div>
                <button 
                  type="button"
                  onClick={() => setSubPage('greeting')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-left font-semibold text-[13px] flex items-center gap-2 cursor-pointer border-0 transition-all ${
                    isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'
                  } ${greeting ? (isLight ? 'text-black' : 'text-white') : 'text-accent'}`}
                >
                  {!greeting && <span className="text-lg leading-none">+</span>}
                  <span className="truncate flex-1">{greeting ? 'World Opening Greeting (Configured)' : 'Add World Opening Greeting'}</span>
                  {greeting && <span className="text-[10px] font-mono opacity-60 bg-white/10 px-2 py-0.5 rounded-full">{greeting.length} chars</span>}
                </button>
                {!greeting && (
                  <p className={`text-[11px] mt-2 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                    Set a custom opening greeting message or scene narration that will appear as the first message when starting a chat in this world.
                  </p>
                )}
              </div>

              {/* World Places */}
              <div>
                <button 
                  type="button"
                  onClick={() => setSubPage('places')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-accent text-left font-semibold text-[14px] flex items-center justify-between cursor-pointer border-0 ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'}`}
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>World Places ({places.length > 1 ? `${places.length - 1} custom` : 'Default general'})</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-current" />
                </button>
                <p className={`text-[13px] mt-3 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                  Visual backdrops triggered dynamically based on where characters go.
                </p>
              </div>

              {/* Ambient Sounds */}
              <div>
                <button 
                  type="button"
                  onClick={() => setSubPage('ambientSounds')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-accent text-left font-semibold text-[14px] flex items-center justify-between cursor-pointer border-0 ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'}`}
                >
                  <span className="flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    <span>Ambient Sounds ({ambientSounds.length > 1 ? `${ambientSounds.length - 1} custom` : 'Default general'})</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-current" />
                </button>
                <p className={`text-[13px] mt-3 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                  Dynamic audio loops and background music tracks triggered on scene transitions.
                </p>
              </div>

              {/* Characters */}
              <div>
                <button 
                  type="button"
                  onClick={() => setSubPage('characters')} 
                  className={`w-full py-4 px-6 rounded-[28px] text-accent text-left font-semibold text-[14px] flex items-center justify-between cursor-pointer border-0 ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'}`}
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Characters ({linkedCharacterIds.length} linked)</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-current" />
                </button>
                <p className={`text-[13px] mt-3 leading-relaxed px-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                  Link existing characters in your library to dynamically appear inside this World setting.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 4: Visibility & Tags */}
        {step === 4 && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="flex flex-col">
            <h3 className={`text-[15px] font-bold mb-3 ${isLight ? 'text-black' : 'text-white'}`}>Visibility</h3>
            
            <div className={`rounded-3xl overflow-hidden mb-6 ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'}`}>
              <button type="button" onClick={() => setPrivacy('public')} className={`w-full p-4 flex items-center gap-4 text-left border-b cursor-pointer border-0 ${isLight ? 'border-black/5' : 'border-white/5'}`}>
                <Globe className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Public</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Anyone can find, view, and explore this World.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'public' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
              
              <button type="button" onClick={() => setPrivacy('unlisted')} className={`w-full p-4 flex items-center gap-4 text-left border-b cursor-pointer border-0 ${isLight ? 'border-black/5' : 'border-white/5'}`}>
                <LinkIcon className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Unlisted</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Only people with a link can view this World.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'unlisted' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
              
              <button type="button" onClick={() => setPrivacy('private')} className="w-full p-4 flex items-center gap-4 text-left cursor-pointer border-0 bg-transparent">
                <Lock className={`w-6 h-6 ${isLight ? 'text-black' : 'text-white'}`} />
                <div className="flex-1">
                  <div className={`text-[16px] font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Private</div>
                  <div className={`text-[13px] ${isLight ? 'text-black/50' : 'text-white/50'}`}>Only you can view and use this World.</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLight ? 'border-black/20' : 'border-white/20'}`}>
                  {privacy === 'private' && <div className={`w-3 h-3 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />}
                </div>
              </button>
            </div>

            <h3 className={`text-[15px] font-bold mb-3 ${isLight ? 'text-black' : 'text-white'}`}>Tags</h3>
            <button type="button" onClick={() => setSubPage('tags')} className={`w-full p-4 rounded-3xl flex items-center justify-between text-left cursor-pointer border-0 ${isLight ? 'bg-black/5' : 'bg-[#1C1C1E]/80 backdrop-blur-md'}`}>
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
              Tags help people discover your World.
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer Nav */}
      <div className={`fixed bottom-0 left-0 right-0 p-4 pb-6 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#0f0f10]'} flex flex-col gap-2`}>
        <button 
          type="button"
          onClick={step === 4 ? handleCreate : handleNext}
          disabled={step === 1 && !name.trim()}
          className={`w-full py-4 rounded-[28px] font-bold text-[16px] transition-all cursor-pointer border-0
            ${(step === 1 && !name.trim()) 
              ? (isLight ? 'bg-black/5 text-black/30' : 'bg-white/10 text-white/30') 
              : (isLight ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90')}`}
        >
          {step === 4 ? 'Create' : 'Next'}
        </button>
      </div>
    </div>
  );
}
