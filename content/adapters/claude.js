window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'claude',

  match() {
    var correctHost = location.hostname.includes('claude.ai');
    if (!correctHost) return false;
    var path = location.pathname;
    return path === '/' || path === '/new' || path.startsWith('/chat/');
  },

  getContainer() {
    var renderCount = document.querySelector('div[data-test-render-count]');
    return renderCount ? renderCount.parentElement : null;
  },

  getUserMessages() {
    var els = document.querySelectorAll('[data-testid="user-message"]');
    if (els.length === 0) {
      els = document.querySelectorAll('.font-user-message');
    }
    return Array.from(els).map(function (el) {
      return { element: el, text: (el.innerText || '').trim() };
    });
  },

  scrollToMessage(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  isLikelyEmptyConversation() {
    var correctHost = location.hostname.includes('claude.ai');
    if (!correctHost) return false;
    var hasAnyMessage = document.querySelector('[data-testid="user-message"]') ||
                        document.querySelector('.font-user-message') ||
                        document.querySelector('.font-claude-message');
    return !hasAnyMessage;
  },

  getChatTitle() {
    var title = document.title || '';
    return title.replace(/\s*[-|]\s*Claude\s*$/, '').trim() || 'New Chat';
  }
});
