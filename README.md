# 🔥 Hinge Breakdown

A privacy-first, browser-based tool that turns the `matches.json` from your Hinge data export into an interactive visual analysis — including a **Sankey chart** of how your matches progressed, plus a set of supporting statistics and charts.

> **Your data never leaves your device.** All processing happens entirely in your browser.

---

## Features

- **Match Progression Sankey Chart** – visualise the flow from initial match → chatted / never messaged → we met / unmatched / ongoing
- **Stats Overview** – total matches, conversations started, "We Met" count, unmatched, ongoing, average messages, and longest conversation
- **Monthly Timeline** – bar chart of matches by calendar month
- **Day of Week Distribution** – when you tend to match
- **Conversation Length Distribution** – histogram of messages exchanged per conversation
- **Matches by Hour of Day** – when matches occur throughout the day
- **Demo Mode** – try it instantly with synthetic sample data (no Hinge account required)

---

## Getting Your Data

1. Open the **Hinge** app
2. Go to **Settings → Download My Data**
3. Wait 24–48 hours for Hinge to prepare your export
4. Download the `.zip` file and extract `matches.json`

---

## Usage

### Option 1 — Run locally with the dev server

```bash
npm install
npm run dev
```

Then open <http://localhost:5173> in your browser and upload `matches.json`.

### Option 2 — Build for production / static hosting

```bash
npm install
npm run build
# The output is in the dist/ folder — deploy it anywhere (GitHub Pages, Netlify, etc.)
```

### Option 3 — Preview the production build

```bash
npm run preview
```

---

## matches.json Format

The tool supports the standard Hinge data export format.  Each entry in the array represents a mutual match and may contain:

| Field    | Description |
|----------|-------------|
| `match`  | Array with the initial like/comment and timestamp |
| `like`   | Alternative key used in some Hinge export versions |
| `chats`  | Array of `{ body, timestamp }` chat messages |
| `we_met` | Array with "We Met" feedback (present if you marked the date) |
| `block`  | Array with unmatched / removed info |

---

## Tech Stack

- [Vite](https://vitejs.dev/) — build tool & dev server
- [d3-sankey](https://github.com/d3/d3-sankey) — Sankey chart layout
- [d3-selection](https://github.com/d3/d3-selection) — SVG rendering
- [Chart.js](https://www.chartjs.org/) — bar charts & statistics
