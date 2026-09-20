window.ACN_Sidebar = (function () {
  var STATES = { LOADING: 'LOADING', EMPTY: 'EMPTY', READY: 'READY', ERROR: 'ERROR' };
  var state = STATES.LOADING;
  var isPinned = false;
  var isHovering = false;
  var tocEntries = [];

  var triggerEl = null;
  var sidebarEl = null;
  var tocListEl = null;
  var stateTextEl = null;
  var pinBtn = null;
  var titleEl = null;
  var fullscreenHandler = null;
  var mountObserver = null;
  var isClosed = false;
  var hasAutoShown = false;
  var activeElement = null;
  var navigationRequestId = 0;
  var messageIndex = window.ACN_MessageIndex.create();
  var itemNodes = new Map();
  var coverageEl = null;
  var noticeEl = null;
  var retryBtn = null;
  var retryHandler = null;
  var flashTimer = null;
  var flashElement = null;
  var mountGeneration = 0;

  function canUseStorage() {
    try {
      return !!(chrome &&
                chrome.runtime &&
                chrome.runtime.id &&
                chrome.storage &&
                chrome.storage.local);
    } catch (e) {
      return false;
    }
  }

  function isDarkMode() {
    var bg = getComputedStyle(document.body).backgroundColor;
    if (bg) {
      var match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        var brightness = (parseInt(match[1]) * 299 +
                          parseInt(match[2]) * 587 +
                          parseInt(match[3]) * 114) / 1000;
        return brightness < 128;
      }
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function isFullScreen() {
    return !!document.fullscreenElement;
  }

  function getMountTarget() {
    if (typeof document === 'undefined' || !document.documentElement) {
      return null;
    }
    return document.body || document.documentElement;
  }

  function mountNodes() {
    var mountTarget = getMountTarget();
    if (!mountTarget) return;

    if (triggerEl && !triggerEl.isConnected) {
      mountTarget.appendChild(triggerEl);
    }
    if (sidebarEl && !sidebarEl.isConnected) {
      mountTarget.appendChild(sidebarEl);
    }
  }

  function startMountObserver() {
    stopMountObserver();
    if (!document.documentElement) return;

    mountObserver = new MutationObserver(function () {
      if ((triggerEl && !triggerEl.isConnected) ||
          (sidebarEl && !sidebarEl.isConnected)) {
        mountNodes();
      }
    });

    mountObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function stopMountObserver() {
    if (mountObserver) {
      mountObserver.disconnect();
      mountObserver = null;
    }
  }

  function create() {
    if (sidebarEl) return;

    triggerEl = document.createElement('button');
    triggerEl.type = 'button';
    triggerEl.setAttribute('data-acn-root', '');
    triggerEl.setAttribute('aria-label', 'Open chat navigation');
    triggerEl.className = 'acn-trigger';
    var triggerIcon = document.createElement('span');
    triggerIcon.className = 'acn-trigger-icon';
    triggerIcon.textContent = 'Chat Nav';
    triggerEl.appendChild(triggerIcon);

    sidebarEl = document.createElement('div');
    sidebarEl.className = 'acn-sidebar';
    sidebarEl.setAttribute('data-acn-root', '');
    sidebarEl.setAttribute('aria-label', 'Chat navigation');

    var header = document.createElement('div');
    header.className = 'acn-header';

    titleEl = document.createElement('span');
    titleEl.className = 'acn-title';
    titleEl.textContent = '';

    pinBtn = document.createElement('button');
    pinBtn.className = 'acn-btn acn-btn-pin';
    pinBtn.type = 'button';
    pinBtn.setAttribute('aria-label', 'Pin sidebar');
    pinBtn.textContent = '\u{1F4CC}';
    pinBtn.title = 'Pin sidebar';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'acn-btn acn-btn-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close sidebar');
    closeBtn.textContent = '\u00D7';
    closeBtn.title = 'Close sidebar';

    header.appendChild(titleEl);
    header.appendChild(pinBtn);
    header.appendChild(closeBtn);

    tocListEl = document.createElement('div');
    tocListEl.className = 'acn-toc';

    stateTextEl = document.createElement('div');
    stateTextEl.className = 'acn-state-text';
    stateTextEl.setAttribute('role', 'status');
    coverageEl = document.createElement('div');
    coverageEl.className = 'acn-coverage';
    noticeEl = document.createElement('div');
    noticeEl.className = 'acn-notice';
    noticeEl.setAttribute('role', 'status');
    retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'acn-retry';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', function () { if (retryHandler) retryHandler(); });

    sidebarEl.appendChild(header);
    sidebarEl.appendChild(stateTextEl);
    sidebarEl.appendChild(retryBtn);
    sidebarEl.appendChild(tocListEl);
    sidebarEl.appendChild(noticeEl);
    sidebarEl.appendChild(coverageEl);
    mountNodes();
    startMountObserver();

    triggerEl.addEventListener('mouseenter', function () {
      if (!isFullScreen() && !isClosed) show();
    });
    triggerEl.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!isFullScreen() && !isClosed) show();
    });
    sidebarEl.addEventListener('mouseenter', function () {
      isHovering = true;
    });
    sidebarEl.addEventListener('mouseleave', function () {
      isHovering = false;
      if (!isPinned) hide();
    });
    triggerEl.addEventListener('mouseleave', function () {
      setTimeout(function () {
        if (!isHovering && !isPinned) hide();
      }, 100);
    });

    pinBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      isPinned = !isPinned;
      pinBtn.classList.toggle('acn-pinned', isPinned);
      if (isPinned) {
        show();
      }
      savePersistence();
    });

    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      close();
    });

    tocListEl.addEventListener('wheel', function (e) {
      e.stopPropagation();
    });

    fullscreenHandler = function () {
      if (isFullScreen()) {
        sidebarEl.classList.add('acn-fullscreen-hidden');
        triggerEl.classList.add('acn-fullscreen-hidden');
      } else {
        sidebarEl.classList.remove('acn-fullscreen-hidden');
        triggerEl.classList.remove('acn-fullscreen-hidden');
      }
    };
    document.addEventListener('fullscreenchange', fullscreenHandler);

    updateTheme();
    render();
    loadPersistence();
  }

  function show() {
    isClosed = false;
    hasAutoShown = true;
    mountNodes();
    if (sidebarEl) {
      sidebarEl.style.display = 'flex';
      sidebarEl.classList.add('acn-visible');
    }
    if (triggerEl) triggerEl.style.display = 'none';
  }

  function hide() {
    if (isClosed) {
      if (triggerEl) triggerEl.style.display = 'none';
      if (sidebarEl) {
        sidebarEl.classList.remove('acn-visible');
        sidebarEl.style.display = 'none';
      }
      return;
    }
    mountNodes();
    if (sidebarEl) {
      sidebarEl.style.display = 'flex';
      sidebarEl.classList.remove('acn-visible');
    }
    if (triggerEl) triggerEl.style.display = 'flex';
  }

  function close() {
    cancelNavigation();
    isPinned = false;
    isClosed = true;
    hasAutoShown = true;
    if (pinBtn) pinBtn.classList.remove('acn-pinned');
    mountNodes();
    if (sidebarEl) {
      sidebarEl.classList.remove('acn-visible');
      sidebarEl.style.display = 'none';
    }
    if (triggerEl) triggerEl.style.display = 'none';
    savePersistence();
  }

  function reopen() {
    isClosed = false;
    savePersistence();
    show();
  }

  function maybeAutoShow() {
    if (!sidebarEl || isClosed || hasAutoShown || isFullScreen()) return;
    show();
  }

  function updateTheme() {
    if (!sidebarEl) return;
    var dark = isDarkMode();
    sidebarEl.classList.toggle('acn-dark', dark);
    if (triggerEl) triggerEl.classList.toggle('acn-dark', dark);
  }

  function setState(newState) {
    if (state === newState) return;
    state = newState;
    render();
  }

  function getState() {
    return state;
  }

  function render() {
    if (!sidebarEl) return;
    mountNodes();
    var ready = state === STATES.READY;
    stateTextEl.style.display = ready ? 'none' : 'block';
    tocListEl.style.display = ready ? 'block' : 'none';
    coverageEl.style.display = ready ? 'block' : 'none';
    retryBtn.style.display = state === STATES.ERROR ? 'block' : 'none';
    var descriptions = {
      LOADING: 'Waiting for this chat to load…',
      EMPTY: 'Start chatting to see your prompts',
      ERROR: 'Could not read this chat. Retry, or refresh the page.'
    };
    var text = descriptions[state] || '';
    if (stateTextEl.textContent !== text) stateTextEl.textContent = text;
    if (!ready) setNotice('');
  }

  function setNotice(text) {
    if (noticeEl && noticeEl.textContent !== text) noticeEl.textContent = text;
  }

  function renderTOC() {
    if (!tocListEl) return;
    var scrollTop = tocListEl.scrollTop;
    var wanted = new Set(tocEntries.map(function (entry) { return entry.key; }));
    itemNodes.forEach(function (item, key) {
      if (!wanted.has(key)) { item.remove(); itemNodes.delete(key); }
    });
    tocEntries.forEach(function (entry, index) {
      var item = itemNodes.get(entry.key);
      if (!item) {
        item = document.createElement('button');
        item.type = 'button';
        item.className = 'acn-toc-item';
        item.addEventListener('click', function () { onTOCClick(item.acnEntry); });
        itemNodes.set(entry.key, item);
      }
      item.acnEntry = entry;
      if (item.textContent !== entry.label) item.textContent = entry.label;
      if (item.title !== entry.text) item.title = entry.text;
      var atIndex = tocListEl.children[index];
      if (atIndex !== item) tocListEl.insertBefore(item, atIndex || null);
    });
    tocListEl.scrollTop = scrollTop;
    syncActiveElement(false);
  }

  function cancelNavigation() {
    navigationRequestId++;
    window.ACN_Navigation.cancel();
    clearTimeout(flashTimer);
    if (flashElement) flashElement.classList.remove('acn-highlight-flash');
    flashElement = null;
    if (window.ACN_Observer) window.ACN_Observer.lockActiveMessage(null, 0);
  }

  async function onTOCClick(entry) {
    var adapter = window.ACN_activeAdapter;
    if (!adapter || !entry) return;
    cancelNavigation();
    var requestId = navigationRequestId;
    setNotice('');
    var result = await window.ACN_Navigation.navigate(adapter, entry);
    if (requestId !== navigationRequestId) return;
    if (result.status === 'cancelled') return;
    if (result.status !== 'success') {
      setNotice('This prompt changed or is no longer loaded. Try again after scrolling to it.');
      return;
    }
    activeElement = result.element;
    syncActiveElement(false);
    flashElement = result.element;
    flashElement.classList.add('acn-highlight-flash');
    flashTimer = setTimeout(function () {
      if (flashElement) flashElement.classList.remove('acn-highlight-flash');
      flashElement = null;
    }, 1600);
  }

  function updateEntries(messages) {
    var nextEntries = messageIndex.update(messages);
    var unchanged = nextEntries.length === tocEntries.length && nextEntries.every(function (entry, i) {
      var previous = tocEntries[i];
      return entry.key === previous.key && entry.text === previous.text && entry.element === previous.element;
    });
    if (unchanged) return;
    tocEntries = nextEntries;
    if (!tocEntries.some(function (entry) { return entry.element === activeElement; })) activeElement = null;
    renderTOC();
    if (coverageEl) {
      var summary = tocEntries.length + ' loaded prompt' + (tocEntries.length === 1 ? '' : 's') +
        ' · Earlier history may be missing';
      if (coverageEl.textContent !== summary) coverageEl.textContent = summary;
    }
  }

  function syncActiveElement(follow) {
    if (!tocListEl) return;
    var activeItem = null;
    itemNodes.forEach(function (item) {
      var active = item.acnEntry.element === activeElement;
      item.classList.toggle('acn-active', active);
      if (active) { item.setAttribute('aria-current', 'true'); activeItem = item; }
      else if (item.hasAttribute('aria-current')) item.removeAttribute('aria-current');
    });
    if (follow && activeItem && !isHovering && !tocListEl.contains(document.activeElement)) {
      var listRect = tocListEl.getBoundingClientRect();
      var itemRect = activeItem.getBoundingClientRect();
      // Scroll only the TOC, never its page ancestors.
      if (itemRect.top < listRect.top) tocListEl.scrollTop += itemRect.top - listRect.top;
      else if (itemRect.bottom > listRect.bottom) tocListEl.scrollTop += itemRect.bottom - listRect.bottom;
    }
  }

  function setActiveElement(element) {
    if (activeElement === element) return;
    activeElement = element;
    syncActiveElement(true);
  }

  function savePersistence() {
    if (!canUseStorage()) return;
    try {
      chrome.storage.local.set({ acn_pinned: isPinned });
    } catch (e) {
      // Ignore stale callbacks from an invalidated extension context.
    }
  }

  function loadPersistence() {
    if (!canUseStorage()) return;
    try {
      var currentMount = mountGeneration;
      chrome.storage.local.get(['acn_pinned'], function (result) {
        if (currentMount !== mountGeneration) return;
        if (!canUseStorage()) return;
        if (!pinBtn || isClosed) return;
        if (result && result.acn_pinned) {
          isPinned = true;
          pinBtn.classList.add('acn-pinned');
          show();
        }
      });
    } catch (e) {
      // Ignore stale callbacks from an invalidated extension context.
    }
  }

  function setTitle(text) {
    if (titleEl && titleEl.textContent !== (text || '')) titleEl.textContent = text || '';
  }

  function destroy() {
    cancelNavigation();
    mountGeneration++;
    messageIndex = window.ACN_MessageIndex.create();
    itemNodes.clear();
    retryHandler = null;
    retryBtn = null;
    noticeEl = null;
    coverageEl = null;
    if (fullscreenHandler) {
      document.removeEventListener('fullscreenchange', fullscreenHandler);
      fullscreenHandler = null;
    }
    stopMountObserver();
    if (triggerEl) { triggerEl.remove(); triggerEl = null; }
    if (sidebarEl) { sidebarEl.remove(); sidebarEl = null; }
    tocListEl = null;
    stateTextEl = null;
    pinBtn = null;
    titleEl = null;
    tocEntries = [];
    activeElement = null;
    state = STATES.LOADING;
    isPinned = false;
    isHovering = false;
    isClosed = false;
    hasAutoShown = false;
  }

  return {
    STATES: STATES,
    create: create,
    cancelNavigation: cancelNavigation,
    setRetryHandler: function (handler) { retryHandler = handler; },
    destroy: destroy,
    show: show,
    hide: hide,
    close: close,
    reopen: reopen,
    maybeAutoShow: maybeAutoShow,
    setState: setState,
    getState: getState,
    updateEntries: updateEntries,
    setActiveElement: setActiveElement,
    setTitle: setTitle,
    updateTheme: updateTheme,
    getEntries: function () { return tocEntries; }
  };
})();
