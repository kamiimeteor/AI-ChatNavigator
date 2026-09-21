<div align="center">
  <h1>AI ChatNavigator</h1>
  <p>
    <a href="https://www.producthunt.com/products/ai-chat-navigator?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-ai-chat-navigator">
      <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1097648&theme=light" height="54" alt="AI Chat Navigator - Add a floating TOC sidebar to AI chats | Product Hunt">
    </a>
  </p>
  <p>Find earlier prompts in long ChatGPT, Claude, and Gemini conversations with a floating table of contents.</p>
  <p>
    <a href="https://chromewebstore.google.com/detail/ai-chatnavigator/illmkheigijhoimkdghiaanedpinibmc?authuser=0&hl=en">
      <img src="https://img.shields.io/badge/Chrome_Web_Store-Install-blue?logo=googlechrome&logoColor=white" alt="Chrome Web Store">
    </a>
    <a href="https://github.com/kamiimeteor/AI-ChatNavigator/releases/tag/v1.0.4">
      <img src="https://img.shields.io/badge/version-1.0.4-blue" alt="Version 1.0.4">
    </a>
    <img src="https://img.shields.io/badge/license-All_Rights_Reserved-lightgrey" alt="License: All Rights Reserved">
    <img src="https://img.shields.io/badge/vanilla-JavaScript-yellow?logo=javascript&logoColor=white" alt="Vanilla JavaScript">
    <img src="https://img.shields.io/badge/Manifest-V3-green" alt="Manifest V3">
  </p>
</div>

![AI ChatNavigator Demo](docs/demo.gif)

## What it does

AI ChatNavigator is a Chrome extension that turns loaded user prompts into clickable sidebar entries. Click an entry to jump to that message, or scroll through the conversation and follow the highlighted prompt.

On ChatGPT, the sidebar keeps prompts it has already read while their virtual placeholders remain on the page. On opening a chat, it briefly scrolls through unread placeholders and restores your reading position. Any manual interaction stops that loading. Claude and Gemini list currently loaded prompts. Conversation text is not saved across page reloads.

**Supported chat platforms:** ChatGPT · Claude · Gemini

## What's new in 1.0.4

1. **ChatGPT prompts stay in the outline as you scroll.** Previously read prompts remain indexed while their original page placeholders survive, even when ChatGPT unloads their text off screen.
2. **Earlier prompts load after opening or refreshing a chat.** The extension scrolls through unread placeholders, then restores your reading position. Scroll, click, type, touch the page, or hide the tab to stop loading. If loading ends early, choose **Load remaining prompts** to continue.
3. **Off-screen prompts remain clickable.** Navigation jumps to the known placeholder and briefly waits for the message to reappear. Your next scroll or navigation action cancels the pending jump.
4. **The active entry follows your reading position.** Reading a prompt and its answer keeps that prompt highlighted, fixing cases where the second entry took the active indicator after jumping to the first.
5. **Jump targets get a subtle violet outline.** A 2px border at 50% opacity follows the message bubble, stays for 1.5 seconds, then fades over 0.2 seconds. Reduced-motion mode removes it without fading.

Read the [English release notes](docs/releases/1.0.4.en.md), [中文更新说明](docs/releases/1.0.4.md), or [download v1.0.4](https://github.com/kamiimeteor/AI-ChatNavigator/releases/tag/v1.0.4). Earlier changes are in the [1.0.3 release notes](docs/releases/1.0.3.en.md).

## Features

- A live prompt outline with active-message highlighting, plus ChatGPT history loading and an in-memory index of observed prompts.
- Click-to-jump navigation that yields to your next action.
- A sidebar you can pin open or reveal on hover, with light and dark themes.
- Keyboard-accessible controls, loading feedback, and retry support.
- Local processing without analytics, tracking, or a separate extension account.

## Screenshots

<p align="center">
  <img src="store/AI-ChatNav-Screenshot-1.jpg" width="32%" />
  <img src="store/AI-ChatNav-Screenshot-2.jpg" width="32%" />
  <img src="store/AI-ChatNav-Screenshot-3.jpg" width="32%" />
</p>

## Install

**[→ Install from Chrome Web Store](https://chromewebstore.google.com/detail/ai-chatnavigator/illmkheigijhoimkdghiaanedpinibmc?authuser=0&hl=en)**

### Install v1.0.4 from GitHub

1. Download `AI-ChatNavigator-v1.0.4-chrome.zip` from the [v1.0.4 release](https://github.com/kamiimeteor/AI-ChatNavigator/releases/tag/v1.0.4) and extract it.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Refresh existing ChatGPT, Claude, or Gemini tabs.

The GitHub release includes a SHA-256 checksum and source provenance file. Version 1.0.4 is available as a GitHub download; this release does not submit or update the Chrome Web Store listing.

For local development, clone this repository and load the project folder through **Load unpacked**. After changing the source, reload the extension in `chrome://extensions` and refresh your chat tabs.

## Supported pages

| Platform | Routes enabled in v1.0.4 |
|---|---|
| ChatGPT | `chatgpt.com` and `chat.openai.com`: `/` and `/c/<id>` |
| Claude | `claude.ai`: `/`, `/new`, and `/chat/<id>` |
| Gemini | `gemini.google.com`: `/app` and paths under it, including `/u/<number>/app` |

These are the adapter's route rules, not a guarantee that every live interface variant has been verified. Project-specific, custom assistant, shared, and agent/work pages outside these rules are not supported.

## How it works

Each supported site has an adapter for DOM selectors and route matching. Shared modules manage message identity, navigation, the sidebar UI, and page observers.

```
AI_ChatNavigator/
├── manifest.json              # Chrome Manifest V3 config
├── content/
│   ├── content.js             # Entry point, adapter detection, retry logic
│   ├── message-index.js       # Snapshot identity and safe message resolution
│   ├── navigation.js          # Cancellable scrolling
│   ├── history-loader.js      # Bounded ChatGPT history loading and position restoration
│   ├── observer.js            # Batched DOM updates + active tracking + URL polling
│   ├── sidebar.js             # Sidebar UI, state machine, TOC rendering
│   └── adapters/
│       ├── common.js         # Shared extraction and scroll-container detection
│       ├── chatgpt.js         # ChatGPT adapter
│       ├── claude.js          # Claude adapter
│       └── gemini.js          # Gemini adapter
├── scripts/build-chrome-release.mjs # Creates the Chrome release zip
├── styles/sidebar.css         # Sidebar styles (light/dark)
├── popup/                     # Extension popup
└── icons/                     # Extension icons
```

### Key technical decisions

- **Vanilla JS, optional release build, zero runtime dependencies**: keeps the extension lightweight and easy to audit
- **Adapter pattern**: platform-specific DOM logic stays isolated; new platforms need an adapter and the corresponding manifest, popup, and test updates
- **Route-based matching**: adapters match on hostname + URL path, not DOM elements, so empty conversations work correctly
- **Lifecycle recovery**: batched DOM observation, active tracking, URL polling, and periodic checks for replaced containers
- **Minimal permissions**: only `storage` (for sidebar pin state)

## Tests and release build

Run the dependency-free regression tests:

```sh
node --test tests/*.test.cjs
```

The browser regression suite uses synthetic pages and loads the real extension in temporary Chrome profiles. It requires Chrome and a development copy of Playwright available to Node (for example through `NODE_PATH`):

```sh
node tests/browser.cjs
```

Screenshots and results are written to a temporary directory outside this repository. Set `ACN_EXTENSION_DIR` to test a built unpacked directory instead of the source tree. The suite does not use your normal browser profile or contact the live chat services.

Build a release:

```sh
node scripts/build-chrome-release.mjs
```

The build checks JavaScript syntax, runs the regression tests, and packages an explicit file allowlist. It writes:

- `release/AI-ChatNavigator-v<version>-chrome.zip`
- SHA-256 and source provenance files beside the zip
- `dist/chrome-v<version>/` for **Load unpacked**

Existing release archives and unpacked release directories are not overwritten. A new release requires a new version. Refresh chat tabs after upgrading.

Version 1.0.4 has 53 passing logic tests. The user confirmed the ChatGPT count and navigation fixes on a signed-in conversation. The latest opacity adjustment, Claude/Gemini shared highlighting, and the native toolbar popup still need visual verification. The synthetic browser suite was last run for 1.0.3. See the [1.0.4 verification details](docs/releases/1.0.4.en.md#verification) and [earlier browser results](docs/releases/1.0.3.en.md#verification).

## Privacy

- The extension processes conversation text locally and does not transmit it to an extension service.
- ChatGPT history loading scrolls the existing page; it does not call private ChatGPT APIs. The chat site still handles its own network activity.
- Prompt text stays in page memory and is cleared on reload or conversation changes.
- No analytics, tracking, or separate extension account; the only permission is `storage` for sidebar UI preferences.

## Known limitations

- Depends on platform DOM structure: adapters may need updates when ChatGPT, Claude, or Gemini change their frontend
- Behavior may vary during platform A/B tests or redesigns; the existing floating sidebar can cover part of a narrow window
- ChatGPT indexing covers observed prompts and existing page placeholders. Each loading pass is limited to 15 seconds or 150 placeholders, with up to 1 second of waiting per placeholder. Loading can also stop on user input; history not represented on the page can still be missing. Claude and Gemini list loaded prompts only
- If a prompt no longer has a unique live identity, navigation stops instead of guessing from its text or position
- Search, bookmarks, reading-position restoration across conversations, resizable panels, and Chrome's native Side Panel are not included in 1.0.4

## Contributing

Found a bug or selector that broke? Issues and PRs welcome.

If a platform changed its DOM and the extension stopped working, the fix is usually in the corresponding adapter file under `content/adapters/`.

## License

All rights reserved unless a license is added explicitly in the future.
