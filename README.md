<div align="center">
  <h1>AI ChatNavigator</h1>
  <p>
    <a href="https://www.producthunt.com/products/ai-chat-navigator?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-ai-chat-navigator">
      <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1097648&theme=light" height="54" alt="AI Chat Navigator - Add a floating TOC sidebar to AI chats | Product Hunt">
    </a>
  </p>
  <p>A Chrome extension that adds a floating table of contents to ChatGPT, Claude, and Gemini.</p>
  <p>
    <a href="https://chromewebstore.google.com/detail/ai-chatnavigator/illmkheigijhoimkdghiaanedpinibmc?authuser=0&hl=en">
      <img src="https://img.shields.io/badge/Chrome_Web_Store-Install-blue?logo=googlechrome&logoColor=white" alt="Chrome Web Store">
    </a>
    <img src="https://img.shields.io/badge/license-All_Rights_Reserved-lightgrey" alt="License: All Rights Reserved">
    <img src="https://img.shields.io/badge/vanilla-JavaScript-yellow?logo=javascript&logoColor=white" alt="Vanilla JavaScript">
    <img src="https://img.shields.io/badge/Manifest-V3-green" alt="Manifest V3">
  </p>
</div>

![AI ChatNavigator Demo](docs/demo.gif)

## What It Does

Loaded user prompts become clickable entries in a sidebar. Click an entry to jump to that message. The outline covers messages currently present on the page; earlier history may not be loaded.

**Supported chat platforms:** ChatGPT · Claude · Gemini

## Features

- **Live prompt outline** — updates changed entries without rebuilding the list during streamed answers
- **Cancellable navigation** — jump to a loaded prompt; scrolling, another click, or changing chats cancels the pending jump
- **Active tracking** — the current prompt is highlighted as you scroll
- **Pin or auto-hide** — keep the sidebar open or let it appear on hover
- **Dark mode** — adapts to each platform's theme
- **Local processing** — no external requests, accounts, or conversation text in extension logs

## Screenshots

<p align="center">
  <img src="store/AI-ChatNav-Screenshot-1.jpg" width="32%" />
  <img src="store/AI-ChatNav-Screenshot-2.jpg" width="32%" />
  <img src="store/AI-ChatNav-Screenshot-3.jpg" width="32%" />
</p>

## Install

**[→ Install from Chrome Web Store](https://chromewebstore.google.com/detail/ai-chatnavigator/illmkheigijhoimkdghiaanedpinibmc?authuser=0&hl=en)**

For local development:

1. Enable Developer mode in `chrome://extensions`.
2. Choose **Load unpacked** and select this project folder.
3. Refresh existing chat tabs after installing or reloading the extension.

For a Chrome Web Store upload package, run `node scripts/build-chrome-release.mjs`.

## How It Works

The extension uses a platform adapter pattern — each supported site has its own adapter that handles DOM selectors and route matching, while shared modules manage the sidebar UI, state machine, and observers.

```
AI_ChatNavigator/
├── manifest.json              # Chrome Manifest V3 config
├── content/
│   ├── content.js             # Entry point, adapter detection, retry logic
│   ├── message-index.js       # Snapshot identity and safe message resolution
│   ├── navigation.js          # Cancellable scrolling
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

- **Vanilla JS, optional release build, zero runtime dependencies** — keeps the extension lightweight and easy to audit
- **Adapter pattern** — platform-specific DOM logic stays isolated; adding a new platform means adding one file
- **Route-based matching** — adapters match on hostname + URL path, not DOM elements, so empty conversations work correctly
- **Lifecycle recovery** — batched DOM observation, active tracking, URL polling, and periodic checks for replaced containers
- **Minimal permissions** — only `storage` (for sidebar pin state)

## Tests and Release Build

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

See [1.0.3 release notes](docs/releases/1.0.3.md) for verification results and remaining live-site checks.

## Privacy

- No data leaves your browser
- No external requests, analytics, or tracking
- No account or login required
- Only permission: `storage` (sidebar UI preferences)

## Known Limitations

- Depends on platform DOM structure — adapters may need updates when ChatGPT, Claude, or Gemini change their frontend
- Behavior may vary during platform A/B tests or redesigns
- The outline includes currently loaded prompts only. It does not fetch or archive unloaded history, or claim complete conversation coverage
- If a prompt no longer has a unique live identity, navigation stops instead of guessing from its text or position
- Project-specific, custom assistant, shared, and agent/work pages outside the adapters' route rules are not claimed as supported

## Contributing

Found a bug or selector that broke? Issues and PRs welcome.

If a platform changed its DOM and the extension stopped working, the fix is usually in the corresponding adapter file under `content/adapters/`.

## License

All rights reserved unless a license is added explicitly in the future.
