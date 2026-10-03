# Firmware for ESP Web Tools

Release binaries and manifests for the Flash section on [evil0ctopus.github.io](https://evil0ctopus.github.io/) live here.

## Catalog

`firmware/firmware-catalog.json` powers the Flash hub on `flash.html` (filters, cards, detail panel).

- Entries with `status: "ready"`, a valid manifest for the selected chip, and reachable nonempty binary parts enable ESP Web Tools Install.
- `pending` / `coming-soon` keep Install disabled.
- `link-out` opens an upstream installer (third-party drafts) — no local Install.

## Layout

```
firmware/
  wigglefish/
    manifest.json     # ESP Web Tools manifest (required to enable Install)
    *.bin             # firmware parts referenced by the manifest
  cores3_weather_console/   # Weather Atlas complete firmware + SPIFFS package
  Pocket-Pirate-CYD/
    manifest.json     # ESP32-S3 / v0.5.7 merged factory image
    *.bin             # exact upstream release asset, checked by CI
```

## Enabling the install button

The Flash UI probes the selected entry's `manifestUrl` and binary URLs. Failed probes show an explicit error; selecting the card again retries.

- **No file** → “Firmware not published yet”; Install stays inactive.
- **Valid manifest + bins** → Install activates for that board (Chrome/Edge, HTTPS, Web Serial).

Do **not** commit placeholder or empty `.bin` files. Ship real builds from Repo Builder (or your release pipeline) only.

## Compatibility and release metadata

Each catalog entry may include `hardwareProfile`, `hardwareVerification`, `latestRelease`, `releaseHistory`, `releaseHistoryUrl`, and `gallery` fields. Keep unknown board revisions marked as not verified; a successful compile is not evidence of a tested flash. Gallery images need descriptive alt text and a caption that says whether they show the board or only its firmware UI.

For a `ready` entry, add the real manifest and every referenced non-empty binary under this repository. Record the build version/date, source commit, SHA-256, exact target model, and flash offset in `firmware/firmware-catalog.json`. `ready` means this site has a validated local install package; it does not mean this catalog independently tested a physical flash. Keep `hardwareVerification` at `not-verified` until a real board revision has been tested and evidence recorded. Optional release asset URLs are shown as manual downloads; do not add one until that release asset exists.

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

## Weather Atlas

[Weather Atlas package notes](cores3_weather_console/README.md) document the
pinned source revision, build commands, offsets, checksums, first boot, and update procedure.
The installer includes the filesystem; firmware-only uploads omit the artwork/audio/web interface.
CoreS3 only (16 MB flash, 8 MB PSRAM), not Core/Core2 or arbitrary ESP32-S3 boards.

## POSEIDON Advanced - Deepwater

[Deepwater package notes](poseidon_adv/README.md) pin v0.8.0's standalone
factory image, source revision and SHA-256. The Flash hub's `#poseidon_adv`
entry installs that image at `0x0` for a standalone Cardputer-Adv only.
Never use this factory installer over Launcher/Meshtastic; the release record
also links to the separate app-only Launcher download.
