// ---------- Config ----------
const REGISTER_URL = "https://localhost:7167/Register"; // use relative/origin URL in production
const SEND_VERIFICATION_CODE_URL = "https://localhost:7167/DiscordVerification/sendcode";
const VERIFY_CODE_URL = "https://localhost:7167/DiscordVerification/verify";
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
  const rows = document.querySelectorAll("#courses-table-body tr");

  rows.forEach((row, i) => {
    const reminderCheckbox = row.querySelector(".course-reminder");
    const autoCheckbox = row.querySelector(".course-auto");

    originalCourses[i].NotificationOn = reminderCheckbox.checked;
    originalCourses[i].AutoRegistrationEnabled = autoCheckbox.checked;
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


// ---------- Dashboard loader ----------
async function loadDashboard() {
  const coursesTableBody = document.querySelector("#courses-table-body");
  if (!coursesTableBody) return;

  const userData = await getUserData();
  if (!userData) {
    coursesTableBody.innerHTML = `<tr><td colspan="5">Please log in to see your courses.</td></tr>`;
    return;
  }

  let courses = [];
  try {
    courses = utf8Base64ToJson(userData.json_courses_settings_binary);
  } catch (err) {
    console.error("Failed to parse courses:", err);
    coursesTableBody.innerHTML = `<tr><td colspan="5">Failed to load courses.</td></tr>`;
    return;
  }

  if (!Array.isArray(courses) || courses.length === 0) {
    coursesTableBody.innerHTML = `<tr><td colspan="5">No courses found.</td></tr>`;
    return;
  }

  // Global exam auto-registration toggle
  const autoExaminationRegistrationInput =
    document.querySelector("#toggle-auto-examination-registration");
  autoExaminationRegistrationInput.checked = userData.auto_register_exams;

  // ---------- Render courses ----------
  coursesTableBody.innerHTML = "";

  courses.forEach((course, i) => {
    const checkedNotification = course.NotificationOn ? "checked" : "";
    const checkedAuto = course.AutoRegistrationEnabled ? "checked" : "";

    coursesTableBody.innerHTML += `
      <tr id="course-${i}">
        <td>${course.Name}</td>
        <td>${course.IsRegistered ? "Yes" : "No"}</td>
        <td>${course.RegistrationStart}</td>
        <td><input type="checkbox" class="course-reminder" ${checkedNotification}></td>
        <td><input type="checkbox" class="course-auto" ${checkedAuto}></td>
      </tr>
    `;
  });

  // ---------- Toggle ALL reminders ----------
  const toggleAllReminders = document.querySelector("#toggle-all-courses-reminder");
  toggleAllReminders.onchange = (e) => {
    document
      .querySelectorAll(".course-reminder")
      .forEach(cb => cb.checked = e.target.checked);
  };

  // ---------- Toggle ALL auto-registrations ----------
  const toggleAllAuto = document.querySelector("#toggle-all-courses-auto-registration");
  toggleAllAuto.onchange = (e) => {
    document
      .querySelectorAll(".course-auto")
      .forEach(cb => cb.checked = e.target.checked);
  };
  //saving changes
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
        document.querySelector("#toggle-auto-examination-registration").checked;

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

  autoReminderInputEl.checked =
    userData.early_registration_reminders_on;

  if (userData.early_register_reminder_days === -1) {
    amountDaysReminderInputEl.selectedIndex = 7; // "Never"
  } else {
    amountDaysReminderInputEl.selectedIndex =
      userData.early_register_reminder_days - 1;
  }

  // ===== UPDATE SETTINGS =====
  const saveChangesBtnEl =
    document.querySelector("#save-changes-btn");

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
    }
  });
  const { data, error } = await supabaseClient
    .from('discord_readonly_table')
    .select('*')
    .single(); // fetch entire row

  if (error) {
    console.error("Error fetching Discord data:", error);
    return;
  }
  const discordIdEl = document.querySelector("#discord-account-id")
  if (data.discord_client_id != null) {
    discordIdEl.textContent = `Discord id: ${data.discord_client_id}`
  }
  const discordLinkStatusEl = document.querySelector("#discord-account-link-status")
  if (data.discord_client_id != null) {
    discordLinkStatusEl.textContent = `Discord Linked: ${data.discord_linked}`
  }
  const linkDiscordAccountBtn = document.querySelector("#change-discord-account-btn").addEventListener("click", async () => {
    const discordSettingsWrapper = document.querySelector(".discord-setting-wrapper")
    discordSettingsWrapper.innerHTML += `<p>Please join the discord server before signing up: <a target="_blank"
                href="https://discord.gg/67vRaEtJhD">Join Server</a></p>
                <label for="discord-username-input">Discord username(Not Display Name):</label>
                <input type="text" name="discord-username" id="discord-username-input" placeholder="Ex: username" />
                <button id="send-code-btn" type="button">Send Code</button>
                <p class="authentication-format-error-discordid"></p>

                <label for="discord-verfication-code-input">Discord verfication code(lasts 5 min):</label>
                <input type="text" name="discord-username" id="discord-verfication-code-input"
                    placeholder="Ex: W8ed2" />
                <button id="verify-code-btn" type="button">Verify Code</button>
                <p class="authentication-format-error-discordid-verfication"></p>`
    const feedbackParagraph = document.querySelector(".authentication-format-error-discordid-verfication");
    const discordUsernameInput = document.querySelector("#discord-username-input");
    const discordCodeInput = document.querySelector("#discord-verfication-code-input");

    const sendCodeBtn = document.querySelector("#send-code-btn");
    sendCodeBtn.addEventListener("click", async () => {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.error(error);
        feedbackParagraph.textContent = "Error getting session!";
        return;
      }

      const jwt = session?.access_token;
      if (!jwt) {
        feedbackParagraph.textContent = "Please login to link Discord!";
        return;
      }

      const discordUsername = discordUsernameInput.value.trim();
      if (!discordUsername) {
        feedbackParagraph.textContent = "Discord username can't be empty!";
        return;
      }

      feedbackParagraph.textContent = "Sending verification code...";

      try {
        const res = await fetch(SEND_VERIFICATION_CODE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ JWT: jwt, DiscordUsername: discordUsername })
        });

        const data = await res.json();
        feedbackParagraph.textContent = data.message || "No message returned";

      } catch (err) {
        feedbackParagraph.textContent = "Failed to send code: " + err.message;
      }
    });

    const verifyCodeBtn = document.querySelector("#verify-code-btn");
    verifyCodeBtn.addEventListener("click", async () => {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.error(error);
        feedbackParagraph.textContent = "Error getting session!";
        return;
      }

      const jwt = session?.access_token;
      if (!jwt) {
        feedbackParagraph.textContent = "Please login to link Discord!";
        return;
      }

      const discordUsername = discordUsernameInput.value.trim();
      const code = discordCodeInput.value.trim();
      if (!code) {
        feedbackParagraph.textContent = "Verification code can't be empty!";
        return;
      }

      feedbackParagraph.textContent = "Verifying code...";

      try {
        const res = await fetch(VERIFY_CODE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ DiscordUsername: discordUsername, Code: code })
        });

        const data = await res.json();
        feedbackParagraph.textContent = data.message || "No message returned";

      } catch (err) {
        feedbackParagraph.textContent = "Failed to verify code: " + err.message;
      }
    });



  })


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
