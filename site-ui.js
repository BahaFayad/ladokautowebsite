/* Ladok Auto - Site UI helpers
   Small UX helpers + auth gating for protected pages. */
(function () {
  const page = document.body && document.body.dataset ? (document.body.dataset.page || "") : "";

  async function requireAuth() {
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
  } else {
    requireAuth();
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
