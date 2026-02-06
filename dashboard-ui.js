/* Ladok Auto - Dashboard UI helpers
   Presentation + UX enhancements (search, labels, section counts, toggle sync). */
(function () {
  const page = document.body && document.body.dataset ? document.body.dataset.page : "";
  if (page !== "dashboard") return;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function addMasterToggleClasses() {
    const ids = [
      "#toggle-all-courses-reminder",
      "#toggle-all-courses-auto-registration",
      "#toggle-auto-examination-registration"
    ];
    ids.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.classList.add("master-toggle");
    });
  }

  function formatIsoDate(txt) {
    const s = String(txt || "").trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    return s;
  }

  function decorateTbody(tbody, labels) {
    const rows = $all("tr", tbody).filter(r => !r.classList.contains("table-empty-row"));

    rows.forEach((row) => {
      const cells = row.children ? Array.from(row.children) : [];
      for (let i = 0; i < labels.length; i++) {
        if (cells[i]) cells[i].setAttribute("data-label", labels[i]);
      }

      // Dates: start + end are usually index 1 and 2 in both tables
      if (cells[1] && cells[1].childElementCount === 0) cells[1].textContent = formatIsoDate(cells[1].textContent);
      if (cells[2] && cells[2].childElementCount === 0) cells[2].textContent = formatIsoDate(cells[2].textContent);

      const reminder = row.querySelector("input.course-reminder");
      if (reminder && !reminder.getAttribute("aria-label")) reminder.setAttribute("aria-label", "Reminder");

      const autoReg = row.querySelector("input.course-auto");
      if (autoReg && !autoReg.getAttribute("aria-label")) autoReg.setAttribute("aria-label", "Auto-Registration");
    });
  }

  function pluralize(n, one, many) {
    return n === 1 ? one : many;
  }

  function fmtCount(n) {
    return "(" + n + " " + pluralize(n, "course", "courses") + ")";
  }

  function getCourseRows(tbody) {
    if (!tbody) return [];
    return $all("tr", tbody).filter(r => !r.classList.contains("table-empty-row"));
  }

  function updateEmptyState(tbody, visibleCount, colSpan, label) {
    if (!tbody) return;
    let emptyRow = tbody.querySelector(".table-empty-row");
    if (!emptyRow) {
      emptyRow = document.createElement("tr");
      emptyRow.className = "table-empty-row";
      const td = document.createElement("td");
      td.colSpan = colSpan;
      td.textContent = label;
      emptyRow.appendChild(td);
      tbody.appendChild(emptyRow);
    }
    emptyRow.hidden = visibleCount !== 0;
  }

  function setupSearch(unregTbody, regTbody) {
    const searchEl = $("#course-search");
    const clearBtn = $("#course-search-clear");
    const countEl = $("#course-count");
    const unregCountEl = $("#unregistered-count");
    const regCountEl = $("#registered-count");

    function applyFilter() {
      const q = String(searchEl && searchEl.value ? searchEl.value : "").trim().toLowerCase();

      const unregRows = getCourseRows(unregTbody);
      const regRows = getCourseRows(regTbody);

      const total = unregRows.length + regRows.length;

      function filterRows(rows) {
        let visible = 0;
        rows.forEach((row) => {
          const nameCell = row.children && row.children[0] ? row.children[0] : null;
          const name = nameCell ? (nameCell.textContent || "") : "";
          const match = !q || name.toLowerCase().includes(q);
          row.classList.toggle("is-filtered-out", !match);
          if (match) visible += 1;
        });
        return visible;
      }

      const unregVisible = filterRows(unregRows);
      const regVisible = filterRows(regRows);
      const visible = unregVisible + regVisible;

      if (countEl) {
        countEl.textContent = q ? ("Showing " + visible + " of " + total + " courses") : (total + " courses");
      }
      if (unregCountEl) unregCountEl.textContent = fmtCount(unregVisible);
      if (regCountEl) regCountEl.textContent = fmtCount(regVisible);

      updateEmptyState(unregTbody, unregVisible, 5, "No unregistered courses found.");
      updateEmptyState(regTbody, regVisible, 3, "No registered courses found.");
    }

    if (searchEl) searchEl.addEventListener("input", applyFilter);
    if (clearBtn) clearBtn.addEventListener("click", function () {
      if (!searchEl) return;
      searchEl.value = "";
      searchEl.focus();
      applyFilter();
    });

    applyFilter();
    return applyFilter;
  }

  function syncToggleAllStates(unregTbody) {
    const toggleAllReminders = document.querySelector("#toggle-all-courses-reminder");
    const toggleAllAuto = document.querySelector("#toggle-all-courses-auto-registration");

    const reminderCbs = $all("input.course-reminder", unregTbody).filter(cb => !cb.disabled);
    const autoCbs = $all("input.course-auto", unregTbody).filter(cb => !cb.disabled);

    function applyMaster(master, list) {
      if (!master) return;
      if (!list.length) {
        master.indeterminate = false;
        master.checked = false;
        return;
      }
      const checked = list.filter(cb => cb.checked).length;
      if (checked === 0) {
        master.indeterminate = false;
        master.checked = false;
      } else if (checked === list.length) {
        master.indeterminate = false;
        master.checked = true;
      } else {
        master.checked = false;
        master.indeterminate = true;
      }
    }

    applyMaster(toggleAllReminders, reminderCbs);
    applyMaster(toggleAllAuto, autoCbs);
  }

  async function getDiscordLinkedStatus() {
    const client = (typeof supabaseClient !== "undefined") ? supabaseClient : window.supabaseClient;
    if (!client || !client.auth) return { ok: false, linked: false };
    try {
      const { data: sess, error: sessErr } = await client.auth.getSession();
      if (sessErr) return { ok: false, linked: false };
      const user = sess?.session?.user;
      if (!user) return { ok: false, linked: false };
    } catch {
      return { ok: false, linked: false };
    }
    try {
      const { data, error } = await client.from("discord_readonly_table").select("*").single();
      if (error) return { ok: true, linked: false };
      const linked = Boolean(data && data.discord_linked && data.discord_client_id != null);
      return { ok: true, linked, data };
    } catch {
      return { ok: true, linked: false };
    }
  }

  function applyDiscordGate(unregTbody, linked) {
    const banner = document.getElementById("discord-not-linked-banner");
    const reminderToggles = $all("input.course-reminder", unregTbody);
    const toggleAllReminders = document.querySelector("#toggle-all-courses-reminder");

    if (!linked) {
      if (banner) banner.hidden = false;
      if (toggleAllReminders) toggleAllReminders.disabled = true;
      reminderToggles.forEach(cb => { cb.disabled = true; cb.closest("tr")?.classList.add("discord-locked"); });
    } else {
      if (banner) banner.hidden = true;
      if (toggleAllReminders) toggleAllReminders.disabled = false;
      reminderToggles.forEach(cb => { cb.disabled = false; cb.closest("tr")?.classList.remove("discord-locked"); });
    }
  }

  function setupToggleAllSync(unregTbody) {
    if (!unregTbody) return;

    unregTbody.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.classList.contains("course-reminder") || t.classList.contains("course-auto")) {
        syncToggleAllStates(unregTbody);
      }
    });

    const toggleAllReminders = document.querySelector("#toggle-all-courses-reminder");
    const toggleAllAuto = document.querySelector("#toggle-all-courses-auto-registration");

    function refreshAfterToggleAll() {
      requestAnimationFrame(() => {
        addMasterToggleClasses();
        decorateTbody(unregTbody, ["Courses", "Registration start", "Registration end", "Reminder", "Auto-Registration"]);
        syncToggleAllStates(unregTbody);
      });
    }

    if (toggleAllReminders) toggleAllReminders.addEventListener("change", refreshAfterToggleAll);
    if (toggleAllAuto) toggleAllAuto.addEventListener("change", refreshAfterToggleAll);
  }

  async function onReady() {
    const unregTbody = document.getElementById("courses-table-body-unregistered") || document.getElementById("courses-table-body");
    const regTbody = document.getElementById("courses-table-body-registered");

    if (!unregTbody) return;

    addMasterToggleClasses();
    decorateTbody(unregTbody, ["Courses", "Registration start", "Registration end", "Reminder", "Auto-Registration"]);
    if (regTbody) decorateTbody(regTbody, ["Courses", "Registration start", "Registration end"]);

    const applyFilter = setupSearch(unregTbody, regTbody);
    setupToggleAllSync(unregTbody);
    syncToggleAllStates(unregTbody);

    let discordLinked = null;
    try {
      const status = await getDiscordLinkedStatus();
      if (status.ok) {
        discordLinked = status.linked;
        applyDiscordGate(unregTbody, status.linked);
      }
    } catch {}

    const observers = [];
    function observe(tbody, labels) {
      if (!tbody) return;
      const mo = new MutationObserver(function () {
        decorateTbody(tbody, labels);
        if (applyFilter) applyFilter();
        if (tbody === unregTbody && discordLinked !== null) applyDiscordGate(unregTbody, discordLinked);
        if (tbody === unregTbody) syncToggleAllStates(unregTbody);
      });
      mo.observe(tbody, { childList: true, subtree: false });
      observers.push(mo);
    }

    observe(unregTbody, ["Courses", "Registration start", "Registration end", "Reminder", "Auto-Registration"]);
    observe(regTbody, ["Courses", "Registration start", "Registration end"]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();