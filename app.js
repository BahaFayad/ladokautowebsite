// Ensure the CDN loaded and `supabase` exists
if (!window.supabase) {
  console.error("Supabase CDN failed to load.");
}

const supabaseClient = window.supabase.createClient(
  "https://ljnikyrjdzjcpvltrduu.supabase.co",
  "sb_publishable_mj5aiWC62fhRMJwpP5Abfg_1YJ1S-eQ"
);

// Prefer relative URL if backend is same origin.
// If backend is separate, set this to your real API origin and configure CORS there.
const REGISTER_URL = "https://localhost:7167/Register"; // or "https://your-api-domain/Register"





if (window.location.pathname.endsWith('signup.html')) {

  const form = document.querySelector("#auth-form");
  const submitBtn = document.querySelector("#submit-btn");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailEl = document.querySelector("#input-email");
    const passwordEl = document.querySelector("#input-password");
    const emailErrorEl = document.querySelector(".authentication-format-error-email");
    const passwordErrorEl = document.querySelector(".authentication-format-error-password");
    const feedbackEl = document.querySelector(".authentication-feedback-message");

    if (!emailEl || !passwordEl || !emailErrorEl || !passwordErrorEl || !feedbackEl || !submitBtn) return;

    const email = String(emailEl.value || "").trim();
    const password = String(passwordEl.value || "");

    // Reset messages
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
    submitBtn.disabled = true;

    try {
      const response = await fetch(REGISTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, discordId: null })
      });

      const parsed = await safeReadJson(response);
      console.log("Registration response:", parsed.data ?? parsed.raw);

      if (!response.ok) {
        // If backend provided a useful error message, surface it
        const msg =
          (parsed.data && (parsed.data.message || parsed.data.error)) ||
          "Registration failed.";
        setText(feedbackEl, msg);
        return;
      }

      setText(feedbackEl, "Registration successful.");
      const { data: authData, error: authError } =
        await supabaseClient.auth.signInWithPassword({ email, password });


      if (authError) {
        console.error("Login failed:", authError);
        setText(feedbackEl, "Login failed.");
        return;
      }

      if (authData?.user?.email) {
        setText(feedbackEl, `Logged in as ${authData.user.email}`);
        console.log("User signed in:", authData.user);
      } else {
        setText(feedbackEl, "Logged in.");
      }
      //redirect to dashboard
      window.location.replace("./dashboard.html");
    } catch (err) {
      console.error("Request error:", err);
      setText(feedbackEl, "Server/network error.");
    } finally {
      submitBtn.disabled = false;
    }
  });
}
if (window.location.pathname.endsWith('index.html')) {
  const form = document.querySelector("#auth-form");
  const submitBtn = document.querySelector("#submit-btn");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailEl = document.querySelector("#input-email");
    const passwordEl = document.querySelector("#input-password");
    const emailErrorEl = document.querySelector(".authentication-format-error-email");
    const passwordErrorEl = document.querySelector(".authentication-format-error-password");
    const feedbackEl = document.querySelector(".authentication-feedback-message");

    if (!emailEl || !passwordEl || !emailErrorEl || !passwordErrorEl || !feedbackEl || !submitBtn) return;

    const email = emailEl.value.trim();
    const password = passwordEl.value;

    // Reset messages
    setText(emailErrorEl, "");
    setText(passwordErrorEl, "");
    setText(feedbackEl, "");

    // Validate inputs
    if (!isValidMduStudentEmail(email)) {
      setText(emailErrorEl, "Email is incorrectly formatted!");
      return;
    }
    if (password.length < 4) {
      setText(passwordErrorEl, "Password must be at least 4 characters.");
      return;
    }

    submitBtn.disabled = true;
    setText(feedbackEl, "Logging in...");

    try {
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        // Wrong credentials or other login error
        console.error("Login error:", authError);
        setText(feedbackEl, authError.message || "Login failed.");
        return;
      }

      if (authData?.user) {
        // Successful login
        setText(feedbackEl, `Logged in as ${authData.user.email}`);
        console.log("User signed in:", authData.user);
        // Redirect to dashboard
        window.location.replace("./dashboard.html");
      } else {
        // Unexpected: no user returned
        setText(feedbackEl, "Login failed: no user returned.");
      }

    } catch (err) {
      // Network or unexpected error
      console.error("Unexpected error during login:", err);
      setText(feedbackEl, "Server or network error.");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// Utility function to set text safely
function setText(el, text) {
  if (el) el.textContent = text;
}



if (window.location.pathname.endsWith('dashboard.html')) {
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

    if (!courses.length) {
      coursesTableBody.innerHTML = `<tr><td colspan="5">No courses found.</td></tr>`;
      return;
    }

    courses.forEach((course, i) => {
      coursesTableBody.innerHTML += `
      <tr id="course-${i}">
        <td>${course.Name}</td>
        <td>${course.IsRegistered ? "Yes" : "No"}</td>
        <td>${course.RegistrationStart}</td>
        <td><input type="checkbox" ${course.NotificationOn ? "checked" : ""}></td>
        <td><input type="checkbox" ${course.AutoRegistrationEnabled ? "checked" : ""}></td>
      </tr>
    `;
    });
  }
  // Run after DOM is loaded
  window.addEventListener("DOMContentLoaded", loadDashboard);
}


async function SignOut() {
  try {
    // 1. Sign out from Supabase
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error("Sign out failed:", error.message);
      return;
    }
    console.log("Signed out successfully.");

    // 2. Clear cached data in JS
    userData = null; // your in-memory user data variable
    const coursesTableBody = document.querySelector("#courses-table-body");
    if (coursesTableBody) {
      coursesTableBody.innerHTML = `<tr><td colspan="5">Please log in to see your courses.</td></tr>`;
    }

    // 3. Optional: redirect to login page
    window.location.href = "/index.html"; // change path to your login page

  } catch (err) {
    console.error("Unexpected error during sign out:", err);
  }
}

function utf8Base64ToJson(base64String) {
  // 1) Decode Base64 to a binary string
  const binary = atob(base64String);

  // 2) Convert binary string to Uint8Array (bytes)
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // 3) Decode UTF-8 bytes to string
  const text = new TextDecoder("utf-8").decode(bytes);

  // 4) Parse JSON
  return JSON.parse(text);
}
async function safeReadJson(response) {
  const text = await response.text();
  if (!text) return { ok: response.ok, data: null, raw: "" };

  try {
    return { ok: response.ok, data: JSON.parse(text), raw: text };
  } catch {
    return { ok: response.ok, data: null, raw: text };
  }
}
function isValidMduStudentEmail(email) {
  const e = email.trim().toLowerCase();
  // Strictly require it to end with the domain
  if (!e.endsWith("@student.mdu.se")) return false;

  // Optional: require something before @ (basic sanity)
  const local = e.slice(0, e.indexOf("@"));
  return local.length > 0;
}

async function getUserData() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Error fetching session:", error);
    return null;
  }

  const session = data?.session;
  const user = session?.user;
  if (!user) {
    console.log("No authenticated user");
    return null;
  }

  const { data: row, error: tableError } = await supabaseClient
    .from("user_settings")
    .select("*")
    .eq("id", user.id)
    .single();

  if (tableError) {
    console.error("Error fetching user row:", tableError);
    return null;
  }

  return row; // <-- return full row object
}
