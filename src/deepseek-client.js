import axios from 'axios';
import { config } from './config.js';

export async function chatCompletion(messages, thinking = true, reasoningEffort = 'high') {
  try {
    const response = await axios.post(
      `${config.deepseekBaseUrl}/chat/completions`,
      {
        model: config.deepseekModel,
        messages,
        thinking: { type: thinking ? 'enabled' : 'disabled' },
        reasoning_effort: reasoningEffort,
        stream: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.deepseekApiKey}`,
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek API error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'DeepSeek API request failed');
  }
}
