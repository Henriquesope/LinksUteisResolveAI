(function () {
  "use strict";

  var PINS_KEY = "links-pins";
  var THEME_KEY = "links-theme";
  var ALL = "todos";

  var el = {
    search: document.getElementById("search"),
    form: document.getElementById("search-form"),
    clear: document.getElementById("search-clear"),
    chips: document.getElementById("chips"),
    count: document.getElementById("result-count"),
    sections: document.getElementById("sections"),
    empty: document.getElementById("empty"),
    emptyTitle: document.getElementById("empty-title"),
    emptyReset: document.getElementById("empty-reset"),
    toast: document.getElementById("toast"),
    themeToggle: document.getElementById("theme-toggle"),
    themeIcon: document.getElementById("theme-icon"),
  };

  /* ---------- Armazenamento (pode estar bloqueado no navegador) ---------- */

  function readStore(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function loadPins() {
    try {
      var parsed = JSON.parse(readStore(PINS_KEY) || "[]");
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      return new Set();
    }
  }

  /* ---------- Dados ---------- */

  function normalize(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }

  function parseUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url : null;
    } catch (e) {
      return null;
    }
  }

  function loadData() {
    var raw = window.LINKS_DATA || {};
    var categories = (raw.categories || []).slice();
    var known = new Set(categories.map(function (c) { return c.id; }));
    var needsOther = false;

    var links = (raw.links || []).reduce(function (result, link) {
      var url = parseUrl(link.url);
      if (!link.name || !url) {
        console.warn("links.js: link ignorado (precisa de name e de url http/https):", link);
        return result;
      }
      var category = link.category;
      if (!known.has(category)) {
        console.warn('links.js: categoria desconhecida em "' + link.name + '", movido para Outros.');
        category = "outros";
        needsOther = true;
      }
      var host = url.hostname.replace(/^www\./, "");
      var label = (categories.find(function (c) { return c.id === category; }) || { label: "Outros" }).label;
      result.push({
        name: link.name,
        url: link.url,
        host: host,
        category: category,
        description: link.description || "",
        haystack: normalize([link.name, link.description, host, label].concat(link.tags || []).join(" ")),
      });
      return result;
    }, []);

    if (needsOther) categories.push({ id: "outros", label: "Outros" });
    return { categories: categories, links: links };
  }

  var data = loadData();
  var pins = loadPins();
  var state = { query: "", category: ALL };

  function matchesQuery(link) {
    return normalize(state.query).split(/\s+/).filter(Boolean).every(function (term) {
      return link.haystack.indexOf(term) !== -1;
    });
  }

  /* ---------- Estado na URL, para a busca poder ser compartilhada ---------- */

  function readHash() {
    var params = new URLSearchParams(location.hash.slice(1));
    var category = params.get("cat");
    var isKnown = data.categories.some(function (c) { return c.id === category; });
    state.category = isKnown ? category : ALL;
    state.query = params.get("q") || "";
    el.search.value = state.query;
  }

  function writeHash() {
    var params = new URLSearchParams();
    if (state.category !== ALL) params.set("cat", state.category);
    if (state.query) params.set("q", state.query);
    var hash = params.toString();
    try {
      history.replaceState(null, "", hash ? "#" + hash : location.pathname + location.search);
    } catch (e) { /* alguns navegadores bloqueiam em file:// */ }
  }

  /* ---------- Renderização ---------- */

  function h(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name, extraClass) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon" + (extraClass ? " " + extraClass : ""));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + name);
    svg.appendChild(use);
    return svg;
  }

  function monogram(name) {
    var match = normalize(name).match(/[a-z0-9]/);
    return match ? match[0].toUpperCase() : "#";
  }

  function iconButton(iconName, label, action, url) {
    var button = h("button", "icon-btn");
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.dataset.action = action;
    button.dataset.url = url;
    button.appendChild(icon(iconName));
    return button;
  }

  function renderCard(link) {
    var item = h("li");
    var card = h("article", "card");
    var main = h("div", "card__main");
    var tile = h("span", "tile", monogram(link.name));
    tile.setAttribute("aria-hidden", "true");

    var text = h("div", "card__text");
    var title = h("h3", "card__name");
    var anchor = h("a", "card__link", link.name);
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.setAttribute("aria-label", link.name + " (abre em nova aba)");
    title.appendChild(anchor);
    text.appendChild(title);
    if (link.description) text.appendChild(h("p", "card__desc", link.description));
    main.append(tile, text);

    var foot = h("div", "card__foot");
    var actions = h("div", "card__actions");
    var pinned = pins.has(link.url);
    var pin = iconButton(
      "i-star",
      (pinned ? "Desafixar " : "Fixar ") + link.name,
      "pin",
      link.url
    );
    pin.setAttribute("aria-pressed", String(pinned));
    actions.append(iconButton("i-copy", "Copiar link de " + link.name, "copy", link.url), pin);
    foot.append(h("span", "card__host", link.host), actions);

    card.append(main, foot);
    item.appendChild(card);
    return item;
  }

  function renderSection(id, title, links, titleIcon) {
    var section = h("section", "section");
    section.dataset.section = id;
    var headingId = "secao-" + id;
    section.setAttribute("aria-labelledby", headingId);

    var head = h("div", "section__head");
    if (titleIcon) head.appendChild(icon(titleIcon, "section__icon"));
    var heading = h("h2", "section__title", title);
    heading.id = headingId;
    head.appendChild(heading);

    var grid = h("ul", "grid");
    links.forEach(function (link) { grid.appendChild(renderCard(link)); });
    section.append(head, grid);
    return section;
  }

  function renderChips() {
    var options = [{ id: ALL, label: "Todos" }].concat(data.categories);
    var searched = data.links.filter(matchesQuery);

    el.chips.replaceChildren.apply(el.chips, options.map(function (option) {
      var count = option.id === ALL
        ? searched.length
        : searched.filter(function (l) { return l.category === option.id; }).length;
      var chip = h("button", "chip");
      chip.type = "button";
      chip.dataset.category = option.id;
      chip.setAttribute("aria-pressed", String(state.category === option.id));
      var number = h("span", "chip__count", String(count));
      chip.append(option.label, number);
      return chip;
    }));
  }

  function render() {
    var visible = data.links.filter(function (link) {
      return matchesQuery(link) && (state.category === ALL || link.category === state.category);
    });

    var sections = [];
    if (state.category === ALL) {
      var pinnedLinks = visible.filter(function (l) { return pins.has(l.url); });
      if (pinnedLinks.length) sections.push(renderSection("fixados", "Fixados", pinnedLinks, "i-star"));
    }
    data.categories.forEach(function (category) {
      var links = visible.filter(function (l) { return l.category === category.id; });
      if (links.length) sections.push(renderSection(category.id, category.label, links));
    });
    el.sections.replaceChildren.apply(el.sections, sections);

    el.count.textContent = visible.length === 1 ? "1 link" : visible.length + " links";
    el.clear.hidden = !state.query;

    el.empty.hidden = visible.length > 0;
    if (!visible.length) {
      el.emptyTitle.textContent = state.query
        ? "Nenhum link encontrado para “" + state.query + "”"
        : "Nenhum link nesta categoria";
    }

    renderChips();
  }

  function update() {
    render();
    writeHash();
  }

  /* ---------- Ações ---------- */

  var toastTimer;

  function showToast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add("is-visible");
    toastTimer = setTimeout(function () {
      el.toast.classList.remove("is-visible");
    }, 3000);
  }

  function legacyCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var copied = false;
    try { copied = document.execCommand("copy"); } catch (e) { copied = false; }
    area.remove();
    return copied;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function copyLink(button, url) {
    var link = data.links.find(function (l) { return l.url === url; });
    copyToClipboard(url).then(function (result) {
      if (result === false) {
        showToast("Não foi possível copiar. Abra o link e copie o endereço.");
      } else {
        showToast("Link de " + link.name + " copiado");
        var use = button.querySelector("use");
        use.setAttribute("href", "#i-check");
        setTimeout(function () { use.setAttribute("href", "#i-copy"); }, 1500);
      }
    });
  }

  function togglePin(button, url) {
    var section = button.closest("[data-section]").dataset.section;
    if (pins.has(url)) pins.delete(url); else pins.add(url);
    var saved = writeStore(PINS_KEY, JSON.stringify(Array.from(pins)));
    if (!saved) showToast("Fixado só nesta visita: o navegador bloqueou o salvamento.");
    render();

    // A lista foi redesenhada: devolve o foco ao mesmo botão.
    var selector = '[data-action="pin"][data-url="' + CSS.escape(url) + '"]';
    var target = el.sections.querySelector('[data-section="' + section + '"] ' + selector)
      || el.sections.querySelector(selector);
    if (target) target.focus();
  }

  /* ---------- Tema ---------- */

  function isDark() {
    var theme = document.documentElement.dataset.theme;
    if (theme) return theme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function syncThemeButton() {
    var dark = isDark();
    var label = dark ? "Usar tema claro" : "Usar tema escuro";
    el.themeIcon.setAttribute("href", dark ? "#i-sun" : "#i-moon");
    el.themeToggle.setAttribute("aria-label", label);
    el.themeToggle.title = label;
  }

  /* ---------- Eventos ---------- */

  el.search.addEventListener("input", function () {
    state.query = el.search.value.trim();
    update();
  });

  el.form.addEventListener("submit", function (event) {
    event.preventDefault();
    var first = el.sections.querySelector(".card__link");
    if (first && state.query) first.focus();
  });

  function clearSearch() {
    el.search.value = "";
    state.query = "";
    update();
    el.search.focus();
  }

  el.clear.addEventListener("click", clearSearch);

  el.emptyReset.addEventListener("click", function () {
    el.search.value = "";
    state.query = "";
    state.category = ALL;
    update();
    el.search.focus();
  });

  el.chips.addEventListener("click", function (event) {
    var chip = event.target.closest(".chip");
    if (!chip) return;
    state.category = chip.dataset.category;
    update();
    var active = el.chips.querySelector('[data-category="' + CSS.escape(state.category) + '"]');
    if (active) active.focus();
  });

  el.sections.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "copy") copyLink(button, button.dataset.url);
    if (button.dataset.action === "pin") togglePin(button, button.dataset.url);
  });

  el.themeToggle.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    writeStore(THEME_KEY, next);
    syncThemeButton();
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeButton);

  document.addEventListener("keydown", function (event) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      el.search.focus();
      el.search.select();
    } else if (event.key === "Escape" && event.target === el.search && el.search.value) {
      event.preventDefault();
      clearSearch();
    }
  });

  window.addEventListener("hashchange", function () {
    readHash();
    render();
  });

  readHash();
  syncThemeButton();
  render();
})();
