import { Handler, stream } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";
import { randomUUID, createHash } from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

interface RateLimit {
  minute: number;
  minuteReset: number;
  burst: number;
  burstReset: number;
  daily: number;
  dailyReset: number;
  recentHashes: Map<string, number>;
}

const rateLimits = new Map<string, RateLimit>();
const cache = new Map<string, { data: any; expiry: number }>();
const MAX_CACHE_ENTRIES = 100;
const CACHE_TTL_MS = 120000;
const MAX_PROMPT_LENGTH = 20000; // Characters

// @ts-ignore
export const handler: Handler = stream(async (event, context) => {
  const requestId = randomUUID();
  const timestamp = new Date().toISOString();
  const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"] || "unknown";

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "Method Not Allowed", requestId, timestamp }),
    };
  }

  const now = Date.now();
  const limitKey = `${ip}-gemini`;
  let limit = rateLimits.get(limitKey);

  if (!limit) {
    limit = {
      minute: 0, minuteReset: now + 60000,
      burst: 0, burstReset: now + 5000,
      daily: 0, dailyReset: now + 86400000,
      recentHashes: new Map()
    };
    rateLimits.set(limitKey, limit);
  }

  if (now > limit.minuteReset) { limit.minute = 0; limit.minuteReset = now + 60000; }
  if (now > limit.burstReset) { limit.burst = 0; limit.burstReset = now + 5000; }
  if (now > limit.dailyReset) { limit.daily = 0; limit.dailyReset = now + 86400000; }

  limit.minute++;
  limit.burst++;
  limit.daily++;

  // Cleanup map memory gracefully
  if (Math.random() < 0.05) {
    for (const [k, v] of rateLimits.entries()) if (now > v.dailyReset) rateLimits.delete(k);
    for (const [k, v] of cache.entries()) if (now > v.expiry) cache.delete(k);
    
    if (cache.size > MAX_CACHE_ENTRIES) {
      const keys = Array.from(cache.keys());
      for (let i = 0; i < keys.length - MAX_CACHE_ENTRIES; i++) cache.delete(keys[i]);
    }
  }

  if (limit.burst > 10 || limit.minute > 60 || limit.daily > 2000) {
    console.warn(`[${timestamp}] [${requestId}] Rate limit exceeded for IP: ${ip}`);
    return {
      statusCode: 429,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "Rate limit exceeded", requestId, timestamp }),
    };
  }

  try {
    const contentType = event.headers["content-type"] || "";
    if (!contentType.includes("application/json")) {
       return {
         statusCode: 400,
         headers: corsHeaders,
         body: JSON.stringify({ success: false, error: "Content-Type must be application/json", requestId, timestamp })
       };
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (err) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: "Invalid JSON", requestId, timestamp }),
      };
    }

    const { prompt, model = "gemini-3.1-flash-lite-preview", contents, config } = body;
    const isStream = event.queryStringParameters?.stream === "true";

    if (!prompt || typeof prompt !== "string") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: "Prompt is required", requestId, timestamp }),
      };
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
       console.warn(`[${timestamp}] [${requestId}] Prompt length too long (${prompt.length} chars) from IP: ${ip}`);
       return {
         statusCode: 400,
         headers: corsHeaders,
         body: JSON.stringify({ success: false, error: "Prompt too long (exceeds 20000 characters)", requestId, timestamp })
       };
    }

    // Hash prompt for duplication check (Spam protection)
    const promptHash = createHash('sha256').update(prompt).digest('hex');
    const recentHashCount = limit.recentHashes.get(promptHash) || 0;
    if (recentHashCount > 5) {
       console.warn(`[${timestamp}] [${requestId}] Spam detected from IP: ${ip}`);
       return {
         statusCode: 429,
         headers: corsHeaders,
         body: JSON.stringify({ success: false, error: "Too many duplicate requests. Please wait.", requestId, timestamp })
       };
    }
    limit.recentHashes.set(promptHash, recentHashCount + 1);
    setTimeout(() => {
       const cnt = limit?.recentHashes.get(promptHash);
       if (cnt && cnt > 1) limit?.recentHashes.set(promptHash, cnt - 1);
       else limit?.recentHashes.delete(promptHash);
    }, 60000); // Clear hash mem after 1 min

    console.log(`[${timestamp}] [${requestId}] IP: ${ip} | Model: ${model} | Stream: ${isStream} | Prompt hash: ${promptHash.slice(0,8)} | Length: ${prompt.length}`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error(`[${timestamp}] [${requestId}] GEMINI_API_KEY is not configured`);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: "Server configuration missing", requestId, timestamp }),
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const apiContents = contents || [{ role: "user", parts: [{ text: prompt }] }];

    const cacheKey = JSON.stringify({ model, contents: apiContents, config });
    if (!isStream) {
       const cached = cache.get(cacheKey);
       if (cached && now < cached.expiry) {
          console.log(`[${timestamp}] [${requestId}] Cache hit`);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ success: true, ...cached.data, requestId, timestamp })
          };
       }
    }

    const fetchWithRetry = async (retries = 2) => {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 15000);

      try {
        if (isStream) {
          return await ai.models.generateContentStream({
            model,
            contents: apiContents,
            config
          });
        } else {
          return await ai.models.generateContent({
            model,
            contents: apiContents,
            config
          });
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (retries > 0) {
          console.warn(`[${timestamp}] [${requestId}] Retrying API call... attempts left: ${retries - 1}`);
          return fetchWithRetry(retries - 1);
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    if (isStream) {
      const streamResult = await fetchWithRetry() as any;
      const encoder = new TextEncoder();
      
      const readable = new ReadableStream({
        async start(controller) {
          // Heartbeat to prevent connection dropping
          const heartbeat = setInterval(() => {
             try { controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`)); } catch {}
          }, 15000);

          try {
            for await (const chunk of streamResult) {
               const chunkData = {
                  response: chunk.text || "",
                  groundingMetadata: chunk.candidates?.[0]?.groundingMetadata
               };
               controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
            }
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          } catch (err: any) {
            console.error(`[${timestamp}] [${requestId}] Stream error:`, err);
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: err.message || "Stream interrupted" })}\n\n`));
          } finally {
            clearInterval(heartbeat);
            controller.close();
          }
        }
      });

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        },
        body: readable
      };
    } else {
      const result = await fetchWithRetry() as any;
      const data = {
         response: result.text || "",
         groundingMetadata: result.candidates?.[0]?.groundingMetadata 
      };

      cache.set(cacheKey, { data, expiry: now + CACHE_TTL_MS });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, data, requestId, timestamp })
      };
    }

  } catch (error: any) {
    console.error(`[${timestamp}] [${requestId}] Gemini API Error:`, error.message || error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "Google Gemini API Error: " + (error.message || "Unknown error"), requestId, timestamp }),
    };
  }
});
