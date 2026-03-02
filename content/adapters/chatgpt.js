window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'chatgpt',

  match() {
    var correctHost = location.hostname.includes('chatgpt.com') ||
                      location.hostname.includes('chat.openai.com');
    var hasChat = !!document.querySelector('[data-message-author-role]');
    return correctHost && hasChat;
  },

  getContainer() {
    var article = document.querySelector('article');
    return article ? article.parentElement : null;
  },

  getUserMessages() {
    var els = document.querySelectorAll('[data-message-author-role="user"]');
    return Array.from(els).map(function (el) {
      return { element: el, text: (el.innerText || '').trim() };
    });
  },

  scrollToMessage(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  isLikelyEmptyConversation() {
    var container = this.getContainer();
    if (!container) return false;
    var hasMessages = container.querySelectorAll('article').length > 0;
    return !hasMessages;
  }
});
