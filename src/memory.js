// ============================================================
// SIMPLE IN-MEMORY STORAGE – No ChromaDB required!
// Memory resets when the server restarts.
// Keeps last 50 messages per user.
// ============================================================

const memoryStore = new Map(); // key: userId, value: array of {message, response, timestamp}

/**
 * Initialize memory (instant – nothing to set up)
 */
export async function initMemory() {
  console.log('✅ Memory ready (in-memory mode)');
  return true;
}

/**
 * Store a user message and AI response in memory
 */
export async function storeMemory(userId, message, response) {
  if (!userId || !message || !response) return;
  
  if (!memoryStore.has(userId)) {
    memoryStore.set(userId, []);
  }
  
  const userMemories = memoryStore.get(userId);
  userMemories.push({
    message,
    response,
    timestamp: Date.now()
  });
  
  // Keep only last 50 messages per user to prevent memory bloat
  if (userMemories.length > 50) {
    memoryStore.set(userId, userMemories.slice(-50));
  }
}

/**
 * Retrieve relevant past memories using simple keyword matching
 */
export async function retrieveMemories(userId, query, nResults = 5) {
  if (!userId || !memoryStore.has(userId)) return [];
  
  const allMemories = memoryStore.get(userId);
  if (allMemories.length === 0) return [];
  
  // Extract meaningful words from query (ignore short/common words)
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  if (queryWords.length === 0) {
    // If no meaningful words, return most recent memories
    return allMemories
      .slice(-nResults)
      .reverse()
      .map(item => `User: ${item.message}\nAI: ${item.response}`);
  }
  
  // Score each memory based on keyword matches
  const scored = allMemories.map((item) => {
    const text = (item.message + ' ' + item.response).toLowerCase();
    let score = 0;
    queryWords.forEach(word => {
      if (text.includes(word)) score++;
    });
    return { ...item, score };
  });
  
  // Sort by score (highest first), then by recency (most recent first)
  scored.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
  
  // Return top nResults as formatted strings
  return scored
    .slice(0, nResults)
    .filter(item => item.score > 0) // Only include relevant memories
    .map(item => `User: ${item.message}\nAI: ${item.response}`);
}

/**
 * Build a context string from retrieved memories
 */
export async function buildContext(userId, newMessage) {
  const memories = await retrieveMemories(userId, newMessage);
  if (memories.length === 0) return '';
  
  let context = "Here are some relevant past conversations:\n";
  memories.forEach((mem, i) => {
    context += `${i + 1}. ${mem}\n`;
  });
  return context;
}

/**
 * Optional: Clear all memory (useful for testing)
 */
export async function clearMemory(userId) {
  if (userId) {
    memoryStore.delete(userId);
  } else {
    memoryStore.clear();
  }
}
