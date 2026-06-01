# Grandmaster Chess Arena

A polished browser-based chess platform with modern UI, dark/light themes, AI play, move history, captured pieces, timers, and board animations.

## What’s Included

- Responsive landing page with hero section and feature highlights
- Modern board design with rounded corners, soft shadows, and move highlighting
- Dark mode / light mode toggle with saved preference
- Clear typography using Inter and Poppins
- Local multiplayer and AI opponent modes
- Move history panel with algebraic notation
- Captured pieces display for both sides
- Turn indicator, timer controls, undo, resign, draw offer
- Promotion selection modal and end-game result modal
- Toast notifications for game events
- Room creation / join support using browser localStorage sync

## Project Structure

```
/assets
/css
  style.css
  theme.css
  board.css
  responsive.css
/js
  game.js
  timer.js
  ai.js
  ui.js
  notification.js
index.html
README.md
```

## Run Locally

1. Open `index.html` in a modern browser.
2. Use the landing page buttons to start a game mode.
3. Select pieces on the board, watch moves animate, and enjoy the UI.

## Notes

- The online room implementation now supports a backend API for worldwide room syncing across devices.
- The local `SERVER_API_URL` in `js/ui.js` is set to `http://localhost:3000` by default; update it to your deployed backend URL for use from GitHub Pages.
- Chrome install support is included via `manifest.json` and a service worker so the site can behave like a downloadable Progressive Web App.
- For full remote multiplayer across devices, host the included `server.js` backend and make sure the server URL is reachable from the browser over HTTPS if the frontend runs on GitHub Pages.

## Technologies

- HTML5
- CSS3
- JavaScript (ES modules)

Enjoy the new chess experience!
