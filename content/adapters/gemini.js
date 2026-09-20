window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'gemini',
  match() {
    return location.hostname === 'gemini.google.com' && /^\/(u\/\d+\/)?app(\/|$)/.test(location.pathname);
  },
  getContainer() {
    return document.querySelector('#chat-history') || document.querySelector('infinite-scroller') ||
      window.ACN_AdapterUtils.main() || document.querySelector('.conversation-container');
  },
  getUserMessages() {
    return window.ACN_AdapterUtils.messages(this.getContainer(), ['user-query-content', 'user-query']);
  },
  isLikelyEmptyConversation() {
    return /^\/(u\/\d+\/)?app\/?$/.test(location.pathname) &&
      !document.querySelector('user-query, user-query-content, model-response, message-content');
  },
  getChatTitle() {
    return document.title.replace(/\s*[-|]\s*(Google )?Gemini\s*$/i, '').trim() || 'New Chat';
  }
});
