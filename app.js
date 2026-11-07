(function () {
  "use strict";

  var PINS_KEY = "links-pins";
  var THEME_KEY = "links-theme";
  var ALL = "todos";
  var API = "api/links";
  var STATIC_DATA = "data/links.json";
  var REFRESH_AFTER = 15000;

  function $(id) { return document.getElementById(id); }

  var el = {
    search: $("search"),
    form: $("search-form"),
    clear: $("search-clear"),
    chips: $("chips"),
    count: $("result-count"),
    sections: $("sections"),
    empty: $("empty"),
    emptyTitle: $("empty-title"),
    emptyReset: $("empty-reset"),
    toast: $("toast"),
    themeToggle: $("theme-toggle"),
    themeIcon: $("theme-icon"),
    editToggle: $("edit-toggle"),
    editIcon: $("edit-icon"),
    editLabel: $("edit-label"),
    editNote: $("edit-note"),
    editTools: $("edit-tools"),
    addSection: $("add-section"),
    footerText: $("footer-text"),
    linkDialog: $("link-dialog"),
    linkForm: $("link-form"),
    linkTitle: $("link-dialog-title"),
    linkError: $("link-error"),
    fName: $("f-name"),
    fUrl: $("f-url"),
    fCategory: $("f-category"),
    fDescription: $("f-description"),
    fTags: $("f-tags"),
    sectionDialog: $("section-dialog"),
    sectionForm: $("section-form"),
    sectionTitle: $("section-dialog-title"),
    sectionError: $("section-error"),
    fLabel: $("f-label"),
    confirmDialog: $("confirm-dialog"),
    confirmForm: $("confirm-form"),
    confirmTitle: $("confirm-title"),
    confirmText: $("confirm-text"),
    confirmError: $("confirm-error"),
    confirmCancel: $("confirm-cancel"),
    confirmOk: $("confirm-ok"),
  };

  var dialogs = [el.linkDialog, el.sectionDialog, el.confirmDialog];

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

  function prepare(raw) {
    var categories = (raw.categories || []).map(function (c) { return { id: c.id, label: c.label }; });
    var known = new Set(categories.map(function (c) { return c.id; }));
    var needsOther = false;

    var links = (raw.links || []).reduce(function (result, link) {
      var url = parseUrl(link.url);
      if (!link.name || !url) {
        console.warn("Link ignorado (precisa de name e de url http/https):", link);
        return result;
      }
      var category = link.category;
      if (!known.has(category)) {
        category = "outros";
        needsOther = true;
      }
      var host = url.hostname.replace(/^www\./, "");
      var label = (categories.find(function (c) { return c.id === category; }) || { label: "Outros" }).label;
      var tags = Array.isArray(link.tags) ? link.tags : [];
      result.push({
        id: link.id,
        name: link.name,
        url: link.url,
        host: host,
        category: category,
        description: link.description || "",
        tags: tags,
        haystack: normalize([link.name, link.description, host, label].concat(tags).join(" ")),
      });
      return result;
    }, []);

    if (needsOther) categories.push({ id: "outros", label: "Outros", virtual: true });
    return { categories: categories, links: links };
  }

  // mode: "loading" | "live" (edição liberada) | "readonly" (cópia estática) | "error"
  var mode = "loading";
  var data = { categories: [], links: [] };
  var lastLoad = 0;
  var pins = loadPins();
  var state = { query: "", category: ALL, editing: false };

  function setData(raw) {
    data = prepare(raw);
    lastLoad = Date.now();
    var exists = data.categories.some(function (c) { return c.id === state.category; });
    if (state.category !== ALL && !exists) state.category = ALL;
  }

  function realCategories() {
    return data.categories.filter(function (c) { return !c.virtual; });
  }

  function findLink(id) {
    return data.links.find(function (l) { return l.id === id; });
  }

  function findCategory(id) {
    return data.categories.find(function (c) { return c.id === id; });
  }

  function matchesQuery(link) {
    return normalize(state.query).split(/\s+/).filter(Boolean).every(function (term) {
      return link.haystack.indexOf(term) !== -1;
    });
  }

  /* ---------- Servidor ---------- */

  function request(url, options) {
    return fetch(url, Object.assign({ cache: "no-store", headers: { Accept: "application/json" } }, options))
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) {
            var error = new Error(body.error || "O servidor respondeu com erro " + response.status + ".");
            error.status = response.status;
            throw error;
          }
          if (!Array.isArray(body.categories)) {
            var invalid = new Error("Resposta inesperada do servidor.");
            invalid.status = 500;
            throw invalid;
          }
          return body;
        });
      });
  }

  function load() {
    return request(API)
      .then(function (raw) { mode = "live"; setData(raw); })
      .catch(function (error) {
        console.warn("Edição indisponível, usando a cópia estática:", error.message);
        return request(STATIC_DATA).then(function (raw) { mode = "readonly"; setData(raw); });
      })
      .catch(function () { mode = "error"; });
  }

  function refresh() {
    if (mode !== "live") return;
    request(API).then(function (raw) {
      setData(raw);
      renderKeepingFocus();
    }).catch(function () { /* mantém o que já está na tela */ });
  }

  function mutate(payload) {
    return request(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    }).then(function (raw) {
      setData(raw);
      return raw;
    }).catch(function (error) {
      if (error.status === 404 || error.status === 409) refresh();
      throw error.status ? error : new Error("Sem conexão com o servidor. Confira a internet e tente de novo.");
    });
  }

  /* ---------- Estado na URL, para a busca poder ser compartilhada ---------- */

  function readHash() {
    var params = new URLSearchParams(location.hash.slice(1));
    var category = params.get("cat");
    state.category = findCategory(category) ? category : ALL;
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

  function iconButton(iconName, label, action, value, extraClass) {
    var button = h("button", "icon-btn" + (extraClass ? " " + extraClass : ""));
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.dataset.action = action;
    button.dataset.value = value;
    button.appendChild(icon(iconName));
    return button;
  }

  function renderCard(link, editing) {
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
    if (editing && link.id) {
      actions.append(
        iconButton("i-pencil", "Editar " + link.name, "edit-link", link.id),
        iconButton("i-trash", "Excluir " + link.name, "delete-link", link.id, "icon-btn--danger")
      );
    } else {
      var pinned = pins.has(link.url);
      var pin = iconButton("i-star", (pinned ? "Desafixar " : "Fixar ") + link.name, "pin", link.url);
      pin.setAttribute("aria-pressed", String(pinned));
      actions.append(iconButton("i-copy", "Copiar link de " + link.name, "copy", link.url), pin);
    }
    foot.append(h("span", "card__host", link.host), actions);

    card.append(main, foot);
    item.appendChild(card);
    return item;
  }

  function renderSection(opts) {
    var section = h("section", "section");
    section.dataset.section = opts.id;
    var headingId = "secao-" + opts.id;
    section.setAttribute("aria-labelledby", headingId);

    var head = h("div", "section__head");
    if (opts.icon) head.appendChild(icon(opts.icon, "section__icon"));
    var heading = h("h2", "section__title", opts.title);
    heading.id = headingId;
    head.appendChild(heading);

    var grid = h("ul", "grid");
    opts.links.forEach(function (link) { grid.appendChild(renderCard(link, opts.editable)); });

    if (opts.editable && opts.category) {
      var tools = h("div", "section__tools");
      tools.append(
        iconButton("i-pencil", "Renomear seção " + opts.title, "rename-section", opts.id),
        iconButton("i-trash", "Excluir seção " + opts.title, "delete-section", opts.id, "icon-btn--danger")
      );
      head.appendChild(tools);

      var addItem = h("li");
      var add = h("button", "add-card");
      add.type = "button";
      add.dataset.action = "add-link";
      add.dataset.value = opts.id;
      add.setAttribute("aria-label", "Adicionar link em " + opts.title);
      add.append(icon("i-plus"), "Adicionar link");
      addItem.appendChild(add);
      grid.appendChild(addItem);
    }

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

  function syncChrome() {
    var editing = isEditing();
    el.editToggle.hidden = mode !== "live";
    el.editToggle.setAttribute("aria-pressed", String(editing));
    el.editLabel.textContent = editing ? "Concluir" : "Editar";
    el.editIcon.setAttribute("href", editing ? "#i-check" : "#i-pencil");
    el.editNote.hidden = !editing;
    el.editTools.hidden = !editing;

    el.footerText.textContent = mode === "live"
      ? "Faltou algum link? Qualquer pessoa com o endereço deste site pode adicionar, editar e excluir links pelo botão Editar."
      : "A edição está indisponível agora. Os links abaixo são uma cópia salva e podem estar desatualizados.";
  }

  function isEditing() {
    return state.editing && mode === "live";
  }

  function render() {
    if (mode === "loading") return;
    syncChrome();

    if (mode === "error") {
      el.sections.replaceChildren(h("p", "status-text", "Não foi possível carregar os links. Recarregue a página."));
      el.count.textContent = "";
      el.chips.replaceChildren();
      return;
    }

    var editing = isEditing();
    var visible = data.links.filter(function (link) {
      return matchesQuery(link) && (state.category === ALL || link.category === state.category);
    });

    var sections = [];
    if (state.category === ALL && !editing) {
      var pinnedLinks = visible.filter(function (l) { return pins.has(l.url); });
      if (pinnedLinks.length) {
        sections.push(renderSection({ id: "fixados", title: "Fixados", links: pinnedLinks, icon: "i-star" }));
      }
    }
    data.categories.forEach(function (category) {
      if (state.category !== ALL && state.category !== category.id) return;
      var links = visible.filter(function (l) { return l.category === category.id; });
      var showEmpty = editing && !category.virtual && !state.query;
      if (!links.length && !showEmpty) return;
      sections.push(renderSection({
        id: category.id,
        title: category.label,
        links: links,
        editable: editing,
        category: category.virtual ? null : category,
      }));
    });
    el.sections.replaceChildren.apply(el.sections, sections);

    el.count.textContent = visible.length === 1 ? "1 link" : visible.length + " links";
    el.clear.hidden = !state.query;

    el.empty.hidden = sections.length > 0;
    if (!sections.length) {
      el.emptyTitle.textContent = state.query
        ? "Nenhum link encontrado para “" + state.query + "”"
        : data.categories.length ? "Nenhum link nesta categoria" : "Nenhuma seção ainda";
      el.emptyReset.hidden = !state.query && state.category === ALL;
    }

    renderChips();
  }

  // Redesenha a lista e devolve o foco ao mesmo botão ou link, se ele ainda existir.
  function renderKeepingFocus() {
    var active = document.activeElement;
    var selector = null;
    if (active && el.sections.contains(active)) {
      if (active.dataset.action) {
        selector = '[data-action="' + active.dataset.action + '"][data-value="' + CSS.escape(active.dataset.value) + '"]';
      } else if (active.classList.contains("card__link")) {
        selector = '.card__link[href="' + CSS.escape(active.getAttribute("href")) + '"]';
      }
    }
    render();
    if (selector) focusIn(selector);
  }

  function focusIn(selector) {
    var target = el.sections.querySelector(selector);
    if (target) target.focus();
    return target;
  }

  function update() {
    render();
    writeHash();
  }

  /* ---------- Ações de leitura ---------- */

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
    var selector = '[data-action="pin"][data-value="' + CSS.escape(url) + '"]';
    var target = el.sections.querySelector('[data-section="' + section + '"] ' + selector)
      || el.sections.querySelector(selector);
    if (target) target.focus();
  }

  /* ---------- Janelas de edição ---------- */

  function setError(node, message) {
    node.textContent = message;
    node.hidden = !message;
  }

  function anyDialogOpen() {
    return dialogs.some(function (d) { return d.open; });
  }

  function openDialog(dialog, focusTarget) {
    dialog.showModal();
    focusTarget.focus();
  }

  function setBusy(dialog, busy) {
    if (busy) dialog.dataset.busy = "1"; else delete dialog.dataset.busy;
    dialog.querySelectorAll("button, input, select").forEach(function (control) { control.disabled = busy; });
  }

  // Envia a alteração; a janela só fecha quando o servidor confirma.
  function submitChange(dialog, errorNode, payload, busyLabel, onDone) {
    var button = dialog.querySelector('[type="submit"]');
    var label = button.textContent;
    setError(errorNode, "");
    setBusy(dialog, true);
    button.textContent = busyLabel;

    function finish() {
      setBusy(dialog, false);
      button.textContent = label;
    }

    mutate(payload).then(function (raw) {
      finish();
      dialog.close();
      render();
      writeHash();
      onDone(raw);
    }).catch(function (error) {
      finish();
      setError(errorNode, error.message);
      button.focus();
    });
  }

  dialogs.forEach(function (dialog) {
    dialog.addEventListener("cancel", function (event) {
      if (dialog.dataset.busy) event.preventDefault();
    });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog && !dialog.dataset.busy) dialog.close();
    });
    dialog.querySelectorAll("[data-close]").forEach(function (button) {
      button.addEventListener("click", function () { dialog.close(); });
    });
  });

  /* Link */

  var editingLinkId = null;

  function fillCategorySelect(selected) {
    var real = realCategories();
    var options = real.map(function (c) { return new Option(c.label, c.id); });
    if (!real.some(function (c) { return c.id === selected; })) {
      options.unshift(new Option("Escolha uma seção", ""));
      selected = "";
    }
    el.fCategory.replaceChildren.apply(el.fCategory, options);
    el.fCategory.value = selected;
  }

  function openLinkDialog(link, categoryId) {
    if (!realCategories().length) {
      showToast("Crie uma seção antes de adicionar links.");
      openSectionDialog(null);
      return;
    }
    editingLinkId = link ? link.id : null;
    el.linkTitle.textContent = link ? "Editar link" : "Adicionar link";
    el.fName.value = link ? link.name : "";
    el.fUrl.value = link ? link.url : "";
    el.fDescription.value = link ? link.description : "";
    el.fTags.value = link ? link.tags.join(", ") : "";
    var fallback = state.category !== ALL ? state.category : realCategories()[0].id;
    fillCategorySelect(link ? link.category : categoryId || fallback);
    setError(el.linkError, "");
    openDialog(el.linkDialog, el.fName);
  }

  el.linkForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var name = el.fName.value.trim();
    var url = el.fUrl.value.trim();
    if (url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      url = "https://" + url;
      el.fUrl.value = url;
    }

    var problem = !name ? [el.fName, "Informe o nome do link."]
      : !parseUrl(url) ? [el.fUrl, "Informe um endereço válido, começando com https://."]
      : !el.fCategory.value ? [el.fCategory, "Escolha uma seção."]
      : null;
    if (problem) {
      setError(el.linkError, problem[1]);
      problem[0].focus();
      return;
    }

    var link = {
      name: name,
      url: url,
      category: el.fCategory.value,
      description: el.fDescription.value.trim(),
      tags: el.fTags.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean),
    };
    var editingId = editingLinkId;
    var payload = editingId ? { op: "link.update", id: editingId, link: link } : { op: "link.add", link: link };

    submitChange(el.linkDialog, el.linkError, payload, "Salvando…", function (raw) {
      var id = editingId || raw.created;
      showToast(editingId ? "Alterações salvas para todos" : "“" + name + "” adicionado para todos");
      var target = focusIn('[data-action="edit-link"][data-value="' + CSS.escape(id) + '"]');
      if (target) target.scrollIntoView({ block: "nearest" });
    });
  });

  /* Seção */

  var editingSectionId = null;

  function openSectionDialog(category) {
    editingSectionId = category ? category.id : null;
    el.sectionTitle.textContent = category ? "Renomear seção" : "Nova seção";
    el.fLabel.value = category ? category.label : "";
    setError(el.sectionError, "");
    openDialog(el.sectionDialog, el.fLabel);
  }

  el.sectionForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var label = el.fLabel.value.trim();
    if (!label) {
      setError(el.sectionError, "Informe o nome da seção.");
      el.fLabel.focus();
      return;
    }
    var editingId = editingSectionId;
    var payload = editingId ? { op: "section.update", id: editingId, label: label } : { op: "section.add", label: label };

    submitChange(el.sectionDialog, el.sectionError, payload, "Salvando…", function (raw) {
      var id = editingId || raw.created;
      showToast(editingId ? "Seção renomeada para todos" : "Seção “" + label + "” criada");
      var selector = editingId
        ? '[data-action="rename-section"][data-value="' + CSS.escape(id) + '"]'
        : '[data-action="add-link"][data-value="' + CSS.escape(id) + '"]';
      var target = focusIn(selector);
      if (target) target.scrollIntoView({ block: "nearest" });
    });
  });

  /* Confirmação de exclusão */

  var pendingDelete = null;

  function confirmDelete(title, text, payload, onDone) {
    pendingDelete = { payload: payload, onDone: onDone };
    el.confirmTitle.textContent = title;
    el.confirmText.textContent = text;
    setError(el.confirmError, "");
    openDialog(el.confirmDialog, el.confirmCancel);
  }

  el.confirmForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!pendingDelete) return;
    submitChange(el.confirmDialog, el.confirmError, pendingDelete.payload, "Excluindo…", pendingDelete.onDone);
  });

  function deleteLink(link) {
    var section = link.category;
    confirmDelete(
      "Excluir link?",
      "“" + link.name + "” vai sumir do site para todo mundo.",
      { op: "link.delete", id: link.id },
      function () {
        showToast("“" + link.name + "” excluído");
        focusIn('[data-action="add-link"][data-value="' + CSS.escape(section) + '"]');
      }
    );
  }

  function deleteSection(category) {
    var count = data.links.filter(function (l) { return l.category === category.id; }).length;
    var text = count
      ? "A seção “" + category.label + "” e " + (count === 1 ? "o link dela" : "os " + count + " links dela") + " vão sumir do site para todo mundo."
      : "A seção “" + category.label + "” vai sumir do site para todo mundo.";
    confirmDelete("Excluir seção?", text, { op: "section.delete", id: category.id }, function () {
      showToast("Seção “" + category.label + "” excluída");
      el.addSection.focus();
    });
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
    var value = button.dataset.value;
    switch (button.dataset.action) {
      case "copy": copyLink(button, value); break;
      case "pin": togglePin(button, value); break;
      case "add-link": openLinkDialog(null, value); break;
      case "edit-link": if (findLink(value)) openLinkDialog(findLink(value)); break;
      case "delete-link": if (findLink(value)) deleteLink(findLink(value)); break;
      case "rename-section": if (findCategory(value)) openSectionDialog(findCategory(value)); break;
      case "delete-section": if (findCategory(value)) deleteSection(findCategory(value)); break;
    }
  });

  el.addSection.addEventListener("click", function () { openSectionDialog(null); });

  el.editToggle.addEventListener("click", function () {
    state.editing = !state.editing;
    render();
    if (state.editing && Date.now() - lastLoad > REFRESH_AFTER) refresh();
  });

  el.themeToggle.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    writeStore(THEME_KEY, next);
    syncThemeButton();
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeButton);

  document.addEventListener("keydown", function (event) {
    if (anyDialogOpen()) return;
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
    if (mode === "loading") return;
    readHash();
    render();
  });

  // Ao voltar para a aba, busca as mudanças que outras pessoas fizeram.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && Date.now() - lastLoad > REFRESH_AFTER) refresh();
  });

  syncThemeButton();
  load().then(function () {
    readHash();
    render();
  });
})();
