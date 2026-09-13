export function resolveWallpaper(
  customWallpaper: string | null | undefined,
  activePlaceName: string | null | undefined,
  worldLocationInput: string | null | undefined,
  linkedWorld: any,
  persona: any
): string | null {
  // 1. Manually overridden custom wallpaper for this chat session
  if (customWallpaper && typeof customWallpaper === 'string' && customWallpaper.trim() !== '') {
    return customWallpaper.trim();
  }

  // 2. World places wallpapers
  if (linkedWorld?.places && Array.isArray(linkedWorld.places) && linkedWorld.places.length > 0) {
    const pLower = (activePlaceName || worldLocationInput || 'general').toLowerCase().trim();

    // Exact place match (e.g. "general" or specific named location)
    const exact = linkedWorld.places.find((p: any) => 
      p && p.name && p.name.toLowerCase().trim() === pLower
    );
    if (exact && exact.image && typeof exact.image === 'string' && exact.image.trim() !== '') {
      return exact.image.trim();
    }

    // Partial place match if not general
    if (pLower && pLower !== 'general') {
      const partial = linkedWorld.places.find((p: any) => 
        p && p.name && (p.name.toLowerCase().includes(pLower) || (pLower.length > 3 && pLower.includes(p.name.toLowerCase())))
      );
      if (partial && partial.image && typeof partial.image === 'string' && partial.image.trim() !== '') {
        return partial.image.trim();
      }
    }

    // Default "General" place image fallback ONLY if that place has an actual image uploaded
    const generalPlace = linkedWorld.places.find((p: any) => p && p.name && p.name.toLowerCase().trim() === 'general');
    if (generalPlace && generalPlace.image && typeof generalPlace.image === 'string' && generalPlace.image.trim() !== '') {
      return generalPlace.image.trim();
    }

    // Do NOT fall back to linkedWorld.coverImage (which is the world's avatar / pfp)
    return null;
  }

  // 3. Individual Character background wallpaper (for standalone character chats)
  const charObj = persona;
  if (charObj && !charObj.id?.startsWith('world-')) {
    if (charObj.backgroundImage && typeof charObj.backgroundImage === 'string' && charObj.backgroundImage.trim() !== '') {
      return charObj.backgroundImage.trim();
    }
    if (charObj.wallpaper && typeof charObj.wallpaper === 'string' && charObj.wallpaper.trim() !== '') {
      return charObj.wallpaper.trim();
    }
  }

  return null;
}

