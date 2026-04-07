# Privacy Policy - AIWrap

**Last updated:** 2026-04-07

## Overview

AIWrap is a browser extension that aggregates AI chat websites into a single window for convenient access. We are committed to protecting your privacy.

## Data Collection

**AIWrap does not collect, transmit, or store any personal data on external servers.**

All data is stored locally on your device using Chrome's built-in storage APIs.

## Permissions Explained

### `storage`
Used to save your preferences locally, including:
- Which AI sites are enabled/disabled
- Site ordering and custom sites
- Window size and position
- Default site preference

### `tabs`
Used to:
- Create and manage tabs within the AIWrap popup window
- Navigate between AI chat sites
- Detect whether a tab belongs to the AIWrap window

### `browsingData`
Used only when you explicitly click "Clear Cache" in the settings page. This clears cookies, localStorage, and cached data for the specific AI site(s) you choose.

### Content Scripts (`<all_urls>`)
A content script runs on pages within the AIWrap popup window to inject the tab bar UI. It only activates inside the AIWrap window and does not run on pages in your normal browser windows.

## Third-Party Services

AIWrap loads website favicons from Google's favicon service (`google.com/s2/favicons`) to display site icons in the tab bar and settings page. No personal data is sent in these requests.

## Data Storage

All configuration data is stored locally using:
- `chrome.storage.local` — persistent settings (sites, preferences)
- `chrome.storage.session` — temporary session state (active window/tab)

No data is ever sent to any external server.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our [GitHub repository](https://github.com/zouyj/aisitewrapper).
