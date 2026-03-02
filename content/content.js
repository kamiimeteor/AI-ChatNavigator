(function () {
  var Sidebar = window.ACN_Sidebar;
  var Observer = window.ACN_Observer;
  var adapters = window.ACN_Adapters || [];

  var MAX_RETRIES = 5;
  var RETRY_INTERVAL = 1000;

  var activeAdapter = null;

  console.log('[ACN] content.js loaded');
  console.log('[ACN] adapters found:', adapters.length);
  console.log('[ACN] Sidebar module:', !!Sidebar);
  console.log('[ACN] Observer module:', !!Observer);
  console.log('[ACN] hostname:', location.hostname);

  function detectAdapter() {
    for (var i = 0; i < adapters.length; i++) {
      try {
        console.log('[ACN] trying adapter:', adapters[i].name, '-> match():', adapters[i].match());
        if (adapters[i].match()) return adapters[i];
      } catch (e) {
        console.log('[ACN] adapter', adapters[i].name, 'match() error:', e.message);
      }
    }
    console.log('[ACN] no adapter matched');
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
    Observer.stopWatchingDOM();
    Observer.stopTrackingActive();
    Sidebar.destroy();

    console.log('[ACN] init() starting, will retry adapter detection');
    retryDetectAdapter(MAX_RETRIES);
  }

  function retryDetectAdapter(retriesLeft) {
    console.log('[ACN] retryDetectAdapter, retriesLeft:', retriesLeft);
    activeAdapter = detectAdapter();

    if (activeAdapter) {
      console.log('[ACN] adapter matched:', activeAdapter.name);
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
    } else if (retriesLeft > 0) {
      console.log('[ACN] no adapter yet, retrying in 1s...');
      setTimeout(function () {
        retryDetectAdapter(retriesLeft - 1);
      }, RETRY_INTERVAL);
    } else {
      console.log('[ACN] no adapter matched after all retries');
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
