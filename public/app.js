const AUTH_KEY = "quickshare_auth";
const SIDEBAR_KEY = "quickshare_sidebar_collapsed";
const FONT_SIZES = [10, 12, 14, 16, 18, 24, 32];

const els = {
  loginScreen: document.getElementById("login-screen"),
  loginForm: document.getElementById("login-form"),
  loginError: document.getElementById("login-error"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  app: document.getElementById("app"),
  sidebar: document.getElementById("sidebar"),
  notesList: document.getElementById("notes-list"),
  notesCount: document.getElementById("notes-count"),
  search: document.getElementById("search"),
  btnNew: document.getElementById("btn-new"),
  btnNewEmpty: document.getElementById("btn-new-empty"),
  btnLogout: document.getElementById("btn-logout"),
  btnBack: document.getElementById("btn-back"),
  btnToggleSidebar: document.getElementById("btn-toggle-sidebar"),
  btnExpandSidebar: document.getElementById("btn-expand-sidebar"),
  emptyState: document.getElementById("empty-state"),
  editorWrap: document.getElementById("editor-wrap"),
  noteTitle: document.getElementById("note-title"),
  editor: document.getElementById("editor"),
  paper: document.getElementById("paper"),
  inkCanvas: document.getElementById("ink-canvas"),
  penCursor: document.getElementById("pen-cursor"),
  btnDownloadImage: document.getElementById("btn-download-image"),
  btnPin: document.getElementById("btn-pin"),
  saveStatus: document.getElementById("save-status"),
  btnCopy: document.getElementById("btn-copy"),
  btnDelete: document.getElementById("btn-delete"),
  fontFamily: document.getElementById("font-family"),
  fontSize: document.getElementById("font-size"),
  lineGap: document.getElementById("line-gap"),
  btnSelectAll: document.getElementById("btn-select-all"),
  insertSymbol: document.getElementById("insert-symbol"),
  btnPen: document.getElementById("btn-pen"),
  penBar: document.getElementById("pen-bar"),
  penTip: document.getElementById("pen-tip"),
  btnEraser: document.getElementById("btn-eraser"),
  btnInkClear: document.getElementById("btn-ink-clear"),
  btnPenDone: document.getElementById("btn-pen-done"),
  liveDot: document.getElementById("live-dot"),
  liveLabel: document.getElementById("live-label"),
  confirmModal: document.getElementById("confirm-modal"),
  confirmTitle: document.getElementById("confirm-title"),
  confirmMessage: document.getElementById("confirm-message"),
  confirmOk: document.getElementById("confirm-ok"),
  confirmCancel: document.getElementById("confirm-cancel"),
};

const PEN_TIPS = {
  ballpoint: { min: 1.15, max: 2.55, flow: 0.82, wobble: 0.18 },
  gel: { min: 1.55, max: 3.1, flow: 0.96, wobble: 0.04 },
  fine: { min: 0.85, max: 1.7, flow: 0.9, wobble: 0.08 },
  marker: { min: 5.5, max: 11, flow: 0.42, wobble: 0 },
};

// Real stationery ink — layered core / body / wet edge
const INKS = {
  "blue-ball": {
    kind: "ball",
    core: "#143a7a",
    body: "#1a4f9c",
    edge: "rgba(26, 79, 156, 0.22)",
    wet: "rgba(70, 120, 190, 0.16)",
  },
  "blue-gel": {
    kind: "gel",
    core: "#003f9a",
    body: "#0057c2",
    edge: "rgba(0, 87, 194, 0.28)",
    wet: "rgba(60, 140, 255, 0.2)",
  },
  "black-ball": {
    kind: "ball",
    core: "#1a1a1a",
    body: "#2a2a2a",
    edge: "rgba(40, 40, 40, 0.2)",
    wet: "rgba(60, 60, 60, 0.12)",
  },
  "black-gel": {
    kind: "gel",
    core: "#0a0a0a",
    body: "#151515",
    edge: "rgba(20, 20, 20, 0.28)",
    wet: "rgba(40, 40, 40, 0.16)",
  },
  "red-ball": {
    kind: "ball",
    core: "#9e1020",
    body: "#c0182a",
    edge: "rgba(192, 24, 42, 0.22)",
    wet: "rgba(220, 70, 80, 0.14)",
  },
  "red-gel": {
    kind: "gel",
    core: "#c41020",
    body: "#e11d2e",
    edge: "rgba(225, 29, 46, 0.28)",
    wet: "rgba(255, 90, 100, 0.18)",
  },
  "green-gel": {
    kind: "gel",
    core: "#065c2e",
    body: "#0a7a3e",
    edge: "rgba(10, 122, 62, 0.26)",
    wet: "rgba(40, 170, 90, 0.16)",
  },
};

const ink = {
  ctx: null,
  drawing: false,
  erasing: false,
  inkId: "blue-ball",
  tip: "ballpoint",
  points: [],
  lastWidth: 1.8,
  dirty: false,
  loading: false,
  dpr: 1,
};

function currentInk() {
  return INKS[ink.inkId] || INKS["blue-ball"];
}

const GAP_CLASSES = ["gap-s", "gap-m", "gap-l", "gap-xl", "gap-2xl"];
const DEFAULT_LINE_GAP = "m";

function normalizeGap(value) {
  const v = String(value || "").toLowerCase();
  if (v === "s" || v === "1.2" || v === "1.25") return "s";
  if (v === "l" || v === "1.8" || v === "2") return "l";
  if (v === "xl" || v === "2.2" || v === "2.5") return "xl";
  if (v === "2xl" || v === "2.8" || v === "3.2") return "2xl";
  return "m";
}

let notes = [];
let activeId = null;
let saveTimer = null;
let applyingRemote = false;
let saving = false;
let saveAgain = false;
let socket = null;
let lastLocalSaveAt = 0;

function isNarrow() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

function setAuth(data) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

function toast(msg) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

function formatTime(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setLive(state) {
  els.liveDot.className = "live-dot " + (state === "on" ? "on" : state === "off" ? "off" : "");
  els.liveLabel.textContent =
    state === "on" ? "Live" : state === "off" ? "Offline" : "…";
}

function setSidebarCollapsed(collapsed) {
  els.app.classList.toggle("sidebar-collapsed", collapsed);
  els.btnExpandSidebar.hidden = !collapsed;
  localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
}

function restoreSidebar() {
  setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
}

function setMobileEditor(on) {
  els.app.classList.toggle("mobile-editor", on && isNarrow());
}

function showApp() {
  els.loginScreen.hidden = true;
  els.app.hidden = false;
  document.body.style.overflow = "hidden";
  restoreSidebar();
  connectSocket();
  loadNotes();
}

function showLogin() {
  els.app.hidden = true;
  els.loginScreen.hidden = false;
  document.body.style.overflow = "";
  activeId = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  setTimeout(() => els.password.focus(), 40);
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

function previewText(html) {
  return stripHtml(html) || "No additional text";
}

function sortNotes() {
  notes.sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return b.updatedAt - a.updatedAt;
  });
}

function syncPinButton(pinned) {
  if (!els.btnPin) return;
  els.btnPin.classList.toggle("is-pinned", !!pinned);
  els.btnPin.setAttribute("aria-pressed", pinned ? "true" : "false");
  els.btnPin.title = pinned ? "Unpin note" : "Pin note";
  els.btnPin.setAttribute("aria-label", pinned ? "Unpin note" : "Pin note");
}

function upsertNote(note) {
  const idx = notes.findIndex((n) => n.id === note.id);
  if (idx === -1) notes.unshift(note);
  else notes[idx] = note;
  sortNotes();
}

function filteredNotes() {
  const q = els.search.value.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(
    (n) =>
      (n.title || "").toLowerCase().includes(q) ||
      stripHtml(n.content).toLowerCase().includes(q)
  );
}

function renderList() {
  const list = filteredNotes();
  els.notesCount.textContent = String(notes.length);
  els.notesList.innerHTML = "";

  if (!list.length) {
    els.notesList.innerHTML = '<li class="empty-list">No notes yet</li>';
    return;
  }

  for (const note of list) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className =
      "note-row" +
      (note.id === activeId ? " active" : "") +
      (note.pinned ? " pinned" : "");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "note-item";
    btn.innerHTML =
      '<span class="t"></span><span class="p"></span><span class="m"></span>';
    const titleEl = btn.querySelector(".t");
    if (note.pinned) {
      titleEl.innerHTML =
        '<svg class="pin-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg><span class="t-text"></span>';
      titleEl.querySelector(".t-text").textContent = note.title || "Untitled";
    } else {
      titleEl.innerHTML = '<span class="t-text"></span>';
      titleEl.querySelector(".t-text").textContent = note.title || "Untitled";
    }
    btn.querySelector(".p").textContent = previewText(note.content);
    btn.querySelector(".m").textContent = formatTime(note.updatedAt);
    btn.addEventListener("click", () => openNote(note.id));

    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "note-pin" + (note.pinned ? " is-on" : "");
    pin.title = note.pinned ? "Unpin" : "Pin";
    pin.setAttribute("aria-label", (note.pinned ? "Unpin " : "Pin ") + (note.title || "Untitled"));
    pin.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4.76z"/></svg>';
    pin.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePin(note.id);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "note-del";
    del.title = "Delete note";
    del.setAttribute("aria-label", "Delete " + (note.title || "Untitled"));
    del.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNoteById(note.id);
    });

    row.appendChild(btn);
    row.appendChild(pin);
    row.appendChild(del);
    li.appendChild(row);
    els.notesList.appendChild(li);
  }
}

function showEmpty() {
  activeId = null;
  setPenMode(false);
  clearInkCanvas();
  syncPinButton(false);
  els.editorWrap.hidden = true;
  els.emptyState.hidden = false;
  setMobileEditor(false);
  renderList();
}

function openNote(id, opts = {}) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;

  // Flush pending edits on the previous note before switching
  if (activeId && activeId !== id && saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveActive();
  }

  activeId = id;
  els.emptyState.hidden = true;
  els.editorWrap.hidden = false;
  applyingRemote = true;
  els.noteTitle.value = note.title || "";
  els.editor.innerHTML = note.content || "";
  applyLineGap(note.lineGap ?? DEFAULT_LINE_GAP, { save: false });
  syncPinButton(!!note.pinned);
  applyingRemote = false;
  els.saveStatus.textContent = "Saved";
  els.saveStatus.className = "save-status";
  setMobileEditor(true);
  renderList();
  syncToolbarFromSelection();
  loadInk(note.ink || "");

  if (!opts.keepFocus) {
    requestAnimationFrame(() => {
      if (opts.focusTitle) {
        els.noteTitle.focus();
        els.noteTitle.select();
      } else if (!els.paper?.classList.contains("pen-mode")) {
        els.editor.focus();
      }
    });
  }
}

function scheduleSave() {
  if (applyingRemote || !activeId) return;
  if (saving) {
    saveAgain = true;
    return;
  }
  els.saveStatus.textContent = "Saving…";
  els.saveStatus.className = "save-status saving";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveActive, 350);
}

async function saveActive() {
  if (!activeId || applyingRemote) return;
  const id = activeId;
  const current = notes.find((n) => n.id === id);
  const payload = {
    title: els.noteTitle.value,
    content: els.editor.innerHTML,
    lineGap: currentLineGap(),
    ink: exportInk(),
    pinned: !!current?.pinned,
  };

  saving = true;
  saveTimer = null;
  try {
    const res = await fetch("/api/notes/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("save failed");
    const updated = await res.json();
    lastLocalSaveAt = Date.now();
    upsertNote(updated);
    if (activeId === id) {
      els.saveStatus.textContent = "Saved";
      els.saveStatus.className = "save-status";
    }
    renderList();
  } catch {
    if (activeId === id) {
      els.saveStatus.textContent = "Error";
      els.saveStatus.className = "save-status error";
    }
    toast("Could not save");
  } finally {
    saving = false;
    if (saveAgain) {
      saveAgain = false;
      scheduleSave();
    }
  }
}

function flushSaveSync() {
  if (!activeId) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  const current = notes.find((n) => n.id === activeId);
  const payload = JSON.stringify({
    title: els.noteTitle.value,
    content: els.editor.innerHTML,
    lineGap: currentLineGap(),
    ink: exportInk(),
    pinned: !!current?.pinned,
  });
  try {
    fetch("/api/notes/" + activeId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

async function createNote() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    await saveActive();
  }
  try {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled", content: "" }),
    });
    if (!res.ok) throw new Error("create failed");
    const note = await res.json();
    lastLocalSaveAt = Date.now();
    upsertNote(note);
    openNote(note.id, { focusTitle: true });
    toast("Note created");
  } catch {
    toast("Could not create note");
  }
}

let confirmResolver = null;

function closeConfirm(result) {
  if (!els.confirmModal) return;
  els.confirmModal.hidden = true;
  const resolve = confirmResolver;
  confirmResolver = null;
  if (resolve) resolve(result);
}

function askDelete(label) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    els.confirmTitle.textContent = "Delete note?";
    els.confirmMessage.textContent =
      '"' + label + '" will be removed from all PCs. This can’t be undone.';
    els.confirmModal.hidden = false;
    requestAnimationFrame(() => els.confirmCancel?.focus());
  });
}

els.confirmModal?.querySelectorAll("[data-modal-cancel]").forEach((el) => {
  el.addEventListener("click", () => closeConfirm(false));
});
els.confirmOk?.addEventListener("click", () => closeConfirm(true));
document.addEventListener("keydown", (e) => {
  if (els.confirmModal?.hidden) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeConfirm(false);
  } else if (e.key === "Enter") {
    e.preventDefault();
    closeConfirm(true);
  }
});

async function deleteNoteById(id) {
  if (!id) return;
  const note = notes.find((n) => n.id === id);
  const label = note?.title || "Untitled";
  const ok = await askDelete(label);
  if (!ok) return;

  if (activeId === id) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  try {
    const res = await fetch("/api/notes/" + id, { method: "DELETE" });
    if (!res.ok) throw new Error("delete failed");
    lastLocalSaveAt = Date.now();
    notes = notes.filter((n) => n.id !== id);
    if (activeId === id) {
      showEmpty();
      if (notes[0] && !isNarrow()) openNote(notes[0].id);
    } else {
      renderList();
    }
    toast("Deleted");
  } catch {
    toast("Could not delete");
  }
}

async function deleteActive() {
  if (!activeId) return;
  return deleteNoteById(activeId);
}

async function togglePin(id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  const next = !note.pinned;
  note.pinned = next;
  if (activeId === id) syncPinButton(next);
  sortNotes();
  renderList();
  try {
    const res = await fetch("/api/notes/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: next }),
    });
    if (!res.ok) throw new Error("pin failed");
    const updated = await res.json();
    lastLocalSaveAt = Date.now();
    upsertNote(updated);
    if (activeId === id) syncPinButton(!!updated.pinned);
    renderList();
    toast(updated.pinned ? "Pinned" : "Unpinned");
  } catch {
    note.pinned = !next;
    if (activeId === id) syncPinButton(!!note.pinned);
    sortNotes();
    renderList();
    toast("Could not update pin");
  }
}

function safeFileName(name) {
  return String(name || "note")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 60) || "note";
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function downloadNoteAsImage() {
  if (!activeId || !els.paper || !els.editor) return;
  const title = (els.noteTitle.value || "Untitled").trim() || "Untitled";
  const width = Math.max(Math.floor(els.paper.clientWidth), 520);
  const padX = 28;
  const titleBlock = 64;
  const editorH = Math.max(els.editor.scrollHeight, 220);
  const height = titleBlock + editorH + 36;
  const scale = 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#1c1c1e";
  ctx.font = '700 26px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText(title, padX, 30, width - padX * 2 - 40);

  // Rule under title
  ctx.strokeStyle = "#d1d1d6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, 52);
  ctx.lineTo(width - padX, 52);
  ctx.stroke();

  // Editor HTML → image via SVG foreignObject
  const gapClass = currentLineGap();
  const html = els.editor.innerHTML || "";
  const xhtml =
    '<div xmlns="http://www.w3.org/1999/xhtml" style="' +
    "box-sizing:border-box;width:" +
    width +
    "px;padding:8px " +
    padX +
    "px 32px;font:16px/1.5 Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1c1e;word-wrap:break-word;overflow-wrap:break-word;" +
    "line-height:" +
    ({ s: 1.2, m: 1.5, l: 1.85, xl: 2.25, "2xl": 2.75 }[gapClass] || 1.5) +
    ';">' +
    html +
    "</div>";
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    editorH +
    '"><foreignObject width="100%" height="100%">' +
    xhtml +
    "</foreignObject></svg>";

  try {
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    const contentImg = await loadImageFromUrl(url);
    ctx.drawImage(contentImg, 0, titleBlock, width, editorH);
  } catch {
    // Fallback: plain text
    ctx.fillStyle = "#1c1c1e";
    ctx.font = '400 16px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textBaseline = "top";
    const text = stripHtml(html) || "";
    const words = text.split(/\s+/);
    let line = "";
    let y = titleBlock + 8;
    const maxW = width - padX * 2;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, padX, y);
        y += 24;
        line = w;
      } else line = test;
    }
    if (line) ctx.fillText(line, padX, y);
  }

  // Ink layer on top of body
  if (els.inkCanvas && canvasHasInk()) {
    const inkW = els.inkCanvas.width / (ink.dpr || 1);
    const inkH = els.inkCanvas.height / (ink.dpr || 1);
    ctx.drawImage(els.inkCanvas, 0, 0, els.inkCanvas.width, els.inkCanvas.height, 0, titleBlock, inkW, inkH);
  }

  const a = document.createElement("a");
  a.download = safeFileName(title) + ".png";
  a.href = canvas.toDataURL("image/png");
  a.click();
  toast("Image downloaded");
}

async function copyActive() {
  if (!activeId) return;
  const text = stripHtml(els.editor.innerHTML);
  const html = els.editor.innerHTML;
  try {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error("no clipboard");
    }
    toast("Copied");
  } catch {
    const range = document.createRange();
    range.selectNodeContents(els.editor);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("copy");
    sel.removeAllRanges();
    toast("Copied");
  }
}

/* ========== Formatting ========== */

function nearestSizeIndex(px) {
  let best = 0;
  for (let i = 0; i < FONT_SIZES.length; i++) {
    if (Math.abs(FONT_SIZES[i] - px) < Math.abs(FONT_SIZES[best] - px)) best = i;
  }
  return best;
}

function getSelectionFontSize() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 16;
  let node = sel.anchorNode;
  if (!node) return 16;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (!node || !els.editor.contains(node)) {
    return parseInt(getComputedStyle(els.editor).fontSize, 10) || 16;
  }
  return parseInt(getComputedStyle(node).fontSize, 10) || 16;
}

function syncSizeDropdown(px) {
  const idx = nearestSizeIndex(px);
  els.fontSize.value = String(FONT_SIZES[idx]);
}

function currentLineGap() {
  const fromClass = GAP_CLASSES.find((c) => els.editor.classList.contains(c));
  if (fromClass) return fromClass.replace("gap-", "");
  const note = notes.find((n) => n.id === activeId);
  if (note?.lineGap != null) return normalizeGap(note.lineGap);
  return DEFAULT_LINE_GAP;
}

function syncToolbarFromSelection() {
  if (!activeId) return;
  syncSizeDropdown(getSelectionFontSize());
  if (els.lineGap) els.lineGap.value = currentLineGap();
}

function selectAllEditor() {
  if (!activeId) return;
  els.editor.focus();
  const range = document.createRange();
  range.selectNodeContents(els.editor);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function ensureSelection() {
  els.editor.focus();
  const sel = window.getSelection();
  if (!sel) return null;
  if (!sel.rangeCount || sel.isCollapsed) {
    // Nothing selected → apply to all content (or whole editor)
    const range = document.createRange();
    if (els.editor.childNodes.length) {
      range.selectNodeContents(els.editor);
    } else {
      // Empty editor: insert a sized span for typing
      return null;
    }
    sel.removeAllRanges();
    sel.addRange(range);
  }
  return sel;
}

function applyFontSizePx(px) {
  els.editor.focus();
  const sel = ensureSelection();

  if (!sel) {
    // Empty note — set base size and a placeholder span
    const span = document.createElement("span");
    span.style.fontSize = px + "px";
    span.appendChild(document.createElement("br"));
    els.editor.innerHTML = "";
    els.editor.appendChild(span);
    const range = document.createRange();
    range.setStart(span, 0);
    range.collapse(true);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(range);
    syncSizeDropdown(px);
    scheduleSave();
    return;
  }

  // Read CURRENT size before wrapping (fontSize 7 trick would inflate it)
  document.execCommand("styleWithCSS", false, true);

  // Wrap via temporary fontSize then replace with exact px
  document.execCommand("fontSize", false, "7");
  const fonts = [...els.editor.querySelectorAll('font[size="7"], span[style*="font-size: xx-large"], span[style*="font-size:xx-large"]')];

  if (!fonts.length) {
    // Fallback: some browsers use span with large font-size
    const spans = [...els.editor.querySelectorAll("span")].filter((s) => {
      const fs = s.style.fontSize;
      return fs === "xx-large" || fs === "-webkit-xxx-large" || parseInt(fs, 10) >= 36;
    });
    spans.forEach((span) => {
      span.style.fontSize = px + "px";
    });
  } else {
    fonts.forEach((font) => {
      const span = document.createElement("span");
      span.style.fontSize = px + "px";
      while (font.firstChild) span.appendChild(font.firstChild);
      font.replaceWith(span);
    });
  }

  // Also catch styleWithCSS output: span style="font-size: xxx"
  els.editor.querySelectorAll('span[style*="xx-large"], span[style*="xxx-large"]').forEach((span) => {
    span.style.fontSize = px + "px";
  });

  syncSizeDropdown(px);
  scheduleSave();
}

function changeFontSize(delta) {
  const current = getSelectionFontSize();
  const idx = Math.max(0, Math.min(FONT_SIZES.length - 1, nearestSizeIndex(current) + delta));
  applyFontSizePx(FONT_SIZES[idx]);
}

function exec(cmd, value = null) {
  els.editor.focus();
  document.execCommand("styleWithCSS", false, true);
  document.execCommand(cmd, false, value);
  scheduleSave();
  syncToolbarFromSelection();
}

/* ========== Pen / ink drawing ========== */

function getInkCtx() {
  if (!els.inkCanvas) return null;
  if (!ink.ctx) ink.ctx = els.inkCanvas.getContext("2d");
  return ink.ctx;
}

function clearInkCanvas() {
  const ctx = getInkCtx();
  if (!ctx || !els.inkCanvas) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, els.inkCanvas.width, els.inkCanvas.height);
  ctx.restore();
  ink.dirty = false;
}

function canvasHasInk() {
  const ctx = getInkCtx();
  if (!ctx || !els.inkCanvas?.width) return false;
  try {
    const { width, height } = els.inkCanvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let i = 3; i < data.length; i += 32) {
      if (data[i] > 0) return true;
    }
  } catch {
    return ink.dirty;
  }
  return false;
}

function exportInk() {
  if (!els.inkCanvas) return "";
  try {
    if (!canvasHasInk()) return "";
    return els.inkCanvas.toDataURL("image/png");
  } catch {
    const note = notes.find((n) => n.id === activeId);
    return note?.ink || "";
  }
}

function resizeInkCanvas(preserve) {
  if (!els.inkCanvas || !els.editor) return;
  const stack = els.inkCanvas.parentElement;
  if (!stack) return;
  const rect = stack.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(Math.max(rect.height, els.editor.scrollHeight, 240)));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ink.dpr = dpr;

  let snapshot = null;
  if (preserve && els.inkCanvas.width && els.inkCanvas.height) {
    snapshot = document.createElement("canvas");
    snapshot.width = els.inkCanvas.width;
    snapshot.height = els.inkCanvas.height;
    snapshot.getContext("2d").drawImage(els.inkCanvas, 0, 0);
  }

  els.inkCanvas.style.width = cssW + "px";
  els.inkCanvas.style.height = cssH + "px";
  els.inkCanvas.width = Math.floor(cssW * dpr);
  els.inkCanvas.height = Math.floor(cssH * dpr);

  const ctx = getInkCtx();
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (snapshot) {
    ctx.drawImage(snapshot, 0, 0, cssW, cssH);
  }
}

function loadInk(dataUrl) {
  ink.loading = true;
  resizeInkCanvas(false);
  clearInkCanvas();
  if (!dataUrl) {
    ink.loading = false;
    ink.dirty = false;
    return;
  }
  const img = new Image();
  img.onload = () => {
    const ctx = getInkCtx();
    if (!ctx || !els.inkCanvas) return;
    const w = els.inkCanvas.width / ink.dpr;
    const h = els.inkCanvas.height / ink.dpr;
    ctx.drawImage(img, 0, 0, w, h);
    ink.loading = false;
    ink.dirty = false;
  };
  img.onerror = () => {
    ink.loading = false;
  };
  img.src = dataUrl;
}

function setPenMode(on) {
  if (!els.paper) return;
  els.paper.classList.toggle("pen-mode", on);
  if (els.btnPen) {
    els.btnPen.classList.toggle("active", on);
    els.btnPen.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (els.penBar) els.penBar.hidden = !on;
  if (els.penCursor) {
    els.penCursor.hidden = true;
    els.penCursor.classList.remove("is-drawing");
  }
  if (on) {
    resizeInkCanvas(true);
    setEraser(false);
    syncPenCursorColor();
  }
}

function syncPenCursorColor() {
  const nib = els.penCursor?.querySelector(".pen-cursor-nib");
  if (!nib) return;
  const profile = currentInk();
  nib.setAttribute("fill", profile.body);
}

function setEraser(on) {
  ink.erasing = on;
  if (els.btnEraser) {
    els.btnEraser.classList.toggle("active", on);
    els.btnEraser.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function pointerPos(e) {
  const rect = els.inkCanvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    t: performance.now(),
  };
}

function strokeWidthForSpeed(speed) {
  const tip = PEN_TIPS[ink.tip] || PEN_TIPS.ballpoint;
  const t = Math.min(1, speed / 2.4);
  const raw = tip.max - (tip.max - tip.min) * t;
  // Smooth width changes so ink looks continuous
  ink.lastWidth = ink.lastWidth * 0.65 + raw * 0.35;
  return ink.lastWidth;
}

function strokePath(ctx, pts, a, mid) {
  ctx.beginPath();
  if (pts.length >= 3) {
    const p0 = pts[pts.length - 3];
    const m0 = { x: (p0.x + a.x) / 2, y: (p0.y + a.y) / 2 };
    ctx.moveTo(m0.x, m0.y);
    ctx.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
  } else {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(mid.x, mid.y);
  }
}

function paintRealisticStroke(pts, a, b, mid, width, speed) {
  const ctx = getInkCtx();
  if (!ctx) return;
  const tip = PEN_TIPS[ink.tip] || PEN_TIPS.ballpoint;
  const profile = currentInk();
  const isGel = profile.kind === "gel" || ink.tip === "gel";
  const isMarker = ink.tip === "marker";
  // Slow strokes lay more ink; fast strokes look drier
  const lay = Math.max(0.55, Math.min(1, tip.flow * (1.15 - Math.min(0.55, speed * 0.35))));

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "source-over";

  if (isMarker) {
    ctx.strokeStyle = profile.body;
    ctx.globalAlpha = 0.34 * lay;
    ctx.lineWidth = width;
    ctx.shadowColor = profile.body;
    ctx.shadowBlur = 3;
    strokePath(ctx, pts, a, mid);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 1) Soft wet edge / paper bleed
  ctx.strokeStyle = profile.wet;
  ctx.globalAlpha = (isGel ? 0.55 : 0.4) * lay;
  ctx.lineWidth = width * (isGel ? 1.55 : 1.75);
  ctx.shadowColor = "transparent";
  strokePath(ctx, pts, a, mid);
  ctx.stroke();

  // 2) Main ink body
  ctx.strokeStyle = profile.body;
  ctx.globalAlpha = (isGel ? 0.92 : 0.78) * lay;
  ctx.lineWidth = width * (isGel ? 1.05 : 1.12);
  if (isGel) {
    ctx.shadowColor = profile.body;
    ctx.shadowBlur = 0.8;
  }
  strokePath(ctx, pts, a, mid);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 3) Darker core (ballpoint ink concentrates; gel has glossy spine)
  ctx.strokeStyle = profile.core;
  ctx.globalAlpha = (isGel ? 0.55 : 0.7) * lay;
  ctx.lineWidth = width * (isGel ? 0.42 : 0.55);
  strokePath(ctx, pts, a, mid);
  ctx.stroke();

  // 4) Ballpoint paper-tooth speckles along the stroke
  if (!isGel && tip.wobble > 0 && Math.random() < 0.35) {
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    const ox = (nx / len) * (Math.random() - 0.5) * tip.wobble * width;
    const oy = (ny / len) * (Math.random() - 0.5) * tip.wobble * width;
    ctx.fillStyle = profile.core;
    ctx.globalAlpha = 0.2 * lay;
    ctx.beginPath();
    ctx.arc(mid.x + ox, mid.y + oy, Math.max(0.35, width * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }

  // 5) Gel wet highlight — tiny bright ridge
  if (isGel && width > 1.4) {
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.globalAlpha = 0.25 * lay;
    ctx.lineWidth = Math.max(0.4, width * 0.18);
    strokePath(ctx, pts, a, mid);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSmoothStroke() {
  const pts = ink.points;
  if (pts.length < 2) return;
  const ctx = getInkCtx();
  if (!ctx) return;

  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dt = Math.max(1, b.t - a.t);
  const speed = Math.sqrt(dx * dx + dy * dy) / dt;
  const width = strokeWidthForSpeed(speed);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  if (ink.erasing) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = Math.max(16, width * 4);
    ctx.lineCap = "round";
    strokePath(ctx, pts, a, mid);
    ctx.stroke();
    ctx.restore();
    return;
  }

  paintRealisticStroke(pts, a, b, mid, width, speed);
}

function stampNib(x, y) {
  const ctx = getInkCtx();
  if (!ctx) return;
  const tip = PEN_TIPS[ink.tip] || PEN_TIPS.ballpoint;
  const profile = currentInk();
  const r = tip.min * (profile.kind === "gel" ? 0.85 : 0.7);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = profile.wet;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = profile.body;
  ctx.globalAlpha = profile.kind === "gel" ? 0.9 : 0.8;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = profile.core;
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function movePenCursor(clientX, clientY) {
  if (!els.penCursor || els.penCursor.hidden) return;
  // Tip sits exactly on the ink point (CSS translate matches nib at 2,78)
  els.penCursor.style.left = clientX + "px";
  els.penCursor.style.top = clientY + "px";
}

function onInkPointerDown(e) {
  if (!els.paper?.classList.contains("pen-mode")) return;
  e.preventDefault();
  els.inkCanvas.setPointerCapture?.(e.pointerId);
  ink.drawing = true;
  els.penCursor?.classList.add("is-drawing");
  movePenCursor(e.clientX, e.clientY);
  ink.points = [pointerPos(e)];
  ink.lastWidth = (PEN_TIPS[ink.tip] || PEN_TIPS.ballpoint).min * 1.1;
  const p = ink.points[0];
  const ctx = getInkCtx();
  if (!ctx) return;
  if (ink.erasing) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    stampNib(p.x, p.y);
  }
  ink.dirty = true;
}

function onInkPointerMove(e) {
  movePenCursor(e.clientX, e.clientY);
  if (!ink.drawing) return;
  e.preventDefault();
  const p = pointerPos(e);
  // Tiny hand tremor so lines aren’t laser-straight
  if (ink.tip !== "marker") {
    p.x += (Math.random() - 0.5) * 0.35;
    p.y += (Math.random() - 0.5) * 0.35;
  }
  ink.points.push(p);
  if (ink.points.length > 48) ink.points = ink.points.slice(-24);
  drawSmoothStroke();
  ink.dirty = true;
}

function onInkPointerUp(e) {
  if (!ink.drawing) return;
  e.preventDefault();
  ink.drawing = false;
  els.penCursor?.classList.remove("is-drawing");
  ink.points = [];
  if (ink.dirty) {
    const note = notes.find((n) => n.id === activeId);
    if (note) note.ink = exportInk();
    scheduleSave();
  }
}

function clearInkNow() {
  if (!activeId) return;
  clearInkCanvas();
  const note = notes.find((n) => n.id === activeId);
  if (note) note.ink = "";
  scheduleSave();
  toast("Drawing cleared");
}

async function loadNotes() {
  try {
    const res = await fetch("/api/notes");
    if (!res.ok) throw new Error("load failed");
    notes = await res.json();
    sortNotes();
    renderList();

    if (activeId && notes.some((n) => n.id === activeId)) {
      openNote(activeId, { keepFocus: true });
    } else if (notes.length && !isNarrow()) {
      openNote(notes[0].id);
    } else {
      showEmpty();
    }
  } catch {
    toast("Could not load notes");
  }
}

function connectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io({ transports: ["websocket", "polling"] });

  socket.on("connect", () => setLive("on"));
  socket.on("disconnect", () => setLive("off"));

  socket.on("notes:sync", (remoteNotes) => {
    if (Date.now() - lastLocalSaveAt < 800) return;
    notes = Array.isArray(remoteNotes) ? remoteNotes : [];
    sortNotes();
    renderList();
    if (activeId && notes.some((n) => n.id === activeId)) {
      const note = notes.find((n) => n.id === activeId);
      const focused = document.activeElement;
      if (focused !== els.noteTitle && focused !== els.editor && !ink.drawing) {
        applyingRemote = true;
        els.noteTitle.value = note.title || "";
        els.editor.innerHTML = note.content || "";
        applyLineGap(note.lineGap ?? DEFAULT_LINE_GAP, { save: false });
        loadInk(note.ink || "");
        applyingRemote = false;
      }
    }
  });

  socket.on("notes:changed", ({ action, note, id }) => {
    if (Date.now() - lastLocalSaveAt < 500) {
      if (action === "delete") {
        notes = notes.filter((n) => n.id !== id);
        if (activeId === id) showEmpty();
        else renderList();
      } else if (note) {
        upsertNote(note);
        renderList();
      }
      return;
    }

    if (action === "delete") {
      notes = notes.filter((n) => n.id !== id);
      if (activeId === id) showEmpty();
      else renderList();
      return;
    }

    if (!note) return;
    upsertNote(note);

    if (activeId === note.id) {
      const focused = document.activeElement;
      const typing = focused === els.noteTitle || focused === els.editor || ink.drawing;
      if (!typing) {
        applyingRemote = true;
        els.noteTitle.value = note.title || "";
        els.editor.innerHTML = note.content || "";
        applyLineGap(note.lineGap ?? DEFAULT_LINE_GAP, { save: false });
        loadInk(note.ink || "");
        applyingRemote = false;
        els.saveStatus.textContent = "Synced";
        els.saveStatus.className = "save-status";
      }
    }
    renderList();
  });
}

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.loginError.hidden = true;
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: els.username.value.trim(),
        password: els.password.value,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      els.loginError.textContent = data.error || "Login failed";
      els.loginError.hidden = false;
      return;
    }
    setAuth({ username: els.username.value.trim(), token: data.token, at: Date.now() });
    showApp();
  } catch {
    els.loginError.textContent = "Server not reachable";
    els.loginError.hidden = false;
  }
});

els.btnLogout.addEventListener("click", () => {
  flushSaveSync();
  clearAuth();
  showLogin();
});

els.btnToggleSidebar.addEventListener("click", () => setSidebarCollapsed(true));
els.btnExpandSidebar.addEventListener("click", () => {
  setSidebarCollapsed(false);
  if (isNarrow()) setMobileEditor(false);
});
els.btnBack.addEventListener("click", () => {
  setMobileEditor(false);
  setSidebarCollapsed(false);
});

els.btnNew.addEventListener("click", createNote);
els.btnNewEmpty.addEventListener("click", createNote);
els.btnDelete.addEventListener("click", deleteActive);
els.btnCopy.addEventListener("click", copyActive);
els.btnDownloadImage?.addEventListener("click", () => {
  downloadNoteAsImage().catch(() => toast("Could not download image"));
});

els.btnPin?.addEventListener("click", () => {
  if (activeId) togglePin(activeId);
});
els.search.addEventListener("input", renderList);
els.noteTitle.addEventListener("input", scheduleSave);
els.editor.addEventListener("input", scheduleSave);
els.editor.addEventListener("keyup", syncToolbarFromSelection);
els.editor.addEventListener("mouseup", syncToolbarFromSelection);

document.querySelectorAll(".toolbar [data-cmd]").forEach((btn) => {
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => {
    const cmd = btn.dataset.cmd;
    if (cmd === "increaseFontSize") return changeFontSize(1);
    if (cmd === "decreaseFontSize") return changeFontSize(-1);
    exec(cmd);
  });
});

els.fontFamily.addEventListener("change", () => {
  exec("fontName", els.fontFamily.value);
});

els.fontSize.addEventListener("change", () => {
  const px = parseInt(els.fontSize.value, 10);
  if (!Number.isNaN(px)) applyFontSizePx(px);
});

function applyLineGap(value, opts = {}) {
  const gap = normalizeGap(value);
  GAP_CLASSES.forEach((c) => els.editor.classList.remove(c));
  els.editor.classList.add("gap-" + gap);
  els.editor.querySelectorAll("[style]").forEach((el) => {
    if (el.style.lineHeight) el.style.removeProperty("line-height");
  });
  if (els.lineGap) els.lineGap.value = gap;
  const note = notes.find((n) => n.id === activeId);
  if (note) note.lineGap = gap;
  if (opts.save !== false) scheduleSave();
}

els.lineGap?.addEventListener("change", () => {
  applyLineGap(els.lineGap.value);
});

els.btnSelectAll?.addEventListener("mousedown", (e) => e.preventDefault());
els.btnSelectAll?.addEventListener("click", selectAllEditor);

els.btnPen?.addEventListener("click", () => {
  const on = !els.paper?.classList.contains("pen-mode");
  setPenMode(on);
  if (on) toast("Pen on — draw on the note");
});

els.btnPenDone?.addEventListener("click", () => setPenMode(false));

els.penTip?.addEventListener("change", () => {
  ink.tip = els.penTip.value;
  // Switching to Gel tip prefers gel inks if current is ball of same hue
  if (ink.tip === "gel" && ink.inkId.endsWith("-ball")) {
    const gelId = ink.inkId.replace("-ball", "-gel");
    if (INKS[gelId]) {
      ink.inkId = gelId;
      document.querySelectorAll(".pen-swatch").forEach((b) => {
        b.classList.toggle("active", b.dataset.ink === gelId);
      });
    }
  }
  setEraser(false);
});

document.querySelectorAll(".pen-swatch").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pen-swatch").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ink.inkId = btn.dataset.ink || "blue-ball";
    const profile = currentInk();
    if (profile.kind === "gel" && ink.tip === "ballpoint") {
      ink.tip = "gel";
      if (els.penTip) els.penTip.value = "gel";
    } else if (profile.kind === "ball" && ink.tip === "gel") {
      ink.tip = "ballpoint";
      if (els.penTip) els.penTip.value = "ballpoint";
    }
    syncPenCursorColor();
    setEraser(false);
  });
});

els.inkCanvas?.addEventListener("pointerenter", (e) => {
  if (!els.paper?.classList.contains("pen-mode")) return;
  if (els.penCursor) els.penCursor.hidden = false;
  movePenCursor(e.clientX, e.clientY);
});

els.inkCanvas?.addEventListener("pointerleave", () => {
  if (!ink.drawing && els.penCursor) els.penCursor.hidden = true;
});

els.btnEraser?.addEventListener("click", () => setEraser(!ink.erasing));
els.btnInkClear?.addEventListener("click", clearInkNow);

if (els.inkCanvas) {
  els.inkCanvas.addEventListener("pointerdown", onInkPointerDown);
  els.inkCanvas.addEventListener("pointermove", onInkPointerMove);
  els.inkCanvas.addEventListener("pointerup", onInkPointerUp);
  els.inkCanvas.addEventListener("pointercancel", onInkPointerUp);
  els.inkCanvas.addEventListener("pointerleave", (e) => {
    if (ink.drawing) onInkPointerUp(e);
  });
}

window.addEventListener("resize", () => {
  if (activeId) resizeInkCanvas(true);
});

els.insertSymbol?.addEventListener("change", () => {
  const sym = els.insertSymbol.value;
  if (!sym) return;
  els.editor.focus();
  document.execCommand("insertText", false, sym);
  els.insertSymbol.selectedIndex = 0;
  scheduleSave();
});

window.addEventListener("resize", () => {
  if (!isNarrow()) els.app.classList.remove("mobile-editor");
  else if (activeId) setMobileEditor(true);
});

window.addEventListener("beforeunload", flushSaveSync);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushSaveSync();
});

if (getAuth()?.token) showApp();
else {
  showLogin();
  els.password.focus();
}
