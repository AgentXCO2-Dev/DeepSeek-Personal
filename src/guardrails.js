/**
 * ============================================================
 * GUARDRAILS – Content filtering for user input and AI output
 * ============================================================
 * This module provides:
 *   - Input moderation (reject harmful user messages)
 *   - Output filtering (check AI responses for harmful content)
 *   - Safe fallback responses
 */

// ============================
// PROHIBITED TOPICS & KEYWORDS
// ============================

const BANNED_PATTERNS = [
  // Violence & self-harm
  /\b(kill|murder|suicide|self-harm|shoot|stab|hang|strangle|poison)\b/i,
  /\b(rape|assault|abuse|torture)\b/i,
  
  // Harassment & hate speech
  /\b(slur|racist|sexist|homophobic|transphobic|hate speech|discrimination)\b/i,
  /\b(nazi|kkk|white supremacy|terrorist)\b/i,
  
  // Illegal activities
  /\b(hack|hacking|cyberattack|phishing|ransomware|malware)\b/i,
  /\b(drugs|trafficking|weapon|gun|bomb|explosive)\b/i,
  /\b(porn|child|underage|exploitation)\b/i,
  
  // Sensitive personal info
  /\b(ssn|social security|credit card|bank account|password|passport)\b/i,
  
  // Instructions for harm
  /\b(how to (kill|murder|suicide|harm|attack|exploit))|(step by step (kill|murder|attack))/i,
];

// ============================
// MODERATION FUNCTIONS
// ============================

/**
 * Check if a text contains any banned patterns.
 * Returns { flagged: boolean, matches: string[] }
 */
export function moderateText(text) {
  if (!text || typeof text !== 'string') return { flagged: false, matches: [] };
  
  const matches = [];
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      matches.push(pattern.source);
    }
  }
  return { flagged: matches.length > 0, matches };
}

/**
 * Moderate user input – if flagged, throw an error with a safe message.
 */
export function moderateUserInput(userMessage) {
  const { flagged, matches } = moderateText(userMessage);
  if (flagged) {
    const err = new Error('I cannot help with that request. Please keep our conversation respectful and safe. 🙏');
    err.code = 'SAFETY_VIOLATION';
    throw err;
  }
  return true;
}

/**
 * Moderate AI output – if flagged, return a safe fallback.
 */
export function moderateAIOutput(aiResponse) {
  const { flagged, matches } = moderateText(aiResponse);
  if (flagged) {
    // Return a safe fallback instead of the flagged content
    return "I'm sorry, but I can't provide that content. Let's keep our conversation positive and helpful. 😊";
  }
  return aiResponse;
}

/**
 * Additional safety system prompt to enforce guardrails.
 */
export function getSafetySystemPrompt() {
  return `
IMPORTANT SAFETY RULES:
- You must refuse any request that asks for illegal, harmful, hateful, violent, or sexually explicit content.
- If a user asks for instructions on how to harm others, create weapons, hack systems, or engage in any dangerous activity, politely refuse.
- Do not generate content that promotes discrimination, harassment, or abuse.
- If you are unsure about a request, err on the side of safety and politely decline.
- Always respond in a respectful, helpful, and positive manner.
- If a user insists on harmful topics, politely end the conversation.
`;
}
