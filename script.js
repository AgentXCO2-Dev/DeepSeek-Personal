const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const userIdInput = document.getElementById('user-id');
const passwordInput = document.getElementById('api-password');

// CHANGE THIS when you deploy!
const API_BASE = 'https://deepseek-personal.onrender.com/api';

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  const userId = userIdInput.value.trim() || 'twin1';
  const password = passwordInput.value.trim();

  if (!password) {
    appendMessage('system', '⚠️ Please enter your API password first!');
    return;
  }

  messageInput.disabled = true;
  sendBtn.disabled = true;
  appendMessage('user', message);
  messageInput.value = '';

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-password': password,
      },
      body: JSON.stringify({
        user_id: userId,
        message: message,
        thinking: true,
        reasoning_effort: 'high',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    appendMessage('ai', data.response);
    if (data.memory_used) {
      appendMessage('system', '🧠 Memory used!');
    }
  } catch (error) {
    appendMessage('ai', `❌ Error: ${error.message}`);
  } finally {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function appendMessage(type, content) {
  const div = document.createElement('div');
  div.classList.add('message');
  if (type === 'user') div.classList.add('user-message');
  else if (type === 'ai') div.classList.add('ai-message');
  else div.classList.add('system-message');
  div.textContent = content;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

setTimeout(() => {
  appendMessage('ai', "Hey twin! 💖 I'm your password‑protected AI. Enter your password above, then ask me anything! I remember everything we discuss.");
}, 300);
