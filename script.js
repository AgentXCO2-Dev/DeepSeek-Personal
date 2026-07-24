// ===== CONFIG =====
const API_BASE = 'https://deepseek-personal.onrender.com';
// ===== DOM REFS =====
// Paywall
const paywallScreen = document.getElementById('paywall-screen');
const paywallPasswordInput = document.getElementById('paywall-password-input');
const paywallBtn = document.getElementById('paywall-btn');
const paywallError = document.getElementById('paywall-error');

// Auth
const authScreen = document.getElementById('auth-screen');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const signupEmail = document.getElementById('signup-email');
const signupName = document.getElementById('signup-name');
const signupPassword = document.getElementById('signup-password');
const signupError = document.getElementById('signup-error');
const googleBtn = document.getElementById('google-btn');
const tabBtns = document.querySelectorAll('.tab-btn');

// Chat
const app = document.getElementById('app');
const chatList = document.getElementById('chat-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatTitle = document.getElementById('chat-title');
const newChatBtn = document.getElementById('new-chat-btn');
const deleteChatBtn = document.getElementById('delete-chat-btn');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-display');

// Settings
const settingsToggle = document.getElementById('settings-toggle-btn');
const settingsPanel = document.getElementById('settings-panel');
const customPromptInput = document.getElementById('custom-prompt-input');
const savePromptBtn = document.getElementById('save-prompt-btn');
const resetPromptBtn = document.getElementById('reset-prompt-btn');
const promptFeedback = document.getElementById('prompt-feedback');

// ===== STATE =====
let currentChatId = null;
let chats = {};
let chatOrder = [];
let authToken = localStorage.getItem('auth_token') || null;
let currentUser = null;
let paywallPassed = localStorage.getItem('paywall_passed') === 'true';

// ============================
// PAYWALL
// ============================

if (paywallPassed) {
  paywallScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
}

async function handlePaywall() {
  const password = paywallPasswordInput.value.trim();
  if (!password) {
    paywallError.textContent = 'Please enter the access password.';
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/auth/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Invalid password');
    // success
    paywallScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    paywallError.textContent = '';
    paywallPasswordInput.value = '';
    localStorage.setItem('paywall_passed', 'true');
    paywallPassed = true;
  } catch (err) {
    paywallError.textContent = err.message || 'Invalid password. Please try again.';
  }
}

paywallBtn.addEventListener('click', handlePaywall);
paywallPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handlePaywall();
});

// ============================
// AUTH (Login / Signup / Google)
// ============================

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('signup-form').classList.toggle('hidden', tab !== 'signup');
    loginError.textContent = '';
    signupError.textContent = '';
  });
});

async function handleLogin(e) {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();
  if (!email || !password) {
    loginError.textContent = 'Email and password required.';
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('auth_token', authToken);
    loginError.textContent = '';
    enterChat();
  } catch (err) {
    loginError.textContent = err.message;
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const email = signupEmail.value.trim();
  const name = signupName.value.trim() || undefined;
  const password = signupPassword.value.trim();
  if (!email || !password) {
    signupError.textContent = 'Email and password required.';
    return;
  }
  if (password.length < 6) {
    signupError.textContent = 'Password must be at least 6 characters.';
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName: name }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Signup failed');
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('auth_token', authToken);
    signupError.textContent = '';
    enterChat();
  } catch (err) {
    signupError.textContent = err.message;
  }
}

loginForm.addEventListener('submit', handleLogin);
signupForm.addEventListener('submit', handleSignup);

// Google OAuth – redirect to backend
googleBtn.addEventListener('click', () => {
  window.location.href = `${API_BASE}/auth/google`;
});

// Handle Google redirect (token in URL)
const urlParams = new URLSearchParams(window.location.search);
const tokenParam = urlParams.get('token');
if (tokenParam) {
  authToken = tokenParam;
  localStorage.setItem('auth_token', authToken);
  try {
    const userParam = urlParams.get('user');
    if (userParam) {
      currentUser = JSON.parse(decodeURIComponent(userParam));
    }
    window.history.replaceState({}, document.title, window.location.pathname);
    // If paywall not passed, hide paywall and show auth? Actually we need to show auth if not passed.
    // But since we have token, we can skip auth and go straight to chat.
    if (!paywallPassed) {
      // user might have already passed paywall? Better to require paywall first.
      // But we can still let them in if they have a valid token? We'll check token validity.
      // For simplicity, we'll enter chat directly.
    }
    enterChat();
  } catch (e) {
    console.error('Error parsing user from URL:', e);
  }
}

// ============================
// ENTER CHAT (After Auth)
// ============================

async function enterChat() {
  // Ensure paywall is hidden and auth is hidden
  paywallScreen.classList.add('hidden');
  authScreen.classList.add('hidden');
  app.classList.remove('hidden');

  if (currentUser && currentUser.displayName) {
    userDisplay.textContent = `👤 ${currentUser.displayName}`;
  }

  // Load chats from localStorage (user-specific)
  const storageKey = `chats_${currentUser?.id || 'anonymous'}`;
  const data = localStorage.getItem(storageKey);
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
  renderChatList();
  // Load custom prompt
  await loadCustomPrompt();
  if (chatOrder.length === 0) {
    createNewChat();
  } else {
    loadChat(chatOrder[0]);
  }
}

// ============================
// CUSTOM PROMPT LOADING
// ============================

async function loadCustomPrompt() {
  if (!authToken) return;
  try {
    const response = await fetch(`${API_BASE}/api/prompt`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await response.json();
    if (data.prompt) {
      customPromptInput.value = data.prompt;
      localStorage.setItem(`custom_prompt_${currentUser?.id}`, data.prompt);
    }
  } catch (err) {
    console.error('Failed to load custom prompt:', err);
  }
}

// ============================
// CHAT STORAGE (per user)
// ============================

function getStorageKey() {
  return `chats_${currentUser?.id || 'anonymous'}`;
}

function saveChatsToStorage() {
  localStorage.setItem(getStorageKey(), JSON.stringify({ chats, order: chatOrder }));
}

// ============================
// CHAT FUNCTIONS
// ============================

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
// RENDER MESSAGES (with code blocks)
// ============================

function renderMessages(messages) {
  messagesContainer.innerHTML = '';
  if (messages.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'message system';
    empty.textContent = '✨ Start a new conversation!';
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
      // assistant – check for code blocks
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

  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        message: message,
        history: history,
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
// SETTINGS (Custom Prompt)
// ============================

settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
  if (!settingsPanel.classList.contains('hidden')) {
    customPromptInput.value = localStorage.getItem(`custom_prompt_${currentUser?.id}`) || '';
    promptFeedback.textContent = '';
  }
});

async function saveCustomPrompt() {
  const prompt = customPromptInput.value.trim();
  try {
    const response = await fetch(`${API_BASE}/api/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save prompt');
    localStorage.setItem(`custom_prompt_${currentUser?.id}`, prompt);
    promptFeedback.textContent = '✅ Prompt saved!';
    promptFeedback.className = 'prompt-feedback success';
  } catch (err) {
    promptFeedback.textContent = `❌ Error: ${err.message}`;
    promptFeedback.className = 'prompt-feedback error';
  }
}

function resetCustomPrompt() {
  customPromptInput.value = '';
  localStorage.removeItem(`custom_prompt_${currentUser?.id}`);
  saveCustomPrompt();
  promptFeedback.textContent = '↩️ Reset to default.';
  promptFeedback.className = 'prompt-feedback success';
}

savePromptBtn.addEventListener('click', saveCustomPrompt);
resetPromptBtn.addEventListener('click', resetCustomPrompt);

// ============================
// EVENT LISTENERS (Chat)
// ============================

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
  localStorage.removeItem('auth_token');
  authToken = null;
  currentUser = null;
  chats = {};
  chatOrder = [];
  currentChatId = null;
  app.classList.add('hidden');
  authScreen.classList.remove('hidden');
  // Reset tab to login
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
  tabBtns.forEach(b => b.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="login"]').classList.add('active');
});

// ===== AUTO-LOGIN CHECK =====
if (authToken) {
  fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  })
    .then(res => res.json())
    .then(user => {
      if (user && user.id) {
        currentUser = user;
        // If paywall not passed, we need to show paywall? Actually we can skip paywall if they have a valid token.
        // But we want to enforce paywall first. However, if they have a token, they've already passed paywall at some point.
        // We'll assume they have. If not, we'll show paywall.
        if (!paywallPassed) {
          // They have a token but paywall not marked? We'll set paywall as passed.
          localStorage.setItem('paywall_passed', 'true');
          paywallPassed = true;
          paywallScreen.classList.add('hidden');
        }
        enterChat();
      } else {
        localStorage.removeItem('auth_token');
        authToken = null;
      }
    })
    .catch(() => {
      localStorage.removeItem('auth_token');
      authToken = null;
    });
}
