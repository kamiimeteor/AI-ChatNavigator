window.ACN_MessageIndex = (function () {
  function normalize(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  // A snapshot contains only mounted messages. Never infer missing history,
  // branch membership or a conversation-wide ordinal from DOM position.
  function create() {
    var nodeKeys = new WeakMap();
    var nextKey = 0;
    return {
      update: function (messages) {
        var counts = new Map();
        messages.forEach(function (msg) {
          if (msg.messageId) counts.set(msg.messageId, (counts.get(msg.messageId) || 0) + 1);
        });
        return messages.map(function (msg) {
          var id = msg.messageId || '';
          var key;
          if (id && counts.get(id) === 1) {
            key = 'id:' + id;
          } else {
            if (!nodeKeys.has(msg.element)) nodeKeys.set(msg.element, 'node:' + (++nextKey));
            key = nodeKeys.get(msg.element);
          }
          var text = normalize(msg.text);
          return {
            key: key,
            element: msg.element,
            messageId: id,
            text: text,
            label: text.length > 50 ? text.slice(0, 50) + '\u2026' : (text || 'Attachment prompt')
          };
        });
      }
    };
  }

  function resolve(entry, messages) {
    // Live membership and text both matter: an element may have been reused
    // for an edit or another branch since the user clicked it.
    var connected = messages.filter(function (msg) {
      return msg.element && msg.element.isConnected && normalize(msg.text) === entry.text;
    });
    var sameNode = connected.find(function (msg) {
      return msg.element === entry.element && (msg.messageId || '') === entry.messageId;
    });
    if (sameNode) return sameNode.element;
    if (!entry.messageId) return null;
    var matches = connected.filter(function (msg) { return msg.messageId === entry.messageId; });
    return matches.length === 1 ? matches[0].element : null;
  }

  return { create: create, normalize: normalize, resolve: resolve };
})();
