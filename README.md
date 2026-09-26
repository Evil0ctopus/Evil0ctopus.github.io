# Evil0ctopus.github.io

Personal brand site for [Evil0ctopus](https://github.com/Evil0ctopus).

**Live:** [https://evil0ctopus.github.io/](https://evil0ctopus.github.io/)

Static multi-page HTML/CSS hiring-facing site, published via GitHub Pages from the `main` branch root.

## Pages

| Page | File | What it is |
|------|------|------------|
| Home | `index.html` | Hero, role line, CTAs to Projects and Flash |
| About | `about.html` | Background, goals, Southeast Missouri base |
| Education | `education.html` | WGU B.S. Cybersecurity & Information Assurance (in progress) |
| Skills | `skills.html` | Skills & certifications (incl. CompTIA A+, lab practice) |
| Projects | `projects.html` | Cards for wigglefish, cores3_weather_console, Pocket-Pirate-CYD, poseidon_adv, OctoBuddy (+ APK CTA) |
| Flash | `flash.html` | Multi-board ESP Web Tools flash hub driven by `firmware/firmware-catalog.json` |
| Tools | `tools.html` | Browser-only experiments — **Birth Sky** (planetarium + classic wheel + on-this-day; no accounts / no backend) |
| Contact | `contact.html` | Hire / contact — GitHub, PayPal, Discord (GitHub-only social until a vanity profile URL) |

Shared chrome: `styles.css`, `assets/` (brand mark, icon, favicon), site background nodes.

## Flash hub

Multi-board Flash UI powered by [ESP Web Tools](https://esphome.github.io/esp-web-tools/) (Chrome/Edge, Web Serial). Catalog lives in `firmware/firmware-catalog.json`; `flash-catalog.js` drives the card + detail UI.

- Own projects (wigglefish, cores3_weather_console, Pocket-Pirate-CYD, and others) appear with status **ready** / **pending** / **coming-soon** depending on whether a resolvable `manifest.json` (and bins) is published under `firmware/<board>/`.
- Install stays inactive with a clear “Firmware not published yet” / “Coming soon” state until a real manifest exists — no placeholder `.bin` files.
- Authorized-use notes are shown per catalog item (e.g. wigglefish: metadata-only / passive observation in authorized environments).

## Tools · Birth Sky

`tools.html` + `birth-sky.js` / `tools.css` / `bg-ocean.js`: birth date/time and place stay in the browser; geocoding via OpenStreetMap Nominatim; optional Wikimedia/Wikipedia on-this-day. Curiosity tool — not scientific prediction.

## Other assets

- `downloads/` — OctoBuddy release APK served from this site
- `firmware/` — release manifests and bins for Flash (see `firmware/README.md`)
- `previews/` — static preview assets

## Identity

Public identity on this site is **Evil0ctopus** only.
