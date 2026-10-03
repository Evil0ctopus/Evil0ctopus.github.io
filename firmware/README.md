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
  Pocket-Pirate-CYD/        # future
```

## Enabling the install button

The Flash UI probes the selected entry's `manifestUrl` and binary URLs. Failed probes show an explicit error; selecting the card again retries.

- **No file** → “Firmware not published yet”; Install stays inactive.
- **Valid manifest + bins** → Install activates for that board (Chrome/Edge, HTTPS, Web Serial).

Do **not** commit placeholder or empty `.bin` files. Ship real builds from Repo Builder (or your release pipeline) only.

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
