window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'gemini',

  match() {
    var correctHost = location.hostname.includes('gemini.google.com');
    var hasChat = !!document.querySelector('user-query') ||
                  !!document.querySelector('user-query-content');
    return correctHost && hasChat;
  },

  getContainer() {
    return document.querySelector('#chat-history') ||
           document.querySelector('.conversation-container') ||
           document.querySelector('infinite-scroller');
  },

  getUserMessages() {
    var els = document.querySelectorAll('user-query-content');
    if (els.length === 0) {
      els = document.querySelectorAll('user-query');
    }
    return Array.from(els).map(function (el) {
      return { element: el, text: (el.innerText || '').trim() };
    });
  },

  scrollToMessage(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  isLikelyEmptyConversation() {
    var correctHost = location.hostname.includes('gemini.google.com');
    if (!correctHost) return false;
    var hasAnyQuery = document.querySelector('user-query') ||
                      document.querySelector('user-query-content');
    var hasAnyResponse = document.querySelector('model-response') ||
                         document.querySelector('message-content');
    return !hasAnyQuery && !hasAnyResponse;
  }
});
