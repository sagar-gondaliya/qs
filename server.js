const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? "/tmp/quickshare" : path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "notes.json");
const AUTH = { username: "admin", password: "1234" };

const DEFAULT_DATA = {
  notes: [
    {
      id: "welcome",
      title: "Welcome note",
      content:
        "<p>Share templates, email drafts, and quick text across all PCs.</p><p>Use the toolbar for <b>bold</b>, <i>italic</i>, <u>underline</u>, size, and fonts. Changes auto-save and sync live.</p>",
      pinned: false,
      ink: "",
      lineGap: "m",
      updatedAt: Date.now(),
    },
  ],
};

function ensureStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    }
  } catch {
    /* /tmp may already exist */
  }
}

ensureStore();

function sortNotesList(list) {
  return [...list].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return b.updatedAt - a.updatedAt;
  });
}

function readNotes() {
  try {
    ensureStore();
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { notes: [...DEFAULT_DATA.notes] };
  }
}

function writeNotes(data) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST", "PUT", "DELETE"] },
  transports: ["websocket", "polling"],
});

app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === AUTH.username && password === AUTH.password) {
    return res.json({ ok: true, token: "qs-local-" + Date.now() });
  }
  res.status(401).json({ ok: false, error: "Invalid username or password" });
});

app.get("/api/notes", (_req, res) => {
  const data = readNotes();
  res.json(sortNotesList(data.notes));
});

app.post("/api/notes", (req, res) => {
  const data = readNotes();
  const note = {
    id: "n_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: (req.body.title || "Untitled").trim() || "Untitled",
    content: req.body.content || "",
    ink: typeof req.body.ink === "string" ? req.body.ink : "",
    pinned: !!req.body.pinned,
    lineGap: ["s", "m", "l", "xl", "2xl"].includes(String(req.body.lineGap || "").toLowerCase())
      ? String(req.body.lineGap).toLowerCase()
      : "m",
    updatedAt: Date.now(),
  };
  data.notes.unshift(note);
  writeNotes(data);
  io.emit("notes:changed", { action: "create", note });
  res.json(note);
});

app.put("/api/notes/:id", (req, res) => {
  const data = readNotes();
  const idx = data.notes.findIndex((n) => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  const prev = data.notes[idx];
  const allowedGaps = ["s", "m", "l", "xl", "2xl"];
  let nextGap = prev.lineGap ?? "m";
  if (req.body.lineGap !== undefined) {
    const g = String(req.body.lineGap).toLowerCase();
    nextGap = allowedGaps.includes(g) ? g : "m";
  }
  data.notes[idx] = {
    ...prev,
    title:
      req.body.title !== undefined
        ? String(req.body.title).trim() || "Untitled"
        : prev.title,
    content: req.body.content !== undefined ? req.body.content : prev.content,
    ink: req.body.ink !== undefined ? String(req.body.ink || "") : prev.ink || "",
    pinned: req.body.pinned !== undefined ? !!req.body.pinned : !!prev.pinned,
    lineGap: nextGap,
    updatedAt: Date.now(),
  };
  writeNotes(data);
  io.emit("notes:changed", { action: "update", note: data.notes[idx] });
  res.json(data.notes[idx]);
});

app.delete("/api/notes/:id", (req, res) => {
  const data = readNotes();
  const before = data.notes.length;
  data.notes = data.notes.filter((n) => n.id !== req.params.id);
  if (data.notes.length === before)
    return res.status(404).json({ error: "Not found" });
  writeNotes(data);
  io.emit("notes:changed", { action: "delete", id: req.params.id });
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  socket.emit("notes:sync", sortNotesList(readNotes().notes));
});

if (!IS_VERCEL) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`QuickShare running at http://localhost:${PORT}`);
    console.log(`Other PCs: http://<this-pc-ip>:${PORT}`);
    console.log(`Login: admin / 1234`);
  });
}

module.exports = server;
