window.ACN_Observer = (function () {
  var mutationObs = null;
  var intersectionObs = null;
  var navigationCleanup = null;

  function watchDOM(container, onNewNodes) {
    stopWatchingDOM();
    mutationObs = new MutationObserver(function (mutations) {
      var hasNew = false;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length > 0) {
          hasNew = true;
          break;
        }
      }
      if (hasNew) onNewNodes();
    });
    mutationObs.observe(container, { childList: true, subtree: true });
  }

  function stopWatchingDOM() {
    if (mutationObs) {
      mutationObs.disconnect();
      mutationObs = null;
    }
  }

  function trackActiveMessage(messageElements, onActiveChange) {
    stopTrackingActive();
    if (messageElements.length === 0) return;

    var currentActive = null;

    intersectionObs = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting && entries[i].target !== currentActive) {
          currentActive = entries[i].target;
          onActiveChange(entries[i].target);
        }
      }
    }, { threshold: 0.3 });

    messageElements.forEach(function (el) { intersectionObs.observe(el); });
  }

  function stopTrackingActive() {
    if (intersectionObs) {
      intersectionObs.disconnect();
      intersectionObs = null;
    }
  }

  function watchNavigation(onNavigate) {
    stopWatchingNavigation();

    var debounceTimer = null;
    function debouncedNavigate() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(onNavigate, 300);
    }

    var origPushState = history.pushState;
    history.pushState = function () {
      origPushState.apply(this, arguments);
      debouncedNavigate();
    };

    var origReplaceState = history.replaceState;
    history.replaceState = function () {
      origReplaceState.apply(this, arguments);
      debouncedNavigate();
    };

    window.addEventListener('popstate', debouncedNavigate);

    navigationCleanup = function () {
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      window.removeEventListener('popstate', debouncedNavigate);
      clearTimeout(debounceTimer);
    };
  }

  function stopWatchingNavigation() {
    if (navigationCleanup) {
      navigationCleanup();
      navigationCleanup = null;
    }
  }

  function destroyAll() {
    stopWatchingDOM();
    stopTrackingActive();
    stopWatchingNavigation();
  }

  return {
    watchDOM: watchDOM,
    stopWatchingDOM: stopWatchingDOM,
    trackActiveMessage: trackActiveMessage,
    stopTrackingActive: stopTrackingActive,
    watchNavigation: watchNavigation,
    stopWatchingNavigation: stopWatchingNavigation,
    destroyAll: destroyAll
  };
})();
