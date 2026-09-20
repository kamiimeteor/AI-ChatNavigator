window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'chatgpt',
  match() {
    return ['chatgpt.com', 'chat.openai.com'].includes(location.hostname) &&
      (location.pathname === '/' || /^\/c\/[^/]+\/?$/.test(location.pathname));
  },
  getContainer() { return window.ACN_AdapterUtils.main(); },
  getUserMessages() {
    return window.ACN_AdapterUtils.messages(this.getContainer(), [
      '[data-message-author-role="user"]',
      '[data-testid*="user-message"]',
      '.user-message-bubble-color'
    ]);
  },
  isLikelyEmptyConversation() {
    return location.pathname === '/' && !document.querySelector('[data-message-author-role], article[data-testid*="conversation-turn"]');
  },
  getChatTitle() {
    return document.title.replace(/\s*[-|]\s*ChatGPT\s*$/, '').trim() || 'New Chat';
  }
});
