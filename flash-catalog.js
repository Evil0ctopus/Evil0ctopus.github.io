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
    compareIds: [],
    demoStep: -1,
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
        return "Install not ready here";
      case "coming-soon":
        return "Not available yet";
      case "link-out":
        return "Separate project";
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
          if (binaryUrl.origin !== manifestUrl.origin) {
            throw new Error("Firmware parts must be hosted with the manifest.");
          }
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
        '<li><div class="firmware-list-row"><button type="button" class="firmware-card' +
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
        "</button><label class=\"compare-toggle\"><input type=\"checkbox\" data-compare-id=\"" +
        escapeHtml(item.id) +
        "\"" +
        (state.compareIds.indexOf(item.id) !== -1 ? " checked" : "") +
        (state.compareIds.length >= 3 && state.compareIds.indexOf(item.id) === -1 ? " disabled" : "") +
        "><span>Compare</span></label></div></li>";
    });
    els.list.innerHTML = html;
  }

  function renderFinder() {
    var html = '<option value="">Browse all boards</option>';
    (state.catalog.items || []).forEach(function (item) {
      html +=
        '<option value="' +
        escapeHtml(item.id) +
        '">' +
        escapeHtml(item.boardLabel || item.name) +
        " · " +
        escapeHtml(item.chipFamily || "Unknown chip") +
        "</option>";
    });
    els.finder.innerHTML = html;
  }

  function hardwareProfile(item) {
    var profile = item.hardwareProfile || {};
    return {
      model: profile.model || item.boardLabel || "Not specified",
      chip: profile.chip || item.chipNote || item.chipFamily || "Not specified",
      display: profile.display || "Not specified",
      usb: profile.usb || "Not specified",
      flash: profile.flash || "Not specified",
      tested: (item.hardwareVerification || state.catalog.defaults.hardwareVerification || {}).label || "Verification status not recorded",
    };
  }

  function renderCompare() {
    var items = state.compareIds.map(findItem).filter(Boolean);
    els.compare.hidden = items.length < 2;
    if (items.length < 2) {
      els.compareTable.innerHTML = "";
      return;
    }

    var rows = [
      ["Board", function (item) { return hardwareProfile(item).model; }],
      ["Chip", function (item) { return hardwareProfile(item).chip; }],
      ["Display", function (item) { return hardwareProfile(item).display; }],
      ["USB", function (item) { return hardwareProfile(item).usb; }],
      ["Flash notes", function (item) { return hardwareProfile(item).flash; }],
      ["Tested on", function (item) { return Array.isArray(item.testedOn) && item.testedOn.length ? item.testedOn.join(", ") : "No hardware test recorded"; }],
      ["Install status", function (item) { return statusLabel(item.status); }],
      ["Hardware verification", function (item) { return hardwareProfile(item).tested; }],
      ["Local release", function (item) { return item.latestRelease || "No local release published"; }],
    ];
    var html = '<table class="compare-table"><thead><tr><th scope="col">Specification</th>';
    items.forEach(function (item) {
      html += '<th scope="col">' + escapeHtml(item.name) + "</th>";
    });
    html += "</tr></thead><tbody>";
    rows.forEach(function (row) {
      html += "<tr><th scope=\"row\">" + escapeHtml(row[0]) + "</th>";
      items.forEach(function (item) {
        html += "<td>" + escapeHtml(row[1](item)) + "</td>";
      });
      html += "</tr>";
    });
    els.compareTable.innerHTML = html + "</tbody></table>";
  }

  function setInstallVisibility(mode) {
    // mode: ready | pending | soon | linkout | none
    els.espHost.hidden = mode !== "ready";
    els.btnDisabled.hidden = mode !== "pending" && mode !== "soon";
    els.btnLinkOut.hidden = mode !== "linkout";
    if (mode === "pending") {
      els.btnDisabled.textContent = "Install not available here yet";
    } else if (mode === "soon") {
      els.btnDisabled.textContent = "Not available yet";
    }
  }

  function renderHardwarePassport(item) {
    var profile = hardwareProfile(item);
    var verification = item.hardwareVerification || state.catalog.defaults.hardwareVerification || {};
    var testedOn = Array.isArray(item.testedOn) ? item.testedOn : [];
    var gallery = Array.isArray(item.gallery) ? item.gallery[0] : null;
    var visual = gallery
      ? '<figure class="board-visual"><img src="' +
        escapeHtml(gallery.src) +
        '" alt="' +
        escapeHtml(gallery.alt || "Firmware screen preview") +
        '" loading="lazy" decoding="async"><figcaption>' +
        escapeHtml(gallery.caption || "Project image") +
        "</figcaption></figure>"
      : '<p class="board-visual-empty">No verified board image is recorded for this entry.</p>';

    return (
      '<section class="hardware-passport" aria-labelledby="passport-heading">' +
      '<div class="passport-heading-row"><div><p class="detail-kicker">Compatibility passport</p>' +
      '<h3 id="passport-heading">Hardware details</h3></div>' +
      '<span class="verification-badge verification-badge--unverified">' +
      escapeHtml(verification.label || "Hardware verification not recorded") +
      "</span></div>" +
      '<dl class="passport-grid">' +
      '<dt>Exact model</dt><dd>' + escapeHtml(profile.model) + "</dd>" +
      '<dt>Chip</dt><dd>' + escapeHtml(profile.chip) + "</dd>" +
      '<dt>Display</dt><dd>' + escapeHtml(profile.display) + "</dd>" +
      '<dt>USB / flash</dt><dd>' + escapeHtml(profile.usb) + " · " + escapeHtml(profile.flash) + "</dd>" +
      '<dt>Tested on</dt><dd>' + escapeHtml(testedOn.length ? testedOn.join(", ") : "No hardware test recorded") + "</dd>" +
      "</dl>" +
      visual +
      '<p class="verification-note">' +
      escapeHtml(verification.note || "Verify the exact board revision against upstream documentation before installing.") +
      "</p></section>"
    );
  }

  function renderReleaseDetails(item) {
    var release = item.latestRelease || {};
    var releasesUrl = item.releaseHistoryUrl || (item.repoUrl ? item.repoUrl.replace(/\/$/, "") + "/releases" : "");
    var releaseUrl = release.releaseUrl || releasesUrl;
    var history = Array.isArray(item.releaseHistory) ? item.releaseHistory : [];
    var historyHtml = history.length
      ? '<ol class="release-history">' + history.map(function (entry) {
          return '<li><strong>' + escapeHtml(entry.version || "Version") + "</strong> · " +
            escapeHtml(entry.date || "Date not recorded") +
            (entry.assetUrl ? ' · <a href="' + escapeHtml(entry.assetUrl) + '" target="_blank" rel="noopener noreferrer" data-upstream-confirm data-firmware-download>Firmware asset</a>' : "") +
            (entry.notes ? '<span>' + escapeHtml(entry.notes) + "</span>" : "") +
            "</li>";
        }).join("") + "</ol>"
      : '<p class="release-empty">' +
        (item.latestRelease ? "No earlier local releases are recorded." : "No local firmware release is published for this entry yet.") +
        "</p>";

    return (
      '<section class="release-passport" aria-labelledby="release-heading">' +
      '<div class="passport-heading-row"><div><p class="detail-kicker">Release record</p>' +
      '<h3 id="release-heading">Firmware history</h3></div>' +
      (releaseUrl ? '<a class="release-history-link" href="' + escapeHtml(releaseUrl) + '" target="_blank" rel="noopener noreferrer">Latest release</a>' : "") +
      "</div>" +
      '<dl class="release-grid">' +
      '<dt>Version</dt><dd>' + escapeHtml(release.version || "Not published") + "</dd>" +
      '<dt>Built</dt><dd>' + escapeHtml(release.builtAt || "Not recorded") + "</dd>" +
      '<dt>Source commit</dt><dd><code>' + escapeHtml(release.commit || "Not recorded") + "</code></dd>" +
      '<dt>SHA-256</dt><dd><code>' + escapeHtml(release.sha256 || "Not recorded") + "</code></dd>" +
      '<dt>Image / offset</dt><dd>' + escapeHtml(release.assetKind || "Not recorded") + " · " + escapeHtml(release.flashOffset || "Not recorded") + "</dd>" +
      "</dl>" +
      '<p class="release-explainer">The SHA-256 code is a file fingerprint you can compare to confirm a download was not changed.</p>' +
      (release.downloadUrl ? '<a class="release-download" href="' + escapeHtml(release.downloadUrl) + '" target="_blank" rel="noopener noreferrer" download data-upstream-confirm data-firmware-download>Download latest firmware</a>' : "") +
      (releasesUrl ? '<a class="release-history-link release-all-link" href="' + escapeHtml(releasesUrl) + '" target="_blank" rel="noopener noreferrer">All releases</a>' : "") +
      historyHtml + "</section>"
    );
  }

  function renderPreflight(item) {
    if (item.installMethod !== "esp-web-tools") return "";
    return (
      '<details class="preflight-panel"><summary>Pre-flash checklist</summary>' +
      '<p>Check each box before connecting your device.</p>' +
      '<label><input type="checkbox" data-preflight> The name and screen on my device match the details above.</label>' +
      '<label><input type="checkbox" data-preflight> This is my device, or I have permission to change its software.</label>' +
      '<label><input type="checkbox" data-preflight> I saved anything important; installation may erase the device.</label>' +
      '<label><input type="checkbox" data-preflight> I am on a computer using Chrome or Edge and a USB data cable.</label>' +
      '<p id="preflight-status" class="preflight-status" role="status" aria-live="polite">Complete each check to enable installation.</p>' +
      "</details>"
    );
  }

  function updatePreflight() {
    var checks = els.detail.querySelectorAll("[data-preflight]");
    var ready = checks.length > 0;
    checks.forEach(function (check) {
      if (!check.checked) ready = false;
    });
    var activate = els.espInstall && els.espInstall.querySelector('[slot="activate"]');
    var status = $("preflight-status");
    if (activate) activate.disabled = !ready;
    if (status) {
      status.textContent = ready
        ? "Checks complete. You can continue with the browser installer."
        : "Complete each check to enable installation.";
    }
  }

  function renderDemo() {
    var steps = els.demoPanel.querySelectorAll("#demo-steps li");
    steps.forEach(function (step, index) {
      step.classList.toggle("is-complete", index < state.demoStep);
      step.classList.toggle("is-current", index === state.demoStep);
    });
    var messages = [
      "Step 1 of 3: Check the selected device name. No device is connected.",
      "Step 2 of 3: Imagine choosing a USB device. This preview does not open a device picker.",
      "Step 3 of 3: Preview complete. Nothing was connected, erased, or changed.",
    ];
    els.demoStatus.textContent = messages[state.demoStep] || messages[0];
    els.demoNext.textContent = state.demoStep >= 2 ? "Close demo" : "Next demo step";
  }

  function renderDetail(item) {
    if (!item) {
      els.detail.innerHTML =
        '<div class="detail-placeholder">Choose a device name to see its match notes, release files, and next steps.</div>';
      // re-bind action hosts that live inside detail — recreate structure
      els.detail.innerHTML =
        '<p class="detail-kicker">Flash hub · detail</p>' +
        '<div class="detail-placeholder">Choose a device name to see its match notes, release files, and next steps.</div>' +
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
      renderHardwarePassport(item) +
      renderReleaseDetails(item) +
      '<p class="detail-auth" role="note"><strong>Authorized use.</strong> ' +
      escapeHtml(auth) +
      "</p>" +
      (item.installSteps && item.installSteps.length
        ? '<section class="detail-setup" aria-label="Installation and first boot"><h3>Installation &amp; first boot</h3><ol>' +
          item.installSteps.map(function (step) { return "<li>" + escapeHtml(step) + "</li>"; }).join("") +
          "</ol></section>"
        : "") +
      renderPreflight(item) +
      '<div class="detail-actions" id="detail-actions">' +
      '<div id="esp-install-host" class="esp-install-host" hidden>' +
      '<esp-web-install-button id="esp-install" class="esp-install">' +
      '<button type="button" slot="activate" class="btn btn-primary" disabled>Connect &amp; install</button>' +
      '<span slot="unsupported" class="flash-slot-msg">Web Serial unavailable — use Chrome or Edge on desktop.</span>' +
      '<span slot="not-allowed" class="flash-slot-msg">Flashing needs HTTPS or localhost.</span>' +
      "</esp-web-install-button>" +
      "</div>" +
      '<button type="button" id="btn-install-disabled" class="btn btn-primary" disabled aria-disabled="true" hidden>Install not available here yet</button>' +
      '<a id="btn-link-out" class="btn btn-secondary" href="#" rel="noopener noreferrer" target="_blank" data-upstream-confirm hidden>Review upstream installer</a>' +
      '<button type="button" id="btn-demo" class="btn btn-ghost" aria-expanded="false" aria-controls="demo-panel">Preview demo</button>' +
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
      '<p class="detail-hint" id="detail-hint"></p>' +
      '<section id="demo-panel" class="demo-panel" aria-labelledby="demo-heading" hidden>' +
      '<p class="demo-kicker">SIMULATION ONLY · NO USB ACCESS · NO FLASHING</p>' +
      '<h3 id="demo-heading">Practice the install flow</h3>' +
      '<ol id="demo-steps"><li>Confirm the selected board identity.</li><li>Simulate choosing a serial port.</li><li>Review a simulated completion state.</li></ol>' +
      '<p id="demo-status" role="status" aria-live="polite">This preview never requests a serial port and never writes firmware.</p>' +
      '<button type="button" id="demo-next" class="btn btn-secondary">Start demo</button>' +
      "</section>";

    // refresh element refs after re-render
    els.espHost = $("esp-install-host");
    els.espInstall = $("esp-install");
    els.btnDisabled = $("btn-install-disabled");
    els.btnLinkOut = $("btn-link-out");
    els.btnDemo = $("btn-demo");
    els.demoPanel = $("demo-panel");
    els.demoStatus = $("demo-status");
    els.demoNext = $("demo-next");
    els.hint = $("detail-hint");

    state.demoStep = -1;
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
        "This firmware belongs to a separate project and will not install through this page. Check that project's device instructions before continuing.";
      return;
    }

    if (status === "coming-soon" || method === "coming-soon") {
      setInstallVisibility("soon");
      hint.textContent =
        "A browser install file is not available here yet. Open Project / docs to check for a manual download.";
      return;
    }

    if (method === "uf2") {
      setInstallVisibility("soon");
      hint.textContent =
        "This device uses a different install method that this page does not support yet. Open Project / docs for instructions.";
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
          updatePreflight();
          hint.textContent =
            "Install file found. Use desktop Chrome or Edge on this secure page and complete the checklist before connecting.";
          return;
        }
        setInstallVisibility("pending");
        if (els.espInstall) els.espInstall.removeAttribute("manifest");
        if (status === "ready" && !result.url) {
          hint.textContent =
            "Install unavailable: " + result.error + " Select this firmware again to retry.";
        } else {
          hint.textContent =
            "This site does not have an install file for this device yet. You can still review its release files and project instructions below.";
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
    els.finder.value = id;
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

    els.list.addEventListener("change", function (e) {
      var checkbox = e.target.closest("input[data-compare-id]");
      if (!checkbox) return;
      var id = checkbox.getAttribute("data-compare-id");
      if (checkbox.checked) {
        if (state.compareIds.length >= 3) {
          checkbox.checked = false;
          return;
        }
        if (state.compareIds.indexOf(id) === -1) state.compareIds.push(id);
      } else {
        state.compareIds = state.compareIds.filter(function (compareId) { return compareId !== id; });
      }
      renderList();
      renderCompare();
    });

    els.finder.addEventListener("change", function () {
      var item = findItem(els.finder.value);
      if (!item) {
        els.finderStatus.textContent = "Select a board to open its passport.";
        return;
      }
      state.category = "all";
      state.query = "";
      els.search.value = "";
      renderFilters();
      selectItem(item.id);
      els.finderStatus.textContent = "Showing catalog details for " + item.boardLabel + ". Check its exact revision before installing.";
    });

    els.compareClear.addEventListener("click", function () {
      state.compareIds = [];
      renderList();
      renderCompare();
    });

    els.detail.addEventListener("change", function (e) {
      if (e.target.matches("[data-preflight]")) updatePreflight();
    });

    els.detail.addEventListener("click", function (e) {
      var upstreamLink = e.target.closest("[data-upstream-confirm]");
      if (upstreamLink) {
        e.preventDefault();
        els.upstreamContinue.href = upstreamLink.href;
        var isFirmwareDownload = upstreamLink.hasAttribute("data-firmware-download");
        $("upstream-dialog-title").textContent = isFirmwareDownload ? "Download upstream firmware?" : "Open upstream firmware?";
        $("upstream-dialog-copy").textContent = isFirmwareDownload
          ? "This file is hosted by the upstream project, not this site. Verify the exact board revision, image type, and checksum before using it; a mismatched image can make a board unusable."
          : "This draft entry is not wired to the local installer. Review the upstream project's board support and instructions before flashing.";
        els.upstreamContinue.textContent = isFirmwareDownload ? "Continue to firmware file" : "Review upstream project";
        els.upstreamDialog.showModal();
        return;
      }

      if (e.target.closest("#btn-demo")) {
        state.demoStep = 0;
        els.demoPanel.hidden = false;
        els.btnDemo.setAttribute("aria-expanded", "true");
        renderDemo();
        return;
      }

      if (e.target.closest("#demo-next")) {
        if (state.demoStep >= 2) {
          state.demoStep = -1;
          els.demoPanel.hidden = true;
          els.btnDemo.setAttribute("aria-expanded", "false");
          return;
        }
        state.demoStep++;
        renderDemo();
      }
    });

    els.upstreamCancel.addEventListener("click", function () {
      els.upstreamDialog.close();
    });
    els.upstreamContinue.addEventListener("click", function () {
      els.upstreamDialog.close();
    });
  }

  function initDom() {
    els.filters = $("catalog-filters");
    els.search = $("catalog-search");
    els.list = $("firmware-list");
    els.count = $("catalog-count");
    els.detail = $("catalog-detail");
    els.loadError = $("catalog-load-error");
    els.finder = $("board-finder-select");
    els.finderStatus = $("board-finder-status");
    els.compare = $("compare-panel");
    els.compareTable = $("compare-table-wrap");
    els.compareClear = $("compare-clear");
    els.upstreamDialog = $("upstream-dialog");
    els.upstreamContinue = $("upstream-continue");
    els.upstreamCancel = $("upstream-cancel");
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
        renderFinder();
        renderCompare();
        if (selectFromHash()) return;
        var first = (data.items || []).find(function (item) { return item.status === "ready"; }) ||
          (data.items && data.items[0]) || null;
        if (first) state.selectedId = first.id;
        if (first) els.finder.value = first.id;
        renderList();
        renderCompare();
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
