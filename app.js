/* Rodinný kalendář – kompletní aplikace */
"use strict";

const SUPABASE_URL = "https://ujtpluckaenrplkfpzgi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5Sf5fpEYUA2Q3dp74c1q3w_XzKRTST7";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const el = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");

const dateKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const dateFromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const dateLabel = (d) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d);

const monthLabel = (d) =>
  new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric"
  }).format(d);

const categoryNames = {
  me: "Já",
  wife: "Manželka",
  mom: "Mamka – práce",
  service: "Servis oken"
};

let user = null;
let familyId = null;

let month = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1
);

let selectedDate = dateKey(new Date());
let events = [];
let serviceSlots = [];
let refreshing = false;

function errorText(error) {
  return error?.message || String(error || "Neznámá chyba");
}

function showLogin(message = "") {
  el("loginScreen").classList.remove("hidden");
  el("appScreen").classList.add("hidden");
  el("eventModal").classList.add("hidden");
  el("loginError").textContent = message;
}

function showApp() {
  el("loginScreen").classList.add("hidden");
  el("appScreen").classList.remove("hidden");
  el("loginError").textContent = "";
}

function showEventError(message = "") {
  el("eventError").textContent = message;
}

function localISO(key, time) {
  return new Date(`${key}T${time}:00`).toISOString();
}

function itemDate(item) {
  return dateKey(new Date(item.start_at));
}

function timeLabel(item) {
  if (item.all_day) return "Celý den";

  const f = new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit"
  });

  return f.format(new Date(item.start_at)) +
    (item.end_at
      ? " – " + f.format(new Date(item.end_at))
      : "");
}

function create(tag, cls, text) {
  const node = document.createElement(tag);

  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;

  return node;
}

/* ==========================================
   NAČTENÍ RODINNÉHO KALENDÁŘE
   ========================================== */

async function loadFamily() {
  const { data, error } = await db
    .from("family_calendar_members")
    .select("family_id,display_name")
    .eq("user_id", user.id)
    .limit(1);

  if (error) {
    throw new Error(
      "Nelze načíst členství v rodinném kalendáři: " +
      errorText(error)
    );
  }

  if (!data?.length) {
    throw new Error(
      "K tomuto účtu zatím není přiřazen rodinný kalendář. " +
      "Zkontroluj členství v Supabase."
    );
  }

  familyId = data[0].family_id;

  el("userName").textContent =
    data[0].display_name || user.email || "";
}

/* ==========================================
   NAČTENÍ UDÁLOSTÍ
   ========================================== */

async function loadMonth() {
  if (!familyId || refreshing) return;

  refreshing = true;

  try {
    const first = new Date(
      month.getFullYear(),
      month.getMonth(),
      1
    );

    const from = new Date(first);
    from.setDate(from.getDate() - 7);

    const to = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      8
    );

    const { data, error } = await db
      .from("family_calendar_events")
      .select(
        "id,title,description,start_at,end_at,all_day,category,created_by"
      )
      .eq("family_id", familyId)
      .gte("start_at", from.toISOString())
      .lt("start_at", to.toISOString())
      .order("start_at");

    if (error) throw error;

    events = data || [];

    // Načítáme pouze časy servisních termínů.
    // Žádná jména, adresy ani telefony zákazníků.

    const slots = await db.rpc(
      "get_family_service_slots",
      {
        p_family_id: familyId,
        p_from: from.toISOString(),
        p_to: to.toISOString()
      }
    );

    if (slots.error) {
      console.warn("Servisní termíny:", slots.error);
      serviceSlots = [];
    } else {
      serviceSlots = (slots.data || [])
        .map((row, i) => ({
          id: `service-${i}`,
          title: "Servis oken",
          category: "service",
          all_day: false,
          start_at:
            row.appointment_at ||
            row.start_at ||
            row.slot_at ||
            row.starts_at,
          end_at: null,
          description: "",
          readonly: true
        }))
        .filter((x) => x.start_at);
    }

    render();

  } catch (error) {
    console.error(error);

    el("selectedDayEvents").textContent =
      "Nepodařilo se načíst kalendář: " +
      errorText(error);

    renderCalendar();

  } finally {
    refreshing = false;
  }
}

function dayItems(key) {
  return [...events, ...serviceSlots]
    .filter((item) => itemDate(item) === key)
    .sort(
      (a, b) =>
        new Date(a.start_at) - new Date(b.start_at)
    );
}

/* ==========================================
   VYKRESLENÍ KALENDÁŘE
   ========================================== */

function renderCalendar() {
  el("monthTitle").textContent = monthLabel(month);

  const grid = el("calendarGrid");
  grid.replaceChildren();

  const first = new Date(
    month.getFullYear(),
    month.getMonth(),
    1
  );

  const mondayOffset = (first.getDay() + 6) % 7;

  const begin = new Date(first);
  begin.setDate(begin.getDate() - mondayOffset);

  const today = dateKey(new Date());

  for (let i = 0; i < 42; i++) {
    const day = new Date(begin);
    day.setDate(begin.getDate() + i);

    const key = dateKey(day);
    const items = dayItems(key);

    const cats = new Set(
      items.map((x) => x.category)
    );

    const cell = create("div", "calendar-day");

    if (day.getMonth() !== month.getMonth()) {
      cell.classList.add("other-month");
    }

    if (key === today) {
      cell.classList.add("today");
    }

    if (key === selectedDate) {
      cell.classList.add("selected");
    }

    if (cats.has("me")) {
      cell.classList.add("has-blue");
    }

    if (cats.has("wife")) {
      cell.classList.add("has-pink");
    }

    cell.setAttribute("role", "button");
    cell.tabIndex = 0;

    cell.setAttribute(
      "aria-label",
      dateLabel(day)
    );

    cell.append(
      create(
        "span",
        "day-number",
        String(day.getDate())
      )
    );

    const holiday =
      window.CzechCalendar?.getHoliday?.(day);

    if (holiday) {
      cell.append(
        create("div", "day-holiday", holiday)
      );
    }

    const nameDay =
      window.CzechCalendar?.getNameDay?.(day);

    if (nameDay) {
      cell.append(
        create("div", "day-name-day", nameDay)
      );
    }

    const chips = create("div", "day-events");

    for (const item of items.slice(0, 3)) {
      const time = item.all_day
        ? ""
        : new Intl.DateTimeFormat("cs-CZ", {
            hour: "2-digit",
            minute: "2-digit"
          }).format(new Date(item.start_at)) + " ";

      const chip = create(
        "div",
        "event-chip " + item.category,
        time + item.title
      );

      chip.title = item.title;
      chips.append(chip);
    }

    if (items.length > 3) {
      chips.append(
        create(
          "div",
          "more-events",
          `+ ${items.length - 3} další`
        )
      );
    }

    cell.append(chips);

    const choose = () => {
      selectedDate = key;
      render();
    };

    cell.addEventListener("click", choose);

    cell.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    });

    grid.append(cell);
  }
}

/* ==========================================
   DETAIL VYBRANÉHO DNE
   ========================================== */

function renderDetails() {
  el("selectedDayTitle").textContent =
    "Události: " +
    dateLabel(dateFromKey(selectedDate));

  const box = el("selectedDayEvents");
  box.replaceChildren();

  const items = dayItems(selectedDate);

  if (!items.length) {
    box.append(
      create(
        "p",
        "",
        "Na tento den zatím nemáte žádnou událost."
      )
    );

    return;
  }

  for (const item of items) {
    const row = create(
      "div",
      "day-event " + item.category
    );

    const content = create("div");

    content.append(
      create(
        "div",
        "day-event-title",
        item.title
      )
    );

    content.append(
      create(
        "div",
        "day-event-time",
        `${categoryNames[item.category] || "Událost"} · ${timeLabel(item)}`
      )
    );

    if (item.description && !item.readonly) {
      content.append(
        create(
          "div",
          "day-event-description",
          item.description
        )
      );
    }

    row.append(content);

    if (!item.readonly) {
      const edit = create(
        "button",
        "edit-event-btn",
        "Upravit"
      );

      edit.type = "button";

      edit.addEventListener(
        "click",
        () => openModal(item)
      );

      row.append(edit);
    }

    box.append(row);
  }
}

function render() {
  renderCalendar();
  renderDetails();
}

/* ==========================================
   OKNO PRO UDÁLOSTI
   ========================================== */

function openModal(item = null) {
  el("eventForm").reset();
  showEventError();

  el("eventId").value = item?.id || "";

  el("modalTitle").textContent =
    item ? "Upravit událost" : "Nová událost";

  el("deleteEventBtn").classList.toggle(
    "hidden",
    !item
  );

  el("eventTitle").value =
    item?.title || "";

  el("eventDescription").value =
    item?.description || "";

  el("eventCategory").value =
    item?.category || "me";

  el("eventDate").value =
    item ? itemDate(item) : selectedDate;

  el("eventAllDay").checked =
    Boolean(item?.all_day);

  const start = item
    ? new Date(item.start_at)
    : null;

  const end = item?.end_at
    ? new Date(item.end_at)
    : null;

  el("eventStartTime").value = start
    ? `${pad(start.getHours())}:${pad(start.getMinutes())}`
    : "09:00";

  el("eventEndTime").value = end
    ? `${pad(end.getHours())}:${pad(end.getMinutes())}`
    : "10:00";

  toggleTimeFields();

  el("eventModal").classList.remove("hidden");
}

function closeModal() {
  el("eventModal").classList.add("hidden");
  showEventError();
}

function toggleTimeFields() {
  el("timeFields").classList.toggle(
    "hidden",
    el("eventAllDay").checked
  );
}

/* ==========================================
   ULOŽENÍ UDÁLOSTI
   ========================================== */

async function saveEvent(e) {
  e.preventDefault();
  showEventError();

  const id = el("eventId").value;
  const key = el("eventDate").value;
  const allDay = el("eventAllDay").checked;

  if (!key) {
    return showEventError("Vyber datum.");
  }

  const start = localISO(
    key,
    allDay ? "00:00" : el("eventStartTime").value
  );

  const end = localISO(
    key,
    allDay ? "23:59" : el("eventEndTime").value
  );

  if (new Date(end) <= new Date(start)) {
    return showEventError(
      "Čas konce musí být později než začátek."
    );
  }

  const payload = {
    title: el("eventTitle").value.trim(),
    description:
      el("eventDescription").value.trim(),
    category: el("eventCategory").value,
    all_day: allDay,
    start_at: start,
    end_at: end
  };

  if (!payload.title) {
    return showEventError(
      "Zadej název události."
    );
  }

  const button = el("eventForm").querySelector(
    'button[type="submit"]'
  );

  button.disabled = true;

  try {
    let result;

    if (id) {
      result = await db
        .from("family_calendar_events")
        .update(payload)
        .eq("id", id)
        .eq("family_id", familyId)
        .select("id");
    } else {
      result = await db
        .from("family_calendar_events")
        .insert({
          ...payload,
          family_id: familyId,
          created_by: user.id
        })
        .select("id");
    }

    if (result.error) {
      throw result.error;
    }

    if (!result.data?.length) {
      throw new Error(
        "Událost se neuložila. " +
        "Zkontroluj oprávnění v databázi."
      );
    }

    selectedDate = key;

    const chosen = dateFromKey(key);

    month = new Date(
      chosen.getFullYear(),
      chosen.getMonth(),
      1
    );

    closeModal();
    await loadMonth();

  } catch (err) {
    showEventError(
      "Uložení se nezdařilo: " +
      errorText(err)
    );

  } finally {
    button.disabled = false;
  }
}

/* ==========================================
   SMAZÁNÍ UDÁLOSTI
   ========================================== */

async function deleteEvent() {
  const id = el("eventId").value;

  if (!id) return;

  if (!confirm("Opravdu chceš tuto událost smazat?")) {
    return;
  }

  try {
    const { error } = await db
      .from("family_calendar_events")
      .delete()
      .eq("id", id)
      .eq("family_id", familyId);

    if (error) throw error;

    closeModal();
    await loadMonth();

  } catch (err) {
    showEventError(
      "Smazání se nezdařilo: " +
      errorText(err)
    );
  }
}

/* ==========================================
   PŘIHLÁŠENÍ
   ========================================== */

async function startSession(sessionUser) {
  user = sessionUser;
  familyId = null;

  try {
    await loadFamily();

    showApp();
    renderCalendar();

    await loadMonth();

  } catch (err) {
    console.error(err);

    showLogin(
      "Přihlášení proběhlo, ale kalendář " +
      "se nepodařilo otevřít: " +
      errorText(err)
    );
  }
}

async function login(e) {
  e.preventDefault();

  el("loginError").textContent =
    "Přihlašuji…";

  const button = el("loginForm").querySelector(
    'button[type="submit"]'
  );

  button.disabled = true;

  try {
    const { data, error } =
      await db.auth.signInWithPassword({
        email: el("loginEmail").value.trim(),
        password: el("loginPassword").value
      });

    if (error) throw error;

    if (!data.user) {
      throw new Error(
        "Nepodařilo se získat přihlášeného uživatele."
      );
    }

    await startSession(data.user);

  } catch (err) {
    showLogin(
      "Přihlášení se nezdařilo: " +
      errorText(err)
    );

  } finally {
    button.disabled = false;
  }
}

/* ==========================================
   ODHLÁŠENÍ
   ========================================== */

async function logout() {
  const { error } = await db.auth.signOut();

  if (error) {
    alert(
      "Odhlášení se nezdařilo: " +
      errorText(error)
    );

    return;
  }

  user = null;
  familyId = null;
  events = [];
  serviceSlots = [];

  showLogin();
}

/* ==========================================
   SPUŠTĚNÍ APLIKACE
   ========================================== */

async function init() {
  el("loginForm").addEventListener(
    "submit",
    login
  );

  el("logoutBtn").addEventListener(
    "click",
    logout
  );

  el("prevMonth").addEventListener(
    "click",
    () => {
      month = new Date(
        month.getFullYear(),
        month.getMonth() - 1,
        1
      );

      renderCalendar();
      loadMonth();
    }
  );

  el("nextMonth").addEventListener(
    "click",
    () => {
      month = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        1
      );

      renderCalendar();
      loadMonth();
    }
  );

  el("todayBtn").addEventListener(
    "click",
    () => {
      const d = new Date();

      month = new Date(
        d.getFullYear(),
        d.getMonth(),
        1
      );

      selectedDate = dateKey(d);

      render();
      loadMonth();
    }
  );

  el("addEventBtn").addEventListener(
    "click",
    () => openModal()
  );

  el("closeModalBtn").addEventListener(
    "click",
    closeModal
  );

  el("eventModal").addEventListener(
    "click",
    (e) => {
      if (e.target === el("eventModal")) {
        closeModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    }
  );

  el("eventAllDay").addEventListener(
    "change",
    toggleTimeFields
  );

  el("eventForm").addEventListener(
    "submit",
    saveEvent
  );

  el("deleteEventBtn").addEventListener(
    "click",
    deleteEvent
  );

  showLogin();

  try {
    const { data, error } =
      await db.auth.getSession();

    if (error) throw error;

    if (data.session?.user) {
      await startSession(
        data.session.user
      );
    }

  } catch (err) {
    showLogin(
      "Nepodařilo se obnovit přihlášení: " +
      errorText(err)
    );
  }

  setInterval(() => {
    if (familyId && !document.hidden) {
      loadMonth();
    }
  }, 60000);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden && familyId) {
        loadMonth();
      }
    }
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    init
  );
} else {
  init();
}
