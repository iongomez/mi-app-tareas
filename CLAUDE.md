# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A vanilla web todo list app — no frameworks, no build tools, no dependencies. Pure HTML, CSS, and JavaScript.

## Running the App

Open `index.html` directly in a browser, or serve it locally:

```bash
npx serve .
# or
python3 -m http.server
```

## Architecture

Single-page app with no build step:

- `index.html` — app shell and DOM structure
- `style.css` — all styles
- `app.js` — all JavaScript logic (DOM manipulation, state, event handling)

State is managed in memory via plain JS objects/arrays. Persistence (if added) uses `localStorage`.
