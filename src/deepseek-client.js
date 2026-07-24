import axios from 'axios';
import { config } from './config.js';
import { moderateUserInput, moderateAIOutput, getSafetySystemPrompt } from './guardrails.js';

// ============================
// HELPERS
// ============================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================
// MAIN CHAT COMPLETION (WITH GUARDRAILS)
// ============================

export async function chatCompletion(messages, thinking = true, reasoningEffort = 'high') {
  // 1. Check the user's last message for safety violations
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  if (lastUserMsg && lastUserMsg.content) {
    try {
      moderateUserInput(lastUserMsg.content);
    } catch (error) {
      if (error.code === 'SAFETY_VIOLATION') {
        return "I can't help with that request. Let's keep our conversation respectful and safe. 🙏";
      }
      throw error;
    }
  }

  // 2. Inject safety system prompt into the messages
  const safetyPrompt = getSafetySystemPrompt();
  let systemMsg = messages.find(m => m.role === 'system');
  if (systemMsg) {
    systemMsg.content = safetyPrompt + '\n\n' + systemMsg.content;
  } else {
    messages.unshift({ role: 'system', content: safetyPrompt });
  }

  // 3. Call Mistral with retry logic
  try {
    const response = await callMistralWithRetry(messages);
    // 4. Moderate the AI output
    const safeResponse = moderateAIOutput(response);
    return safeResponse;
  } catch (error) {
    console.error('Mistral API error:', error.message);
    throw error;
  }
}

// ============================
// MISTRAL IMPLEMENTATION (WITH RETRY)
// ============================

async function callMistralWithRetry(messages, retries = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await callMistral(messages);
    } catch (error) {
      const status = error.response?.status;
      const retryAfter = parseInt(error.response?.headers?.['retry-after'] || '5000');
      
      if (status === 429) {
        console.log(`⏳ Mistral rate limited (attempt ${attempt + 1}/${retries}). Waiting ${retryAfter}ms...`);
        await sleep(retryAfter);
        continue;
      }
      
      // Non‑rate‑limit errors – throw immediately
      throw error;
    }
  }
  throw new Error('❌ Mistral rate limit exceeded. Please try again later.');
}

async function callMistral(messages) {
  if (!config.mistralApiKey) {
    throw new Error('❌ MISTRAL_API_KEY not configured. Please add it to your environment variables.');
  }

  // Extract system prompt (if any)
  let systemPrompt = '';
  const filteredMessages = messages.filter(msg => {
    if (msg.role === 'system') {
      systemPrompt = msg.content;
      return false;
    }
    return true;
  });

  // Format messages for Mistral (OpenAI‑compatible format)
  const mistralMessages = [];
  if (systemPrompt) {
    mistralMessages.push({ role: 'system', content: systemPrompt });
  }
  filteredMessages.forEach(msg => {
    mistralMessages.push({ role: msg.role, content: msg.content });
  });

  // Mistral API payload – using the free-tier model
  const payload = {
    model: 'mistral-small-latest',  // ✅ Free tier model – 1B tokens/month!
    messages: mistralMessages,
    temperature: 0.7,
    max_tokens: 8192,
    top_p: 0.95,
    stream: false,
  };

  try {
    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',  // ✅ Correct endpoint
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.mistralApiKey}`,
        },
        timeout: 60000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Mistral');
    }
    return content;
  } catch (error) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    const errorMessage = errorData?.error?.message || error.message;

    // Detailed error logging
    console.error('Mistral API error details:', {
      status,
      error: errorData,
      message: errorMessage,
    });

    // Handle specific HTTP status codes
    if (status === 401 || status === 403) {
      throw new Error(
        '❌ Invalid Mistral API key (401/403). Please verify your key at console.mistral.ai'
      );
    }

    if (status === 429) {
      throw new Error(
        `❌ Mistral rate limit exceeded. Retry after ${error.response?.headers?.['retry-after'] || 'a few seconds'}.`
      );
    }

    if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('credit')) {
      throw new Error(
        '❌ Mistral quota exhausted. Your free 1B tokens might be used up. Check your usage at console.mistral.ai'
      );
    }

    // Generic fallback
    throw new Error(`Mistral API error: ${errorMessage}`);
  }
}
