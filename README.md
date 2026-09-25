# Evil0ctopus.github.io

Personal brand site for [Evil0ctopus](https://github.com/Evil0ctopus).

**Live:** [https://evil0ctopus.github.io/](https://evil0ctopus.github.io/)

Static HTML/CSS hiring-facing landing page, published via GitHub Pages from the `main` branch root.

## Files

- `index.html` — single-page site (includes ESP Web Tools Flash UI)
- `styles.css` — dark cyan theme styles
- `assets/` — brand mark, icon, and favicon
- `firmware/` — release manifests and bins for the Flash section (see `firmware/README.md`)
- `README.md` — this note

## Flash section

Multi-board Flash UI powered by [ESP Web Tools](https://esphome.github.io/esp-web-tools/) (Chrome/Edge, Web Serial).

- **wigglefish (ESP32-C5)** is selected by default.
- **cores3_weather_console** and **Pocket-Pirate-CYD** are listed as Coming soon / disabled until firmware exists.
- The page probes `firmware/<board>/manifest.json`. Until a real manifest (and bins) is published, Install stays inactive with a clear “Firmware not published yet” state — no placeholder `.bin` files.

Authorized-use and metadata-only / passive observation framing for wigglefish is shown on the page.
