(function () {
  var Sidebar = window.ACN_Sidebar;
  var Observer = window.ACN_Observer;
  var activeAdapter = null;
  var container = null;
  var trackedElements = [];
  var healthTimer = null;
  var generation = 0;
  var deadline = 0;
  var suspended = false;
  var historyAttempted = false;

  function loadHistory(delay) {
    if (!activeAdapter || !activeAdapter.getHistorySnapshot) return;
    historyAttempted = true;
    Sidebar.cancelNavigation();
    window.ACN_HistoryLoader.start(activeAdapter, refresh, Sidebar.setHistoryState, delay);
  }

  function stop() {
    generation++;
    clearInterval(healthTimer);
    healthTimer = null;
    window.ACN_HistoryLoader.cancel();
    historyAttempted = false;
    Observer.destroyAll();
    Sidebar.cancelNavigation();
    container = null;
    trackedElements = [];
  }

  function track(messages) {
    var elements = messages.map(function (message) { return message.element; });
    if (elements.length === trackedElements.length && elements.every(function (el, i) { return el === trackedElements[i]; })) return;
    trackedElements = elements;
    Observer.trackActiveMessage(elements, Sidebar.setActiveElement);
  }

  function refresh() {
    if (!activeAdapter || suspended) return;
    try {
      var nextContainer = activeAdapter.getContainer();
      if (nextContainer !== container || (container && !container.isConnected)) {
        window.ACN_HistoryLoader.cancel();
        historyAttempted = false;
        Sidebar.cancelNavigation();
        Observer.stopWatchingDOM();
        container = nextContainer && nextContainer.isConnected ? nextContainer : null;
        deadline = Date.now() + 10000;
        if (container) {
          var currentGeneration = generation;
          Observer.watchDOM(container, function () {
            if (currentGeneration === generation) refresh();
          });
        }
      }
      var messages = container ? activeAdapter.getUserMessages() : [];
      Sidebar.updateEntries(messages);
      track(messages);
      if (messages.length) {
        Sidebar.setState(Sidebar.STATES.READY);
        Sidebar.setTitle(activeAdapter.getChatTitle());
        Sidebar.maybeAutoShow();
        if (!historyAttempted && activeAdapter.getHistorySnapshot) loadHistory();
      } else if (Date.now() < deadline) {
        Sidebar.setState(Sidebar.STATES.LOADING);
      } else if (container && activeAdapter.isLikelyEmptyConversation()) {
        Sidebar.setState(Sidebar.STATES.EMPTY);
      } else {
        Sidebar.setState(Sidebar.STATES.ERROR);
      }
    } catch (error) {
      Sidebar.cancelNavigation();
      Sidebar.updateEntries([]);
      track([]);
      Sidebar.setState(Sidebar.STATES.ERROR);
    }
  }

  function init() {
    stop();
    Sidebar.destroy();
    activeAdapter = (window.ACN_Adapters || []).find(function (adapter) { return adapter.match(); }) || null;
    window.ACN_activeAdapter = activeAdapter;
    Observer.watchNavigation(init);
    if (!activeAdapter) return;
    deadline = Date.now() + 10000;
    Sidebar.create();
    Sidebar.setRetryHandler(init);
    Sidebar.setHistoryHandler(function () { loadHistory(0); });
    refresh();
    // Recover replaced containers and messages arriving after the deadline.
    healthTimer = setInterval(function () { if (!document.hidden) refresh(); }, 1000);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !suspended) refresh();
  });
  window.addEventListener('pagehide', function () { suspended = true; stop(); });
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) { suspended = false; init(); }
  });
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === 'ACN_STATUS') {
      sendResponse({ state: activeAdapter ? Sidebar.getState() : 'UNSUPPORTED',
        platform: activeAdapter ? activeAdapter.name : null,
        messageCount: Sidebar.getEntries().length, coverage: activeAdapter && activeAdapter.coverage || 'loaded-only' });
    } else if (msg.type === 'ACN_SHOW_SIDEBAR') {
      if (activeAdapter) Sidebar.reopen();
      sendResponse({ ok: !!activeAdapter });
    } else if (msg.type === 'ACN_RETRY') {
      init();
      sendResponse({ ok: !!activeAdapter });
    }
  });
  init();
})();
