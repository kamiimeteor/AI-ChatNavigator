(function () {
  var Sidebar = window.ACN_Sidebar;
  var Observer = window.ACN_Observer;
  var adapters = window.ACN_Adapters || [];

  var MAX_RETRIES = 3;
  var RETRY_INTERVAL = 1000;

  var activeAdapter = null;

  function detectAdapter() {
    for (var i = 0; i < adapters.length; i++) {
      try {
        if (adapters[i].match()) return adapters[i];
      } catch (e) {
        // Adapter match failed — skip silently
      }
    }
    return null;
  }

  function resolveContainer(adapter, retriesLeft, callback) {
    var container = adapter.getContainer();
    if (container) {
      callback(container);
      return;
    }
    if (retriesLeft > 0) {
      setTimeout(function () {
        resolveContainer(adapter, retriesLeft - 1, callback);
      }, RETRY_INTERVAL);
    } else {
      callback(null);
    }
  }

  function detectMessages(adapter) {
    var messages = adapter.getUserMessages();
    if (messages.length > 0) {
      Sidebar.setState(Sidebar.STATES.READY);
      Sidebar.updateEntries(messages);
      Observer.trackActiveMessage(
        messages.map(function (m) { return m.element; }),
        function (el) { Sidebar.setActiveElement(el); }
      );
    } else {
      if (adapter.isLikelyEmptyConversation()) {
        Sidebar.setState(Sidebar.STATES.EMPTY);
      } else {
        Sidebar.setState(Sidebar.STATES.ERROR);
      }
    }
  }

  function onDOMMutation() {
    if (!activeAdapter) return;
    var messages = activeAdapter.getUserMessages();
    if (messages.length > 0) {
      Sidebar.setState(Sidebar.STATES.READY);
      Sidebar.updateEntries(messages);
      Observer.trackActiveMessage(
        messages.map(function (m) { return m.element; }),
        function (el) { Sidebar.setActiveElement(el); }
      );
    } else if (Sidebar.getState() === Sidebar.STATES.READY) {
      detectMessages(activeAdapter);
    }
  }

  function init() {
    Observer.destroyAll();
    Sidebar.destroy();

    setTimeout(function () {
      activeAdapter = detectAdapter();
      if (!activeAdapter) {
        return;
      }
      window.ACN_activeAdapter = activeAdapter;

      Sidebar.create();
      Sidebar.setState(Sidebar.STATES.LOADING);

      resolveContainer(activeAdapter, MAX_RETRIES, function (container) {
        if (!container) {
          Sidebar.setState(Sidebar.STATES.ERROR);
          return;
        }

        detectMessages(activeAdapter);
        Observer.watchDOM(container, onDOMMutation);
      });
    }, 500);
  }

  init();

  Observer.watchNavigation(function () {
    init();
  });

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === 'ACN_STATUS') {
      sendResponse({
        state: Sidebar.getState(),
        platform: activeAdapter ? activeAdapter.name : null,
        messageCount: Sidebar.getEntries().length
      });
    }
  });
})();
