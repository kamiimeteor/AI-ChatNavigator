window.ACN_AdapterUtils = (function () {
  function isVisible(node) {
    if (!node.isConnected || node.closest('[hidden], [aria-hidden="true"], [data-acn-root]')) return false;
    var style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
  }

  function messages(root, selectors) {
    if (!root) return [];
    var nodes = Array.from(root.querySelectorAll(selectors.join(', '))).filter(isVisible);
    // Prefer the outer user-message boundary, without promoting it to an
    // article which may also contain the assistant's answer.
    var selected = new Set(nodes);
    nodes = nodes.filter(function (node) {
      for (var parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) {
        if (selected.has(parent)) return false;
      }
      return true;
    });
    return nodes.map(function (node) {
      var idNode = node.closest('[data-message-id]') || node.querySelector('[data-message-id]');
      var text = window.ACN_MessageIndex.normalize(node.innerText || node.textContent);
      return { element: node, text: text || 'Attachment prompt', messageId: idNode ? idNode.getAttribute('data-message-id') : '' };
    });
  }

  function main() {
    return document.querySelector('main') || document.querySelector('[role="main"]');
  }

  function scroller(node) {
    for (var parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      var style = getComputedStyle(parent);
      if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 4) return parent;
    }
    return document.scrollingElement || document.documentElement;
  }

  return { messages: messages, main: main, scroller: scroller };
})();
