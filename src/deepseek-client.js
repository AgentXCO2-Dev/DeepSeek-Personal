import axios from 'axios';
import { config } from './config.js';

// ============================
// HELPERS
// ============================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Key rotation state
let currentKeyIndex = 0;

function getNextGroqKey() {
  if (config.groqApiKeys.length === 0) {
    throw new Error('❌ No Groq API keys configured. Please set GROQ_API_KEY, GROQ_API_KEY1, etc.');
  }
  const key = config.groqApiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % config.groqApiKeys.length;
  return key;
}

// ============================
// MAIN CHAT COMPLETION
// ============================

export async function chatCompletion(messages, thinking = true, reasoningEffort = 'high') {
  // Try Groq with multi-key rotation and retry
  return await callGroqWithRetry(messages);
}

// ============================
// GROQ IMPLEMENTATION (MULTI-KEY)
// ============================

async function callGroqWithRetry(messages) {
  let lastError = null;
  const maxRetries = 3;

  // Try each key at most maxRetries times (rotate on 429)
  for (let attempt = 0; attempt < config.groqApiKeys.length * maxRetries; attempt++) {
    const apiKey = getNextGroqKey();
    try {
      return await callGroq(messages, apiKey);
    } catch (error) {
      const status = error.response?.status;
      const retryAfter = parseInt(error.response?.headers?.['retry-after'] || '1000');
      
      if (status === 429) {
        console.log(`⏳ Rate limit on key. Waiting ${retryAfter}ms before retry... (attempt ${attempt+1})`);
        await sleep(retryAfter);
        // Continue loop to try next key
        continue;
      }
      
      // Non‑rate-limit error – re-throw
      throw error;
    }
  }

  throw new Error('❌ All Groq keys exhausted or rate limited. Please try again later.');
}

async function callGroq(messages, apiKey) {
  // Extract system prompt (if any)
  let systemPrompt = '';
  const filteredMessages = messages.filter(msg => {
    if (msg.role === 'system') {
      systemPrompt = msg.content;
      return false;
    }
    return true;
  });

  const groqMessages = [];
  if (systemPrompt) {
    groqMessages.push({ role: 'system', content: systemPrompt });
  }
  filteredMessages.forEach(msg => {
    groqMessages.push({ role: msg.role, content: msg.content });
  });

  const payload = {
    model: 'llama-3.3-70b-versatile',
    messages: groqMessages,
    temperature: 0.7,
    max_tokens: 8192,
    top_p: 0.95,
    stream: false,
  };

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 60000,
    }
  );

  const content = response.data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from Groq');
  }
  return content;
}
