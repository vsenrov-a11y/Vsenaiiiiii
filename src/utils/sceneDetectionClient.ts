export function shouldSkipSceneDetection(userMessage: string, characterMessage: string): boolean {
  const combined = (userMessage + " " + characterMessage).toLowerCase();
  
  // A heuristic list of keywords that imply state changes:
  const triggerKeywords = [
    'walk', 'run', 'go', 'head to', 'arrive', 'leave', 'enter', 'exit', 'travel', // location
    'sleep', 'wake', 'bed', 'morning', 'night', 'tomorrow', 'later', 'tired', 'yawn', // calendar / energy
    'eat', 'drink', 'hungry', 'thirsty', 'food', 'water', 'meal', // hunger / thirst
    'rain', 'sun', 'snow', 'wind', 'storm', 'weather', 'cold', 'hot', // weather
    'shower', 'bath', 'wash', 'clean', 'dirty', 'sweat', // hygiene
    'kiss', 'touch', 'hug', 'love', 'hate', 'angry', 'mad', 'smile', 'blush', 'moan', // relationships / arousal
    'buy', 'sell', 'pay', 'cost', 'money', // inventory
    'hurt', 'pain', 'bleed', 'doctor', 'hospital' // health
  ];

  // If none of the trigger keywords are present, we skip the API call.
  // We can return true to SKIP if no keywords match.
  const hasTrigger = triggerKeywords.some(kw => combined.includes(kw));
  return !hasTrigger;
}

export async function detectSceneState(params: {
  characterMessage: string,
  userMessageText: string,
  defaultTargetCharName: string,
  linkedWorld: any,
  worldCalendarInput: string,
  worldLocationInput: string,
  worldWeatherInput: string,
  worldReputationInput: string,
  charRelScores: any,
  getInitialCharScores: any,
  worldChars: any[],
  apiKey?: string,
  storageConfig: any,
  characterState: any,
  defaultTargetCharId: string,
  signal: AbortSignal
}) {
  const fallback = {
    success: true,
    sceneMood: "Calm",
    place: "no_change",
    ambient: "no_change",
    calendar: "no_change",
    location: "no_change",
    weather: "no_change",
    reputation: "no_change",
    relationships: null,
    characterState: null
  };

  try {
    const response = await fetch('/api/detect-scene', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: params.characterMessage,
        userMessage: params.userMessageText || '',
        characterName: params.defaultTargetCharName,
        worldName: params.linkedWorld?.name || 'Current Roleplay World',
        places: params.linkedWorld?.places || [],
        ambientSounds: params.linkedWorld?.ambientSounds || [],
        currentCalendar: params.worldCalendarInput,
        currentLocation: params.worldLocationInput,
        currentWeather: params.worldWeatherInput,
        currentReputation: params.worldReputationInput,
        currentRelationships: params.charRelScores[params.defaultTargetCharId] || params.getInitialCharScores(params.defaultTargetCharId, params.defaultTargetCharName),
        characters: params.worldChars,
        customApiKey: params.apiKey,
        customApiKeys: params.storageConfig?.apiKeys,
        characterState: params.characterState,
      }),
      signal: params.signal,
    });

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    if (!data.success) {
      return fallback;
    }

    return data;
  } catch (err: any) {
    if (err.name === 'AbortError' || (err.message && (err.message.includes('aborted') || err.message.includes('abort')))) {
      return fallback;
    }
    // Network or fetch issues
    return fallback;
  }
}
