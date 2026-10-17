"use strict";

(function () {
  const scriptEl = document.currentScript;
  const THEME_KEY = "pv-theme";
  const WELCOME_KEY = "petvision-bienvenida-v1";
  const DARK_META = "#1E2530";
  const LIGHT_META = "#FAF3E3";
  const PIE_INFO = "PetVision · Autor: Rolando Velasco Soliz · Materia: INF432";

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      /* Modo privado o almacenamiento bloqueado: se ignora. */
    }
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      /* Ignorado. */
    }
  }

  const prefersDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function effectiveDark() {
    const theme = document.documentElement.getAttribute("data-theme");
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return !!(prefersDark && prefersDark.matches);
  }

  function updateThemeMeta() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", effectiveDark() ? DARK_META : LIGHT_META);
  }

  function syncThemeButtons() {
    document.querySelectorAll(".js-theme-toggle").forEach((button) => {
      button.setAttribute("aria-pressed", effectiveDark() ? "true" : "false");
    });
  }

  function applyTheme(theme) {
    if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    updateThemeMeta();
    syncThemeButtons();
  }

  function initTheme() {
    applyTheme(safeGet(THEME_KEY));
    if (prefersDark && prefersDark.addEventListener) {
      prefersDark.addEventListener("change", () => {
        if (!document.documentElement.getAttribute("data-theme")) {
          updateThemeMeta();
          syncThemeButtons();
        }
      });
    }
  }

  function toggleTheme() {
    const next = effectiveDark() ? "light" : "dark";
    safeSet(THEME_KEY, next);
    applyTheme(next);
  }

  function bindTheme() {
    document.querySelectorAll(".js-theme-toggle").forEach((button) => {
      button.addEventListener("click", toggleTheme);
    });
  }

  function initNav() {
    const toggle = document.getElementById("nav-toggle");
    const panel = document.getElementById("nav-panel");
    if (!toggle || !panel) return;

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      panel.hidden = !open;
    }

    toggle.addEventListener("click", () => setOpen(panel.hidden));
    panel.querySelectorAll("a, button").forEach((item) => {
      item.addEventListener("click", () => setOpen(false));
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 960) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  function initScrollSpy() {
    const nav = document.querySelector(".nav");
    const links = Array.prototype.slice.call(document.querySelectorAll(".nav-link[data-spy]"));
    if (!nav || links.length === 0) return;

    const indicator = nav.querySelector(".nav__indicator");

    function moveIndicator(link) {
      if (!indicator || !link) return;
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      indicator.style.width = linkRect.width + "px";
      indicator.style.transform = "translateX(" + (linkRect.left - navRect.left) + "px)";
    }

    function setActive(link) {
      links.forEach((item) => item.classList.toggle("is-active", item === link));
      moveIndicator(link);
    }

    function update() {
      const offset = 140;
      const y = window.scrollY + offset;
      let current = links[0];
      links.forEach((link) => {
        const target = document.getElementById(link.getAttribute("href").slice(1));
        if (target && target.offsetTop <= y) current = link;
      });
      if (navRectBottomReached()) current = links[links.length - 1];
      setActive(current);
    }

    function navRectBottomReached() {
      return window.innerHeight + window.scrollY >= document.body.offsetHeight - 4;
    }

    links.forEach((link) => {
      link.addEventListener("click", () => setActive(link));
    });

    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    }, { passive: true });
    window.addEventListener("resize", update);

    update();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(update);
    }
  }

  function initWelcome() {
    const welcome = document.getElementById("welcome");
    if (!welcome) return;

    const openers = document.querySelectorAll(".js-open-welcome");
    const card = welcome.querySelector(".welcome__card");
    const focusables = () =>
      Array.prototype.slice.call(
        card.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.offsetParent !== null);

    let lastFocused = null;
    let closing = false;
    let closeTimer = null;

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function open() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      closing = false;
      lastFocused = document.activeElement;
      welcome.hidden = false;
      document.body.classList.add("welcome-open");
      requestAnimationFrame(() => welcome.classList.add("is-open"));
      const target = welcome.querySelector("[data-start-welcome]") || focusables()[0];
      if (target) target.focus();
      document.addEventListener("keydown", onKeydown);
    }

    function close() {
      if (closing) return;
      closing = true;
      welcome.classList.remove("is-open");
      document.body.classList.remove("welcome-open");
      document.removeEventListener("keydown", onKeydown);
      closeTimer = setTimeout(() => {
        welcome.hidden = true;
        closing = false;
      }, 320);
      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    }

    openers.forEach((opener) => {
      opener.addEventListener("click", (event) => {
        if (opener.tagName === "A" && !welcome) return;
        event.preventDefault();
        open();
      });
    });

    welcome.querySelectorAll("[data-close-welcome]").forEach((el) => {
      el.addEventListener("click", close);
    });

    const startButton = welcome.querySelector("[data-start-welcome]");
    if (startButton) {
      startButton.addEventListener("click", () => {
        close();
        const target = document.getElementById("analisis");
        if (target) {
          window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
        }
      });
    }

    const params = new URLSearchParams(window.location.search);
    const forced = params.get("bienvenida") === "1" || window.location.hash === "#bienvenida";
    if (forced) {
      open();
      if (window.location.hash === "#bienvenida") {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    } else if (safeGet(WELCOME_KEY) !== "visto") {
      safeSet(WELCOME_KEY, "visto");
      window.setTimeout(open, 260);
    }
  }

  function initFooter() {
    const pie = document.getElementById("pie-info");
    if (pie) pie.textContent = PIE_INFO;
  }

  function initServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    const swUrl = scriptEl && scriptEl.getAttribute("data-sw");
    if (!swUrl) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(swUrl).catch((error) => {
        console.warn("No se pudo activar el modo sin conexión:", error);
      });
    });
  }

  function detectInstallTarget() {
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isFirefox = /Firefox|FxiOS/i.test(ua);
    const isEdge = /Edg\//.test(ua);
    const isChrome = /Chrome\//.test(ua) || /CriOS/.test(ua);
    const isSafari = /Safari/.test(ua) && !isChrome && !isEdge && !isFirefox;
    if (isIOS || isSafari) return "ios";
    if (isFirefox) return "firefox";
    return "chromium";
  }

  function initInstall() {
    const headerBtn = document.getElementById("install-app");
    const panelBtn = document.getElementById("install-app-panel");
    const help = document.getElementById("install-help");
    if (!headerBtn && !panelBtn && !help) return;

    let deferredPrompt = null;

    function isStandalone() {
      try {
        return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
          window.navigator.standalone === true;
      } catch (error) {
        return false;
      }
    }

    function show(el) {
      if (el) el.classList.remove("hidden");
    }

    function hide(el) {
      if (el) el.classList.add("hidden");
    }

    function syncAvailability() {
      if (isStandalone()) {
        hide(headerBtn);
        hide(panelBtn);
        return;
      }
      show(panelBtn);
      if (deferredPrompt) show(headerBtn);
      else hide(headerBtn);
    }

    let lastFocused = null;
    let helpClosing = false;
    let helpTimer = null;

    function helpFocusables() {
      return Array.prototype.slice.call(
        help.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.offsetParent !== null);
    }

    function onHelpKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHelp();
        return;
      }
      if (event.key !== "Tab") return;
      const items = helpFocusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function openHelp() {
      if (!help) return;
      if (helpTimer) {
        clearTimeout(helpTimer);
        helpTimer = null;
      }
      helpClosing = false;
      lastFocused = document.activeElement;
      const target = detectInstallTarget();
      help.querySelectorAll("[data-install-target]").forEach((group) => {
        group.hidden = group.getAttribute("data-install-target") !== target;
      });
      help.hidden = false;
      document.body.classList.add("modal-open");
      requestAnimationFrame(() => help.classList.add("is-open"));
      const closeBtn = help.querySelector(".modal__close");
      if (closeBtn) closeBtn.focus();
      document.addEventListener("keydown", onHelpKeydown);
    }

    function closeHelp() {
      if (!help || helpClosing || help.hidden) return;
      helpClosing = true;
      help.classList.remove("is-open");
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", onHelpKeydown);
      helpTimer = setTimeout(() => {
        help.hidden = true;
        helpClosing = false;
      }, 300);
      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    }

    async function runPrompt() {
      if (!deferredPrompt) return false;
      const prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      try {
        await prompt.userChoice;
      } catch (error) {
        /* El usuario puede cancelar; se ignora. */
      }
      hide(headerBtn);
      return true;
    }

    function onInstallClick(event) {
      event.preventDefault();
      if (deferredPrompt) {
        runPrompt();
      } else {
        openHelp();
      }
    }

    if (headerBtn) headerBtn.addEventListener("click", onInstallClick);
    if (panelBtn) panelBtn.addEventListener("click", onInstallClick);

    if (help) {
      help.querySelectorAll("[data-close-install-help]").forEach((el) => {
        el.addEventListener("click", closeHelp);
      });
    }

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      syncAvailability();
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      hide(headerBtn);
      hide(panelBtn);
      closeHelp();
    });

    if (window.matchMedia) {
      const mode = window.matchMedia("(display-mode: standalone)");
      const onMode = () => syncAvailability();
      if (mode.addEventListener) mode.addEventListener("change", onMode);
      else if (mode.addListener) mode.addListener(onMode);
    }

    syncAvailability();
  }

  function init() {
    initTheme();
    bindTheme();
    initNav();
    initScrollSpy();
    initWelcome();
    initFooter();
    initServiceWorker();
    initInstall();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
