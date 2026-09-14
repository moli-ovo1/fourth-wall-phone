function claudeVersion(model = '') {
  const value = String(model || '').trim().toLowerCase();
  if (!value) return null;

  if (/claude-mythos-preview/.test(value)) return { major: 999, minor: 0 };

  let match = value.match(/claude-(?:opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d+))?/);
  if (!match) match = value.match(/claude-(\d+)-(\d+)-(?:opus|sonnet|haiku)/);
  if (!match) return null;

  return {
    major: Number(match[1]) || 0,
    minor: Number(match[2]) || 0,
  };
}

export function claudeDisallowsAssistantPrefill(model = '') {
  const value = String(model || '').trim().toLowerCase();
  if (!value) return false;
  if (/claude-mythos-preview/.test(value)) return true;

  const version = claudeVersion(value);
  if (!version) return false;
  return version.major > 4 || (version.major === 4 && version.minor >= 6);
}

export function resolveFourthWallPrefillCompatibility(config = {}, chatSettings = {}) {
  if (chatSettings?.disableAssistantPrefill === true) {
    return { disableAssistantPrefill: true, reason: 'saved-disabled' };
  }

  if (config?.source === 'tavern') {
    return { disableAssistantPrefill: false, reason: 'tavern-managed' };
  }

  const provider = String(config?.provider || '').trim();
  if (provider === 'gemini') {
    // Gemini generateContent chat history is defined as alternating user/model turns
    // with the latest request supplied by the user. Keep Bottom in the user turn.
    return { disableAssistantPrefill: true, reason: 'gemini-user-last' };
  }

  if (provider === 'claude' && claudeDisallowsAssistantPrefill(config?.model)) {
    // Anthropic removed final-assistant prefill support starting with Claude 4.6
    // (and Claude Mythos Preview). Sending it produces an invalid-request error.
    return { disableAssistantPrefill: true, reason: 'claude-prefill-unsupported' };
  }

  // OpenAI-compatible endpoints are intentionally heterogeneous. Do not infer
  // capability from a model name or gateway unless we have explicit evidence.
  return { disableAssistantPrefill: false, reason: 'configured-default' };
}
