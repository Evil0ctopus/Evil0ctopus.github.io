const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const apkName = "wigglefish-comic-preview-2026-10-03.apk";
const projects = fs.readFileSync(path.join(root, "projects.html"), "utf8");

test("comic preview download is real and matches its published checksum", () => {
  const apk = fs.readFileSync(path.join(root, "downloads", apkName));
  assert.equal(apk.subarray(0, 4).toString("hex"), "504b0304");
  assert.ok(apk.length > 10 * 1024 * 1024);
  const checksum = fs.readFileSync(path.join(root, "downloads", apkName + ".sha256"), "utf8").trim();
  assert.equal(checksum, crypto.createHash("sha256").update(apk).digest("hex") + "  " + apkName);
  assert.ok(projects.includes('data-apk-url="downloads/' + apkName + '"'));
  assert.ok(projects.includes('href="downloads/' + apkName + '"'));
  assert.ok(projects.includes('download="' + apkName + '"'));
  assert.ok(projects.includes('href="downloads/' + apkName + '.sha256"'));
});

test("preview is disclosed honestly and old Wigglefish download is removed", () => {
  assert.ok(projects.includes("debug-signed sideload APK"));
  assert.ok(projects.includes("com.wigglefish.android.lumitest"));
  assert.ok(projects.includes("Optional active lab tools"));
  assert.ok(projects.includes('id="wigglefish"'));
  assert.ok(!projects.includes("downloads/wigglefish-0.4.0.apk"));
  assert.ok(!fs.existsSync(path.join(root, "downloads", "wigglefish-0.4.0.apk")));
  const flash = fs.readFileSync(path.join(root, "flash.html"), "utf8");
  assert.ok(flash.includes("projects.html#wigglefish"));
  assert.ok(!flash.includes("Wigglefish 0.4.0"));
});

test("comic screenshot has real image data and accessible responsive markup", () => {
  const filename = "assets/wigglefish-comic-ui-2026-10-03.png";
  const image = fs.readFileSync(path.join(root, filename));
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(image.readUInt32BE(16), 1350);
  assert.equal(image.readUInt32BE(20), 630);
  assert.ok(projects.includes('src="' + filename + '"'));
  assert.ok(projects.includes('alt="Wigglefish comic UI:'));
  assert.ok(projects.includes('href="' + filename + '"'));
  assert.ok(fs.readFileSync(path.join(root, "styles.css"), "utf8").includes(".wigglefish-preview img"));
});
