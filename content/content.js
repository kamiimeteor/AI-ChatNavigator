(function () {
  var Sidebar = window.ACN_Sidebar;
  var Observer = window.ACN_Observer;
  var adapters = window.ACN_Adapters || [];

  var MAX_RETRIES = 10;
  var RETRY_INTERVAL = 1000;

  var activeAdapter = null;
  var initGeneration = 0;

  console.log('[ACN] content.js loaded');
  console.log('[ACN] adapters found:', adapters.length);
  console.log('[ACN] hostname:', location.hostname);

  function detectAdapter() {
    for (var i = 0; i < adapters.length; i++) {
      try {
        if (adapters[i].match()) return adapters[i];
      } catch (e) {
        console.log('[ACN] adapter', adapters[i].name, 'match() error:', e.message);
      }
    }
    return null;
  }

  function resolveContainer(adapter, retriesLeft, gen, callback) {
    if (gen !== initGeneration) return;
    var container = adapter.getContainer();
    if (container) {
      callback(container);
      return;
    }
    if (retriesLeft > 0) {
      setTimeout(function () {
        resolveContainer(adapter, retriesLeft - 1, gen, callback);
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
      Sidebar.setTitle(adapter.getChatTitle());
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
      Sidebar.setTitle(activeAdapter.getChatTitle());
      Observer.trackActiveMessage(
        messages.map(function (m) { return m.element; }),
        function (el) { Sidebar.setActiveElement(el); }
      );
    } else if (Sidebar.getState() === Sidebar.STATES.READY) {
      detectMessages(activeAdapter);
    }
  }

  function startContainerRecovery(adapter, gen) {
    Observer.watchDOM(document.body, function () {
      if (gen !== initGeneration) return;
      var container = adapter.getContainer();
      if (container) {
        Observer.stopWatchingDOM();
        detectMessages(adapter);
        Observer.watchDOM(container, onDOMMutation);
      }
    });
  }

  function init() {
    initGeneration++;
    var gen = initGeneration;

    Observer.stopWatchingDOM();
    Observer.stopTrackingActive();
    Sidebar.destroy();

    activeAdapter = detectAdapter();

    if (activeAdapter) {
      window.ACN_activeAdapter = activeAdapter;
      Sidebar.create();
      Sidebar.setState(Sidebar.STATES.LOADING);

      resolveContainer(activeAdapter, MAX_RETRIES, gen, function (container) {
        if (gen !== initGeneration) return;
        if (!container) {
          Sidebar.setState(Sidebar.STATES.ERROR);
          startContainerRecovery(activeAdapter, gen);
          return;
        }
        detectMessages(activeAdapter);
        Observer.watchDOM(container, onDOMMutation);
      });
    } else {
      setTimeout(function () {
        if (gen !== initGeneration) return;
        retryDetectAdapter(MAX_RETRIES, gen);
      }, RETRY_INTERVAL);
    }
  }

  function retryDetectAdapter(retriesLeft, gen) {
    if (gen !== initGeneration) return;
    activeAdapter = detectAdapter();

    if (activeAdapter) {
      window.ACN_activeAdapter = activeAdapter;
      Sidebar.create();
      Sidebar.setState(Sidebar.STATES.LOADING);

      resolveContainer(activeAdapter, MAX_RETRIES, gen, function (container) {
        if (gen !== initGeneration) return;
        if (!container) {
          Sidebar.setState(Sidebar.STATES.ERROR);
          startContainerRecovery(activeAdapter, gen);
          return;
        }
        detectMessages(activeAdapter);
        Observer.watchDOM(container, onDOMMutation);
      });
    } else if (retriesLeft > 0) {
      setTimeout(function () {
        retryDetectAdapter(retriesLeft - 1, gen);
      }, RETRY_INTERVAL);
    }
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
