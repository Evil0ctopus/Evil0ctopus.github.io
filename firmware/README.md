# Firmware for ESP Web Tools

Release binaries and manifests for the Flash section on [evil0ctopus.github.io](https://evil0ctopus.github.io/) live here.

## Catalog

`firmware/firmware-catalog.json` powers the Flash hub on the homepage (filters, cards, detail panel).

- Entries with `status: "ready"` and a resolvable `manifestUrl` enable ESP Web Tools Install.
- `pending` / `coming-soon` keep Install disabled.
- `link-out` opens an upstream installer (third-party drafts) — no local Install.

## Layout

```
firmware/
  wigglefish/
    manifest.json     # ESP Web Tools manifest (required to enable Install)
    *.bin             # firmware parts referenced by the manifest
  cores3_weather_console/   # future
  Pocket-Pirate-CYD/        # future
```

## Enabling the install button

The Flash UI probes `firmware/<board>/manifest.json` at page load.

- **No file** → “Firmware not published yet”; Install stays inactive.
- **Valid manifest + bins** → Install activates for that board (Chrome/Edge, HTTPS, Web Serial).

Do **not** commit placeholder or empty `.bin` files. Ship real builds from Repo Builder (or your release pipeline) only.

## Compatibility and release metadata

Each catalog entry may include `hardwareProfile`, `hardwareVerification`, `latestRelease`, `releaseHistory`, `releaseHistoryUrl`, and `gallery` fields. Keep unknown board revisions marked as not verified; a successful compile is not evidence of a tested flash. Gallery images need descriptive alt text and a caption that says whether they show the board or only its firmware UI.

For a `ready` entry, add the real manifest and every referenced non-empty binary under this repository. Record the build version/date, source commit, SHA-256, and exact tested board revision in `firmware/firmware-catalog.json`. Optional release asset URLs are shown as manual downloads; do not add one until that release asset exists.

Validate locally with:

```sh
node scripts/validate-firmware-catalog.js
```

The same validator runs on pushes and pull requests through `.github/workflows/validate-firmware-catalog.yml`. It checks catalog references, gallery files, ready manifests, matching chip families, local binary paths, optional part checksums, and required release/test evidence. The browser independently checks that same-origin binaries exist before exposing the local installer.

## Example manifest (ESP32-C5 / wigglefish)

Paths are relative to the manifest. Prefer a single merged binary when using ESP-IDF v4+:

```json
{
  "name": "wigglefish",
  "version": "0.1.0",
  "new_install_prompt_erase": true,
  "builds": [
    {
      "chipFamily": "ESP32-C5",
      "parts": [
        { "path": "merged-firmware.bin", "offset": 0 }
      ]
    }
  ]
}
```

See [ESP Web Tools docs](https://esphome.github.io/esp-web-tools/) for multi-part layouts and chip families.
