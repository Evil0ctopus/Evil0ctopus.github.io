/**
 * Evil0ctopus Flash catalog (live).
 * Loads firmware/firmware-catalog.json and drives card + detail UI.
 * ESP Web Tools installs only when status=ready AND a resolvable manifest exists.
 */
(function () {
  "use strict";

  var CATALOG_URL = "firmware/firmware-catalog.json";
  var state = {
    catalog: null,
    category: "all",
    query: "",
    selectedId: null,
    manifestCache: Object.create(null),
  };

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function statusLabel(status) {
    switch (status) {
      case "ready":
        return "Ready";
      case "pending":
        return "Pending firmware";
      case "coming-soon":
        return "Coming soon";
      case "link-out":
        return "Upstream / draft";
      default:
        return status || "Unknown";
    }
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function matchesQuery(item, q) {
    if (!q) return true;
    var hay = [
      item.id,
      item.name,
      item.shortDescription,
      item.boardLabel,
      item.chipFamily,
      item.chipNote,
      item.category,
      (item.tags || []).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function filteredItems() {
    var items = (state.catalog && state.catalog.items) || [];
    var q = state.query.trim().toLowerCase();
    return items.filter(function (item) {
      if (state.category !== "all" && item.category !== state.category) return false;
      return matchesQuery(item, q);
    });
  }

  function findItem(id) {
    var items = (state.catalog && state.catalog.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function probeManifest(url, chipFamily) {
    if (!url) return Promise.resolve({ error: "No manifest URL configured." });
    if (state.manifestCache[url] !== undefined) {
      return state.manifestCache[url];
    }
    state.manifestCache[url] = fetch(url, { method: "GET", cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("Manifest HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var build = data && Array.isArray(data.builds) && data.builds.find(function (candidate) {
          return candidate.chipFamily === chipFamily;
        });
        if (!build || !Array.isArray(build.parts) || !build.parts.length) {
          throw new Error("Manifest has no firmware parts for " + chipFamily + ".");
        }
        var manifestUrl = new URL(url, document.baseURI);
        return Promise.all(build.parts.map(function (part) {
          if (!part || typeof part.path !== "string" || !part.path.trim() ||
              !Number.isSafeInteger(part.offset) || part.offset < 0) {
            throw new Error("Manifest contains an invalid firmware part.");
          }
          var binaryUrl = new URL(part.path, manifestUrl);
          return fetch(binaryUrl.href, { method: "HEAD", cache: "no-store" })
            .then(function (res) {
              var length = res.headers.get("content-length");
              if (!res.ok || (length !== null && Number(length) <= 0)) {
                throw new Error("Firmware part missing or empty: " + part.path + " (HTTP " + res.status + ").");
              }
            });
        })).then(function () {
          return { url: url };
        });
      })
      .catch(function (err) {
        console.error("Firmware availability check failed:", url, err);
        delete state.manifestCache[url];
        return { error: err.message };
      });
    return state.manifestCache[url];
  }

  function renderFilters() {
    var cats = (state.catalog && state.catalog.categories) || [];
    var html =
      '<button type="button" class="filter-chip' +
      (state.category === "all" ? " is-active" : "") +
      '" data-category="all" aria-pressed="' +
      (state.category === "all" ? "true" : "false") +
      '">All</button>';
    cats.forEach(function (c) {
      var active = state.category === c.id;
      html +=
        '<button type="button" class="filter-chip' +
        (active ? " is-active" : "") +
        '" data-category="' +
        escapeHtml(c.id) +
        '" aria-pressed="' +
        (active ? "true" : "false") +
        '">' +
        escapeHtml(c.label) +
        "</button>";
    });
    els.filters.innerHTML = html;
  }

  function renderList() {
    var items = filteredItems();
    els.count.innerHTML =
      '<strong>' +
      items.length +
      "</strong> firmware" +
      (items.length === 1 ? "" : "s") +
      (state.category !== "all" || state.query ? " matching" : " in catalog");

    if (!items.length) {
      els.list.innerHTML =
        '<li class="empty-state" role="status">No firmware matches this filter. Clear search or pick another category.</li>';
      return;
    }

    var html = "";
    items.forEach(function (item) {
      var selected = item.id === state.selectedId;
      var draft =
        (item.tags || []).indexOf("draft") !== -1 ||
        (item.tags || []).indexOf("not-wired") !== -1;
      var tagsHtml = "";
      (item.tags || []).slice(0, 4).forEach(function (t) {
        var draftClass =
          t === "draft" || t === "not-wired" || t === "third-party" ? " tag-pill--draft" : "";
        tagsHtml +=
          '<span class="tag-pill' + draftClass + '">' + escapeHtml(t) + "</span>";
      });
      var own =
        item.category === "evil0ctopus" ||
        (item.tags || []).indexOf("evil0ctopus") !== -1 ||
        (item.tags || []).indexOf("own-project") !== -1;
      html +=
        '<li><button type="button" class="firmware-card' +
        (own ? " firmware-card--own" : "") +
        (selected ? " is-selected" : "") +
        '" data-id="' +
        escapeHtml(item.id) +
        '" aria-pressed="' +
        (selected ? "true" : "false") +
        '">' +
        '<div class="firmware-card-top">' +
        '<span class="firmware-card-name">' +
        escapeHtml(item.name) +
        "</span>" +
        '<span class="status-badge status-badge--' +
        escapeHtml(item.status) +
        '">' +
        escapeHtml(statusLabel(item.status)) +
        "</span>" +
        "</div>" +
        '<p class="firmware-card-desc">' +
        escapeHtml(item.shortDescription) +
        "</p>" +
        '<div class="firmware-card-meta">' +
        '<span class="chip-badge" title="' +
        escapeHtml(item.chipNote || item.chipFamily) +
        '">' +
        escapeHtml(item.chipFamily) +
        "</span>" +
        (draft ? '<span class="tag-pill tag-pill--draft">draft</span>' : "") +
        tagsHtml +
        "</div>" +
        "</button></li>";
    });
    els.list.innerHTML = html;
  }

  function setInstallVisibility(mode) {
    // mode: ready | pending | soon | linkout | none
    els.espHost.hidden = mode !== "ready";
    els.btnDisabled.hidden = mode !== "pending" && mode !== "soon";
    els.btnLinkOut.hidden = mode !== "linkout";
    if (mode === "pending") {
      els.btnDisabled.textContent = "Connect & install (waiting on firmware)";
    } else if (mode === "soon") {
      els.btnDisabled.textContent = "Coming soon";
    }
  }

  function renderDetail(item) {
    if (!item) {
      els.detail.innerHTML =
        '<div class="detail-placeholder">Select a firmware card to inspect install options, chip family, and authorized-use notes.</div>';
      // re-bind action hosts that live inside detail — recreate structure
      els.detail.innerHTML =
        '<p class="detail-kicker">Flash hub · detail</p>' +
        '<div class="detail-placeholder">Select a firmware card to inspect install options, chip family, and authorized-use notes.</div>' +
        '<div id="detail-body" hidden></div>';
      return;
    }

    var auth =
      item.authorizedUseNote ||
      (state.catalog.defaults && state.catalog.defaults.authorizedUseNote) ||
      "";
    var repo = item.repoUrl || item.upstreamUrl || "";
    var upstream = item.upstreamUrl || repo;

    els.detail.innerHTML =
      '<p class="detail-kicker">Selected firmware</p>' +
      '<h2 class="detail-title" id="detail-heading">' +
      escapeHtml(item.name) +
      "</h2>" +
      '<div class="detail-chips">' +
      '<span class="chip-badge">' +
      escapeHtml(item.chipFamily) +
      "</span>" +
      '<span class="status-badge status-badge--' +
      escapeHtml(item.status) +
      '">' +
      escapeHtml(statusLabel(item.status)) +
      "</span>" +
      '<span class="tag-pill">' +
      escapeHtml(item.category) +
      "</span>" +
      '<span class="tag-pill">' +
      escapeHtml(item.mcuFamily) +
      " · " +
      escapeHtml(item.installMethod) +
      "</span>" +
      "</div>" +
      '<p class="detail-blurb">' +
      escapeHtml(item.shortDescription) +
      "</p>" +
      "<dl class=\"detail-dl\">" +
      "<dt>Board</dt><dd>" +
      escapeHtml(item.boardLabel) +
      "</dd>" +
      "<dt>Chip</dt><dd>" +
      escapeHtml(item.chipNote || item.chipFamily) +
      "</dd>" +
      "<dt>License</dt><dd>" +
      escapeHtml(item.license || "See upstream") +
      "</dd>" +
      (item.version ? "<dt>Build</dt><dd>" + escapeHtml(item.version) + "</dd>" : "") +
      (item.sourceCommit && repo
        ? '<dt>Revision</dt><dd><a href="' + escapeHtml(repo + "/commit/" + item.sourceCommit) +
          '" rel="noopener noreferrer" target="_blank">' + escapeHtml(item.sourceCommit.slice(0, 7)) + "</a></dd>"
        : "") +
      (repo
        ? "<dt>Source</dt><dd><a href=\"" +
          escapeHtml(repo) +
          "\" rel=\"noopener noreferrer\" target=\"_blank\">" +
          escapeHtml(repo.replace(/^https?:\/\//, "")) +
          "</a></dd>"
        : "") +
      "</dl>" +
      '<p class="detail-auth" role="note"><strong>Authorized use.</strong> ' +
      escapeHtml(auth) +
      "</p>" +
      (item.installSteps && item.installSteps.length
        ? '<section class="detail-setup" aria-label="Installation and first boot"><h3>Installation &amp; first boot</h3><ol>' +
          item.installSteps.map(function (step) { return "<li>" + escapeHtml(step) + "</li>"; }).join("") +
          "</ol></section>"
        : "") +
      '<div class="detail-actions" id="detail-actions">' +
      '<div id="esp-install-host" class="esp-install-host" hidden>' +
      '<esp-web-install-button id="esp-install" class="esp-install">' +
      '<button type="button" slot="activate" class="btn btn-primary">Connect &amp; install</button>' +
      '<span slot="unsupported" class="flash-slot-msg">Web Serial unavailable — use Chrome or Edge on desktop.</span>' +
      '<span slot="not-allowed" class="flash-slot-msg">Flashing needs HTTPS or localhost.</span>' +
      "</esp-web-install-button>" +
      "</div>" +
      '<button type="button" id="btn-install-disabled" class="btn btn-primary" disabled aria-disabled="true" hidden>Coming soon</button>' +
      '<a id="btn-link-out" class="btn btn-secondary" href="#" rel="noopener noreferrer" target="_blank" hidden>Open upstream installer</a>' +
      (upstream
        ? '<a class="btn btn-ghost" href="' +
          escapeHtml(upstream) +
          '" rel="noopener noreferrer" target="_blank">Project / docs</a>'
        : "") +
      (item.downloadUrl
        ? '<a class="btn btn-ghost" href="' + escapeHtml(item.downloadUrl) + '" download>Download manifest</a>'
        : "") +
      (item.buildInfoUrl
        ? '<a class="btn btn-ghost" href="' + escapeHtml(item.buildInfoUrl) +
          '" rel="noopener noreferrer" target="_blank">Build details / SHA-256</a>'
        : "") +
      "</div>" +
      '<p class="detail-hint" id="detail-hint"></p>';

    // refresh element refs after re-render
    els.espHost = $("esp-install-host");
    els.espInstall = $("esp-install");
    els.btnDisabled = $("btn-install-disabled");
    els.btnLinkOut = $("btn-link-out");
    els.hint = $("detail-hint");

    updateActions(item);
  }

  function updateActions(item) {
    var hint = els.hint;
    var method = item.installMethod;
    var status = item.status;

    if (status === "link-out" || method === "link-out") {
      setInstallVisibility("linkout");
      if (els.btnLinkOut) {
        els.btnLinkOut.href = item.upstreamUrl || item.repoUrl || "#";
        els.btnLinkOut.hidden = !(item.upstreamUrl || item.repoUrl);
      }
      hint.textContent =
        "Draft catalog entry — not wired to a local ESP Web Tools manifest. Opens the upstream installer / page.";
      return;
    }

    if (status === "coming-soon" || method === "coming-soon") {
      setInstallVisibility("soon");
      hint.textContent =
        "Packaging for browser install is not published yet. Watch the GitHub repo for releases.";
      return;
    }

    if (method === "uf2") {
      setInstallVisibility("soon");
      hint.textContent =
        "UF2 install path reserved for future non-ESP MCU families. Not active in v1.";
      return;
    }

    // ESP Web Tools: Install only when status=ready AND a valid manifest exists
    if (method === "esp-web-tools") {
      setInstallVisibility("pending");
      hint.textContent = "Checking manifest and firmware files…";
      var installElement = els.espInstall;
      probeManifest(item.manifestUrl, item.chipFamily).then(function (result) {
        if (state.selectedId !== item.id || els.espInstall !== installElement) return;
        if (status === "ready" && result.url) {
          setInstallVisibility("ready");
          if (els.espInstall) {
            els.espInstall.setAttribute("manifest", result.url);
          }
          hint.textContent =
            "Chrome or Edge · connect board over USB · then Connect & install. Manifest: " +
            result.url;
          return;
        }
        setInstallVisibility("pending");
        if (els.espInstall) els.espInstall.removeAttribute("manifest");
        if (status === "ready" && !result.url) {
          hint.textContent =
            "Install unavailable: " + result.error + " Select this firmware again to retry.";
        } else {
          hint.textContent =
            "Install stays inactive until status=ready and a published manifest exists" +
            (item.manifestUrl ? " at " + item.manifestUrl : "") +
            ".";
        }
      });
      return;
    }

    setInstallVisibility("soon");
    hint.textContent = "No install action configured for this entry.";
  }

  function selectItem(id) {
    if (!findItem(id)) return;
    state.selectedId = id;
    history.replaceState(null, "", "#" + encodeURIComponent(id));
    renderList();
    renderDetail(findItem(id));
  }

  function selectFromHash() {
    var id;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch (err) {
      console.warn("Invalid firmware link:", err);
      return false;
    }
    if (!findItem(id)) return false;
    state.category = "all";
    state.query = "";
    els.search.value = "";
    renderFilters();
    selectItem(id);
    return true;
  }

  function bindEvents() {
    window.addEventListener("hashchange", selectFromHash);
    els.filters.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-category]");
      if (!btn) return;
      state.category = btn.getAttribute("data-category") || "all";
      renderFilters();
      renderList();
    });

    els.search.addEventListener("input", function () {
      state.query = els.search.value || "";
      renderList();
    });

    els.list.addEventListener("click", function (e) {
      var card = e.target.closest(".firmware-card[data-id]");
      if (!card) return;
      selectItem(card.getAttribute("data-id"));
    });
  }

  function initDom() {
    els.filters = $("catalog-filters");
    els.search = $("catalog-search");
    els.list = $("firmware-list");
    els.count = $("catalog-count");
    els.detail = $("catalog-detail");
    els.loadError = $("catalog-load-error");
  }

  function boot() {
    initDom();
    bindEvents();
    fetch(CATALOG_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        state.catalog = data;
        renderFilters();
        if (selectFromHash()) return;
        var first = (data.items || []).find(function (item) { return item.status === "ready"; }) ||
          (data.items && data.items[0]) || null;
        if (first) state.selectedId = first.id;
        renderList();
        renderDetail(first);
        if (els.loadError) els.loadError.hidden = true;
      })
      .catch(function (err) {
        console.error(err);
        if (els.loadError) {
          els.loadError.hidden = false;
          els.loadError.textContent =
            "Could not load firmware/firmware-catalog.json.";
        }
        els.list.innerHTML =
          '<li class="empty-state">Catalog failed to load.</li>';
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
