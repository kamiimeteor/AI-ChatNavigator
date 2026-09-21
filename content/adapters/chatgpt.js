window.ACN_Adapters = window.ACN_Adapters || [];
(function () {
  var cache = new Map();
  var cacheURL = '';
  var cacheRoot = null;
  var observedTurns = new Map();
  var shellSelector = '[data-turn-id-container][data-is-intersecting]';

  function isPlaceholder(node) {
    return node.matches(shellSelector) && node.getAttribute('data-is-intersecting') === 'false' &&
      !node.textContent.trim() && node.getBoundingClientRect().height > 0;
  }

  window.ACN_Adapters.push({
  name: 'chatgpt',
  coverage: 'session-index',
  match() {
    return ['chatgpt.com', 'chat.openai.com'].includes(location.hostname) &&
      (location.pathname === '/' || /^\/c\/[^/]+\/?$/.test(location.pathname));
  },
  getContainer() { return window.ACN_AdapterUtils.main(); },
  getHighlightTarget(element) {
    return element.matches('.user-message-bubble-color') ? element :
      element.querySelector('.user-message-bubble-color') || element;
  },
  isPlaceholder: isPlaceholder,
  getUserMessages() {
    var root = this.getContainer();
    if (cacheURL !== location.href || cacheRoot !== root) {
      cache.clear();
      observedTurns.clear();
      cacheURL = location.href;
      cacheRoot = root;
    }
    var live = window.ACN_AdapterUtils.messages(root, [
      '[data-message-author-role="user"]',
      '[data-testid*="user-message"]',
      '.user-message-bubble-color'
    ]);
    if (!root) return live;

    // ChatGPT keeps a sized, ID-bearing shell when it unmounts a turn.
    // Retain only previously observed user text whose exact shell survives.
    // Missing shells (deletion/branch changes) and new conversations evict it.
    var shells = Array.from(root.querySelectorAll(shellSelector));
    var present = new Set(shells);
    var ids = new Map();
    shells.forEach(function (shell) {
      var id = shell.getAttribute('data-turn-id-container');
      ids.set(id, (ids.get(id) || 0) + 1);
      if (shell.querySelector('[data-message-author-role], [data-turn="user"], [data-turn="assistant"]')) {
        observedTurns.set(shell, id);
      }
    });
    observedTurns.forEach(function (id, shell) {
      if (!present.has(shell) || shell.getAttribute('data-turn-id-container') !== id || ids.get(id) !== 1) {
        observedTurns.delete(shell);
      }
    });
    var current = new Map();
    live.forEach(function (message) {
      var shell = message.element.closest(shellSelector);
      if (!shell || !present.has(shell)) return;
      var id = shell.getAttribute('data-turn-id-container');
      if (id !== message.messageId || ids.get(id) !== 1) return;
      if (current.has(shell)) { current.set(shell, null); return; }
      current.set(shell, message);
    });
    cache.forEach(function (saved, shell) {
      if (!present.has(shell) || ids.get(saved.messageId) !== 1 ||
          shell.getAttribute('data-turn-id-container') !== saved.messageId ||
          (!current.get(shell) && !isPlaceholder(shell))) cache.delete(shell);
    });
    current.forEach(function (message, shell) {
      if (message) cache.set(shell, { messageId: message.messageId, text: message.text });
    });
    var result = live.slice();
    cache.forEach(function (saved, shell) {
      if (!current.has(shell) && isPlaceholder(shell)) {
        result.push({ element: shell, messageId: saved.messageId, text: saved.text, retained: true });
      }
    });
    return result.sort(function (a, b) {
      var order = a.element.compareDocumentPosition(b.element);
      return order & 4 ? -1 : order & 2 ? 1 : 0;
    });
  },
  getHistorySnapshot() {
    this.getUserMessages();
    var shells = cacheRoot ? Array.from(cacheRoot.querySelectorAll(shellSelector)).filter(function (shell) {
      return shell.getBoundingClientRect().height > 0;
    }) : [];
    return {
      root: cacheRoot,
      turns: shells.map(function (shell) {
        return { element: shell, id: shell.getAttribute('data-turn-id-container') };
      }),
      pending: shells.filter(function (shell) {
        return isPlaceholder(shell) && observedTurns.get(shell) !== shell.getAttribute('data-turn-id-container');
      })
    };
  },
  isLikelyEmptyConversation() {
    return location.pathname === '/' && !document.querySelector('[data-message-author-role], article[data-testid*="conversation-turn"]');
  },
  getChatTitle() {
    return document.title.replace(/\s*[-|]\s*ChatGPT\s*$/, '').trim() || 'New Chat';
  }
  });
})();
