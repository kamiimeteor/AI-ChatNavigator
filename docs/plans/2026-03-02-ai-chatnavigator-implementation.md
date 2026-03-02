# AI ChatNavigator — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome extension that adds a real-time TOC sidebar to ChatGPT, Claude, Gemini, and Grok chat pages.

**Architecture:** Platform Adapter Pattern — content scripts detect the current platform, load the matching adapter for DOM queries, and render a shared sidebar overlay. A state machine (LOADING → READY / EMPTY / ERROR) drives all UI rendering.

**Tech Stack:** Vanilla JS, Chrome Extension Manifest V3, CSS, no build step, zero dependencies.

**Testing Note:** MVP uses structured manual testing (14 test cases). No automated tests — the extension depends on third-party DOM that can't be reliably mocked. Each task includes a manual verification step.

---

### Task 1: Project Scaffolding — manifest.json + Folder Structure

**Files:**
- Create: `manifest.json`
- Create: `icons/icon16.png`
- Create: `icons/icon48.png`
- Create: `icons/icon128.png`

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "AI ChatNavigator",
  "version": "1.0.0",
  "description": "Real-time table of contents for AI chat platforms. Never get lost in long conversations again.",
  "permissions": ["storage"],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_scripts": [
    {
      "matches": [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
        "https://grok.com/*"
      ],
      "js": [
        "content/adapters/chatgpt.js",
        "content/adapters/claude.js",
        "content/adapters/gemini.js",
        "content/adapters/grok.js",
        "content/observer.js",
        "content/sidebar.js",
        "content/content.js"
      ],
      "css": ["styles/sidebar.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    }
  }
}
```

**Step 2: Create placeholder icons**

Generate simple colored square PNG icons at 16x16, 48x48, and 128x128. Use a canvas-based generator script or any simple icon. These are placeholders — replace with proper icons later.

**Step 3: Create empty directory structure**

Ensure these directories exist:
- `content/adapters/`
- `popup/`
- `styles/`

**Step 4: Verify — load in Chrome**

1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked" -> select project root
4. Verify extension loads without errors
5. Verify icon appears in toolbar

**Step 5: Commit**

```bash
git add manifest.json icons/
git commit -m "feat: project scaffolding with manifest v3 and placeholder icons"
```

---

### Task 2: Sidebar CSS — Light Mode, Dark Mode, Animations

**Files:**
- Create: `styles/sidebar.css`

**Step 1: Write the full sidebar stylesheet**

```css
/* ============================================
   AI ChatNavigator — Sidebar Styles
   ============================================ */

/* --- Trigger Zone (invisible hover area on right edge) --- */
.acn-trigger {
  position: fixed;
  top: 0;
  right: 0;
  width: 12px;
  height: 100vh;
  z-index: 9998;
  cursor: pointer;
}

/* --- Sidebar Card --- */
.acn-sidebar {
  position: fixed;
  right: -200px;
  top: 50%;
  transform: translateY(-50%);
  width: 184px;
  height: 240px;
  z-index: 9999;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  transition: right 0.25s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;

  /* Light mode defaults */
  background: #FFFFFF;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(13, 13, 13, 0.15);
  color: #0D0D0D;
}

/* Sidebar visible state */
.acn-sidebar.acn-visible {
  right: 8px;
}

/* --- Dark Mode --- */
.acn-sidebar.acn-dark {
  background: #131D2B;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  color: #E6EDF3;
}

.acn-sidebar.acn-dark .acn-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.acn-sidebar.acn-dark .acn-toc-item {
  color: rgba(255, 255, 255, 0.65);
}

.acn-sidebar.acn-dark .acn-toc-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #E6EDF3;
}

.acn-sidebar.acn-dark .acn-toc-item.acn-active {
  color: #E6EDF3;
}

.acn-sidebar.acn-dark .acn-state-text {
  color: rgba(255, 255, 255, 0.45);
}

/* --- Header --- */
.acn-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(13, 13, 13, 0.1);
  flex-shrink: 0;
  gap: 4px;
}

.acn-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 13px;
  opacity: 0.5;
  transition: opacity 0.15s;
  color: inherit;
  line-height: 1;
}

.acn-btn:hover {
  opacity: 1;
}

.acn-btn-pin.acn-pinned {
  opacity: 1;
}

/* --- TOC List --- */
.acn-toc {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.acn-toc-item {
  padding: 5px 10px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(13, 13, 13, 0.65);
  transition: background 0.15s, color 0.15s;
}

.acn-toc-item:hover {
  background: rgba(13, 13, 13, 0.04);
  color: #0D0D0D;
}

.acn-toc-item.acn-active {
  color: #0D0D0D;
  font-weight: 500;
}

.acn-toc-item.acn-active::before {
  content: '\u25CF';
  margin-right: 4px;
  color: #03A9F4;
  font-size: 8px;
  vertical-align: middle;
}

/* --- State Text (LOADING / EMPTY / ERROR) --- */
.acn-state-text {
  padding: 20px 12px;
  text-align: center;
  color: rgba(13, 13, 13, 0.4);
  font-size: 11px;
}

/* --- Highlight Flash (applied to chat messages) --- */
@keyframes acnMessageFlash {
  0% { background: rgba(3, 169, 244, 0.6); }
  100% { background: rgba(3, 169, 244, 0); }
}

.acn-highlight-flash {
  animation: acnMessageFlash 1.5s ease-out forwards;
}

/* Dark mode highlight */
@keyframes acnMessageFlashDark {
  0% { background: rgba(3, 169, 244, 0.45); }
  100% { background: rgba(3, 169, 244, 0); }
}

/* --- Fullscreen: hide everything --- */
.acn-fullscreen-hidden {
  display: none !important;
}

/* --- Scrollbar styling for TOC --- */
.acn-toc::-webkit-scrollbar {
  width: 3px;
}

.acn-toc::-webkit-scrollbar-track {
  background: transparent;
}

.acn-toc::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}

.acn-sidebar.acn-dark .acn-toc::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
```

**Step 2: Verify — reload extension**

1. Reload extension in `chrome://extensions/`
2. Open any of the 4 platform URLs
3. Inspect page -> verify `sidebar.css` is injected (check DevTools Sources)
4. No console errors

**Step 3: Commit**

```bash
git add styles/sidebar.css
git commit -m "feat: sidebar CSS with light/dark mode, animations, scroll styling"
```

---

### Task 3: Platform Adapters — All 4 Platforms

**Files:**
- Create: `content/adapters/chatgpt.js`
- Create: `content/adapters/claude.js`
- Create: `content/adapters/gemini.js`
- Create: `content/adapters/grok.js`

**Step 1: Write ChatGPT adapter**

```js
// content/adapters/chatgpt.js
window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'chatgpt',

  match() {
    const correctHost = location.hostname.includes('chatgpt.com') ||
                        location.hostname.includes('chat.openai.com');
    const hasChat = !!document.querySelector('[data-message-author-role]');
    return correctHost && hasChat;
  },

  getContainer() {
    const article = document.querySelector('article');
    return article ? article.parentElement : null;
  },

  getUserMessages() {
    const els = document.querySelectorAll('[data-message-author-role="user"]');
    return Array.from(els).map(el => ({
      element: el,
      text: (el.innerText || '').trim()
    }));
  },

  scrollToMessage(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  isLikelyEmptyConversation() {
    const container = this.getContainer();
    if (!container) return false;
    const hasMessages = container.querySelectorAll('article').length > 0;
    return !hasMessages;
  }
});
```

**Step 2: Write Claude adapter**

```js
// content/adapters/claude.js
window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'claude',

  match() {
    const correctHost = location.hostname.includes('claude.ai');
    const hasChat = !!document.querySelector('[data-testid="user-message"]') ||
                    !!document.querySelector('.font-user-message');
    return correctHost && hasChat;
  },

  getContainer() {
    const renderCount = document.querySelector('div[data-test-render-count]');
    return renderCount ? renderCount.parentElement : null;
  },

  getUserMessages() {
    var els = document.querySelectorAll('[data-testid="user-message"]');
    if (els.length === 0) {
      els = document.querySelectorAll('.font-user-message');
    }
    return Array.from(els).map(el => ({
      element: el,
      text: (el.innerText || '').trim()
    }));
  },

  scrollToMessage(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  isLikelyEmptyConversation() {
    const correctHost = location.hostname.includes('claude.ai');
    if (!correctHost) return false;
    const hasAnyMessage = document.querySelector('[data-testid="user-message"]') ||
                          document.querySelector('.font-user-message') ||
                          document.querySelector('.font-claude-message');
    return !hasAnyMessage;
  }
});
```

**Step 3: Write Gemini adapter**

```js
// content/adapters/gemini.js
window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'gemini',

  match() {
    const correctHost = location.hostname.includes('gemini.google.com');
    const hasChat = !!document.querySelector('user-query') ||
                    !!document.querySelector('user-query-content');
    return correctHost && hasChat;
  },

  getContainer() {
    return document.querySelector('#chat-history') ||
           document.querySelector('.conversation-container') ||
           document.querySelector('infinite-scroller');
  },

  getUserMessages() {
    var els = document.querySelectorAll('user-query-content');
    if (els.length === 0) {
      els = document.querySelectorAll('user-query');
    }
    return Array.from(els).map(el => ({
      element: el,
      text: (el.innerText || '').trim()
    }));
  },

  scrollToMessage(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  isLikelyEmptyConversation() {
    const correctHost = location.hostname.includes('gemini.google.com');
    if (!correctHost) return false;
    const hasAnyQuery = document.querySelector('user-query') ||
                        document.querySelector('user-query-content');
    const hasAnyResponse = document.querySelector('model-response') ||
                           document.querySelector('message-content');
    return !hasAnyQuery && !hasAnyResponse;
  }
});
```

**Step 4: Write Grok adapter**

```js
// content/adapters/grok.js
window.ACN_Adapters = window.ACN_Adapters || [];
window.ACN_Adapters.push({
  name: 'grok',

  match() {
    const correctHost = location.hostname.includes('grok.com');
    const hasChat = !!document.querySelector('.message-bubble');
    return correctHost && hasChat;
  },

  getContainer() {
    const lastReply = document.querySelector('#last-reply-container');
    return lastReply ? lastReply.parentElement : null;
  },

  getUserMessages() {
    const allBubbles = document.querySelectorAll('.message-bubble');
    const userMessages = [];
    allBubbles.forEach(bubble => {
      if (bubble.classList.contains('bg-foreground') &&
          bubble.classList.contains('border-input-border')) {
        userMessages.push({
          element: bubble,
          text: (bubble.innerText || '').trim()
        });
      }
    });
    return userMessages;
  },

  scrollToMessage(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  isLikelyEmptyConversation() {
    const correctHost = location.hostname.includes('grok.com');
    if (!correctHost) return false;
    const hasBubbles = document.querySelector('.message-bubble');
    return !hasBubbles;
  }
});
```

**Step 5: Verify — reload extension**

1. Reload extension in `chrome://extensions/`
2. Open browser console on any platform
3. Type `window.ACN_Adapters` -> verify array of 4 adapter objects
4. No console errors

**Step 6: Commit**

```bash
git add content/adapters/
git commit -m "feat: platform adapters for ChatGPT, Claude, Gemini, Grok"
```

---

### Task 4: Observer Module — MutationObserver + SPA Navigation

**Files:**
- Create: `content/observer.js`

**Step 1: Write the observer module**

```js
// content/observer.js
window.ACN_Observer = (function () {
  var mutationObs = null;
  var intersectionObs = null;
  var navigationCleanup = null;

  /**
   * Watch for new DOM nodes added to the chat container.
   * Calls onNewNodes whenever childList mutations occur.
   */
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

  /**
   * Track which user message is currently in view.
   * Calls onActiveChange(element) when the visible message changes.
   */
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

  /**
   * Detect SPA navigation (URL changes without full page reload).
   * Calls onNavigate after a 300ms debounce.
   */
  function watchNavigation(onNavigate) {
    stopWatchingNavigation();

    var debounceTimer = null;
    function debouncedNavigate() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(onNavigate, 300);
    }

    // Override history.pushState
    var origPushState = history.pushState;
    history.pushState = function () {
      origPushState.apply(this, arguments);
      debouncedNavigate();
    };

    // Override history.replaceState
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

  /** Tear down all observers. */
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
```

**Step 2: Verify — reload extension**

1. Reload extension
2. Open console on a chat page
3. Type `window.ACN_Observer` -> verify object with expected methods
4. No console errors

**Step 3: Commit**

```bash
git add content/observer.js
git commit -m "feat: observer module for DOM mutations, active tracking, SPA navigation"
```

---

### Task 5: Sidebar JS — TOC Rendering, State Machine, Interactions

**Files:**
- Create: `content/sidebar.js`

**Step 1: Write the sidebar module**

Uses only safe DOM methods (createElement, textContent, appendChild, removeChild). No innerHTML.

```js
// content/sidebar.js
window.ACN_Sidebar = (function () {
  // --- State ---
  var STATES = { LOADING: 'LOADING', EMPTY: 'EMPTY', READY: 'READY', ERROR: 'ERROR' };
  var state = STATES.LOADING;
  var isPinned = false;
  var isHovering = false;
  var tocEntries = []; // { element, text, label }

  // --- DOM refs ---
  var triggerEl = null;
  var sidebarEl = null;
  var tocListEl = null;
  var stateTextEl = null;
  var pinBtn = null;

  // --- Helper: remove all children safely ---
  function clearChildren(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  // --- Dark mode detection ---
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

  // --- Fullscreen detection ---
  function isFullScreen() {
    return !!document.fullscreenElement;
  }

  // --- Build DOM ---
  function create() {
    if (sidebarEl) return; // already created

    // Trigger zone
    triggerEl = document.createElement('div');
    triggerEl.className = 'acn-trigger';

    // Sidebar card
    sidebarEl = document.createElement('div');
    sidebarEl.className = 'acn-sidebar';

    // Header
    var header = document.createElement('div');
    header.className = 'acn-header';

    pinBtn = document.createElement('button');
    pinBtn.className = 'acn-btn acn-btn-pin';
    pinBtn.textContent = '\u{1F4CC}'; // pin emoji
    pinBtn.title = 'Pin sidebar';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'acn-btn acn-btn-close';
    closeBtn.textContent = '\u00D7'; // x
    closeBtn.title = 'Close sidebar';

    header.appendChild(pinBtn);
    header.appendChild(closeBtn);

    // TOC list
    tocListEl = document.createElement('div');
    tocListEl.className = 'acn-toc';

    // State text (for LOADING/EMPTY/ERROR)
    stateTextEl = document.createElement('div');
    stateTextEl.className = 'acn-state-text';

    sidebarEl.appendChild(header);
    sidebarEl.appendChild(stateTextEl);
    sidebarEl.appendChild(tocListEl);
    document.body.appendChild(triggerEl);
    document.body.appendChild(sidebarEl);

    // --- Event listeners ---

    // Hover to reveal
    triggerEl.addEventListener('mouseenter', function () {
      if (!isFullScreen()) show();
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

    // Pin toggle
    pinBtn.addEventListener('click', function () {
      isPinned = !isPinned;
      pinBtn.classList.toggle('acn-pinned', isPinned);
      if (isPinned) {
        show();
      }
      savePersistence();
    });

    // Close
    closeBtn.addEventListener('click', function () {
      hide();
      isPinned = false;
      pinBtn.classList.remove('acn-pinned');
      savePersistence();
    });

    // Scroll isolation
    tocListEl.addEventListener('wheel', function (e) {
      e.stopPropagation();
    });

    // Fullscreen listener
    document.addEventListener('fullscreenchange', function () {
      if (isFullScreen()) {
        sidebarEl.classList.add('acn-fullscreen-hidden');
        triggerEl.classList.add('acn-fullscreen-hidden');
      } else {
        sidebarEl.classList.remove('acn-fullscreen-hidden');
        triggerEl.classList.remove('acn-fullscreen-hidden');
      }
    });

    // Apply dark mode
    updateTheme();

    // Restore persisted state
    loadPersistence();
  }

  function show() {
    if (sidebarEl) sidebarEl.classList.add('acn-visible');
  }

  function hide() {
    if (sidebarEl) sidebarEl.classList.remove('acn-visible');
  }

  function updateTheme() {
    if (!sidebarEl) return;
    sidebarEl.classList.toggle('acn-dark', isDarkMode());
  }

  // --- State machine rendering ---
  function setState(newState) {
    state = newState;
    render();
  }

  function getState() {
    return state;
  }

  function render() {
    if (!sidebarEl) return;

    // Clear both containers
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
    // Show latest messages at top
    var items = tocEntries.slice();
    items.reverse();
    items.forEach(function (entry) {
      var div = document.createElement('div');
      div.className = 'acn-toc-item';
      div.textContent = entry.label;
      div.addEventListener('click', function () { onTOCClick(entry); });
      tocListEl.appendChild(div);
    });
  }

  function onTOCClick(entry) {
    var adapter = window.ACN_activeAdapter;
    if (adapter && entry.element) {
      adapter.scrollToMessage(entry.element);
      // Apply highlight flash
      entry.element.classList.remove('acn-highlight-flash');
      // Force reflow to restart animation
      void entry.element.offsetWidth;
      entry.element.classList.add('acn-highlight-flash');
      setTimeout(function () {
        entry.element.classList.remove('acn-highlight-flash');
      }, 1600);
    }
  }

  // --- Update TOC entries from adapter data ---
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

  // --- Active tracking callback ---
  function setActiveElement(element) {
    if (!tocListEl) return;
    var items = tocListEl.querySelectorAll('.acn-toc-item');
    var reversedEntries = tocEntries.slice().reverse();
    items.forEach(function (item, idx) {
      var isActive = reversedEntries[idx] && reversedEntries[idx].element === element;
      item.classList.toggle('acn-active', isActive);
    });
  }

  // --- Persistence ---
  function savePersistence() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ acn_pinned: isPinned });
    }
  }

  function loadPersistence() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['acn_pinned'], function (result) {
        if (result.acn_pinned) {
          isPinned = true;
          pinBtn.classList.add('acn-pinned');
          show();
        }
      });
    }
  }

  // --- Cleanup ---
  function destroy() {
    if (triggerEl) { triggerEl.remove(); triggerEl = null; }
    if (sidebarEl) { sidebarEl.remove(); sidebarEl = null; }
    tocListEl = null;
    stateTextEl = null;
    pinBtn = null;
    tocEntries = [];
    state = STATES.LOADING;
    isPinned = false;
    isHovering = false;
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
    updateTheme: updateTheme,
    getEntries: function () { return tocEntries; }
  };
})();
```

**Step 2: Verify — reload extension**

1. Reload extension
2. Open console on a chat page
3. Type `window.ACN_Sidebar` -> verify object with expected methods
4. No console errors

**Step 3: Commit**

```bash
git add content/sidebar.js
git commit -m "feat: sidebar module with state machine, TOC rendering, pin/hover/close"
```

---

### Task 6: Content.js — Entry Point and Orchestration

**Files:**
- Create: `content/content.js`

**Step 1: Write the entry point**

```js
// content/content.js
(function () {
  var Sidebar = window.ACN_Sidebar;
  var Observer = window.ACN_Observer;
  var adapters = window.ACN_Adapters || [];

  var MAX_RETRIES = 3;
  var RETRY_INTERVAL = 1000;

  var activeAdapter = null;

  /** Find the first adapter whose match() returns true. */
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

  /** Attempt to resolve the chat container with retries. */
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

  /** Run message detection and transition state. */
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

  /** Handle new DOM mutations — re-detect messages. */
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
      // Messages disappeared — re-run detection
      detectMessages(activeAdapter);
    }
  }

  /** Main initialization flow. */
  function init() {
    // Cleanup previous run
    Observer.destroyAll();
    Sidebar.destroy();

    // Detect adapter — small delay for SPA pages still rendering
    setTimeout(function () {
      activeAdapter = detectAdapter();
      if (!activeAdapter) {
        // No adapter matched — not on a chat page. Do nothing.
        return;
      }
      window.ACN_activeAdapter = activeAdapter;

      // Create sidebar
      Sidebar.create();
      Sidebar.setState(Sidebar.STATES.LOADING);

      // Resolve container with retries
      resolveContainer(activeAdapter, MAX_RETRIES, function (container) {
        if (!container) {
          Sidebar.setState(Sidebar.STATES.ERROR);
          return;
        }

        // Container found — detect messages
        detectMessages(activeAdapter);

        // Watch for new messages
        Observer.watchDOM(container, onDOMMutation);
      });
    }, 500);
  }

  // --- Bootstrap ---
  init();

  // Watch for SPA navigation
  Observer.watchNavigation(function () {
    init();
  });

  // --- Message listener for popup ---
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
```

**Step 2: Verify — full integration test**

1. Reload extension in `chrome://extensions/`
2. Open ChatGPT with an existing conversation (10+ messages)
3. Hover right edge -> sidebar should slide out with TOC entries
4. Click a TOC entry -> page should scroll + blue highlight flash
5. Pin sidebar -> should stay visible after mouse leaves
6. Close sidebar -> should hide
7. Check console for any errors

**Step 3: Commit**

```bash
git add content/content.js
git commit -m "feat: content entry point with adapter detection, state machine, observer wiring"
```

---

### Task 7: Popup — Informational Status Page

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.js`

**Step 1: Write popup HTML**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      width: 200px;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #333;
      margin: 0;
    }
    h1 {
      font-size: 14px;
      margin: 0 0 10px 0;
      font-weight: 600;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .label { color: #888; }
    .value { font-weight: 500; }
    .status-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 4px;
      vertical-align: middle;
    }
    .status-dot.active { background: #4CAF50; }
    .status-dot.inactive { background: #CCC; }
  </style>
</head>
<body>
  <h1>AI ChatNavigator</h1>
  <div class="row">
    <span class="label">Status</span>
    <span class="value" id="status">
      <span class="status-dot inactive" id="status-dot"></span>
      <span id="status-text">Inactive</span>
    </span>
  </div>
  <div class="row">
    <span class="label">Platform</span>
    <span class="value" id="platform">&mdash;</span>
  </div>
  <div class="row">
    <span class="label">Messages</span>
    <span class="value" id="messages">&mdash;</span>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: Write popup JS**

```js
// popup/popup.js
(function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs[0]) return;

    chrome.tabs.sendMessage(tabs[0].id, { type: 'ACN_STATUS' }, function (response) {
      if (chrome.runtime.lastError || !response) {
        // Extension not active on this tab
        return;
      }

      document.getElementById('status-dot').classList.remove('inactive');
      document.getElementById('status-dot').classList.add('active');
      document.getElementById('status-text').textContent = response.state || 'Active';
      document.getElementById('platform').textContent = response.platform || '\u2014';
      document.getElementById('messages').textContent =
        response.messageCount != null ? String(response.messageCount) : '\u2014';
    });
  });
})();
```

**Step 3: Verify**

1. Reload extension
2. Open ChatGPT with a conversation
3. Click the extension icon in toolbar
4. Popup should show: Status READY, Platform: chatgpt, Messages: N

**Step 4: Commit**

```bash
git add popup/
git commit -m "feat: informational popup showing status, platform, and message count"
```

---

### Task 8: Icon Generation

**Files:**
- Create: `icons/icon16.png`
- Create: `icons/icon48.png`
- Create: `icons/icon128.png`

**Step 1: Generate icons**

Create simple extension icons — a blue (#03A9F4) rounded square with a white "N" (for Navigator) centered. Generate at 16x16, 48x48, and 128x128.

Options:
- Use any image editor (Figma, Sketch, GIMP, Preview)
- Or use a Node.js canvas script
- Or use an online favicon generator

**Step 2: Place icons in `icons/` directory**

**Step 3: Verify**

1. Reload extension
2. Check toolbar — custom icon should appear
3. Check `chrome://extensions/` — icon should render at all sizes

**Step 4: Commit**

```bash
git add icons/
git commit -m "feat: extension icons"
```

---

### Task 9: Git Init + .gitignore + Final Integration

**Step 1: Initialize git repo (if not already)**

```bash
cd /Users/kamiiamazing/Documents/AI_ChatNavigator
git init
```

**Step 2: Create .gitignore**

```
.DS_Store
*.log
```

**Step 3: Verify full extension**

Run through all 14 test cases from the design doc (Section 6). Focus on:

1. ChatGPT — open conversation, verify TOC, click, scroll, highlight
2. Claude — same flow
3. Gemini — same flow (may need selector fixes)
4. Grok — same flow (may need selector fixes)
5. Pin persistence — pin, reload, verify still pinned
6. SPA navigation — switch conversations, verify TOC rebuilds
7. Non-chat pages — visit login/settings, verify no sidebar
8. Dark mode — toggle platform dark mode, verify card adapts

**Step 4: Fix any broken selectors**

After testing on real pages, update adapter files as needed. Each adapter is independent — fixing one cannot break another.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: AI ChatNavigator v1.0.0 — MVP complete"
```

---

## Task Dependency Graph

```
Task 1 (scaffolding)
  |-- Task 2 (CSS)          \
  |-- Task 3 (adapters)      |-- can run in parallel after Task 1
  |-- Task 4 (observer)      |
  |-- Task 5 (sidebar.js)   /
  |-- Task 8 (icons)        --- independent
        |
        v
  Task 6 (content.js) ---- depends on Tasks 2-5
        |
        v
  Task 7 (popup) ---------- depends on Task 6
        |
        v
  Task 9 (integration) ---- depends on all above
```

Tasks 2, 3, 4, 5, and 8 can run in parallel after Task 1.
Task 6 requires Tasks 2-5 complete.
Task 7 requires Task 6 complete.
Task 9 is the final integration pass.
