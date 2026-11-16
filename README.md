# QuickShare

Real-time shared notes & templates for multiple PCs. One login, auto-save, live sync, quick copy, and basic formatting.

## Login

- **Username:** `admin`
- **Password:** `1234`

Login is saved in Chrome localStorage — you only sign in once per browser.

## Run (one PC is the server)

```bash
npm install
npm start
```

Open on that PC: [http://localhost:3000](http://localhost:3000)

### Other PCs on the same network

1. Find the server PC IP (Mac: System Settings → Network, or `ipconfig getifaddr en0`)
2. On the other PCs open: `http://SERVER_IP:3000`
3. Login once with `admin` / `1234`

All 4 PCs stay in sync: create, edit, delete, and copy templates in real time.

## Features

- Notes CRUD (add / edit / update / delete)
- Auto-save to server
- Live sync via WebSockets
- Quick **Copy** (plain + HTML)
- Formatting: **B** / *I* / <u>U</u>, size A+/A−, fonts, bullets
- Search notes
- Session remembered in localStorage

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial QuickShare notes app"
gh repo create quickshare-notes --private --source=. --push
```

Or create a repo on GitHub and:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## Data

Notes are stored in `data/notes.json` on the server PC. That file is gitignored so each deploy keeps its own data.
