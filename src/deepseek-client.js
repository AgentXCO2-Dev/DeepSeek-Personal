import axios from 'axios';
import { config } from './config.js';
import { moderateUserInput, moderateAIOutput, getSafetySystemPrompt } from './guardrails.js';

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
// MAIN CHAT COMPLETION (WITH GUARDRAILS)
// ============================

export async function chatCompletion(messages, thinking = true, reasoningEffort = 'high') {
  // 1. Check the user's last message (the last user message in the array)
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  if (lastUserMsg && lastUserMsg.content) {
    try {
      moderateUserInput(lastUserMsg.content);
    } catch (error) {
      if (error.code === 'SAFETY_VIOLATION') {
        // Return a safe response instead of calling the AI
        return "I can't help with that request. Let's keep our conversation respectful and safe. 🙏";
      }
      throw error;
    }
  }

  // 2. Inject safety system prompt (merge with existing system prompt)
  const safetyPrompt = getSafetySystemPrompt();
  let systemMsg = messages.find(m => m.role === 'system');
  if (systemMsg) {
    systemMsg.content = safetyPrompt + '\n\n' + systemMsg.content;
  } else {
    // If no system prompt, add one
    messages.unshift({ role: 'system', content: safetyPrompt });
  }

  // 3. Try Groq with multi-key rotation and retry
  try {
    const response = await callGroqWithRetry(messages);
    // 4. Moderate the AI output
    const safeResponse = moderateAIOutput(response);
    return safeResponse;
  } catch (error) {
    // If Groq fails, re-throw (no fallback)
    throw error;
  }
}

// ============================
// GROQ IMPLEMENTATION (MULTI-KEY)
// ============================

async function callGroqWithRetry(messages) {
  let lastError = null;
  const maxRetries = 3;

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
        continue;
      }
      
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
