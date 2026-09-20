window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'claude',
  match() {
    return location.hostname === 'claude.ai' &&
      (location.pathname === '/' || location.pathname === '/new' || /^\/chat\/[^/]+\/?$/.test(location.pathname));
  },
  getContainer() {
    var marker = document.querySelector('div[data-test-render-count]');
    return window.ACN_AdapterUtils.main() || (marker && marker.parentElement);
  },
  getUserMessages() {
    return window.ACN_AdapterUtils.messages(this.getContainer(), ['[data-testid="user-message"]', '.font-user-message']);
  },
  isLikelyEmptyConversation() {
    return ['/', '/new'].includes(location.pathname) &&
      !document.querySelector('[data-testid="user-message"], .font-user-message, .font-claude-message');
  },
  getChatTitle() {
    return document.title.replace(/\s*[-|]\s*Claude\s*$/, '').trim() || 'New Chat';
  }
});
