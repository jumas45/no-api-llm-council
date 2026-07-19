// ============================================================================
// EXTERNALIZED CSS SELECTORS, MAPPED BY DOMAIN (PRD §3, Goal 1 requirement)
// ----------------------------------------------------------------------------
// These are the ONLY things that need to change when an LLM provider ships a UI
// redesign. Each field is a list of candidate selectors tried in order, so a
// single stale selector degrades gracefully instead of breaking the adapter.
//
//   input          -> the prompt composer (textarea or contenteditable)
//   sendButton     -> the button that submits the prompt
//   stopButton     -> present ONLY while the model is generating (our "busy"
//                     signal — when it disappears, generation is complete)
//   response       -> the assistant response bubbles; we scrape the LAST one
//   quickAnswer    -> the optional "Answer now" / "quick answer" control some
//                     providers surface while a model is thinking. Matched by
//                     CSS `selectors` first, then by button `texts` (lowercase
//                     fragments), since these controls are label-driven and
//                     rarely have stable selectors. Only clicked when the user
//                     opts in, and never for the Chairman synthesis. See ADR-0004.
// ============================================================================

export const SELECTORS = {
  'chatgpt.com': {
    input: [
      '#prompt-textarea',
      'div[contenteditable="true"]#prompt-textarea',
      'textarea[data-id]',
      'textarea',
    ],
    sendButton: [
      'button[data-testid="send-button"]',
      '#composer-submit-button',
      'button[aria-label="Send prompt"]',
      'button[aria-label*="Send"]',
    ],
    stopButton: [
      'button[data-testid="stop-button"]',
      'button[aria-label="Stop streaming"]',
      'button[aria-label*="Stop"]',
    ],
    response: [
      'div[data-message-author-role="assistant"] .markdown',
      'div[data-message-author-role="assistant"]',
    ],
    quickAnswer: {
      selectors: [
        'button[aria-label*="quick answer" i]',
        'button[aria-label*="answer now" i]',
      ],
      texts: ['answer now', 'get a quick answer', 'quick answer', 'fast answer'],
    },
  },

  'claude.ai': {
    input: [
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"][translate="no"]',
      'div[contenteditable="true"]',
    ],
    sendButton: [
      'button[aria-label="Send message"]',
      'button[aria-label="Send Message"]',
      'button[aria-label*="Send"]',
      'button[type="submit"]',
    ],
    stopButton: [
      'button[aria-label="Stop response"]',
      'button[aria-label*="Stop"]',
    ],
    response: [
      'div.font-claude-message',
      'div[data-testid="assistant-message"]',
      'div.font-claude-response',
    ],
    quickAnswer: {
      selectors: ['button[aria-label*="answer now" i]'],
      texts: ['answer now', 'quick answer', 'fast answer'],
    },
  },

  'gemini.google.com': {
    input: [
      'div.ql-editor[contenteditable="true"]',
      'rich-textarea div[contenteditable="true"]',
      'div[contenteditable="true"]',
      'textarea',
    ],
    sendButton: [
      'button.send-button',
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]',
    ],
    stopButton: [
      'button.send-button.stop',
      'button[aria-label="Stop response"]',
      'button[aria-label*="Stop"]',
      '.stop-icon',
    ],
    response: [
      'message-content .markdown',
      'message-content',
      '.model-response-text',
    ],
    quickAnswer: {
      selectors: ['button[aria-label*="answer now" i]'],
      texts: ['answer now', 'quick answer', 'fast answer'],
    },
  },
}

// Resolve the selector set for the current host (handles subdomains/www).
export function selectorsForHost(hostname = location.hostname) {
  const key = Object.keys(SELECTORS).find(
    (domain) => hostname === domain || hostname.endsWith('.' + domain),
  )
  return key ? { key, ...SELECTORS[key] } : null
}
