// ---------- Config ----------
const REGISTER_URL = "https://actinographic-tod-frumentaceous.ngrok-free.dev/Register"; // use relative/origin URL in production
const SEND_VERIFICATION_CODE_URL = "https://actinographic-tod-frumentaceous.ngrok-free.dev/DiscordVerification/sendcode";
const VERIFY_CODE_URL = "https://actinographic-tod-frumentaceous.ngrok-free.dev/DiscordVerification/verify";
// Ensure Supabase CDN is loaded
if (!window.supabase) {
  console.error("Supabase CDN failed to load.");
}

const supabaseClient = window.supabase?.createClient(
  "https://ljnikyrjdzjcpvltrduu.supabase.co",
  "sb_publishable_mj5aiWC62fhRMJwpP5Abfg_1YJ1S-eQ"
);

// ---------- Small helpers ----------
const $ = (selector, parent = document) => parent.querySelector(selector);
const $all = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

function setHtml(el, html) {
  if (!el) return;
  el.innerHTML = html;
}

function setDisabled(el, disabled = true) {
  if (!el) return;
  el.disabled = disabled;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateOnly(value) {
  if (value == null) return "";
  const s = String(value);
  const head = s.split("T")[0].split(" ")[0];
  const m = head.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : head;
}

async function safeReadJson(response) {
  const raw = await response.text();
  if (!raw) return { ok: response.ok, data: null, raw: "" };
  try {
    return { ok: response.ok, data: JSON.parse(raw), raw };
  } catch (e) {
    return { ok: response.ok, data: null, raw };
  }
}

function isValidMduStudentEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e.endsWith("@student.mdu.se")) return false;
  const local = e.slice(0, e.indexOf("@"));
  return local.length > 0;
}
function jsonToUtf8Base64(obj) {
  const jsonString = JSON.stringify(obj);
  const utf8Bytes = new TextEncoder().encode(jsonString);

  let binary = "";
  utf8Bytes.forEach(b => binary += String.fromCharCode(b));

  return btoa(binary);
}
function utf8Base64ToJson(base64String) {
  if (!base64String) return [];
  const binary = atob(base64String);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const text = new TextDecoder("utf-8").decode(bytes);
  return JSON.parse(text);
}
function collectCoursesFromTable(originalCourses) {
  const rows = document.querySelectorAll(
    "#courses-table-body-unregistered tr[data-course-index], #courses-table-body tr[data-course-index]"
  );

  rows.forEach((row) => {
    const idx = Number(row.getAttribute("data-course-index"));
    if (!Number.isFinite(idx) || !originalCourses[idx]) return;

    const reminderCheckbox = row.querySelector(".course-reminder");
    const autoCheckbox = row.querySelector(".course-auto");

    if (reminderCheckbox) originalCourses[idx].NotificationOn = reminderCheckbox.checked;
    if (autoCheckbox) originalCourses[idx].AutoRegistrationEnabled = autoCheckbox.checked;
  });

  return originalCourses;
}

// ---------- API wrappers ----------
async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await safeReadJson(res);
  return { response: res, parsed };
}

// ---------- Auth handlers (signup/signin/send-code/verify) ----------
async function handleSignupSubmit(e, elements) {
  e.preventDefault();
  const { emailEl, passwordEl, emailErrorEl, passwordErrorEl, feedbackEl, submitBtn } = elements;
  if (!emailEl || !passwordEl) return;

  const email = String(emailEl.value || "").trim();
  const password = String(passwordEl.value || "");

  // reset messages
  setText(emailErrorEl, "");
  setText(passwordErrorEl, "");
  setText(feedbackEl, "");

  // Liability consent (required)
  const liabilityCb = document.getElementById("liability-accept");
  const liabilityErrEl = document.querySelector(".authentication-format-error-liability");
  setText(liabilityErrEl, "");
  if (liabilityCb && !liabilityCb.checked) {
    setText(liabilityErrEl, "You must accept the Liability terms to sign up.");
    return;
  }

  if (!isValidMduStudentEmail(email)) {
    setText(emailErrorEl, "Email is incorrectly formatted!");
    return;
  }
  if (password.length < 4) {
    setText(passwordErrorEl, "Password must be at least 4 characters.");
    return;
  }

  setText(feedbackEl, "Trying to sign up...");
  setDisabled(submitBtn, true);

  try {
    const { response, parsed } = await postJson(REGISTER_URL, { Email: email, Password: password, DiscordUsername: null });
    console.log("Registration response:", parsed.data ?? parsed.raw);

    if (!response.ok) {
      const msg = (parsed.data && (parsed.data.message || parsed.data.error)) || "Registration failed.";
      setText(feedbackEl, msg);
      return;
    }

    setText(feedbackEl, "Registration successful.");

    // Sign in via Supabase
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (authError) {
      console.error("Login failed:", authError);
      setText(feedbackEl, "Login failed.");
      return;
    }

    if (authData?.user?.email) {
      setText(feedbackEl, `Logged in as ${authData.user.email}`);
      console.log("User signed in:", authData.user);
      window.location.replace("./dashboard.html");
    } else {
      setText(feedbackEl, "Logged in.");
    }

    // redirect to dashboard
    window.location.replace("./dashboard.html");
  } catch (err) {
    console.error("Request error:", err);
    setText(feedbackEl, "Server/network error.");
  } finally {
    setDisabled(submitBtn, false);
  }
}

async function handleSendCode(elements) {
  const { emailEl, passwordEl, emailErrorEl, passwordErrorEl, feedbackEl, submitBtn, discordUsernameEl, discordUsernameErrorEl } = elements;
  if (!emailEl || !passwordEl) return;

  const email = String(emailEl.value || "").trim();
  const password = String(passwordEl.value || "");
  const discordUsername = String(discordUsernameEl?.value || "").trim();

  // reset messages
  setText(emailErrorEl, "");
  setText(passwordErrorEl, "");
  setText(feedbackEl, "");
  setText(discordUsernameErrorEl, "");

  if (!isValidMduStudentEmail(email)) {
    setText(emailErrorEl, "Email is incorrectly formatted!");
    return;
  }
  if (password.length < 4) {
    setText(passwordErrorEl, "Password must be at least 4 characters.");
    return;
  }
  if (!discordUsername) {
    setText(discordUsernameErrorEl, "Discord username is empty!");
    return;
  }

  setDisabled(submitBtn, true);
  setText(feedbackEl, "Sending verification code...");

  try {
    const { response, parsed } = await postJson(REGISTER_URL, { Email: email, Password: password, DiscordUsername: discordUsername });
    console.log("Registration response (send-code):", parsed.data ?? parsed.raw);

    if (!response.ok) {
      const msg = (parsed.data && (parsed.data.message || parsed.data.error)) || "Registration failed.";
      setText(feedbackEl, msg);
      return;
    }
    if (!response.success) {
      setText(feedbackEl, "User account already exists, please Sign in!");
      return;
    }
    setText(feedbackEl, "Registration successful. Verification code sent (if applicable).");
  } catch (err) {
    console.error("Request error:", err);
    setText(feedbackEl, "Server/network error.");
  } finally {
    setDisabled(submitBtn, false);
  }
}

async function handleVerifyCode(elements) {
  const { emailEl, passwordEl, emailErrorEl, passwordErrorEl, feedbackEl, submitBtn, discordUsernameEl, verifyInputEl, verifyInputErrorEl } = elements;
  if (!emailEl || !passwordEl) return;

  const email = String(emailEl.value || "").trim();
  const password = String(passwordEl.value || "");
  const discordUsername = String(discordUsernameEl?.value || "").trim();
  const code = String(verifyInputEl?.value || "").trim();

  // reset messages
  setText(emailErrorEl, "");
  setText(passwordErrorEl, "");
  setText(feedbackEl, "");
  setText(verifyInputErrorEl, "");

  if (!isValidMduStudentEmail(email)) {
    setText(emailErrorEl, "Email is incorrectly formatted!");
    return;
  }
  if (password.length < 4) {
    setText(passwordErrorEl, "Password must be at least 4 characters.");
    return;
  }
  if (!code) {
    setText(verifyInputErrorEl, "Please enter the verification code!");
    return;
  }

  setDisabled(submitBtn, true);
  setText(feedbackEl, "Verifying code...");

  try {
    const { response, parsed } = await postJson(VERIFY_CODE_URL, { DiscordUsername: discordUsername, Code: code });
    console.log("Verify response:", parsed.data ?? parsed.raw);

    if (!response.ok) {
      const msg = (parsed.data && (parsed.data.message || parsed.data.error)) || "Verification failed.";
      setText(feedbackEl, msg);
      return;
    }

    setText(feedbackEl, "Verification successful.");

    // Sign in via Supabase
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (authError) {
      console.error("Login failed:", authError);
      setText(feedbackEl, "Login failed.");
      return;
    }

    if (authData?.user?.email) {
      setText(feedbackEl, `Logged in as ${authData.user.email}`);
      console.log("User signed in:", authData.user);
      window.location.replace("./dashboard.html");
    } else {
      setText(feedbackEl, "Something went wrong.");
    }
  } catch (err) {
    console.error("Request error:", err);
    setText(feedbackEl, "Server/network error.");
  } finally {
    setDisabled(submitBtn, false);
  }
}

async function handleSigninSubmit(e, elements) {
  e.preventDefault();
  const { emailEl, passwordEl, emailErrorEl, passwordErrorEl, feedbackEl, submitBtn } = elements;
  if (!emailEl || !passwordEl) return;

  const email = String(emailEl.value || "").trim();
  const password = String(passwordEl.value || "");

  // reset messages
  setText(emailErrorEl, "");
  setText(passwordErrorEl, "");
  setText(feedbackEl, "");

  if (!isValidMduStudentEmail(email)) {
    setText(emailErrorEl, "Email is incorrectly formatted!");
    return;
  }
  if (password.length < 4) {
    setText(passwordErrorEl, "Password must be at least 4 characters.");
    return;
  }

  setDisabled(submitBtn, true);
  setText(feedbackEl, "Logging in...");

  try {
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (authError) {
      console.error("Login error:", authError);
      setText(feedbackEl, authError.message || "Login failed.");
      return;
    }

    if (authData?.user) {
      setText(feedbackEl, `Logged in as ${authData.user.email}`);
      console.log("User signed in:", authData.user);
      window.location.replace("./dashboard.html");
    } else {
      setText(feedbackEl, "Login failed: no user returned.");
    }
  } catch (err) {
    console.error("Unexpected error during login:", err);
    setText(feedbackEl, "Server or network error.");
  } finally {
    setDisabled(submitBtn, false);
  }
}



function isCourseRegistered(course) {
  const v =
    (course && (course.IsRegistered ?? course.isRegistered ?? course.Status ?? course.status)) ?? false;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  const s = String(v).trim().toLowerCase();
  return s === "yes" || s === "true" || s === "registered";
}

// ---------- Dashboard loader ----------
async function loadDashboard() {
  const unregBody = document.querySelector("#courses-table-body-unregistered") || document.querySelector("#courses-table-body");
  const regBody = document.querySelector("#courses-table-body-registered");
  if (!unregBody) return;

  const userData = await getUserData();
  if (!userData) {
    unregBody.innerHTML = `<tr class="table-empty-row"><td colspan="5">Please log in to see your courses.</td></tr>`;
    if (regBody) regBody.innerHTML = `<tr class="table-empty-row"><td colspan="3">Please log in to see your courses.</td></tr>`;
    return;
  }

  let courses = [];
  try {
    courses = utf8Base64ToJson(userData.json_courses_settings_binary);
  } catch (err) {
    console.error("Failed to parse courses:", err);
    unregBody.innerHTML = `<tr class="table-empty-row"><td colspan="5">Failed to load courses.</td></tr>`;
    if (regBody) regBody.innerHTML = `<tr class="table-empty-row"><td colspan="3">Failed to load courses.</td></tr>`;
    return;
  }

  if (!Array.isArray(courses) || courses.length === 0) {
    unregBody.innerHTML = `<tr class="table-empty-row"><td colspan="5">No courses found.</td></tr>`;
    if (regBody) regBody.innerHTML = `<tr class="table-empty-row"><td colspan="3">No courses found.</td></tr>`;
    return;
  }

  // Global exam auto-registration toggle
  const autoExamsInput = document.querySelector("#toggle-auto-examination-registration");
  if (autoExamsInput) autoExamsInput.checked = Boolean(userData.auto_register_exams);

  // ---------- Render courses ----------
  unregBody.innerHTML = "";
  if (regBody) regBody.innerHTML = "";

  courses.forEach((course, i) => {
    const registered = isCourseRegistered(course);

    const name = escapeHtml(course.Name);
    const start = escapeHtml(formatDateOnly(course.RegistrationStart));
    const end = escapeHtml(formatDateOnly(course.RegistrationEnd));

    if (!registered) {
      const checkedNotification = course.NotificationOn ? "checked" : "";
      const checkedAuto = course.AutoRegistrationEnabled ? "checked" : "";

      unregBody.innerHTML += `
        <tr class="course-row" data-course-index="${i}" id="course-${i}">
          <td>${name}</td>
          <td>${start}</td>
          <td>${end}</td>
          <td><input type="checkbox" class="course-reminder" ${checkedNotification}></td>
          <td><input type="checkbox" class="course-auto" ${checkedAuto}></td>
        </tr>
      `;
    } else if (regBody) {
      regBody.innerHTML += `
        <tr class="course-row" data-course-index="${i}" id="course-registered-${i}">
          <td>
            <div class="course-name-registered">
              <span class="course-name-text">${name}</span>
              <span class="status-badge is-yes"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> Registered</span>
            </div>
          </td>
          <td>${start}</td>
          <td>${end}</td>
        </tr>
      `;
    }
  });

  // Notify UI helpers (dashboard-ui.js) that rows are rendered
  try {
    document.dispatchEvent(new CustomEvent("ladokauto:courses-rendered"));
  } catch (_) {
    // ignore
  }

  // ---------- Toggle ALL reminders / auto-registrations (unregistered only) ----------
  const toggleAllRemindersDesktop = document.querySelector("#toggle-all-courses-reminder");
  const toggleAllAutoDesktop = document.querySelector("#toggle-all-courses-auto-registration");
  const toggleAllRemindersMobile = document.querySelector("#toggle-all-courses-reminder-mobile");
  const toggleAllAutoMobile = document.querySelector("#toggle-all-courses-auto-registration-mobile");

  function syncMasterToggles(which, checked, sourceEl) {
    if (which === "reminder") {
      if (toggleAllRemindersDesktop && sourceEl !== toggleAllRemindersDesktop) toggleAllRemindersDesktop.checked = checked;
      if (toggleAllRemindersMobile && sourceEl !== toggleAllRemindersMobile) toggleAllRemindersMobile.checked = checked;
    }
    if (which === "auto") {
      if (toggleAllAutoDesktop && sourceEl !== toggleAllAutoDesktop) toggleAllAutoDesktop.checked = checked;
      if (toggleAllAutoMobile && sourceEl !== toggleAllAutoMobile) toggleAllAutoMobile.checked = checked;
    }
  }

  function bindMasterToggle(el, which) {
    if (!el) return;
    el.onchange = (e) => {
      const checked = !!e.target.checked;
      if (which === "reminder") {
        unregBody.querySelectorAll(".course-reminder").forEach(cb => cb.checked = checked);
      } else {
        unregBody.querySelectorAll(".course-auto").forEach(cb => cb.checked = checked);
      }
      syncMasterToggles(which, checked, el);
      updateDashboardDirtyState();
    };
  }

  bindMasterToggle(toggleAllRemindersDesktop, "reminder");
  bindMasterToggle(toggleAllRemindersMobile, "reminder");
  bindMasterToggle(toggleAllAutoDesktop, "auto");
  bindMasterToggle(toggleAllAutoMobile, "auto");

  // ---------- Unsaved changes guard (Dashboard) ----------
  const unsavedEl = document.querySelector("#dashboard-unsaved");
  const saveBtnEl = document.querySelector("#save-courses-settings-changes");
  let baseline = null;

  function captureDashboardBaseline() {
    baseline = {
      autoExams: autoExamsInput ? autoExamsInput.checked : false,
      perCourse: new Map()
    };
    unregBody.querySelectorAll("tr[data-course-index]").forEach((row) => {
      const idx = Number(row.getAttribute("data-course-index"));
      if (!Number.isFinite(idx)) return;
      baseline.perCourse.set(idx, {
        reminder: !!row.querySelector(".course-reminder")?.checked,
        auto: !!row.querySelector(".course-auto")?.checked
      });
    });
  }

  function computeDashboardDirty() {
    if (!baseline) return false;
    if (autoExamsInput && autoExamsInput.checked !== baseline.autoExams) return true;

    let dirty = false;
    unregBody.querySelectorAll("tr[data-course-index]").forEach((row) => {
      if (dirty) return;
      const idx = Number(row.getAttribute("data-course-index"));
      const b = baseline.perCourse.get(idx);
      if (!b) return;
      const r = !!row.querySelector(".course-reminder")?.checked;
      const a = !!row.querySelector(".course-auto")?.checked;
      if (r !== b.reminder || a !== b.auto) dirty = true;
    });
    return dirty;
  }

  function setDashboardDirtyUI(isDirty) {
    if (unsavedEl) unsavedEl.hidden = !isDirty;
    if (saveBtnEl) {
      saveBtnEl.disabled = !isDirty;
      saveBtnEl.classList.toggle("btn-primary", isDirty);
    }
  }

  function updateDashboardDirtyState() {
    setDashboardDirtyUI(computeDashboardDirty());
  }

  captureDashboardBaseline();
  updateDashboardDirtyState();

  // Change listeners
  unregBody.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.classList && (t.classList.contains("course-reminder") || t.classList.contains("course-auto"))) {
      updateDashboardDirtyState();
    }
  });
  if (autoExamsInput) autoExamsInput.addEventListener("change", updateDashboardDirtyState);

  // beforeunload warning
  if (!window.__ladokautoDashboardUnloadGuard) {
    window.__ladokautoDashboardUnloadGuard = true;
    window.addEventListener("beforeunload", (e) => {
      if (!computeDashboardDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  // ---------- Save changes ----------
  document.querySelector("#save-courses-settings-changes")
    .addEventListener("click", async () => {
      const feedbackEl = document.querySelector(".save-changes-feedback-paragraf");
      feedbackEl.textContent = "Saving changes...";

      const userData = await getUserData();
      if (!userData) {
        feedbackEl.textContent = "You must be logged in.";
        return;
      }

      let courses;
      try {
        courses = utf8Base64ToJson(userData.json_courses_settings_binary);
      } catch {
        feedbackEl.textContent = "Failed to read existing course data.";
        return;
      }

      // Apply UI changes
      const updatedCourses = collectCoursesFromTable(courses);

      // Encode back to Base64
      const encodedCourses = jsonToUtf8Base64(updatedCourses);

      // Global toggle
      const autoRegisterExams =
        document.querySelector("#toggle-auto-examination-registration")?.checked ?? false;

      // Save to Supabase
      const { error } = await supabaseClient
        .from("user_settings")
        .update({
          json_courses_settings_binary: encodedCourses,
          auto_register_exams: autoRegisterExams
        })
        .eq("id", userData.id);

      if (error) {
        console.error(error);
        feedbackEl.textContent = "Failed to save changes.";
        return;
      }

      feedbackEl.textContent = "Changes saved successfully ✅";
      // Update baseline so "unsaved changes" clears correctly
      captureDashboardBaseline();
      updateDashboardDirtyState();
    });
}

 // ---------- Settings loader ----------

async function loadSettings() {
  const errorParagrafEl = document.querySelector(".error-paragraf");
  if (!errorParagrafEl) return;

  const saveFeedbackEl = document.querySelector(".save-feedback-paragraf")
  if (!saveFeedbackEl) return;

  const userData = await getUserData();
  if (!userData) {
    errorParagrafEl.textContent = "Please log in to see your courses!";
    return;
  }

  // ===== LOAD SETTINGS =====
  const autoReminderInputEl = document.querySelector(
    "#toggle-auto-course-and-examination-reminder"
  );
  const amountDaysReminderInputEl =
    document.querySelector("#days-ammount");
  const saveChangesBtnEl =
    document.querySelector("#save-changes-btn");

  autoReminderInputEl.checked =
    userData.early_registration_reminders_on;

  if (userData.early_register_reminder_days === -1) {
    amountDaysReminderInputEl.selectedIndex = 7; // "Never"
  } else {
    amountDaysReminderInputEl.selectedIndex =
      userData.early_register_reminder_days - 1;
  }


  // ---------- Unsaved changes guard (Settings) ----------
  const settingsUnsavedEl = document.querySelector("#settings-unsaved");
  let settingsBaseline = null;

  function captureSettingsBaseline() {
    settingsBaseline = {
      reminder: autoReminderInputEl.checked,
      daysIndex: amountDaysReminderInputEl.selectedIndex
    };
  }

  function computeSettingsDirty() {
    if (!settingsBaseline) return false;
    return (
      autoReminderInputEl.checked !== settingsBaseline.reminder ||
      amountDaysReminderInputEl.selectedIndex !== settingsBaseline.daysIndex
    );
  }

  function updateSettingsDirtyUI() {
    const dirty = computeSettingsDirty();
    if (settingsUnsavedEl) settingsUnsavedEl.hidden = !dirty;
    if (saveChangesBtnEl) {
      saveChangesBtnEl.disabled = !dirty;
      saveChangesBtnEl.classList.toggle("btn-primary", dirty);
    }
  }

  captureSettingsBaseline();
  updateSettingsDirtyUI();

  autoReminderInputEl.addEventListener("change", updateSettingsDirtyUI);
  amountDaysReminderInputEl.addEventListener("change", updateSettingsDirtyUI);

  if (!window.__ladokautoSettingsUnloadGuard) {
    window.__ladokautoSettingsUnloadGuard = true;
    window.addEventListener("beforeunload", (e) => {
      if (!computeSettingsDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }
  // ===== UPDATE SETTINGS =====

  saveChangesBtnEl.addEventListener("click", async () => {
    const daysValue =
      amountDaysReminderInputEl.selectedIndex === 7
        ? -1
        : amountDaysReminderInputEl.selectedIndex + 1;

    const { error } = await supabaseClient
      .from("user_settings")
      .update({
        early_registration_reminders_on:
          autoReminderInputEl.checked,
        early_register_reminder_days: daysValue
      })
      .eq("id", userData.id);

    if (error) {
      console.error(error);
      saveFeedbackEl.textContent =
        "Failed to save settings. Try again.";
    } else {
      saveFeedbackEl.textContent = "Settings saved successfully ✅";
      if (typeof captureSettingsBaseline === "function") captureSettingsBaseline();
      if (typeof updateSettingsDirtyUI === "function") updateSettingsDirtyUI();
    }
  });
  // ===== Discord link UI =====
  const discordIdEl = document.querySelector("#discord-account-id");
  const discordPillEl = document.querySelector("#discord-status-pill");
  const discordPanelEl = document.querySelector("#discord-link-panel");
  const openDiscordPanelBtn = document.querySelector("#change-discord-account-btn");

  const discordUsernameInput = document.querySelector("#settings-discord-username-input");
  const discordCodeInput = document.querySelector("#settings-discord-verfication-code-input");
  const sendCodeBtn = document.querySelector("#settings-send-code-btn");
  const verifyCodeBtn = document.querySelector("#settings-verify-code-btn");
  const sendFeedbackEl = document.querySelector("#settings-discord-send-feedback");
  const verifyFeedbackEl = document.querySelector("#settings-discord-verify-feedback");

  async function refreshDiscordStatus() {
    if (!discordIdEl || !discordPillEl) return;

    const { data, error } = await supabaseClient
      .from("discord_readonly_table")
      .select("*")
      .single();

    if (error) {
      console.error("Error fetching Discord data:", error);
      return;
    }

    const id = data?.discord_client_id;
    const linked = Boolean(data?.discord_linked);

    discordIdEl.textContent = id ? `Discord id: ${id}` : "Discord id: Not linked";
    discordPillEl.textContent = linked ? "Linked" : "Not linked";
    discordPillEl.classList.toggle("is-yes", linked);
    discordPillEl.classList.toggle("is-no", !linked);
  }

  await refreshDiscordStatus();

  if (openDiscordPanelBtn && discordPanelEl) {
    openDiscordPanelBtn.addEventListener("click", () => {
      discordPanelEl.hidden = !discordPanelEl.hidden;
      if (sendFeedbackEl) sendFeedbackEl.textContent = "";
      if (verifyFeedbackEl) verifyFeedbackEl.textContent = "";
    });
  }

  if (sendCodeBtn) {
    sendCodeBtn.addEventListener("click", async () => {
      if (sendFeedbackEl) sendFeedbackEl.textContent = "";
      if (verifyFeedbackEl) verifyFeedbackEl.textContent = "";

      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error || !session?.access_token) {
        if (sendFeedbackEl) sendFeedbackEl.textContent = "Please login to link Discord!";
        return;
      }

      const discordUsername = String(discordUsernameInput?.value || "").trim();
      if (!discordUsername) {
        if (sendFeedbackEl) sendFeedbackEl.textContent = "Discord username can't be empty!";
        return;
      }

      if (sendFeedbackEl) sendFeedbackEl.textContent = "Sending verification code...";

      try {
        const res = await fetch(SEND_VERIFICATION_CODE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ JWT: session.access_token, DiscordUsername: discordUsername })
        });
        const data = await res.json();
        if (sendFeedbackEl) sendFeedbackEl.textContent = data.message || "No message returned";
      } catch (err) {
        if (sendFeedbackEl) sendFeedbackEl.textContent = "Failed to send code: " + err.message;
      }
    });
  }

  if (verifyCodeBtn) {
    verifyCodeBtn.addEventListener("click", async () => {
      if (verifyFeedbackEl) verifyFeedbackEl.textContent = "";

      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error || !session?.access_token) {
        if (verifyFeedbackEl) verifyFeedbackEl.textContent = "Please login to link Discord!";
        return;
      }

      const discordUsername = String(discordUsernameInput?.value || "").trim();
      const code = String(discordCodeInput?.value || "").trim();
      if (!code) {
        if (verifyFeedbackEl) verifyFeedbackEl.textContent = "Verification code can't be empty!";
        return;
      }

      if (verifyFeedbackEl) verifyFeedbackEl.textContent = "Verifying code...";

      try {
        const res = await fetch(VERIFY_CODE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ DiscordUsername: discordUsername, Code: code })
        });
        const data = await res.json();
        if (verifyFeedbackEl) verifyFeedbackEl.textContent = data.message || "No message returned";
        // If backend links the account, refresh the UI.
        await refreshDiscordStatus();
      } catch (err) {
        if (verifyFeedbackEl) verifyFeedbackEl.textContent = "Failed to verify code: " + err.message;
      }
    });
  }


}

// ---------- Session helpers ----------
async function getUserData() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Error fetching session:", error);
    return null;
  }

  const session = data?.session;
  const user = session?.user;
  if (!user) return null;

  const { data: row, error: tableError } = await supabaseClient
    .from("user_settings")
    .select("*")
    .eq("id", user.id)
    .single();

  if (tableError) {
    console.error("Error fetching user row:", tableError);
    return null;
  }

  return row;
}

async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.replace("/index.html");
}

// ---------- Initialization (attach event listeners based on page) ----------
function initSignup() {
  const form = $("#auth-form");
  const submitBtn = $("#submit-btn");
  const sendCodeBtn = $("#send-code-btn");
  const verifyCodeBtn = $("#verify-code-btn");

  const elements = {
    emailEl: $("#input-email"),
    passwordEl: $("#input-password"),
    emailErrorEl: $(".authentication-format-error-email"),
    passwordErrorEl: $(".authentication-format-error-password"),
    feedbackEl: $(".authentication-feedback-message"),
    submitBtn,
    discordUsernameEl: $("#discord-username-input"),
    discordUsernameErrorEl: $(".authentication-format-error-discordid"),
    verifyInputEl: $("#discord-verfication-code-input"),
    verifyInputErrorEl: $(".authentication-format-error-discordid-verfication"),
  };

  elements.discordUsernameEl.addEventListener("input", async () => {
    if (elements.discordUsernameEl.value.trim() !== "") {
      elements.submitBtn.disabled = true
    }
    else {
      elements.submitBtn.disabled = false
    }
  })

  if (form) form.addEventListener("submit", (e) => handleSignupSubmit(e, elements));
  if (sendCodeBtn) sendCodeBtn.addEventListener("click", (e) => { e.preventDefault(); handleSendCode(elements); });
  if (verifyCodeBtn) verifyCodeBtn.addEventListener("click", () => handleVerifyCode(elements));
}

function initSignin() {
  const form = $("#auth-form");
  const submitBtn = $("#submit-btn");

  const elements = {
    emailEl: $("#input-email"),
    passwordEl: $("#input-password"),
    emailErrorEl: $(".authentication-format-error-email"),
    passwordErrorEl: $(".authentication-format-error-password"),
    feedbackEl: $(".authentication-feedback-message"),
    submitBtn,
  };

  if (form) form.addEventListener("submit", (e) => handleSigninSubmit(e, elements));
}

function initDashboard() {
  window.addEventListener("DOMContentLoaded", loadDashboard);
}
function initSettings() {
  window.addEventListener("DOMContentLoaded", loadSettings);
}

(function bootstrap() {
  const page = document.body?.dataset?.page;
  if (!page) return;

  switch (page) {
    case "signup":
      initSignup();
      break;
    case "signin":
      initSignin();
      break;
    case "dashboard":
      initDashboard();
      break;
    case "settings":
      initSettings();
      break;
    default:
      break;
  }
})();
