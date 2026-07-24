import axios from 'axios';
import { config } from './config.js';

export async function chatCompletion(messages, thinking = true, reasoningEffort = 'high') {
  try {
    // Extract system prompt if it exists
    let systemPrompt = '';
    const filteredMessages = messages.filter(msg => {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
        return false;
      }
      return true;
    });

    // Format messages for Groq (OpenAI-compatible)
    const groqMessages = [];
    
    // Add system prompt as a system message
    if (systemPrompt) {
      groqMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Add the rest of the messages
    filteredMessages.forEach(msg => {
      groqMessages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Choose model – 'llama-3.3-70b-versatile' is super smart and free!
    const payload = {
      model: 'llama-3.3-70b-versatile', // or 'llama-3.1-8b-instant' for faster responses
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
          'Authorization': `Bearer ${config.groqApiKey}`,
        },
        timeout: 60000, // 60 second timeout
      }
    );

    // Extract the response text
    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Groq');
    }
    return content;
  } catch (error) {
    console.error('Groq API error:', error.response?.data || error.message);
    
    // Better error messages
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (error.response?.status === 401) {
      throw new Error('Invalid API key. Please check your Groq API key in environment variables.');
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    
    throw new Error(error.response?.data?.error?.message || error.message || 'Groq API request failed');
  }
}
