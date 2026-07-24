// ===== CONFIG =====
const API_BASE = 'https://deepseek-personal.onrender.com/api'; // CHANGE TO YOUR BACKEND URL
const USER_ID = 'twin1';

// ===== DOM REFS =====
const passwordScreen = document.getElementById('password-screen');
const app = document.getElementById('app');
const passwordInput = document.getElementById('password-input');
const passwordBtn = document.getElementById('password-btn');
const passwordError = document.getElementById('password-error');

const chatList = document.getElementById('chat-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatTitle = document.getElementById('chat-title');
const newChatBtn = document.getElementById('new-chat-btn');
const deleteChatBtn = document.getElementById('delete-chat-btn');
const logoutBtn = document.getElementById('logout-btn');

// Settings elements
const settingsToggle = document.getElementById('settings-toggle-btn');
const settingsPanel = document.getElementById('settings-panel');
const customPromptInput = document.getElementById('custom-prompt-input');
const savePromptBtn = document.getElementById('save-prompt-btn');
const resetPromptBtn = document.getElementById('reset-prompt-btn');
const promptFeedback = document.getElementById('prompt-feedback');

// ===== STATE =====
let storedPassword = localStorage.getItem('twin_password') || '';
let currentChatId = null;
let chats = {};
let chatOrder = [];
let customSystemPrompt = localStorage.getItem('custom_system_prompt') || '';

// ===== INIT =====
function init() {
  loadChatsFromStorage();
  renderChatList();

  // Load custom prompt into textarea
  customPromptInput.value = customSystemPrompt;

  if (storedPassword) {
    passwordScreen.classList.add('hidden');
    app.classList.remove('hidden');
    if (chatOrder.length === 0) {
      createNewChat();
    } else {
      loadChat(chatOrder[0]);
    }
  } else {
    passwordScreen.classList.remove('hidden');
    app.classList.add('hidden');
  }
}

// ===== PASSWORD =====
passwordBtn.addEventListener('click', handlePassword);
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handlePassword();
});

function handlePassword() {
  const pwd = passwordInput.value.trim();
  if (!pwd) {
    passwordError.textContent = 'Please enter a password.';
    return;
  }
  storedPassword = pwd;
  localStorage.setItem('twin_password', pwd);
  passwordScreen.classList.add('hidden');
  app.classList.remove('hidden');
  passwordError.textContent = '';
  passwordInput.value = '';
  if (chatOrder.length === 0) {
    createNewChat();
  } else {
    loadChat(chatOrder[0]);
  }
}

// ===== CHAT STORAGE =====
function loadChatsFromStorage() {
  const data = localStorage.getItem('twin_chats');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      chats = parsed.chats || {};
      chatOrder = parsed.order || [];
    } catch {
      chats = {};
      chatOrder = [];
    }
  } else {
    chats = {};
    chatOrder = [];
  }
}

function saveChatsToStorage() {
  localStorage.setItem('twin_chats', JSON.stringify({ chats, order: chatOrder }));
}

function createNewChat() {
  const id = 'chat_' + Date.now();
  chats[id] = { title: 'New Chat', messages: [] };
  chatOrder.push(id);
  saveChatsToStorage();
  loadChat(id);
  renderChatList();
}

function loadChat(id) {
  if (!chats[id]) return;
  currentChatId = id;
  const chat = chats[id];
  chatTitle.textContent = chat.title || 'New Chat';
  renderMessages(chat.messages);
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector(`.chat-item[data-id="${id}"]`);
  if (activeEl) activeEl.classList.add('active');
}

function deleteChat(id) {
  if (!confirm('Delete this chat?')) return;
  const index = chatOrder.indexOf(id);
  if (index > -1) chatOrder.splice(index, 1);
  delete chats[id];
  saveChatsToStorage();
  renderChatList();
  if (chatOrder.length === 0) {
    createNewChat();
  } else {
    loadChat(chatOrder[0]);
  }
}

function renderChatList() {
  chatList.innerHTML = '';
  chatOrder.forEach(id => {
    const chat = chats[id];
    if (!chat) return;
    const div = document.createElement('div');
    div.className = 'chat-item' + (id === currentChatId ? ' active' : '');
    div.dataset.id = id;
    const titleSpan = document.createElement('span');
    titleSpan.className = 'chat-title';
    titleSpan.textContent = chat.title || 'New Chat';
    div.appendChild(titleSpan);
    const delBtn = document.createElement('button');
    delBtn.className = 'chat-delete';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChat(id);
    });
    div.appendChild(delBtn);
    div.addEventListener('click', () => loadChat(id));
    chatList.appendChild(div);
  });
}

// ============================
// RENDER MESSAGES (with code blocks – same as before)
// ============================
function renderMessages(messages) {
  messagesContainer.innerHTML = '';
  if (messages.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'message system';
    empty.textContent = '✨ Start a new conversation with DeepSeek Memory!';
    messagesContainer.appendChild(empty);
    return;
  }
  messages.forEach(msg => {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ' + msg.role;
    if (msg.role === 'user') {
      const div = document.createElement('div');
      div.className = 'message user';
      div.textContent = msg.content;
      wrapper.appendChild(div);
    } else if (msg.role === 'system') {
      const div = document.createElement('div');
      div.className = 'message system';
      div.textContent = msg.content;
      wrapper.appendChild(div);
    } else {
      // assistant
      const parts = splitContentByCodeBlocks(msg.content);
      const container = document.createElement('div');
      container.className = 'assistant-message-container';
      parts.forEach(part => {
        if (part.type === 'text') {
          const textDiv = document.createElement('div');
          textDiv.className = 'message assistant';
          textDiv.textContent = part.content;
          container.appendChild(textDiv);
        } else if (part.type === 'code') {
          const codeBlock = createCodeBlock(part.content, part.language);
          container.appendChild(codeBlock);
        }
      });
      wrapper.appendChild(container);
    }
    messagesContainer.appendChild(wrapper);
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function splitContentByCodeBlocks(content) {
  const parts = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: 'text', content: text });
    }
    const language = match[1] || 'plaintext';
    const code = match[2];
    parts.push({ type: 'code', content: code, language });
    lastIndex = match.index + match[0].length;
  }
  const remaining = content.slice(lastIndex).trim();
  if (remaining) parts.push({ type: 'text', content: remaining });
  if (parts.length === 0) parts.push({ type: 'text', content });
  return parts;
}

function createCodeBlock(code, language) {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block-wrapper';
  const header = document.createElement('div');
  header.className = 'code-block-header';
  const lang = document.createElement('span');
  lang.className = 'code-language';
  lang.textContent = language || 'plaintext';
  header.appendChild(lang);
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = '📋 Copy';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
    }
  });
  header.appendChild(copyBtn);
  wrapper.appendChild(header);
  const pre = document.createElement('pre');
  pre.className = 'code-block';
  const codeEl = document.createElement('code');
  codeEl.textContent = code;
  pre.appendChild(codeEl);
  wrapper.appendChild(pre);
  return wrapper;
}

// ============================
// ADD MESSAGE
// ============================
function addMessage(role, content) {
  if (!currentChatId || !chats[currentChatId]) return;
  const chat = chats[currentChatId];
  chat.messages.push({ role, content });
  if (chat.messages.length === 1 && role === 'user') {
    let title = content.slice(0, 30);
    if (content.length > 30) title += '…';
    chat.title = title;
    chatTitle.textContent = title;
  }
  saveChatsToStorage();
  renderMessages(chat.messages);
  renderChatList();
}

// ============================
// SEND MESSAGE (WITH HISTORY & CUSTOM PROMPT)
// ============================
async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;
  if (!currentChatId) createNewChat();

  addMessage('user', message);
  messageInput.value = '';
  sendBtn.disabled = true;
  messageInput.disabled = true;

  const chat = chats[currentChatId];
  const history = chat.messages
    .filter(msg => msg.role !== 'system')
    .slice(-20)
    .map(msg => ({ role: msg.role, content: msg.content }));

  const placeholderIndex = chat.messages.length;
  chat.messages.push({ role: 'assistant', content: '…' });
  renderMessages(chat.messages);

  // Read the current custom prompt (from the textarea in case they changed it without saving, but we save on change)
  const systemPrompt = customSystemPrompt || null;

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-password': storedPassword,
      },
      body: JSON.stringify({
        user_id: USER_ID,
        message: message,
        history: history,
        system_prompt: systemPrompt, // <-- SEND CUSTOM PROMPT
        thinking: true,
        reasoning_effort: 'high',
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');

    chat.messages[placeholderIndex] = { role: 'assistant', content: data.response };
    if (data.memory_used) {
      chat.messages.push({ role: 'system', content: '🧠 Memory used' });
    }
    saveChatsToStorage();
    renderMessages(chat.messages);
    renderChatList();
  } catch (error) {
    chat.messages[placeholderIndex] = { role: 'assistant', content: `❌ Error: ${error.message}` };
    saveChatsToStorage();
    renderMessages(chat.messages);
  } finally {
    sendBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

// ============================
// SETTINGS LOGIC
// ============================
settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
  // Reload the current prompt into the textarea if it's opened
  if (!settingsPanel.classList.contains('hidden')) {
    customPromptInput.value = customSystemPrompt;
    promptFeedback.textContent = '';
  }
});

function saveCustomPrompt() {
  const newPrompt = customPromptInput.value.trim();
  // We'll send a test moderation request to backend? Actually we'll do client-side check + backend will reject if unsafe.
  // For safety, we'll also moderate on backend. Here we just save.
  customSystemPrompt = newPrompt;
  localStorage.setItem('custom_system_prompt', newPrompt);
  promptFeedback.textContent = '✅ Prompt saved successfully!';
  promptFeedback.className = 'prompt-feedback success';
  // Optionally close panel after save?
  // settingsPanel.classList.add('hidden');
}

function resetCustomPrompt() {
  customSystemPrompt = '';
  localStorage.removeItem('custom_system_prompt');
  customPromptInput.value = '';
  promptFeedback.textContent = '↩️ Reset to default prompt.';
  promptFeedback.className = 'prompt-feedback success';
}

savePromptBtn.addEventListener('click', saveCustomPrompt);
resetPromptBtn.addEventListener('click', resetCustomPrompt);

// ===== EVENT LISTENERS =====
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
newChatBtn.addEventListener('click', createNewChat);
deleteChatBtn.addEventListener('click', () => {
  if (currentChatId) deleteChat(currentChatId);
});
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('twin_password');
  storedPassword = '';
  passwordScreen.classList.remove('hidden');
  app.classList.add('hidden');
  messagesContainer.innerHTML = '';
  chatTitle.textContent = 'New Chat';
  chatList.innerHTML = '';
  chats = {};
  chatOrder = [];
  currentChatId = null;
  saveChatsToStorage();
});

setTimeout(() => {
  appendMessage('ai', "Hey twin! 💖 Welcome to **DeepSeek Memory** – a modified DeepSeek AI with long‑term memory. Enter your password above, then ask me anything! I remember everything we discuss.");
}, 300);

// ===== START =====
init();
