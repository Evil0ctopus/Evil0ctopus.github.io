const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "flash-catalog.js"), "utf8");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "firmware", "firmware-catalog.json")));
const weather = catalog.items.find((item) => item.id === "cores3_weather_console");
const manifestPath = path.join(root, weather.manifestUrl);
const manifest = JSON.parse(fs.readFileSync(manifestPath));

function response(data, status = 200, length = "100") {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    headers: { get: () => length },
  };
}

async function boot({ hash = "", manifestData = manifest, binaryStatus = 200, binaryLength = "100", catalogData = catalog } = {}) {
  const elements = new Map();
  const listeners = {};
  const requests = [];
  const checks = Array.from({ length: 4 }, () => ({ checked: false }));
  const activate = { disabled: true };
  function getElement(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        hidden: true,
        value: "",
        innerHTML: "",
        textContent: "",
        attributes: {},
        addEventListener(event, callback) { listeners[id + ":" + event] = callback; },
        setAttribute(name, value) { this.attributes[name] = value; },
        removeAttribute(name) { delete this.attributes[name]; },
        querySelectorAll() { return checks; },
        querySelector() { return activate; },
      });
    }
    return elements.get(id);
  }
  const location = { hash };
  vm.runInNewContext(script, {
    document: {
      readyState: "complete",
      baseURI: "https://example.test/flash.html",
      getElementById: getElement,
    },
    window: { addEventListener(event, callback) { listeners[event] = callback; } },
    location,
    history: { replaceState(_state, _title, value) { location.hash = value; } },
    console: { error() {}, warn() {} },
    URL, Promise, Number,
    fetch: async (url, options) => {
      requests.push({ url, method: options.method || "GET" });
      if (url === "firmware/firmware-catalog.json") return response(catalogData);
      if (url === weather.manifestUrl) return response(manifestData);
      if (url === "firmware/Pocket-Pirate-CYD/manifest.json") {
        return response(JSON.parse(fs.readFileSync(path.join(root, url))));
      }
      if (options.method === "HEAD") return response(null, binaryStatus, binaryLength);
      return response(null, 404);
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { getElement, requests, listeners, location, checks, activate };
}

test("Weather Atlas defaults to ready and checks every published firmware part", async () => {
  const app = await boot();
  assert.match(app.getElement("catalog-detail").innerHTML, /Weather Atlas/);
  assert.match(app.getElement("catalog-detail").innerHTML, /Installation &amp; first boot/);
  assert.equal(app.getElement("esp-install-host").hidden, false);
  assert.equal(app.getElement("esp-install").attributes.manifest, weather.manifestUrl);
  assert.equal(app.requests.filter((request) => request.method === "HEAD").length, 5);
  assert.ok(app.requests.some((request) => request.url.endsWith("/cores3_weather_console/spiffs.bin")));
});

test("project deep links select Weather Atlas directly", async () => {
  const app = await boot({ hash: "#cores3_weather_console" });
  assert.equal(app.location.hash, "#cores3_weather_console");
  assert.equal(app.getElement("esp-install-host").hidden, false);
});

test("pending and coming-soon projects remain disabled", async () => {
  const catalogData = structuredClone(catalog);
  const pocket = catalogData.items.find((item) => item.id === "Pocket-Pirate-CYD");
  pocket.status = "coming-soon";
  pocket.installMethod = "coming-soon";
  for (const id of ["wigglefish", "Pocket-Pirate-CYD"]) {
    const app = await boot({ hash: "#" + id, catalogData });
    assert.equal(app.getElement("esp-install-host").hidden, true);
    assert.equal(app.getElement("btn-install-disabled").hidden, false);
    assert.equal(app.getElement("esp-install").attributes.manifest, undefined);
  }
});

test("ready installers require the preserved pre-flash checklist", async () => {
  for (const id of ["cores3_weather_console", "Pocket-Pirate-CYD"]) {
    const app = await boot({ hash: "#" + id });
    assert.equal(app.getElement("esp-install-host").hidden, false);
    assert.equal(app.activate.disabled, true);
    app.checks.forEach((check) => { check.checked = true; });
    app.listeners["catalog-detail:change"]({ target: { matches: () => true } });
    assert.equal(app.activate.disabled, false);
    app.checks[0].checked = false;
    app.listeners["catalog-detail:change"]({ target: { matches: () => true } });
    assert.equal(app.activate.disabled, true);
  }
});

test("third-party entries still link out without a local installer", async () => {
  const app = await boot({ hash: "#cyd-aura" });
  assert.equal(app.getElement("esp-install-host").hidden, true);
  assert.equal(app.getElement("btn-link-out").hidden, false);
});

test("wrong chip, empty parts and invalid offsets cannot enable installation", async () => {
  for (const build of [
    { chipFamily: "ESP32", parts: manifest.builds[0].parts },
    { chipFamily: "ESP32-S3", parts: [] },
    { chipFamily: "ESP32-S3", parts: [{ path: "firmware.bin", offset: -1 }] },
  ]) {
    const app = await boot({ manifestData: { builds: [build] } });
    assert.equal(app.getElement("esp-install-host").hidden, true);
    assert.match(app.getElement("detail-hint").textContent, /Install unavailable/);
  }
});

test("missing or empty binaries keep installation disabled with an explicit error", async () => {
  for (const options of [{ binaryStatus: 404 }, { binaryLength: "0" }]) {
    const app = await boot(options);
    assert.equal(app.getElement("esp-install-host").hidden, true);
    assert.match(app.getElement("detail-hint").textContent, /missing or empty/);
  }
});

test("malformed and unknown hashes safely fall back to the ready project", async () => {
  for (const hash of ["#%ZZ", "#unknown"]) {
    const app = await boot({ hash });
    assert.equal(app.getElement("esp-install-host").hidden, false);
  }
});

test("hash navigation selects a different project and clears catalog filters", async () => {
  const app = await boot();
  app.getElement("catalog-search").value = "weather";
  app.listeners["catalog-search:input"]();
  app.location.hash = "#wigglefish";
  app.listeners.hashchange();
  assert.equal(app.getElement("catalog-search").value, "");
  assert.match(app.getElement("catalog-detail").innerHTML, /wigglefish/);
  assert.equal(app.getElement("esp-install-host").hidden, true);
});

test("release parts are nonempty, fit actual partitions, and match recorded SHA-256 hashes", () => {
  const folder = path.dirname(manifestPath);
  const info = JSON.parse(fs.readFileSync(path.join(folder, "build-info.json")));
  assert.equal(info.sourceCommit, weather.sourceCommit);
  assert.equal(info.version, manifest.version);
  assert.equal(weather.version, manifest.version);
  assert.equal(weather.latestRelease.version, manifest.version);
  assert.equal(weather.latestRelease.commit, info.sourceCommit);
  assert.equal(weather.latestRelease.builtAt, info.builtAt);
  assert.equal(weather.latestRelease.sha256, info.files["firmware.bin"].sha256);
  const firmware = fs.readFileSync(path.join(folder, "firmware.bin"));
  assert.ok(firmware.includes(Buffer.from(info.sourceCommit.slice(0, 7))),
    "Application must contain the recorded source revision, not just updated metadata");
  const partitions = fs.readFileSync(path.join(folder, "partitions.bin"));
  const ranges = [];
  for (let offset = 0; partitions.readUInt16LE(offset) === 0x50aa; offset += 32) {
    ranges.push({
      offset: partitions.readUInt32LE(offset + 4),
      size: partitions.readUInt32LE(offset + 8),
      label: partitions.subarray(offset + 12, offset + 28).toString().replace(/\0.*$/, ""),
    });
  }
  const app = ranges.find((part) => part.label === "app0");
  const spiffs = ranges.find((part) => part.label === "spiffs");
  assert.ok(app && spiffs);
  let end = 0;
  for (const part of manifest.builds[0].parts) {
    const binary = fs.readFileSync(path.join(folder, part.path));
    assert.ok(binary.length > 0);
    assert.ok(part.offset >= end, part.path + " overlaps previous part");
    end = part.offset + binary.length;
    assert.ok(end <= 16 * 1024 * 1024);
    assert.equal(crypto.createHash("sha256").update(binary).digest("hex"), info.files[part.path].sha256);
    assert.equal(binary.length, info.files[part.path].bytes);
    if (part.path === "firmware.bin") {
      assert.equal(part.offset, app.offset);
      assert.ok(binary.length <= app.size);
      assert.equal(binary[0], 0xe9);
    }
    if (part.path === "spiffs.bin") {
      assert.equal(part.offset, spiffs.offset);
      assert.equal(binary.length, spiffs.size);
    }
  }
});
