/* Ladok Auto - Site UI helpers
   Auth-aware navigation + protected page gating. */
(function () {
  const page = document.body && document.body.dataset ? (document.body.dataset.page || "") : "";

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function usernameFromUser(user) {
    if (!user) return "";
    const meta = user.user_metadata || {};
    const preferred = String(meta.username || meta.name || "").trim();
    if (preferred) return preferred;
    const email = String(user.email || "").trim();
    if (!email) return "";
    const at = email.indexOf("@");
    return at > 0 ? email.slice(0, at) : email;
  }

  function buildLoggedOutNavHtml() {
    return [
      `<li><a class="navlink" href="./index.html"><i class="bi bi-box-arrow-in-right" aria-hidden="true"></i><span>Sign in</span></a></li>`,
      `<li><a class="navlink" href="./signup.html"><i class="bi bi-person-plus" aria-hidden="true"></i><span>Sign up</span></a></li>`,
      `<li><a class="navlink" href="./about.html"><i class="bi bi-info-circle" aria-hidden="true"></i><span>About</span></a></li>`
    ].join("");
  }

  function buildLoggedInNavHtml(username) {
    const userHtml = username
      ? `<li class="nav-user"><span>Signed in as:</span><span class="nav-username">${escapeHtml(username)}</span></li>`
      : "";

    return [
      `<li><a class="navlink" href="./dashboard.html"><i class="bi bi-speedometer2" aria-hidden="true"></i><span>Dashboard</span></a></li>`,
      `<li><a class="navlink" href="./settings.html"><i class="bi bi-gear" aria-hidden="true"></i><span>Settings</span></a></li>`,
      `<li><a class="navlink" href="./about.html"><i class="bi bi-info-circle" aria-hidden="true"></i><span>About</span></a></li>`,
      userHtml,
      `<li><button type="button" onclick="signOut()"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Sign Out</span></button></li>`
    ].join("");
  }

  async function syncNavToSession() {
    const nav = document.getElementById("primary-nav");
    if (!nav) return;
    const ul = nav.querySelector("ul");
    if (!ul) return;

    const client = (typeof supabaseClient !== "undefined") ? supabaseClient : window.supabaseClient;
    if (!client || !client.auth) return;

    try {
      const { data, error } = await client.auth.getSession();
      const user = (!error && data && data.session) ? data.session.user : null;

      if (!user) {
        ul.innerHTML = buildLoggedOutNavHtml();
        return;
      }

      const username = usernameFromUser(user);
      ul.innerHTML = buildLoggedInNavHtml(username);
    } catch (_) {
      // If session check fails, default to logged-out nav
      ul.innerHTML = buildLoggedOutNavHtml();
    }
  }

  async function requireAuth() {
    // Protected pages only
    if (page !== "dashboard" && page !== "settings") return;

    const client = (typeof supabaseClient !== "undefined") ? supabaseClient : window.supabaseClient;
    if (!client || !client.auth) {
      window.location.replace("./index.html");
      return;
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data || !data.session || !data.session.user) {
        window.location.replace("./index.html");
      }
    } catch (_) {
      window.location.replace("./index.html");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", requireAuth);
    document.addEventListener("DOMContentLoaded", syncNavToSession);
  } else {
    requireAuth();
    syncNavToSession();
  }

  const header = document.querySelector("header");
  if (header) {
    function onScroll() {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
})();
