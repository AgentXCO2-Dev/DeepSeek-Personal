// ===== CONFIG =====
const API_BASE = 'https://deepseek-personal.onrender.com/api'; // CHANGE TO YOUR BACKEND URL
const USER_ID = 'twin1'; // fixed user ID for this demo

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

// ===== STATE =====
let storedPassword = localStorage.getItem('twin_password') || '';
let currentChatId = null;
let chats = {}; // { chatId: { title, messages: [{role, content}] } }
let chatOrder = []; // ordered list of chat IDs

// ===== INIT =====
function init() {
  loadChatsFromStorage();
  renderChatList();

  // If password already stored, auto-login
  if (storedPassword) {
    passwordScreen.classList.add('hidden');
    app.classList.remove('hidden');
    // Create a new chat if none exists
    if (chatOrder.length === 0) {
      createNewChat();
    } else {
      // Load the first chat
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

  // We'll test the password by making a quick API call (or we can just trust it)
  // For simplicity, we'll store it and try to send a test message later.
  // Actually we can just store it and let the first API call fail if wrong.
  storedPassword = pwd;
  localStorage.setItem('twin_password', pwd);
  passwordScreen.classList.add('hidden');
  app.classList.remove('hidden');
  passwordError.textContent = '';
  passwordInput.value = '';

  // Create initial chat if none
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
  chats[id] = {
    title: 'New Chat',
    messages: []
  };
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
  // highlight in sidebar
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

    div.addEventListener('click', () => {
      loadChat(id);
    });

    chatList.appendChild(div);
  });
}

function renderMessages(messages) {
  messagesContainer.innerHTML = '';
  if (messages.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'message system';
    emptyMsg.textContent = '✨ Start a new conversation with your twin!';
    messagesContainer.appendChild(emptyMsg);
    return;
  }
  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'message ' + msg.role;
    div.textContent = msg.content;
    messagesContainer.appendChild(div);
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ===== ADD MESSAGE =====
function addMessage(role, content) {
  if (!currentChatId || !chats[currentChatId]) return;
  const chat = chats[currentChatId];
  chat.messages.push({ role, content });
  // Update title if it's the first user message
  if (chat.messages.length === 1 && role === 'user') {
    // Truncate for title
    let title = content.slice(0, 30);
    if (content.length > 30) title += '…';
    chat.title = title;
    chatTitle.textContent = title;
  }
  saveChatsToStorage();
  renderMessages(chat.messages);
  renderChatList();
}

// ===== SEND MESSAGE TO BACKEND =====
async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;
  if (!currentChatId) {
    createNewChat();
  }
  // Add user message immediately
  addMessage('user', message);
  messageInput.value = '';
  sendBtn.disabled = true;
  messageInput.disabled = true;

  // Add a placeholder assistant message (typing)
  const chat = chats[currentChatId];
  const placeholderIndex = chat.messages.length;
  chat.messages.push({ role: 'assistant', content: '…' });
  renderMessages(chat.messages);

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
        thinking: true,
        reasoning_effort: 'high',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    // Replace placeholder with actual response
    chat.messages[placeholderIndex] = { role: 'assistant', content: data.response };
    // If memory used, add a system note
    if (data.memory_used) {
      chat.messages.push({ role: 'system', content: '🧠 Memory used' });
    }
    saveChatsToStorage();
    renderMessages(chat.messages);
    renderChatList();
  } catch (error) {
    // Replace placeholder with error
    chat.messages[placeholderIndex] = { role: 'assistant', content: `❌ Error: ${error.message}` };
    saveChatsToStorage();
    renderMessages(chat.messages);
  } finally {
    sendBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

// ===== EVENT LISTENERS =====
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

newChatBtn.addEventListener('click', () => {
  createNewChat();
});

deleteChatBtn.addEventListener('click', () => {
  if (currentChatId) {
    deleteChat(currentChatId);
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('twin_password');
  storedPassword = '';
  passwordScreen.classList.remove('hidden');
  app.classList.add('hidden');
  // clear UI
  messagesContainer.innerHTML = '';
  chatTitle.textContent = 'New Chat';
  chatList.innerHTML = '';
  // reset state
  chats = {};
  chatOrder = [];
  currentChatId = null;
  saveChatsToStorage();
});

// ===== START =====
init();
