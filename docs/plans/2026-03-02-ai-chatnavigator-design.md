# AI ChatNavigator — Design Document

**Date:** 2026-03-02
**Status:** Approved

## Overview

A universal Chrome extension that adds a real-time table of contents and quick navigation sidebar to AI chat platforms. Never get lost in long AI conversations again.

**MVP Platforms:** ChatGPT, Claude, Gemini, Grok

---

## Section 1: Architecture & File Structure

**Approach:** Platform Adapter Pattern — a single content script loads on all platforms, with a small adapter layer mapping each platform's DOM selectors to a common interface.

```
AI_ChatNavigator/
├── manifest.json              # Chrome Extension manifest v3
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── content/
│   ├── content.js             # Entry point: detects platform, inits adapter + sidebar
│   ├── sidebar.js             # TOC rendering, click handling, highlight pulse
│   ├── observer.js            # MutationObserver + SPA navigation detection
│   └── adapters/
│       ├── chatgpt.js         # ChatGPT DOM selectors & message extraction
│       ├── claude.js          # Claude DOM selectors & message extraction
│       ├── gemini.js          # Gemini DOM selectors & message extraction
│       └── grok.js            # Grok DOM selectors & message extraction
├── popup/
│   ├── popup.html             # Simple toggle/settings popup
│   └── popup.js
└── styles/
    └── sidebar.css            # All sidebar styling
```

**Key decisions:**
- Manifest V3 (required for new Chrome Web Store submissions)
- No background service worker needed for MVP
- Vanilla JS, no build step, zero dependencies
- Each adapter exports a common interface
- Platform detection via `window.location.hostname` in `content.js`

---

## Section 2: Adapter Interface & Platform Selectors

### Common Adapter Interface

Each adapter implements:

```js
{
  name: 'chatgpt',                       // platform identifier
  match(),                               // returns true if current page is this platform's chat
  getContainer(),                        // returns the chat scroll container element
  getUserMessages(),                     // returns array of { element, text } for user messages
  scrollToMessage(element),              // scrolls chat to the given message element
  isLikelyEmptyConversation(),           // returns true if this is a new/empty conversation
}
```

### Adapter.match() — Hardened Matching Rules

`match()` MUST validate:
- Correct hostname
- Presence of chat container element
- Not a marketing / login / non-chat page

**Host-only matching is NOT permitted.**

Example pattern:
```js
match() {
  const correctHost = location.hostname.includes("chatgpt.com");
  const hasChatContainer = document.querySelector('[data-message-author-role]');
  return correctHost && hasChatContainer;
}
```

### Platform Selectors (Research-Based — Verify with DevTools)

| Platform | Host Match | User Message Selector | Container |
|---|---|---|---|
| ChatGPT | `chatgpt.com` | `[data-message-author-role="user"]` | `article` parent |
| Claude | `claude.ai` | `[data-testid="user-message"]` | `div[data-test-render-count]` parent |
| Gemini | `gemini.google.com` | `user-query-content` (custom element) | `#chat-history` |
| Grok | `grok.com` | `.message-bubble.bg-foreground` | `#last-reply-container` parent |

> **Note:** DOM selectors are researched, not verified. Must validate against real pages with DevTools during implementation. If selectors are wrong, only the adapter file needs updating.

### Text Extraction

- Each adapter's `getUserMessages()` truncates message text to 50 chars for the TOC label
- Prefix with `Q1:`, `Q2:`, etc.
- Append `…` if truncated

### Resilience

- If a selector breaks (platform UI update), only that adapter fails
- Other platforms continue working

---

## Section 3: Sidebar UI & Interaction

### Layout

- Fixed on the right side of the page
- Vertically centered relative to the viewport
- Size: **184px width × 240px height**
- **Overlay** on top of the page (does not resize layout)
- Default: **hover to reveal**
- Supports **Pin mode** (persistent display)

### Positioning & Layering

```css
position: fixed;
z-index: 9999;
```

Ensures visibility above platform fixed headers and toolbars.

### Fullscreen Safety Rule

Sidebar must not interfere with platform fullscreen layouts.

```js
if (isFullScreenMode()) {
  hideSidebar();
}
```

Fullscreen detection includes:
- `document.fullscreenElement`
- Platform-specific fullscreen class detection
- Container layout inspection

**Rule:** Fullscreen state overrides z-index behavior. Sidebar must auto-hide in fullscreen mode.

### Card Visual Style — Light Mode

| Property | Value |
|---|---|
| Background | `#FFFFFF` |
| Box Shadow | `0 4px 16px rgba(0, 0, 0, 0.05)` |
| Border | `1px solid rgba(13, 13, 13, 0.15)` |

### Card Visual Style — Dark Mode

| Property | Value |
|---|---|
| Background | `#131D2B` |
| Border | `1px solid rgba(255, 255, 255, 0.15)` |
| Shadow | `0 4px 16px rgba(0, 0, 0, 0.25)` |
| Highlight | `rgba(3, 169, 244, 0.45)` |
| Text Primary | `#E6EDF3` |
| Text Secondary | `rgba(255, 255, 255, 0.65)` |

### Header Structure

- Pin icon (📌) positioned to the left of the close button
- Close button (×) at top right

**Behavior:**
- Hover right edge → sidebar slides out
- Mouse leave → sidebar hides
- Click Pin → sidebar stays visible (disable auto-hide)
- Click Pin again → restore hover behavior
- Click × → hide immediately

### TOC Strategy

- Show latest **6** user topics by default
- New messages appear at the **top**
- List is scrollable

### Mouse Wheel Behavior

- When cursor is over the sidebar, mouse wheel scrolls the TOC list
- Does **not** scroll main page
- Implementation: `e.stopPropagation()` + `overflow-y: auto` on TOC container

### Click Interaction

When clicking a TOC item:
1. Smooth scroll to the corresponding message
2. Trigger highlight animation
3. Fade out after 1.5 seconds

**Highlight Style:**
```css
background: rgba(3, 169, 244, 0.6);

@keyframes messageFlash {
  0% { background: rgba(3, 169, 244, 0.6); }
  100% { background: rgba(3, 169, 244, 0); }
}

.highlight-flash {
  animation: messageFlash 1.5s ease-out forwards;
}
```

### Active Tracking

- Use `IntersectionObserver`
- Highlight the TOC item corresponding to the message currently in viewport

### Real-time Updates

- Use `MutationObserver`
- Detect new user messages
- Automatically update TOC

### SPA Navigation Support

Listen to:
- `history.pushState`
- `popstate`

On conversation change:
1. Debounce 300ms
2. Tear down old MutationObserver + IntersectionObserver
3. Clear TOC
4. Reset internal state
5. Re-run initial load flow (state → LOADING)

### Persistence

Store in `chrome.storage.local`:
- Pin state
- Sidebar open/closed state
- Optional: scroll position

---

## Section 4: Popup

Informational only for MVP:

```
┌──────────────────────┐
│  AI ChatNavigator     │
│──────────────────────│
│  Status: ● Active     │
│  Platform: ChatGPT    │
│                       │
│  Messages found: 12   │
└──────────────────────┘
```

- Shows current platform and number of detected user messages
- No settings page for MVP
- Pin state and visibility controlled directly from sidebar card

---

## Section 5: State Machine

### State Definitions

| State | Description |
|---|---|
| `LOADING` | Initial state, attempting to resolve container |
| `EMPTY` | Container found, but conversation is empty (valid state) |
| `READY` | Messages detected, TOC rendered |
| `ERROR` | Container not found after retries |

Optional internal transient state: `RETRYING`

### State Transitions

**Initial Load Flow:**

1. Page load → state = `LOADING`
2. Attempt `adapter.getContainer()`
3. If container not found: retry up to 3 times at 1-second intervals (state remains `LOADING`)
4. After retries:
   - Container still null → state = `ERROR`
   - Container exists → proceed to message detection

**Message Detection:**

```
messages = adapter.getUserMessages()

if messages.length > 0:
  → state = READY

if messages.length === 0:
  if adapter.isLikelyEmptyConversation() === true:
    → state = EMPTY
  else:
    → state = ERROR
```

### State Behaviors

**LOADING:**
- Sidebar visible on hover
- TOC area empty (no error text)
- No intrusive UI
- Optional: lightweight skeleton

**EMPTY:**
- Display: "Start chatting to see your TOC"
- No retry loop, no error styling
- This is a valid state

**READY:**
- Render TOC entries
- Enable IntersectionObserver, MutationObserver
- Click highlight behavior active

**ERROR:**
- Display: "No messages detected"
- No popups, no alerts
- Subtle inline text only
- Do not retry endlessly

### MutationObserver Behavior (in READY state)

- New user message detected → update TOC
- All messages disappear unexpectedly → re-run message detection logic

### Engineering Principle

The sidebar must never infer error purely from `messages.length === 0`.

Zero messages is ambiguous. State must be determined through:
1. Container existence
2. Retry logic
3. Platform-specific empty detection (`isLikelyEmptyConversation()`)

This guarantees:
- Correct empty-state UX
- No false error messages
- Stable behavior across lazy-rendered platforms

---

## Section 6: Testing Strategy

### Testing Philosophy

MVP uses structured manual testing organized into 4 categories. No automated tests due to heavy third-party DOM dependency.

### A. State Validation

**Test 1: READY State**
- Open a conversation with 10+ messages
- Verify TOC renders correctly with correct ordering
- Verify active tracking works
- Verify highlight animation triggers on click

**Test 2: EMPTY State**
- Open a brand-new conversation
- Verify EMPTY state displays: "Start chatting to see your TOC"
- Verify no error text appears, no retry loop continues

**Test 3: ERROR State**
- Force selector failure (e.g., temporarily modify selector)
- Verify state becomes ERROR, text displays: "No messages detected"
- Verify no infinite retry loop, no intrusive popups

**Test 4: LOADING State**
- Simulate slow network (Chrome DevTools → Slow 3G)
- Verify sidebar does NOT immediately show ERROR
- Verify LOADING transitions correctly to READY or EMPTY
- Ensure no flickering between states

### B. Core Interaction Validation

**Test 5: Real-time Updates**
- Send a new message
- Verify TOC updates automatically
- Verify MutationObserver does not duplicate entries

**Test 6: Conversation Switching (SPA)**
- Switch between conversations
- Verify old observers destroyed, TOC clears
- Verify platform re-detection and rebuild occurs correctly
- Verify no double-trigger due to URL changes

**Test 7: TOC Click Interaction**
- Click a TOC entry
- Verify smooth scroll, highlight animation triggers, highlight fades after 1.5s

**Test 8: Hover / Pin / Close Behavior**
- Hover reveal works
- Pin keeps sidebar visible
- Unpin restores auto-hide
- Close button hides immediately

**Test 9: Reload Persistence**
- Reload page
- Verify pin state persists, sidebar visibility logic restored correctly

### C. Edge Case Validation

**Test 10: Scroll Isolation**
- Scroll inside TOC, verify main page does NOT scroll
- Scroll to TOC boundary, ensure no scroll bleed
- Confirm `e.stopPropagation()` + `overflow-y: auto` behavior

**Test 11: Multiple Tabs**
- Open same platform in two tabs
- Verify independent state machines
- Verify pin state does not affect other tab, no cross-tab interference

### D. Environment & Theme Validation

**Test 12: Cross-Browser**
- Test on Chrome (primary target) and Edge (Chromium-based)
- Verify identical behavior and rendering

**Test 13: Dark Mode Visual Validation**
- Card contrast readable on dark chat pages
- Border not overly strong
- Shadow subtle but present
- Highlight visible but not neon
- No visual clash with host platform theme

**Test 14: Non-Chat Page Validation**
- Visit platform homepage (marketing page)
- Visit login page
- Visit settings/account page
- Verify sidebar does NOT initialize
- Verify no console errors
- Confirm `adapter.match()` correctly prevents activation

---

## System Guarantees

With this design, the extension ensures:

- No activation outside chat contexts
- No interference with fullscreen modes
- No unintended overlay conflicts
- Explicit layering control
- Safe and deterministic initialization behavior
- Deterministic state transitions
- Clean observer lifecycle handling
- Stable SPA rebuild logic
- Scroll isolation integrity
- Consistent visual behavior across Light and Dark modes
