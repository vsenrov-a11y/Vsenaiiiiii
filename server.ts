import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const getPaths = () => {
  try {
    const hasImportMeta = typeof import.meta !== "undefined" && !!import.meta && !!import.meta.url;
    const f = hasImportMeta ? fileURLToPath(import.meta.url) : (typeof __filename !== "undefined" ? __filename : "");
    const d = hasImportMeta ? path.dirname(f) : (typeof __dirname !== "undefined" ? __dirname : "");
    return { filename: f, dirname: d };
  } catch {
    return { filename: "", dirname: "" };
  }
};

const { filename: safeFilename, dirname: safeDirname } = getPaths();

class KeyStats {
  lastUsed: number = 0;
  errorCount: number = 0;
  cooldownUntil: number = 0;
}

const keyRegistry = new Map<string, KeyStats>();

let lastWorkingApiKey: string | null = null;
let lastWorkingModel: string | null = null;
let lastSuccessTime: number = 0;

function getKeyStats(key: string): KeyStats {
  let stats = keyRegistry.get(key);
  if (!stats) {
    stats = new KeyStats();
    keyRegistry.set(key, stats);
  }
  return stats;
}

function maskKey(key: string): string {
  if (!key) return "empty";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function sortApiKeys(keys: string[]): string[] {
  const now = Date.now();
  return [...keys].sort((a, b) => {
    // Prioritize the last working API key if it's not currently cooled down
    const isLastWorkingA = (a === lastWorkingApiKey && getKeyStats(a).cooldownUntil <= now) ? 1 : 0;
    const isLastWorkingB = (b === lastWorkingApiKey && getKeyStats(b).cooldownUntil <= now) ? 1 : 0;
    if (isLastWorkingA !== isLastWorkingB) {
      return isLastWorkingB - isLastWorkingA;
    }

    const statsA = getKeyStats(a);
    const statsB = getKeyStats(b);
    
    const isCooledA = statsA.cooldownUntil > now ? 1 : 0;
    const isCooledB = statsB.cooldownUntil > now ? 1 : 0;
    if (isCooledA !== isCooledB) {
      return isCooledA - isCooledB;
    }
    
    if (isCooledA === 1) {
      return statsA.cooldownUntil - statsB.cooldownUntil;
    }
    
    if (statsA.errorCount !== statsB.errorCount) {
      return statsA.errorCount - statsB.errorCount;
    }
    
    return statsB.lastUsed - statsA.lastUsed;
  });
}

function markKeySuccess(key: string, modelName?: string) {
  const stats = getKeyStats(key);
  stats.errorCount = 0;
  stats.cooldownUntil = 0;
  lastWorkingApiKey = key;
  if (modelName) {
    lastWorkingModel = modelName;
  }
  lastSuccessTime = Date.now();
}

function markKeyError(key: string, error: any) {
  const stats = getKeyStats(key);
  stats.errorCount++;
  
  const errMsg = (error?.message || error?.statusText || String(error)).toLowerCase();
  
  const isInvalidKey = 
    (errMsg.includes("api_key_invalid") || 
    errMsg.includes("key not valid") || 
    errMsg.includes("invalid key") || 
    errMsg.includes("unauthorized") ||
    errMsg.includes("api key not found") ||
    errMsg.includes("key has been deleted") ||
    errMsg.includes("invalid api key")) &&
    !errMsg.includes("model");

  if (isInvalidKey) {
    stats.cooldownUntil = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    console.warn(`[KeyManager] Key ${maskKey(key)} disabled for 24h due to invalid key error.`);
    return;
  }

  // Model-specific quota or model high demand (503 / 429 / rate limits) should NOT pause key for other fallback models
  const isModelSpecific = errMsg.includes("model") ||
                          errMsg.includes("per_model") ||
                          errMsg.includes("generate_content") ||
                          errMsg.includes("limit:") ||
                          errMsg.includes("limit :") ||
                          errMsg.includes("quota") ||
                          errMsg.includes("503") ||
                          errMsg.includes("429") ||
                          errMsg.includes("high demand") ||
                          errMsg.includes("unavailable") ||
                          errMsg.includes("resource_exhausted") ||
                          error?.status === 503 ||
                          error?.status === 429 ||
                          error?.code === 503 ||
                          error?.code === 429;

  if (isModelSpecific) {
    console.warn(`[KeyManager] Key ${maskKey(key)} encountered model-specific quota/busy status. Key kept active for fallback models.`);
    return;
  }

  stats.cooldownUntil = Date.now() + 15 * 1000; // brief 15 seconds for network drops
  console.warn(`[KeyManager] Key ${maskKey(key)} briefly cooled down for 15s due to network error: ${errMsg.slice(0, 100)}`);
}

function getApiKeysToTry(customApiKey?: string, customApiKeys?: string[]): string[] {
  const apiKeysSet = new Set<string>();
  let wantsServerFallback = false;

  if (customApiKeys && Array.isArray(customApiKeys)) {
    customApiKeys.forEach(k => {
      if (!k || !k.trim()) return;
      const trimmed = k.trim();
      if (trimmed === "SERVER_FALLBACK") {
        wantsServerFallback = true;
      } else {
        apiKeysSet.add(trimmed);
      }
    });
  }
  if (customApiKey && customApiKey.trim() !== "") {
    const trimmed = customApiKey.trim();
    if (trimmed === "SERVER_FALLBACK") {
      wantsServerFallback = true;
    } else {
      apiKeysSet.add(trimmed);
    }
  }
  // Always include server env key when available (or when explicitly requested via SERVER_FALLBACK)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "") {
    apiKeysSet.add(process.env.GEMINI_API_KEY.trim());
  } else if (wantsServerFallback) {
    console.warn("[KeyManager] SERVER_FALLBACK requested but GEMINI_API_KEY is not set in environment.");
  }
  return Array.from(apiKeysSet).filter(k => k && k.trim().length > 10);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API endpoint to verify status and server API key presence
  app.get("/api/config", (req, res) => {
    res.json({
      hasServerApiKey: !!process.env.GEMINI_API_KEY,
      appName: "Vsen.Ai",
      version: "1.0.0 (Native Android Simulation)"
    });
  });

  // Image Generation Endpoint for Avatar PFPs
  app.post("/api/generate-avatar", async (req, res) => {
    try {
      const { prompt, customApiKey, customApiKeys } = req.body;
      const apiKeysToTry = getApiKeysToTry(customApiKey, customApiKeys);

      if (apiKeysToTry.length === 0) {
        return res.status(400).json({
          error: "API Key missing. Please provide a Gemini API Key in the API Onboarding screen or set GEMINI_API_KEY in server secrets."
        });
      }

      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: "Prompt is required." });
      }

      const sortedKeys = sortApiKeys(apiKeysToTry);
      let success = false;
      let base64Image = "";
      let isBillingOrFreeTierQuota = false;
      let lastAvatarErrorMessage = "";

      const avatarModels = ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image'];

      for (let count = 0; count < sortedKeys.length; count++) {
        const apiKey = sortedKeys[count];
        getKeyStats(apiKey).lastUsed = Date.now();

        const ai = new GoogleGenAI({ 
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        for (const model of avatarModels) {
          try {
            console.log(`[Avatar API] Trying key ${maskKey(apiKey)} with model ${model}...`);
            const response = await ai.models.generateContent({
              model,
              contents: {
                parts: [{ text: prompt }]
              }
            });

            if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                  base64Image = part.inlineData.data;
                  break;
                }
              }
            }

            if (base64Image) {
              markKeySuccess(apiKey);
              success = true;
              break;
            }
          } catch (err: any) {
            const errStr = (err?.message || String(err)).toLowerCase();
            console.error(`[Avatar API] Error on key ${maskKey(apiKey)} with model ${model}:`, errStr);
            lastAvatarErrorMessage = err?.message || String(err);
            if (errStr.includes("limit: 0") || errStr.includes("limit:0") || errStr.includes("generate_content_free_tier_requests")) {
              isBillingOrFreeTierQuota = true;
            }
            markKeyError(apiKey, err);
          }
        }

        if (success) break;
      }

      if (!success || !base64Image) {
        if (isBillingOrFreeTierQuota) {
          return res.status(403).json({
            error: "AI image generation requires a Gemini API key with billing enabled (image models have a limit of 0 on Google's free tier). You can still upload any avatar photo from your device or select an existing avatar."
          });
        }
        return res.status(500).json({ 
          error: lastAvatarErrorMessage || "Could not generate portrait data from the provided prompt with any available API key." 
        });
      }

      res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
    } catch (err: any) {
      console.error("Image generation error:", err);
      res.status(500).json({ error: err.message || "Failed to generate image." });
    }
  });

  // Test Connection Endpoint
  app.post("/api/test-connection", async (req, res) => {
    try {
      const { apiKey, provider } = req.body;
      let keyToUse = apiKey ? apiKey.trim() : "";

      if (keyToUse === "SERVER_FALLBACK" && provider === "gemini") {
        keyToUse = process.env.GEMINI_API_KEY || "";
        if (!keyToUse) {
          return res.status(400).json({ error: "Server fallback is enabled, but GEMINI_API_KEY is not configured on the backend server." });
        }
      }

      if (!keyToUse) {
        return res.status(400).json({ error: "API Key is required to test connection." });
      }

      if (provider === "openai") {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: {
            "Authorization": `Bearer ${keyToUse}`
          }
        });
        if (response.ok) {
          return res.json({ success: true, message: "OpenAI connection successful!" });
        } else {
          let errMsg = `Failed with status code ${response.status}`;
          try {
            const errData = await response.json();
            if (errData?.error?.message) {
              errMsg = errData.error.message;
            }
          } catch {}
          return res.status(400).json({ error: errMsg });
        }
      } else {
        // Default: Gemini - Free tier models
        const testModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
        let testSuccess = false;
        let lastTestError: any = null;

        const ai = new GoogleGenAI({ 
          apiKey: keyToUse,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        for (const tm of testModels) {
          try {
            const response = await ai.models.generateContent({
              model: tm,
              contents: "Hello"
            });
            if (response && response.text) {
              testSuccess = true;
              break;
            }
          } catch (err: any) {
            lastTestError = err;
            console.warn(`[Test Connection] Model ${tm} failed:`, err.message || err);
          }
        }

        if (testSuccess) {
          return res.json({ success: true, message: "Gemini connection successful!" });
        } else {
          return res.status(400).json({ error: lastTestError?.message || "Gemini connection failed." });
        }
      }
    } catch (err: any) {
      console.error("Test connection error:", err);
      return res.status(500).json({ error: err.message || "Failed to test connection." });
    }
  });

  function sanitizeZeroCharacterOutput(text: string): string {
    let sanitized = text.replace(/^[a-zA-Z0-9_\s\-]+:\s*"/gm, "");
    sanitized = sanitized.replace(/^[a-zA-Z0-9_\s\-]+:\s*/gm, "");
    sanitized = sanitized.replace(/"/g, "");
    sanitized = sanitized.replace(/“/g, "");
    sanitized = sanitized.replace(/”/g, "");
    return sanitized;
  }

  const allSupportedModels = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemma-4",
    "gemini-flash-latest"
  ];

  const sanitizeModelName = (name?: string): string => {
    if (!name) return "gemini-3.8-flash";
    const raw = name.trim().toLowerCase();
    if (allSupportedModels.includes(raw)) return raw;
    if (raw.includes("3.8")) return "gemini-3.8-flash";
    if (raw.includes("3.6")) return "gemini-3.6-flash";
    if (raw.includes("preview")) return "gemini-3-flash-preview";
    if (raw.includes("2.5-pro")) return "gemini-2.5-pro";
    if (raw.includes("2.5-flash-lite")) return "gemini-2.5-flash-lite";
    if (raw.includes("2.5")) return "gemini-2.5-flash";
    if (raw.includes("3.5-flash") || raw.includes("3.5") || raw.includes("lite")) return "gemini-3.5-flash-lite";
    if (raw.includes("3.1")) return "gemini-3.1-flash-lite";
    if (raw.includes("gemma")) return "gemma-4";
    return "gemini-3.8-flash";
  };

  
  // Streaming Chat Route
  app.post("/api/chat", async (req, res) => {
    let keepAliveInterval: any = null;
    try {
      const { message, messages, history, systemInstruction, customApiKey, customApiKeys, customApiProvider, samplers, linkedCharactersCount, selectedModel } = req.body;

      const apiKeysToTry = getApiKeysToTry(customApiKey, customApiKeys);

      if (apiKeysToTry.length === 0) {
        return res.status(400).json({
          error: "API Key missing. Please provide an API Key in Settings or set GEMINI_API_KEY."
        });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      res.write(": heartbeat\n\n");

      keepAliveInterval = setInterval(() => {
        if (!res.writableEnded) {
          try { res.write(": ping\n\n"); } catch {}
        }
      }, 10000);

      const config: any = {
        systemInstruction,
        temperature: samplers?.temperature !== undefined ? Number(samplers.temperature) : 0.8,
        topP: samplers?.topP !== undefined ? Number(samplers.topP) : undefined,
        maxOutputTokens: samplers?.generatedTokens !== undefined ? Number(samplers.generatedTokens) : 500,
        thinkingConfig: { thinkingBudget: 0 },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      };
      if (samplers?.presencePenalty !== undefined && !isNaN(Number(samplers.presencePenalty)) && Number(samplers.presencePenalty) !== 0) {
        config.presencePenalty = Number(samplers.presencePenalty);
      }
      if (samplers?.frequencyPenalty !== undefined && !isNaN(Number(samplers.frequencyPenalty)) && Number(samplers.frequencyPenalty) !== 0) {
        config.frequencyPenalty = Number(samplers.frequencyPenalty);
      }

      const cleanedContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      const historyList = (history && Array.isArray(history) && history.length > 0)
        ? history
        : (messages && Array.isArray(messages) ? messages : []);

      for (const item of historyList) {
        if (!item) continue;
        const text = item.text || item.content || (item.parts && item.parts[0]?.text) || "";
        if (typeof text !== 'string') continue;
        const trimmed = text.trim();
        if (!trimmed) continue;
        // Skip any saved error messages
        if (trimmed.startsWith('**Error:**') || trimmed.startsWith('Error:') || trimmed.startsWith('{ "error":') || trimmed.includes('All attempted API Keys')) {
          continue;
        }
        const isUserMsg = item.isUser === true || item.role === 'user';
        const role = isUserMsg ? "user" : "model";
        if (cleanedContents.length > 0 && cleanedContents[cleanedContents.length - 1].role === role) {
          cleanedContents[cleanedContents.length - 1].parts[0].text += "\n\n" + trimmed;
        } else {
          cleanedContents.push({
            role,
            parts: [{ text: trimmed }]
          });
        }
      }

      // If history starts with model (e.g. character initial greeting / scene opener),
      // prepend a user turn so contents always start with user without losing opening context
      if (cleanedContents.length > 0 && cleanedContents[0].role === "model") {
        cleanedContents.unshift({
          role: "user",
          parts: [{ text: "[Conversation begins / Scene starts]" }]
        });
      }

      // Append current user message safely
      if (message && typeof message === 'string' && message.trim()) {
        const trimmedMessage = message.trim();
        if (cleanedContents.length > 0 && cleanedContents[cleanedContents.length - 1].role === "user") {
          cleanedContents[cleanedContents.length - 1].parts[0].text += "\n\n" + trimmedMessage;
        } else {
          cleanedContents.push({ role: "user", parts: [{ text: trimmedMessage }] });
        }
      }

      // Guarantee cleanedContents has at least one valid turn and ends with a user turn
      if (cleanedContents.length === 0) {
        cleanedContents.push({
          role: "user",
          parts: [{ text: (typeof message === 'string' && message.trim()) ? message.trim() : "Hello" }]
        });
      } else if (cleanedContents[cleanedContents.length - 1].role === "model") {
        // If the conversation ends on an AI message (continuation/regeneration), provide a user prompt turn
        cleanedContents.push({
          role: "user",
          parts: [{ text: (typeof message === 'string' && message.trim()) ? message.trim() : "[Continue scene / Respond]" }]
        });
      }

      const mappedModel = sanitizeModelName(selectedModel);
      let primaryModel = mappedModel;
      if (lastWorkingModel && allSupportedModels.includes(lastWorkingModel)) {
        if (!selectedModel || mappedModel === lastWorkingModel) {
          primaryModel = lastWorkingModel;
        } else {
          primaryModel = mappedModel;
        }
      }

      const standardFallbacks = [
        "gemini-2.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite"
      ];
      const models = [primaryModel, ...standardFallbacks.filter(m => m !== primaryModel)];
      
      const useStreaming = samplers?.isStreaming !== false;
      const sortedKeys = sortApiKeys(apiKeysToTry);

      let success = false;
      let lastOverallError: any = null;
      for (let count = 0; count < sortedKeys.length; count++) {
        const apiKey = sortedKeys[count];
        getKeyStats(apiKey).lastUsed = Date.now();

        const ai = new GoogleGenAI({ 
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        let keySucceeded = false;
        let lastErrorOnKey = null;

        for (const modelName of models) {
          try {
            console.log(`[Chat API] Trying key ${maskKey(apiKey)} (attempt ${count + 1}/${sortedKeys.length}) with model ${modelName}...`);

            if (useStreaming) {
              const streamResponse = await ai.models.generateContentStream({
                model: modelName,
                contents: cleanedContents,
                config
              });
              
              let hasStreamedAnyText = false;
              for await (const chunk of streamResponse) {
                let text = "";
                try {
                  text = chunk.text || "";
                } catch (chunkErr) {
                  console.warn(`[Chat API] Warning reading stream chunk text:`, chunkErr);
                }
                if (text) {
                  if (linkedCharactersCount === 0) text = sanitizeZeroCharacterOutput(text);
                  res.write(`data: ${JSON.stringify({ text })}\n\n`);
                  if (typeof (res as any).flush === 'function') {
                    (res as any).flush();
                  }
                  hasStreamedAnyText = true;
                }
              }

              if (hasStreamedAnyText) {
                success = true;
                keySucceeded = true;
                markKeySuccess(apiKey, modelName);
                break;
              } else {
                console.warn(`[Chat API] Stream for ${modelName} emitted 0 text chunks. Attempting non-streaming fallback...`);
                const response = await ai.models.generateContent({
                  model: modelName,
                  contents: cleanedContents,
                  config
                });
                let text = response.text || "";
                if (text) {
                  if (linkedCharactersCount === 0) text = sanitizeZeroCharacterOutput(text);
                  res.write(`data: ${JSON.stringify({ text })}\n\n`);
                  success = true;
                  keySucceeded = true;
                  markKeySuccess(apiKey, modelName);
                  break;
                }
              }
            } else {
              const response = await ai.models.generateContent({
                model: modelName,
                contents: cleanedContents,
                config
              });
              let text = response.text || "";
              if (text) {
                if (linkedCharactersCount === 0) text = sanitizeZeroCharacterOutput(text);
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
                success = true;
                keySucceeded = true;
                markKeySuccess(apiKey, modelName);
                break;
              }
            }
          } catch (err: any) {
            console.error(`[Chat API] Error on key ${maskKey(apiKey)} with model ${modelName}:`, err.message || err);
            lastErrorOnKey = err;
            lastOverallError = err;

            const errMsg = (err.message || "").toLowerCase();
            const isInvalidKey = 
              errMsg.includes("api_key_invalid") || 
              errMsg.includes("key not valid") || 
              errMsg.includes("invalid key") || 
              errMsg.includes("unauthorized") ||
              errMsg.includes("api key not found") ||
              errMsg.includes("key has been deleted") ||
              errMsg.includes("invalid api key");

            if (isInvalidKey) {
              console.log(`[Chat API] Invalid key detected for ${maskKey(apiKey)}. Skipping remaining models for this key.`);
              markKeyError(apiKey, err);
              break; 
            } else {
              console.log(`[Chat API] Model ${modelName} encountered error/busy on key ${maskKey(apiKey)}. Automatically switching to next fallback model...`);
              markKeyError(apiKey, err);
              continue;
            }
          }
        }

        if (keySucceeded) {
          break;
        } else if (lastErrorOnKey) {
          markKeyError(apiKey, lastErrorOnKey);
        }
      }

      if (!success) {
        const detail = lastOverallError?.message || lastOverallError?.statusText || String(lastOverallError || "unknown error");
        const uniqueKeys = [...new Set(sortedKeys)];
        const keysTried = uniqueKeys.map(k => maskKey(k)).join(", ");
        console.error(`[Chat API] All keys/models failed. Unique keys tried: [${keysTried}]. Last error: ${detail}`);
        res.write(`data: ${JSON.stringify({ 
          error: `Service temporarily busy. Tap Continue or Regenerate to try again.` 
        })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("Chat streaming error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "An error occurred generating response." });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message || "Stream error occurred." })}\n\n`);
        res.end();
      }
    } finally {
      clearInterval(keepAliveInterval);
    }
  });

  // Phone Messaging Chat Route
  app.post("/api/phone-chat", async (req, res) => {
    let keepAliveInterval: any = null;
    try {
      const { message, messages, history, contactName, contactPersona, recentWorldChatHistory, worldLocation, customApiKey, customApiKeys, selectedModel, samplers } = req.body;
      const apiKeysToTry = getApiKeysToTry(customApiKey, customApiKeys);

      if (apiKeysToTry.length === 0) {
        return res.status(400).json({
          error: "API Key missing. Please provide an API Key in Settings or set GEMINI_API_KEY."
        });
      }

      const phoneSystemInstruction = `You are communicating through a smartphone instant messenger as ${contactName || 'Companion'}.

Companion Profile / Personality:
${contactPersona || 'A realistic companion communicating via text message.'}

[EPISTEMIC HORIZON & ANTI-TELEPATHY RULE]
- You are located at your own home/work/activity, NOT standing next to the user.
- You DO NOT possess telepathic or supernatural knowledge of what the user witnessed, saw, or did in other locations (e.g. seeing monsters/werewolves, finding items, fights, private thoughts) unless the user explicitly tells you in their text messages!
- If the user sends a text message about something crazy or sudden, react with natural human reactions (shock, confusion, skepticism, asking for clarification, concern) rather than acting like you already knew.

IMPORTANT TEXTING RULES:
- Reply fast, naturally, and casually like real people text on phones.
- Keep replies snappy and conversational (1 to 3 short sentences).
- If you have multiple short thoughts or separate texts, put an empty line (two newlines "\\n\\n") between them so each one has its own message bubble box!
- No narration, no scene descriptions, no actions, no asterisks (*action*), no quotation marks.
- Never mention holding/checking a phone or describe physical surroundings.
- Only output the direct text message content.
`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      res.write(": heartbeat\n\n");

      keepAliveInterval = setInterval(() => {
        if (!res.writableEnded) {
          try { res.write(": ping\n\n"); } catch {}
        }
      }, 10000);

      const config: any = {
        systemInstruction: phoneSystemInstruction,
        temperature: samplers?.temperature !== undefined ? Number(samplers.temperature) : 0.8,
        topP: samplers?.topP !== undefined ? Number(samplers.topP) : undefined,
        maxOutputTokens: samplers?.generatedTokens !== undefined ? Number(samplers.generatedTokens) : 250,
        thinkingConfig: { thinkingBudget: 0 },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      };
      if (samplers?.presencePenalty !== undefined && !isNaN(Number(samplers.presencePenalty)) && Number(samplers.presencePenalty) !== 0) {
        config.presencePenalty = Number(samplers.presencePenalty);
      }
      if (samplers?.frequencyPenalty !== undefined && !isNaN(Number(samplers.frequencyPenalty)) && Number(samplers.frequencyPenalty) !== 0) {
        config.frequencyPenalty = Number(samplers.frequencyPenalty);
      }

      const cleanedContents: any[] = [];
      const historyList = (history && Array.isArray(history) && history.length > 0)
        ? history
        : (messages && Array.isArray(messages) ? messages : []);

      for (const item of historyList) {
        if (!item) continue;
        const text = item.text || item.content || (item.parts && item.parts[0]?.text) || "";
        if (typeof text !== 'string') continue;
        const trimmed = text.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('**Error:**') || trimmed.startsWith('Error:') || trimmed.startsWith('{ "error":') || trimmed.includes('All attempted API Keys')) {
          continue;
        }
        const isUserMsg = item.isUser === true || item.role === 'user';
        const role = isUserMsg ? "user" : "model";
        if (cleanedContents.length > 0 && cleanedContents[cleanedContents.length - 1].role === role) {
          cleanedContents[cleanedContents.length - 1].parts[0].text += "\n\n" + trimmed;
        } else {
          cleanedContents.push({
            role,
            parts: [{ text: trimmed }]
          });
        }
      }

      if (cleanedContents.length > 0 && cleanedContents[0].role === "model") {
        cleanedContents.unshift({
          role: "user",
          parts: [{ text: "[Texting conversation starts]" }]
        });
      }

      if (message && typeof message === 'string' && message.trim()) {
        const trimmedMessage = message.trim();
        if (cleanedContents.length > 0 && cleanedContents[cleanedContents.length - 1].role === "user") {
          cleanedContents[cleanedContents.length - 1].parts[0].text += "\n\n" + trimmedMessage;
        } else {
          cleanedContents.push({ role: "user", parts: [{ text: trimmedMessage }] });
        }
      }

      if (cleanedContents.length === 0) {
        cleanedContents.push({
          role: "user",
          parts: [{ text: (typeof message === 'string' && message.trim()) ? message.trim() : "Hey" }]
        });
      } else if (cleanedContents[cleanedContents.length - 1].role === "model") {
        cleanedContents.push({
          role: "user",
          parts: [{ text: (typeof message === 'string' && message.trim()) ? message.trim() : "[Continue]" }]
        });
      }

      const mappedModel = sanitizeModelName(selectedModel);
      let primaryModel = mappedModel;
      if (lastWorkingModel && allSupportedModels.includes(lastWorkingModel)) {
        if (!selectedModel || mappedModel === lastWorkingModel || mappedModel === "gemini-3.5-flash-lite") {
          primaryModel = lastWorkingModel;
        } else {
          primaryModel = mappedModel;
        }
      }

      const standardFallbacks = [
        "gemini-2.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite"
      ];
      const models = [primaryModel, ...standardFallbacks.filter(m => m !== primaryModel)];
      
      const useStreaming = samplers?.isStreaming !== false;
      const sortedKeys = sortApiKeys(apiKeysToTry);
      let success = false;
      let lastOverallError: any = null;

      for (let count = 0; count < sortedKeys.length; count++) {
        const apiKey = sortedKeys[count];
        getKeyStats(apiKey).lastUsed = Date.now();

        const ai = new GoogleGenAI({ 
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        let keySucceeded = false;
        let lastErrorOnKey: any = null;

        for (const modelName of models) {
          try {
            console.log(`[Chat API] Trying key ${maskKey(apiKey)} (attempt ${count + 1}/${sortedKeys.length}) with model ${modelName}...`);

            if (useStreaming) {
              const streamResponse = await ai.models.generateContentStream({
                model: modelName,
                contents: cleanedContents,
                config
              });
              
              let hasStreamedAnyText = false;
              for await (const chunk of streamResponse) {
                let text = "";
                try {
                  text = chunk.text || "";
                } catch (chunkErr) {
                  console.warn(`[Phone Chat API] Warning reading chunk text:`, chunkErr);
                }
                if (text) {
                  res.write(`data: ${JSON.stringify({ text })}\n\n`);
                  if (typeof (res as any).flush === 'function') {
                    (res as any).flush();
                  }
                  hasStreamedAnyText = true;
                }
              }

              if (hasStreamedAnyText) {
                success = true;
                keySucceeded = true;
                markKeySuccess(apiKey, modelName);
                break;
              } else {
                console.warn(`[Chat API] Stream for ${modelName} emitted 0 text chunks. Attempting non-streaming fallback...`);
                const response = await ai.models.generateContent({
                  model: modelName,
                  contents: cleanedContents,
                  config
                });
                let text = response.text || "";
                if (text) {
                  res.write(`data: ${JSON.stringify({ text })}\n\n`);
                  success = true;
                  keySucceeded = true;
                  markKeySuccess(apiKey, modelName);
                  break;
                }
              }
            } else {
              const response = await ai.models.generateContent({
                model: modelName,
                contents: cleanedContents,
                config
              });
              let text = response.text || "";
              if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
                success = true;
                keySucceeded = true;
                markKeySuccess(apiKey, modelName);
                break;
              }
            }
          } catch (err: any) {
            console.error(`[PhoneChat API] Error on key ${maskKey(apiKey)} with model ${modelName}:`, err.message || err);
            lastErrorOnKey = err;
            lastOverallError = err;

            const errMsg = (err.message || "").toLowerCase();
            const isInvalidKey = 
              errMsg.includes("api_key_invalid") || 
              errMsg.includes("key not valid") || 
              errMsg.includes("invalid key") || 
              errMsg.includes("unauthorized") ||
              errMsg.includes("api key not found") ||
              errMsg.includes("key has been deleted") ||
              errMsg.includes("invalid api key");

            if (isInvalidKey) {
              console.log(`[PhoneChat API] Invalid key detected for ${maskKey(apiKey)}. Skipping remaining models for this key.`);
              markKeyError(apiKey, err);
              break;
            } else {
              console.log(`[PhoneChat API] Model ${modelName} encountered error/busy on key ${maskKey(apiKey)}. Automatically switching to next fallback model...`);
              markKeyError(apiKey, err);
              continue;
            }
          }
        }
        if (keySucceeded) {
          break;
        } else if (lastErrorOnKey) {
          markKeyError(apiKey, lastErrorOnKey);
        }
      }

      if (!success) {
        const detail = lastOverallError?.message || lastOverallError?.statusText || String(lastOverallError || "unknown error");
        const uniqueKeys = [...new Set(sortedKeys)];
        const keysTried = uniqueKeys.map(k => maskKey(k)).join(", ");
        console.error(`[PhoneChat API] All keys/models failed. Unique keys tried: [${keysTried}]. Last error: ${detail}`);
        res.write(`data: ${JSON.stringify({ 
          error: `Service temporarily busy. Tap Continue or Regenerate to try again.` 
        })}\n\n`);
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("Chat streaming error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "An error occurred generating response." });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message || "Stream error occurred." })}\n\n`);
        res.end();
      }
    } finally {
      clearInterval(keepAliveInterval);
    }
  });

  // Scene & World Analyzer Route
  app.post("/api/detect-scene", async (req, res) => {
    try {
      const { 
        message, 
        userMessage, 
        characterName, 
        worldName, 
        places, 
        ambientSounds, 
        currentCalendar, 
        currentLocation, 
        currentWeather, 
        currentReputation, 
        currentRelationships, 
        characters,
        customApiKey, 
        customApiKeys,
        characterState
      } = req.body;

      const apiKeysToTry = getApiKeysToTry(customApiKey, customApiKeys);

      if (apiKeysToTry.length === 0) {
        return res.json({ 
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
        });
      }

      const placesList = (places || []).map((p: any) => `- Name: "${p.name}", Trigger script/description: "${p.triggerDescription || ''}"`).join("\n");
      const ambientsList = (ambientSounds || []).map((s: any) => `- Name: "${s.name}", Trigger script/description: "${s.triggerDescription || ''}"`).join("\n");

      const charactersList = (characters && Array.isArray(characters) && characters.length > 0)
        ? characters.map((c: any) => `- ID: "${c.id}", Name: "${c.name}", Current Feelings toward User: ${JSON.stringify(c.currentRelationships || {})}`).join("\n")
        : `- ID: "default", Name: "${characterName || 'Companion'}", Current Feelings toward User: ${JSON.stringify(currentRelationships || {})}`;

      const previousStateStr = characterState ? JSON.stringify(characterState) : "{}";

      const systemInstruction = `You are the Background World Engine for an AI roleplay application.
You NEVER roleplay or speak. You ONLY maintain the persistent world in the background based on the User's message and the Character's response.

CORE PRINCIPLES:
1. Realism & Human Stamina: Normal conversations, casual walking, sitting, or everyday dialogue barely drain energy (at most 0 to 1 point or stay identical). Humans do NOT collapse or pass out from ordinary roleplay.
2. Realistic Status Calibration: Keep vital stats (health, energy, hunger, thirst, hygiene, mood) healthy, resilient, and stable (typically in the 70-100 range).
3. Status Recovery: Resting, sleeping, or relaxing easily restores Energy and Health back to 90-100. Eating or drinking restores Hunger and Thirst back to 90-100. Bathing/washing restores Hygiene to 95-100.
4. Floor & Safety: NEVER drain any stat into the 0-30 range unless the user explicitly narrated a mortal trauma in their own words. NEVER force passing out, fainting, or incapacitation.
5. Time System: Time moves naturally based on actions (e.g. sleep ~8h, travel ~1-2h, workouts/intimacy ~1h).

Current World Context:
- World: "${worldName || 'Active World'}"
- Characters Present:
${charactersList}
- Current Calendar/Time: "${currentCalendar || 'Spring - Afternoon'}"
- Current Location: "${currentLocation || 'Unspecified'}"
- Current Weather: "${currentWeather || 'Clear'}"

Current Player State (Previous):
${previousStateStr}

Available Places in World:
${placesList || "(None defined)"}

Available Ambient Soundscapes:
${ambientsList || "(None defined)"}

UPDATE RULES:
- Return "no_change" for calendar, location, weather, ambient, and place if they did not naturally change.
- characterState: update status, inventory, appearance, phone, longterm, and pregnancy realistically based on Previous State.
- keyMemory: if a new key factual revelation, secret, promise, name introduction, or major milestone occurred, summarize it in one concise factual sentence (e.g., "User introduced themselves as Elena's childhood friend", "Agreed to investigate the haunted tower together"). Return "none" if nothing major occurred.
`;

      const modelsToTry = [
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-flash-latest"
      ];
      const sortedKeys = sortApiKeys(apiKeysToTry);
      let success = false;
      let responseText = "";

      for (let count = 0; count < sortedKeys.length; count++) {
        const apiKey = sortedKeys[count];
        // Track use
        getKeyStats(apiKey).lastUsed = Date.now();

        const ai = new GoogleGenAI({ 
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        let keySucceeded = false;
        let lastErrorOnKey: any = null;
        for (const modelName of modelsToTry) {
          try {
            console.log(`[Analyzer API] Trying key ${maskKey(apiKey)} (attempt ${count + 1}/${sortedKeys.length}) with model ${modelName}...`);
            const response = await ai.models.generateContent({
              model: modelName,
              contents: `User message: "${userMessage || ''}"\nCharacter response: "${message || ''}"`,
              config: {
                systemInstruction,
                temperature: 0.2,
                responseMimeType: "application/json",
                safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
                ],
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    sceneMood: { type: Type.STRING },
                    place: { type: Type.STRING },
                    ambient: { type: Type.STRING },
                    calendar: { type: Type.STRING },
                    location: { type: Type.STRING },
                    weather: { type: Type.STRING },
                    keyMemory: { type: Type.STRING },
                    targetCharacterId: { type: Type.STRING },
                    targetCharacterName: { type: Type.STRING },
                    characterState: {
                      type: Type.OBJECT,
                      properties: {
                        status: {
                          type: Type.OBJECT,
                          properties: {
                            health: { type: Type.INTEGER },
                            hunger: { type: Type.INTEGER },
                            thirst: { type: Type.INTEGER },
                            energy: { type: Type.INTEGER },
                            hygiene: { type: Type.INTEGER },
                            mood: { type: Type.INTEGER },
                            arousal: { type: Type.INTEGER }
                          },
                          required: ["health", "hunger", "thirst", "energy", "hygiene", "mood", "arousal"]
                        },
                        inventory: {
                          type: Type.OBJECT,
                          properties: {
                            money: { type: Type.INTEGER },
                            items: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING }
                            }
                          },
                          required: ["money", "items"]
                        },
                        appearance: {
                          type: Type.OBJECT,
                          properties: {
                            outfit: { type: Type.STRING },
                            accessories: { type: Type.STRING },
                            hairstyle: { type: Type.STRING },
                            makeup: { type: Type.STRING }
                          },
                          required: ["outfit", "accessories", "hairstyle", "makeup"]
                        },
                        phone: {
                          type: Type.OBJECT,
                          properties: {
                            notifications: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING }
                            },
                            isAccessible: { type: Type.BOOLEAN },
                            accessBlockedReason: { type: Type.STRING }
                          }
                        },
                        longterm: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              title: { type: Type.STRING },
                              description: { type: Type.STRING },
                              severity: { type: Type.STRING },
                              type: { type: Type.STRING }
                            }
                          }
                        },
                        pregnancy: {
                          type: Type.OBJECT,
                          properties: {
                            status: { type: Type.STRING },
                            weeks: { type: Type.INTEGER },
                            father: { type: Type.STRING },
                            symptoms: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING }
                            },
                            protectionUsed: { type: Type.STRING }
                          }
                        }
                      }
                    }
                  },
                  required: ["sceneMood", "place", "ambient", "calendar", "location", "weather"]
                }
              }
            });
            responseText = response.text || "";
            if (responseText.trim().length > 0) {
              success = true;
              keySucceeded = true;
              markKeySuccess(apiKey);
              break;
            }
          } catch (err: any) {
            console.error(`[Analyzer API] Error on key ${maskKey(apiKey)} with model ${modelName}:`, err.message || err);
            lastErrorOnKey = err;

            const errMsg = (err.message || "").toLowerCase();
            const is503HighDemand = errMsg.includes("503") || 
                                    errMsg.includes("unavailable") || 
                                    errMsg.includes("high demand") || 
                                    err?.status === 503 || 
                                    err?.code === 503;

            if (is503HighDemand) {
              console.log(`[Analyzer API] Model ${modelName} is temporarily unavailable (503). Trying next model fallback...`);
              continue;
            }

            const isInvalidKey = 
              errMsg.includes("api_key_invalid") || 
              errMsg.includes("key not valid") || 
              errMsg.includes("invalid key") || 
              errMsg.includes("unauthorized") ||
              errMsg.includes("api key not found") ||
              errMsg.includes("key has been deleted") ||
              errMsg.includes("invalid api key");

            if (isInvalidKey) {
              console.log(`[Analyzer API] Invalid key detected for ${maskKey(apiKey)}. Skipping remaining models for this key.`);
              markKeyError(apiKey, err);
              break; // Break the model loop to try the next API key
            }
          }
        }
        if (keySucceeded) {
          break;
        } else if (lastErrorOnKey) {
          markKeyError(apiKey, lastErrorOnKey);
        }
      }

      if (!success || !responseText.trim()) {
        console.warn("[Analyzer API] World state analysis skipped/unsuccessful. Returning default no-change response.");
        return res.json({ 
          success: true, 
          sceneMood: "Calm",
          place: "no_change", 
          ambient: "no_change",
          calendar: "no_change",
          location: "no_change",
          weather: "no_change",
          characterState: null
        });
      }

      let cleanText = responseText.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
      }

      let result: any = {};
      try {
        const match = cleanText.match(/\{[\s\S]*\}/);
        if (match) {
          result = JSON.parse(match[0]);
        } else {
          result = JSON.parse(cleanText);
        }
      } catch (parseErr: any) {
        console.warn("[Analyzer API] Could not parse JSON response from AI. Using fallback defaults:", cleanText);
        result = {};
      }

      if (result.characterState && result.characterState.status) {
        const s = result.characterState.status;
        s.health = Math.min(100, Math.max(50, typeof s.health === 'number' ? s.health : 100));
        s.energy = Math.min(100, Math.max(45, typeof s.energy === 'number' ? s.energy : 85));
        s.hunger = Math.min(100, Math.max(40, typeof s.hunger === 'number' ? s.hunger : 90));
        s.thirst = Math.min(100, Math.max(40, typeof s.thirst === 'number' ? s.thirst : 90));
        s.hygiene = Math.min(100, Math.max(40, typeof s.hygiene === 'number' ? s.hygiene : 95));
        s.mood = Math.min(100, Math.max(40, typeof s.mood === 'number' ? s.mood : 85));
        s.arousal = Math.min(100, Math.max(0, typeof s.arousal === 'number' ? s.arousal : 10));
      }

      return res.json({ 
        success: true, 
        sceneMood: result.sceneMood || "Calm",
        place: result.place || "no_change", 
        ambient: result.ambient || "no_change",
        calendar: result.calendar || "no_change",
        location: result.location || "no_change",
        weather: result.weather || "no_change",
        targetCharacterId: result.targetCharacterId,
        targetCharacterName: result.targetCharacterName,
        characterState: result.characterState
      });
    } catch (err: any) {
      console.error("Detect scene fallback error:", err);
      return res.json({ 
        success: true, 
        sceneMood: "Calm",
        place: "no_change", 
        ambient: "no_change",
        calendar: "no_change",
        location: "no_change",
        weather: "no_change",
        characterState: null
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Vsen.Ai server running on http://localhost:${PORT}`);
  });
}

startServer();
