(() => {
  const key = "sai-theme";
  let saved = "dark";
  try { saved = localStorage.getItem(key) || "dark"; } catch (_) {}

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      button.textContent = theme === "light" ? "🌙 Oscuro" : "☀️ Claro";
    });
    try { localStorage.setItem(key, theme); } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTheme(saved === "light" ? "light" : "dark");
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      button.addEventListener("click", () => {
        setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
      });
    });
  });
})();
