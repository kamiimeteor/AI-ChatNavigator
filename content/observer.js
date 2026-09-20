window.ACN_Observer = (function () {
  var mutationObs = null;
  var intersectionObs = null;
  var navigationCleanup = null;
  var trackedEntries = new Map();
  var currentActive = null;
  var activeChangeHandler = null;
  var activeLockUntil = 0;
  var activeLockTarget = null;

  var mutationTimer = null;

  function isOwned(node) {
    var element = node && (node.nodeType === 1 ? node : node.parentElement);
    return !!(element && element.closest('[data-acn-root]'));
  }

  function watchDOM(container, onNewNodes) {
    stopWatchingDOM();
    mutationObs = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (mutation) {
        if (isOwned(mutation.target)) return false;
        if (mutation.type !== 'childList') return true;
        return Array.from(mutation.addedNodes).concat(Array.from(mutation.removedNodes)).some(function (node) {
          return !isOwned(node);
        });
      });
      // Throttle, not debounce: a continuous stream must not starve updates.
      if (relevant && mutationTimer === null) {
        mutationTimer = setTimeout(function () {
          mutationTimer = null;
          onNewNodes();
        }, 50);
      }
    });
    mutationObs.observe(container, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['data-message-id', 'data-message-author-role', 'data-testid', 'aria-hidden', 'hidden', 'class']
    });
  }

  function stopWatchingDOM() {
    clearTimeout(mutationTimer);
    mutationTimer = null;
    if (mutationObs) mutationObs.disconnect();
    mutationObs = null;
  }

  function pickBestActiveTarget() {
    var viewportCenter = window.innerHeight / 2;
    var bestTarget = null;
    var bestScore = Infinity;

    trackedEntries.forEach(function (entry, element) {
      if (!entry || !entry.isIntersecting || entry.intersectionRatio <= 0) return;

      if (!element.isConnected) return;
      var rect = element.getBoundingClientRect();
      var elementCenter = rect.top + (rect.height / 2);
      var distanceToCenter = Math.abs(elementCenter - viewportCenter);
      var score = distanceToCenter - (entry.intersectionRatio * 100);

      if (score < bestScore) {
        bestScore = score;
        bestTarget = element;
      }
    });

    return bestTarget;
  }

  function emitActiveChange(target) {
    if (!target || target === currentActive || !activeChangeHandler) return;
    currentActive = target;
    activeChangeHandler(target);
  }

  function recomputeActiveTarget() {
    if (!activeChangeHandler) return;

    if (activeLockTarget && Date.now() < activeLockUntil) {
      emitActiveChange(activeLockTarget);
      return;
    }

    activeLockTarget = null;
    activeLockUntil = 0;
    emitActiveChange(pickBestActiveTarget());
  }

  function trackActiveMessage(messageElements, onActiveChange) {
    stopTrackingActive();
    if (messageElements.length === 0) return;

    activeChangeHandler = onActiveChange;
    trackedEntries = new Map();
    currentActive = null;
    activeLockUntil = 0;
    activeLockTarget = null;

    intersectionObs = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        trackedEntries.set(entries[i].target, entries[i]);
      }
      recomputeActiveTarget();
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });

    messageElements.forEach(function (el) { intersectionObs.observe(el); });
  }

  function lockActiveMessage(element, durationMs) {
    activeLockTarget = element || null;
    activeLockUntil = Date.now() + (durationMs || 0);
    recomputeActiveTarget();
  }

  function stopTrackingActive() {
    if (intersectionObs) {
      intersectionObs.disconnect();
      intersectionObs = null;
    }
    trackedEntries = new Map();
    currentActive = null;
    activeChangeHandler = null;
    activeLockUntil = 0;
    activeLockTarget = null;
  }

  function watchNavigation(onNavigate) {
    stopWatchingNavigation();
    var lastUrl = location.href;
    function checkURL() {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      onNavigate();
    }
    // Content scripts are isolated from the site's history wrappers. Keep a
    // bounded URL poll rather than monkey-patching history in the wrong world.
    var timer = setInterval(checkURL, 250);
    window.addEventListener('popstate', checkURL);
    window.addEventListener('hashchange', checkURL);
    navigationCleanup = function () {
      clearInterval(timer);
      window.removeEventListener('popstate', checkURL);
      window.removeEventListener('hashchange', checkURL);
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
    lockActiveMessage: lockActiveMessage,
    stopTrackingActive: stopTrackingActive,
    watchNavigation: watchNavigation,
    stopWatchingNavigation: stopWatchingNavigation,
    destroyAll: destroyAll
  };
})();
