# AI ChatNavigator

A Chrome extension that adds a real-time sidebar table of contents to long AI conversations, making it easier to navigate across prompts in ChatGPT, Claude, and Gemini.

## What It Does

AI chat interfaces are great at generating long responses, but they are still inefficient when users need to revisit something from earlier in the conversation.

As chats grow longer, finding a previous prompt often means manually scrolling through many turns. AI ChatNavigator solves that by generating a live table of contents from the user's prompts and keeping it available in a sidebar for fast navigation.

## Features

- Real-time conversation table of contents generated from user prompts
- One-click jump to earlier prompts in the same conversation
- Active prompt highlighting while scrolling through a chat
- Sidebar pin and close state persistence
- Chat title display in the sidebar header
- Support for multiple AI chat platforms through a platform adapter architecture

## Supported Platforms

- ChatGPT
- Claude
- Gemini

## Availability

AI ChatNavigator is intended to be distributed through the Chrome Web Store.

Chrome Web Store listing: Coming soon.

## How It Works

The extension injects a lightweight sidebar into supported AI chat pages.

Each platform adapter is responsible for:

- detecting whether the current page is a supported chat route
- locating the main chat container
- extracting user messages
- scrolling back to a selected message
- detecting whether a conversation is empty
- deriving the chat title from the current page context

The content script then connects the adapter to:

- a sidebar state machine
- DOM mutation tracking for real-time updates
- active message tracking
- SPA navigation detection and recovery logic

## Architecture

This project uses a simple adapter-based structure so platform-specific logic stays isolated.

### Core modules

- `content/content.js`
  Main entry point. Detects the active platform adapter, initializes the sidebar, and coordinates observers and recovery flow.

- `content/sidebar.js`
  Handles sidebar creation, rendering, state transitions, title updates, TOC interactions, and persistence.

- `content/observer.js`
  Manages DOM mutation observation, active message tracking, and navigation detection for single-page app behavior.

- `content/adapters/*.js`
  One adapter per platform. Each adapter implements `match()`, `getContainer()`, `getUserMessages()`, `scrollToMessage()`, `isLikelyEmptyConversation()`, and `getChatTitle()`.

## Privacy

AI ChatNavigator processes page content locally in the browser in order to build the conversation table of contents.

Current implementation:

- does not send chat content to external servers
- does not use remote code
- does not require account login
- only uses the `storage` permission to persist sidebar UI state such as pin/close behavior

## Permissions

The extension currently requests only one Chrome permission:

- `storage`  
  Used to save sidebar UI preferences locally in the browser.

## Current Status

AI ChatNavigator is actively being refined for reliability across supported platforms.

Recent improvements include:

- more precise route-based adapter matching
- reduced false activation on non-chat pages
- better handling for delayed chat container rendering
- improved Gemini multi-account route support

## Known Limitations

- The extension depends on platform DOM structure and route conventions, so supported sites may require adapter updates when their frontend changes
- Behavior can vary when AI platforms roll out experiments, redesigns, or account-specific UI differences
- Chrome Web Store listing assets and final store copy may still evolve as the product is prepared for public release

## Roadmap

- improve adapter resilience against frontend changes
- expand support for additional stable chat routes where appropriate
- add stronger regression testing for adapter matching and message extraction
- finalize Chrome Web Store listing assets, descriptions, and privacy documentation

## Repository Structure

```text
AI_ChatNavigator/
├── manifest.json
├── content/
│   ├── content.js
│   ├── observer.js
│   ├── sidebar.js
│   └── adapters/
│       ├── chatgpt.js
│       ├── claude.js
│       └── gemini.js
├── popup/
│   ├── popup.html
│   └── popup.js
├── styles/
│   └── sidebar.css
├── icons/
└── docs/
```

## License

No license has been added yet.

All rights reserved unless a license is added explicitly in the future.
