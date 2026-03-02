window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'chatgpt',

  match() {
    var correctHost = location.hostname.includes('chatgpt.com') ||
                      location.hostname.includes('chat.openai.com');
    if (!correctHost) return false;
    var path = location.pathname;
    return path === '/' || path.startsWith('/c/');
  },

  getContainer() {
    // main#main is the primary chat container on current ChatGPT
    var container = document.querySelector('main#main');
    if (container) return container;
    // Fallback: find the scrollable parent of the first user message
    var firstMsg = document.querySelector('.user-message-bubble-color');
    if (firstMsg) {
      var el = firstMsg.parentElement;
      while (el && el !== document.body) {
        var style = getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return el;
        }
        el = el.parentElement;
      }
    }
    return null;
  },

  getUserMessages() {
    var els = document.querySelectorAll('.user-message-bubble-color');
    return Array.from(els).map(function (el) {
      return { element: el, text: (el.innerText || '').trim() };
    });
  },

  scrollToMessage(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  isLikelyEmptyConversation() {
    var correctHost = location.hostname.includes('chatgpt.com') ||
                      location.hostname.includes('chat.openai.com');
    if (!correctHost) return false;
    var hasAnyMessage = document.querySelector('.user-message-bubble-color') ||
                        document.querySelector('.agent-turn');
    return !hasAnyMessage;
  },

  getChatTitle() {
    var title = document.title || '';
    return title.replace(/\s*[-|]\s*ChatGPT\s*$/, '').trim() || 'New Chat';
  }
});
