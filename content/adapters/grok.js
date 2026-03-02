window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'grok',

  match() {
    var correctHost = location.hostname.includes('grok.com');
    var hasChat = !!document.querySelector('.message-bubble');
    return correctHost && hasChat;
  },

  getContainer() {
    var lastReply = document.querySelector('#last-reply-container');
    return lastReply ? lastReply.parentElement : null;
  },

  getUserMessages() {
    var allBubbles = document.querySelectorAll('.message-bubble');
    var userMessages = [];
    allBubbles.forEach(function (bubble) {
      if (bubble.classList.contains('bg-foreground') &&
          bubble.classList.contains('border-input-border')) {
        userMessages.push({
          element: bubble,
          text: (bubble.innerText || '').trim()
        });
      }
    });
    return userMessages;
  },

  scrollToMessage(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  isLikelyEmptyConversation() {
    var correctHost = location.hostname.includes('grok.com');
    if (!correctHost) return false;
    var hasBubbles = document.querySelector('.message-bubble');
    return !hasBubbles;
  }
});
