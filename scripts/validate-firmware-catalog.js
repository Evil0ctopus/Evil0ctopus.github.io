"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "firmware", "firmware-catalog.json");
const errors = [];

function report(message) {
  errors.push(message);
}

function isInsideRoot(candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function validateHttpUrl(value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      report(label + " must use HTTP or HTTPS.");
    }
  } catch (_error) {
    report(label + " is not a valid URL.");
  }
}

function validateReadyItem(item) {
  if (item.installMethod !== "esp-web-tools") {
    report(item.id + ": ready entries must use esp-web-tools.");
    return;
  }
  if (typeof item.manifestUrl !== "string" || !item.manifestUrl.trim()) {
    report(item.id + ": ready entries need a local manifestUrl.");
    return;
  }

  const manifestPath = path.resolve(root, item.manifestUrl);
  if (!isInsideRoot(manifestPath) || !fs.existsSync(manifestPath)) {
    report(item.id + ": manifest is missing or outside the repository: " + item.manifestUrl);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (_error) {
    report(item.id + ": manifest is not valid JSON.");
    return;
  }

  if (!Array.isArray(manifest.builds) || manifest.builds.length === 0) {
    report(item.id + ": manifest must contain at least one build.");
    return;
  }

  manifest.builds.forEach((build, buildIndex) => {
    const buildLabel = item.id + " build " + (buildIndex + 1);
    if (!build || build.chipFamily !== item.chipFamily) {
      report(buildLabel + ": chipFamily must match catalog chipFamily " + item.chipFamily + ".");
    }
    if (!Array.isArray(build && build.parts) || build.parts.length === 0) {
      report(buildLabel + ": at least one binary part is required.");
      return;
    }

    build.parts.forEach((part) => {
      if (!part || typeof part.path !== "string" || !Number.isFinite(Number(part.offset)) || Number(part.offset) < 0) {
        report(buildLabel + ": every part needs a path and a non-negative numeric offset.");
        return;
      }

      const binaryPath = path.resolve(path.dirname(manifestPath), part.path);
      if (!isInsideRoot(binaryPath) || !fs.existsSync(binaryPath)) {
        report(buildLabel + ": binary is missing or outside the repository: " + part.path);
        return;
      }

      const binary = fs.readFileSync(binaryPath);
      if (binary.length === 0) {
        report(buildLabel + ": binary must not be empty: " + part.path);
      }
      if (part.sha256) {
        const actual = crypto.createHash("sha256").update(binary).digest("hex");
        if (actual.toLowerCase() !== String(part.sha256).toLowerCase()) {
          report(buildLabel + ": SHA-256 mismatch for " + part.path + ".");
        }
      }
    });
  });

  const release = item.latestRelease;
  if (!release || typeof release.version !== "string" || !release.version.trim()) {
    report(item.id + ": ready entries need latestRelease.version.");
    return;
  }
  if (!release.builtAt || !/^[0-9a-f]{7,40}$/i.test(release.commit || "")) {
    report(item.id + ": latestRelease needs builtAt and a source commit hash.");
  }
  if (!release.assetKind || !release.flashOffset) {
    report(item.id + ": latestRelease needs the image type and flash offset.");
  }
  if (!/^[0-9a-f]{64}$/i.test(release.sha256 || "")) {
    report(item.id + ": latestRelease.sha256 must be a 64-character SHA-256.");
  }
  if (!Array.isArray(item.testedOn) || item.testedOn.length === 0) {
    report(item.id + ": ready entries need at least one testedOn board revision.");
  }
}

try {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  if (!Array.isArray(catalog.items) || !Array.isArray(catalog.categories)) {
    report("Catalog must define categories and items arrays.");
  } else {
    const categoryIds = new Set(catalog.categories.map((category) => category.id));
    const itemIds = new Set();
    const validStatuses = new Set(["ready", "pending", "coming-soon", "link-out"]);
    const validInstallMethods = new Set((catalog.installMethods || []).map((method) => method.id));

    catalog.items.forEach((item) => {
      if (!item || typeof item.id !== "string" || !item.id.trim()) {
        report("Every catalog item needs an id.");
        return;
      }
      if (itemIds.has(item.id)) report(item.id + ": duplicate id.");
      itemIds.add(item.id);
      if (!item.name || !item.boardLabel || !item.chipFamily) report(item.id + ": name, boardLabel, and chipFamily are required.");
      if (!categoryIds.has(item.category)) report(item.id + ": unknown category " + item.category + ".");
      if (!validStatuses.has(item.status)) report(item.id + ": invalid status " + item.status + ".");
      if (!validInstallMethods.has(item.installMethod)) report(item.id + ": invalid installMethod " + item.installMethod + ".");

      if (item.releaseHistoryUrl) validateHttpUrl(item.releaseHistoryUrl, item.id + ".releaseHistoryUrl");
      if (item.latestRelease && item.latestRelease.downloadUrl) {
        validateHttpUrl(item.latestRelease.downloadUrl, item.id + ".latestRelease.downloadUrl");
      }
      if (item.latestRelease && item.latestRelease.releaseUrl) {
        validateHttpUrl(item.latestRelease.releaseUrl, item.id + ".latestRelease.releaseUrl");
      }
      (item.releaseHistory || []).forEach((release, index) => {
        if (release.assetUrl) validateHttpUrl(release.assetUrl, item.id + ".releaseHistory[" + index + "].assetUrl");
      });
      (item.gallery || []).forEach((image, index) => {
        if (typeof image.src !== "string") {
          report(item.id + ": gallery image source must be a path or URL.");
        } else if (/^https?:\/\//i.test(image.src)) {
          validateHttpUrl(image.src, item.id + ".gallery[" + index + "].src");
        } else {
          const imagePath = path.resolve(root, image.src);
          if (!isInsideRoot(imagePath) || !fs.existsSync(imagePath)) {
            report(item.id + ": local gallery image is missing or outside the repository: " + image.src);
          }
        }
        if (!image.alt || !image.caption) report(item.id + ": gallery images need alt text and a caption.");
      });

      const verification = item.hardwareVerification || (catalog.defaults && catalog.defaults.hardwareVerification);
      if (verification && verification.status === "verified") {
        if (!verification.verifiedOn || !verification.evidenceUrl || !Array.isArray(item.testedOn) || item.testedOn.length === 0) {
          report(item.id + ": verified hardware status needs verifiedOn, evidenceUrl, and testedOn revisions.");
        }
      }
      if (item.status === "ready") validateReadyItem(item);
    });
  }
} catch (error) {
  report("Could not read firmware catalog: " + error.message);
}

if (errors.length) {
  console.error("Firmware catalog validation failed:");
  errors.forEach((error) => console.error("- " + error));
  process.exitCode = 1;
} else {
  console.log("Firmware catalog valid. No ready local builds require artifact checks yet.");
}