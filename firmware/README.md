# Firmware for ESP Web Tools

Release binaries and manifests for the Flash section on [evil0ctopus.github.io](https://evil0ctopus.github.io/) live here.

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
