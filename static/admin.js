/* ============================================================================
   ADMIN — wired to match your Flask/dataclass shape:
     Food_struct: { name, description, price, category }
     category is an int index into CATEGORIES below.
     No `id` field on your struct, so we identify dishes by `name`
     everywhere (matches how your remove() method works). If two dishes
     ever share a name, editing/deleting one will affect the other —
     worth adding a unique id field on the backend if that becomes a problem.

   YOU STILL NEED TO ADD THESE ROUTES TO app.py — they don't exist yet:
     GET    /api/menu                 -> list of Food_struct as JSON
     POST   /api/menu                 -> body: {name, description, price, category}
     PUT    /api/menu/<name>          -> body: any of the same fields to update
     DELETE /api/menu/<name>
============================================================================ */

const CATEGORIES = [
  { id: 0, name: "Coffee & Breakfast", name_ar: "القهوة والفطور" },
  { id: 1, name: "Mezze to Share", name_ar: "المقبلات" },
  { id: 2, name: "Wood-Fired Mains", name_ar: "الأطباق الرئيسية" },
  { id: 3, name: "Sweet Endings", name_ar: "الحلويات" },
];

function categoryName(id) {
  const c = CATEGORIES.find((c) => c.id === id);
  return c ? c.name : "Uncategorized";
}

let menuItems = [];       // cache of the last successful GET /api/menu
let editingName = null;   // name of the dish being edited, or null when adding

let reservationsCache = [];   // cache of the last successful GET /api/reservations
let editingReservationId = null;

document.addEventListener("DOMContentLoaded", () => {
  wireNav();
  wireModal();
  wireInfoForm();
  wireUserMenu();
  wirePasswordForm();
  wireMenuToolbar();
  wireReservationModal();
  wireExportButton();
  wireImportButton();
  populateCategorySelect();
  loadMenu();
  loadReservations();
});

/* ---------------------------------------------------------------------- */
/* NAV                                                                     */
/* ---------------------------------------------------------------------- */
function wireNav() {
  const navItems = document.querySelectorAll(".nav-item");
  const views = document.querySelectorAll(".view");
  const topbarTitle = document.getElementById("topbarTitle");
  const topbarSubtitle = document.getElementById("topbarSubtitle");
  const addItemBtn = document.getElementById("addItemBtn");
  const addReservationBtn = document.getElementById("addReservationBtn");
  const exportMenuBtn = document.getElementById("exportMenuBtn");
  const importMenuBtn = document.getElementById("importMenuBtn");

  const titles = {
    dashboard: ["Dashboard", "An overview of the menu and recent changes"],
    menu: ["Menu Items", "Add, edit, and remove dishes across every category"],
    reservations: ["Reservations", "Upcoming bookings and table requests"],
    info: ["Restaurant Info", "Address, hours, and contact details shown on the site"],
    settings: ["Settings", "Manage your admin account"],
  };

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;
      navItems.forEach((b) => b.classList.toggle("active", b === btn));
      views.forEach((v) => v.classList.toggle("active", v.id === "view-" + target));
      topbarTitle.textContent = titles[target][0];
      topbarSubtitle.textContent = titles[target][1];
      addItemBtn.style.display = target === "menu" ? "inline-flex" : "none";
      exportMenuBtn.style.display = target === "menu" ? "inline-flex" : "none";
      importMenuBtn.style.display = target === "menu" ? "inline-flex" : "none";
      addReservationBtn.style.display = target === "reservations" ? "inline-flex" : "none";
      if (target === "dashboard") renderDashboard();
    });
  });
}

/* ---------------------------------------------------------------------- */
/* USER MENU (topbar dropdown + logout)                                   */
/* ---------------------------------------------------------------------- */
function wireUserMenu() {
  const btn = document.getElementById("userMenuBtn");
  const dropdown = document.getElementById("userMenuDropdown");
  if (!btn || !dropdown) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });
  document.addEventListener("click", () => dropdown.classList.remove("open"));
  dropdown.addEventListener("click", (e) => e.stopPropagation());
}

/* ---------------------------------------------------------------------- */
/* SETTINGS — change password (PUT /api/settings/password)                */
/* ---------------------------------------------------------------------- */
function wirePasswordForm() {
  const form = document.getElementById("passwordForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("passwordFormError");
    errorBox.style.display = "none";

    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;

    try {
      const res = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const body = await res.json();

      if (!res.ok) {
        errorBox.textContent = body.error || "Couldn't update password";
        errorBox.style.display = "block";
        return;
      }

      form.reset();
      toast("Password updated");
    } catch (err) {
      errorBox.textContent = "Couldn't reach the server";
      errorBox.style.display = "block";
    }
  });
}

/* ---------------------------------------------------------------------- */
/* MENU SEARCH + CATEGORY FILTER (client-side, no extra requests)         */
/* ---------------------------------------------------------------------- */
let activeSearch = "";
let activeCategoryFilter = "all";

function wireMenuToolbar() {
  const searchInput = document.getElementById("menuSearch");
  const chips = document.querySelectorAll(".filter-chip");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      activeSearch = searchInput.value.trim().toLowerCase();
      renderMenu();
    });
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeCategoryFilter = chip.dataset.filterCategory;
      renderMenu();
    });
  });
}

/* ---------------------------------------------------------------------- */
/* LOAD + RENDER MENU (GET /api/menu)                                     */
/* ---------------------------------------------------------------------- */
async function loadMenu() {
  try {
    const res = await fetch("/api/menu");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) throw new Error("Request failed: " + res.status);
    menuItems = await res.json();
    setBackendStatus(true);
  } catch (err) {
    toast("Couldn't load the menu — is /api/menu built yet?", "danger");
    menuItems = [];
    setBackendStatus(false);
  }
  renderMenu();
  renderDashboard();
}

function setBackendStatus(connected) {
  const dot = document.getElementById("backendStatusDot");
  const label = document.getElementById("backendStatusLabel");
  if (!dot || !label) return;
  dot.classList.toggle("connected", connected);
  dot.classList.toggle("disconnected", !connected);
  label.textContent = connected ? "Connected to backend" : "Backend not reachable";
}

function renderDashboard() {
  document.getElementById("statTotal").textContent = menuItems.length;
  document.getElementById("statCategories").textContent = CATEGORIES.length;

  const feed = document.getElementById("activityFeed");
  if (menuItems.length === 0) {
    feed.innerHTML = `<div class="empty-state"><div class="glyph">—</div><p>No dishes yet. Add your first one from the Menu Items tab.</p></div>`;
    return;
  }
  feed.innerHTML = menuItems
    .slice(-5)
    .reverse()
    .map(
      (item) => `
      <div class="activity-row">
        <div><strong>${escapeHtml(item.name)}</strong> <span class="who">· ${categoryName(item.category)}</span></div>
        <span class="when mono">$${Number(item.price).toFixed(2)}</span>
      </div>`
    )
    .join("");
}

function renderMenu() {
  const wrap = document.getElementById("menuCategories");

  const filtered = menuItems.filter((item) => {
    const matchesSearch =
      !activeSearch ||
      item.name.toLowerCase().includes(activeSearch) ||
      (item.description || "").toLowerCase().includes(activeSearch);
    const matchesCategory =
      activeCategoryFilter === "all" || String(item.category) === activeCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categoriesToShow =
    activeCategoryFilter === "all"
      ? CATEGORIES
      : CATEGORIES.filter((c) => String(c.id) === activeCategoryFilter);

  if (filtered.length === 0 && menuItems.length > 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="glyph">—</div><p>No dishes match "${escapeHtml(activeSearch)}".</p></div>`;
    return;
  }

  wrap.innerHTML = categoriesToShow.map((cat) => {
    const items = filtered.filter((i) => i.category === cat.id);
    return `
    <div class="category-block">
      <div class="cat-head">
        <div class="cat-title">
          <span class="dot"></span>
          <h2>${escapeHtml(cat.name)}</h2>
          <span class="cat-ar">${escapeHtml(cat.name_ar)}</span>
        </div>
        <span class="cat-count mono">${items.length} item${items.length === 1 ? "" : "s"}</span>
      </div>
      <div class="panel">
        <div class="panel-body">
          ${
            items.length === 0
              ? `<div class="empty-state"><p>No dishes in this category yet.</p></div>`
              : `
            <table class="item-table">
              <thead><tr><th>Dish</th><th>Price</th><th></th></tr></thead>
              <tbody>
                ${items
                  .map(
                    (item) => `
                  <tr>
                    <td>
                      <div class="item-name">${escapeHtml(item.name)}</div>
                      <div class="item-desc">${escapeHtml(item.description || "")}</div>
                    </td>
                    <td class="item-price">$${Number(item.price).toFixed(2)}</td>
                    <td>
                      <div class="item-actions">
                        <button class="icon-btn" title="Edit" onclick="openItemModal(${JSON.stringify(item.name)})">✎</button>
                        <button class="icon-btn danger" title="Delete" onclick="handleDelete(${JSON.stringify(item.name)})">✕</button>
                      </div>
                    </td>
                  </tr>`
                  )
                  .join("")}
              </tbody>
            </table>`
          }
        </div>
      </div>
    </div>`;
  }).join("");
}

/* ---------------------------------------------------------------------- */
/* MODAL — create (POST) / edit (PUT)                                     */
/* ---------------------------------------------------------------------- */
function populateCategorySelect() {
  const select = document.getElementById("fieldCategory");
  select.innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

function wireModal() {
  const backdrop = document.getElementById("itemModalBackdrop");
  document.getElementById("addItemBtn").addEventListener("click", () => openItemModal(null));
  document.getElementById("modalCloseBtn").addEventListener("click", closeItemModal);
  document.getElementById("modalCancelBtn").addEventListener("click", closeItemModal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeItemModal(); });
  document.getElementById("itemForm").addEventListener("submit", handleFormSubmit);
}

function openItemModal(name) {
  editingName = name;
  const form = document.getElementById("itemForm");
  form.reset();
  document.getElementById("modalTitle").textContent = name ? "Edit Dish" : "Add Dish";

  if (name) {
    const item = menuItems.find((i) => i.name === name);
    if (item) {
      document.getElementById("fieldName").value = item.name;
      document.getElementById("fieldDesc").value = item.description || "";
      document.getElementById("fieldPrice").value = item.price;
      document.getElementById("fieldCategory").value = item.category;
    }
  }
  document.getElementById("itemModalBackdrop").classList.add("open");
}

function closeItemModal() {
  document.getElementById("itemModalBackdrop").classList.remove("open");
  editingName = null;
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById("fieldName").value.trim(),
    description: document.getElementById("fieldDesc").value.trim(),
    price: parseFloat(document.getElementById("fieldPrice").value),
    category: parseInt(document.getElementById("fieldCategory").value, 10),
  };

  if (!payload.name || !payload.description || Number.isNaN(payload.price)) {
    toast("Fill in name, description, and price first", "danger");
    return;
  }

  try {
    if (editingName) {
      const res = await fetch(`/api/menu/${encodeURIComponent(editingName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast(`Saved "${payload.name}"`);
    } else {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast(`Added "${payload.name}"`);
    }
    closeItemModal();
    await loadMenu();
  } catch (err) {
    toast("Couldn't save — check the /api/menu route on the backend", "danger");
  }
}

async function handleDelete(name) {
  if (!confirm(`Remove "${name}" from the menu? This can't be undone.`)) return;
  try {
    const res = await fetch(`/api/menu/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    toast(`Deleted "${name}"`);
    await loadMenu();
  } catch (err) {
    toast("Couldn't delete — check the /api/menu route on the backend", "danger");
  }
}

/* ---------------------------------------------------------------------- */
/* RESTAURANT INFO — wire this once you add /api/info on the backend      */
/* ---------------------------------------------------------------------- */
function wireInfoForm() {
  document.getElementById("infoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    toast("Restaurant info save isn't wired up yet — add /api/info on the backend");
  });
}

/* ---------------------------------------------------------------------- */
/* TOAST + UTIL                                                           */
/* ---------------------------------------------------------------------- */
function toast(message, type = "default") {
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  el.className = "toast" + (type === "danger" ? " danger" : "");
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------------------------------------------------------------------- */
/* RESERVATIONS — GET/POST/PUT/DELETE /api/reservations                   */
/* ---------------------------------------------------------------------- */
async function loadReservations() {
  try {
    const res = await fetch("/api/reservations");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) throw new Error("Request failed: " + res.status);
    reservationsCache = await res.json();
  } catch (err) {
    reservationsCache = [];
  }
  renderReservations();
}

function renderReservations() {
  const wrap = document.getElementById("reservationsList");
  if (!wrap) return;

  if (reservationsCache.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="glyph">—</div><p>No reservations yet. Add one with "+ New Reservation".</p></div>`;
    return;
  }

  const sorted = [...reservationsCache].sort((a, b) => {
    const aKey = `${a.date} ${a.time}`;
    const bKey = `${b.date} ${b.time}`;
    return aKey.localeCompare(bKey);
  });

  const statusClass = { confirmed: "available", pending: "pending", cancelled: "cancelled" };

  wrap.innerHTML = sorted
    .map((r) => `
    <div class="reservation-card">
      <div class="reservation-main">
        <div>
          <div class="reservation-name">${escapeHtml(r.name)}</div>
          <div class="reservation-meta">
            <span>📅 ${escapeHtml(r.date)} · ${escapeHtml(r.time)}</span>
            <span>👥 ${r.party_size}</span>
            <span>📞 ${escapeHtml(r.phone)}</span>
          </div>
        </div>
      </div>
      <div class="reservation-actions">
        <span class="status-pill ${statusClass[r.status] || "pending"}"><span class="dot"></span><span class="label">${escapeHtml(r.status)}</span></span>
        <button class="icon-btn" title="Edit" onclick="openReservationModal(${r.id})">✎</button>
        <button class="icon-btn danger" title="Delete" onclick="handleDeleteReservation(${r.id})">✕</button>
      </div>
    </div>`)
    .join("");
}

function wireReservationModal() {
  const backdrop = document.getElementById("reservationModalBackdrop");
  const addBtn = document.getElementById("addReservationBtn");
  if (!backdrop || !addBtn) return;

  addBtn.addEventListener("click", () => openReservationModal(null));
  document.getElementById("reservationModalCloseBtn").addEventListener("click", closeReservationModal);
  document.getElementById("reservationModalCancelBtn").addEventListener("click", closeReservationModal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeReservationModal(); });
  document.getElementById("reservationForm").addEventListener("submit", handleReservationFormSubmit);
}

function openReservationModal(id) {
  editingReservationId = id;
  const form = document.getElementById("reservationForm");
  form.reset();
  document.getElementById("reservationModalTitle").textContent = id ? "Edit Reservation" : "New Reservation";

  if (id) {
    const r = reservationsCache.find((x) => x.id === id);
    if (r) {
      document.getElementById("resName").value = r.name;
      document.getElementById("resPhone").value = r.phone;
      document.getElementById("resPartySize").value = r.party_size;
      document.getElementById("resDate").value = r.date;
      document.getElementById("resTime").value = r.time;
      document.getElementById("resStatus").value = r.status;
      document.getElementById("resNotes").value = r.notes || "";
    }
  }
  document.getElementById("reservationModalBackdrop").classList.add("open");
}

function closeReservationModal() {
  document.getElementById("reservationModalBackdrop").classList.remove("open");
  editingReservationId = null;
}

async function handleReservationFormSubmit(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById("resName").value.trim(),
    phone: document.getElementById("resPhone").value.trim(),
    party_size: parseInt(document.getElementById("resPartySize").value, 10),
    date: document.getElementById("resDate").value,
    time: document.getElementById("resTime").value,
    status: document.getElementById("resStatus").value,
    notes: document.getElementById("resNotes").value.trim(),
  };

  if (!payload.name || !payload.phone || !payload.date || !payload.time || Number.isNaN(payload.party_size)) {
    toast("Fill in name, phone, party size, date, and time first", "danger");
    return;
  }

  try {
    if (editingReservationId) {
      const res = await fetch(`/api/reservations/${editingReservationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast(`Updated reservation for ${payload.name}`);
    } else {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast(`Added reservation for ${payload.name}`);
    }
    closeReservationModal();
    await loadReservations();
  } catch (err) {
    toast("Couldn't save the reservation", "danger");
  }
}

async function handleDeleteReservation(id) {
  const r = reservationsCache.find((x) => x.id === id);
  if (!r) return;
  if (!confirm(`Cancel and remove the reservation for "${r.name}"? This can't be undone.`)) return;
  try {
    const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    toast(`Removed reservation for ${r.name}`);
    await loadReservations();
  } catch (err) {
    toast("Couldn't delete the reservation", "danger");
  }
}

/* ---------------------------------------------------------------------- */
/* EXPORT MENU TO JSON — POST /api/menu/export                            */
/* ---------------------------------------------------------------------- */
function wireExportButton() {
  const btn = document.getElementById("exportMenuBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Exporting…";

    try {
      const res = await fetch("/api/menu/export", { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Export failed");
      toast(`Exported ${body.count} dish${body.count === 1 ? "" : "es"} to menu_items.json`);
    } catch (err) {
      toast("Couldn't export the menu — check the /api/menu/export route on the backend", "danger");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

/* ---------------------------------------------------------------------- */
/* IMPORT MENU FROM JSON — POST /api/menu/import                          */
/* ---------------------------------------------------------------------- */
function wireImportButton() {
  const btn = document.getElementById("importMenuBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!confirm("This replaces the current menu with whatever is saved in menu_items.json. Continue?")) return;

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Importing…";

    try {
      const res = await fetch("/api/menu/import", { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Import failed");
      toast(`Imported ${body.count} dish${body.count === 1 ? "" : "es"} from menu_items.json`);
      await loadMenu();
    } catch (err) {
      toast(err.message || "Couldn't import the menu", "danger");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}
