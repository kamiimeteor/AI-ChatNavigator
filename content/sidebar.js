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
  var isClosed = false;

  function clearChildren(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
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

  function create() {
    if (sidebarEl) return;

    triggerEl = document.createElement('div');
    triggerEl.className = 'acn-trigger';
    var triggerIcon = document.createElement('span');
    triggerIcon.className = 'acn-trigger-icon';
    triggerIcon.textContent = 'Chat Nav';
    triggerEl.appendChild(triggerIcon);

    sidebarEl = document.createElement('div');
    sidebarEl.className = 'acn-sidebar';

    var header = document.createElement('div');
    header.className = 'acn-header';

    titleEl = document.createElement('span');
    titleEl.className = 'acn-title';
    titleEl.textContent = '';

    pinBtn = document.createElement('button');
    pinBtn.className = 'acn-btn acn-btn-pin';
    pinBtn.textContent = '\u{1F4CC}';
    pinBtn.title = 'Pin sidebar';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'acn-btn acn-btn-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.title = 'Close sidebar';

    header.appendChild(titleEl);
    header.appendChild(pinBtn);
    header.appendChild(closeBtn);

    tocListEl = document.createElement('div');
    tocListEl.className = 'acn-toc';

    stateTextEl = document.createElement('div');
    stateTextEl.className = 'acn-state-text';

    sidebarEl.appendChild(header);
    sidebarEl.appendChild(stateTextEl);
    sidebarEl.appendChild(tocListEl);
    document.body.appendChild(triggerEl);
    document.body.appendChild(sidebarEl);

    triggerEl.addEventListener('mouseenter', function () {
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

    pinBtn.addEventListener('click', function () {
      isPinned = !isPinned;
      pinBtn.classList.toggle('acn-pinned', isPinned);
      if (isPinned) {
        show();
      }
      savePersistence();
    });

    closeBtn.addEventListener('click', function () {
      hide();
      isPinned = false;
      isClosed = true;
      pinBtn.classList.remove('acn-pinned');
      savePersistence();
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
    loadPersistence();
  }

  function show() {
    if (sidebarEl) sidebarEl.classList.add('acn-visible');
    if (triggerEl) triggerEl.style.display = 'none';
  }

  function hide() {
    if (sidebarEl) sidebarEl.classList.remove('acn-visible');
    if (triggerEl) triggerEl.style.display = 'flex';
  }

  function updateTheme() {
    if (!sidebarEl) return;
    var dark = isDarkMode();
    sidebarEl.classList.toggle('acn-dark', dark);
    if (triggerEl) triggerEl.classList.toggle('acn-dark', dark);
  }

  function setState(newState) {
    state = newState;
    render();
  }

  function getState() {
    return state;
  }

  function render() {
    if (!sidebarEl) return;

    clearChildren(tocListEl);
    stateTextEl.textContent = '';
    stateTextEl.style.display = 'none';
    tocListEl.style.display = 'none';

    switch (state) {
      case STATES.LOADING:
        stateTextEl.style.display = 'block';
        stateTextEl.textContent = '';
        break;

      case STATES.EMPTY:
        stateTextEl.style.display = 'block';
        stateTextEl.textContent = 'Start chatting to see your TOC';
        break;

      case STATES.ERROR:
        stateTextEl.style.display = 'block';
        stateTextEl.textContent = 'No messages detected';
        break;

      case STATES.READY:
        tocListEl.style.display = 'block';
        renderTOC();
        break;
    }
  }

  function renderTOC() {
    clearChildren(tocListEl);
    var items = tocEntries.slice();
    items.forEach(function (entry) {
      var div = document.createElement('div');
      div.className = 'acn-toc-item';
      div.textContent = entry.label;
      div.addEventListener('click', function () { onTOCClick(entry); });
      tocListEl.appendChild(div);
    });
    tocListEl.scrollTop = tocListEl.scrollHeight;
  }

  function onTOCClick(entry) {
    var adapter = window.ACN_activeAdapter;
    if (adapter && entry.element) {
      adapter.scrollToMessage(entry.element);
      entry.element.classList.remove('acn-highlight-flash');
      void entry.element.offsetWidth;
      entry.element.classList.add('acn-highlight-flash');
      setTimeout(function () {
        entry.element.classList.remove('acn-highlight-flash');
      }, 1600);
    }
  }

  function updateEntries(messages) {
    tocEntries = messages.map(function (msg, i) {
      var text = msg.text.replace(/\n/g, ' ').trim();
      if (text.length > 50) text = text.substring(0, 50) + '\u2026';
      return {
        element: msg.element,
        text: msg.text,
        label: 'Q' + (i + 1) + ': ' + text
      };
    });
    if (state === STATES.READY) renderTOC();
  }

  function setActiveElement(element) {
    if (!tocListEl) return;
    var items = tocListEl.querySelectorAll('.acn-toc-item');
    items.forEach(function (item, idx) {
      var isActive = tocEntries[idx] && tocEntries[idx].element === element;
      item.classList.toggle('acn-active', isActive);
    });
  }

  function savePersistence() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ acn_pinned: isPinned, acn_closed: isClosed });
    }
  }

  function loadPersistence() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['acn_pinned', 'acn_closed'], function (result) {
        if (!pinBtn) return;
        if (result.acn_closed) {
          isClosed = true;
          return;
        }
        if (result.acn_pinned) {
          isPinned = true;
          pinBtn.classList.add('acn-pinned');
          show();
        }
      });
    }
  }

  function setTitle(text) {
    if (titleEl) titleEl.textContent = text || '';
  }

  function destroy() {
    if (fullscreenHandler) {
      document.removeEventListener('fullscreenchange', fullscreenHandler);
      fullscreenHandler = null;
    }
    if (triggerEl) { triggerEl.remove(); triggerEl = null; }
    if (sidebarEl) { sidebarEl.remove(); sidebarEl = null; }
    tocListEl = null;
    stateTextEl = null;
    pinBtn = null;
    titleEl = null;
    tocEntries = [];
    state = STATES.LOADING;
    isPinned = false;
    isHovering = false;
    isClosed = false;
  }

  return {
    STATES: STATES,
    create: create,
    destroy: destroy,
    show: show,
    hide: hide,
    setState: setState,
    getState: getState,
    updateEntries: updateEntries,
    setActiveElement: setActiveElement,
    setTitle: setTitle,
    updateTheme: updateTheme,
    getEntries: function () { return tocEntries; }
  };
})();
