import { ChromaClient } from 'chromadb';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';

let collection;
const client = new ChromaClient();

export async function initMemory() {
  try {
    collection = await client.getOrCreateCollection({
      name: 'twin_memories',
      metadata: { 'hnsw:space': 'cosine' },
    });
    console.log('✅ ChromaDB collection ready');
  } catch (err) {
    console.error('❌ ChromaDB init error:', err.message);
  }
}

export async function storeMemory(userId, message, response) {
  if (!collection) await initMemory();
  const text = `User: ${message}\nAI: ${response}`;
  const id = `${userId}_${uuidv4()}`;
  await collection.add({
    ids: [id],
    documents: [text],
    metadatas: [{ user_id: userId }],
  });
}

export async function retrieveMemories(userId, query, nResults = config.maxMemoryResults) {
  if (!collection) await initMemory();
  try {
    const results = await collection.query({
      queryTexts: [query],
      nResults,
      where: { user_id: userId },
    });
    return results.documents[0] || [];
  } catch {
    return [];
  }
}

export async function buildContext(userId, newMessage) {
  const memories = await retrieveMemories(userId, newMessage);
  if (memories.length === 0) return '';
  let context = "Here are some relevant past conversations:\n";
  memories.forEach((mem, i) => (context += `${i + 1}. ${mem}\n`));
  return context;
}
