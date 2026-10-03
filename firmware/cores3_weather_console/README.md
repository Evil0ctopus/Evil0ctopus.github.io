# Weather Atlas browser-install package

The current feature scope is complete. This package is built from
[cores3_weather_console commit bf33e50](https://github.com/Evil0ctopus/cores3_weather_console/commit/bf33e50b17afc80532bc753a80a694b93911c3fd),
not a placeholder or a claim of a separately tagged upstream release.

- Website package version: `2026.10.02-bf33e50`.
- Includes the Wi-Fi password editor fix from [commit 3081436](https://github.com/Evil0ctopus/cores3_weather_console/commit/308143649889ba6cdf5f1d7906356eadbbeee599): the full keyboard and separate Cancel/Save row fit on the CoreS3 display without overlap or scrolling.
- Target: **M5Stack CoreS3**, ESP32-S3, 16 MB flash, 8 MB PSRAM.
- License: MIT; see the pinned source repository's license.
- [Manifest](manifest.json) includes firmware **and** SPIFFS (themes, boot artwork, audio, device web portal).
- [Build provenance and SHA-256 checksums](build-info.json) record the source, resolved toolchain/library versions, offsets, and file sizes.
- Firmware and filesystem builds passed. Website tests validate checksums, partition placement, file availability, and installer gating. This newly generated package has **not** been flashed onto physical hardware during website preparation.

## Installation and first boot

Open [the installer](https://evil0ctopus.github.io/flash.html#cores3_weather_console)
in desktop Chrome or Edge. Use a USB-C **data** cable and close serial monitors.
The site must be served over HTTPS (localhost also works); opening an HTML file
directly is not a supported installation workflow.

Installation replaces existing firmware and SPIFFS assets. The installer offers
an erase choice; erasing clears saved Wi-Fi credentials and preferences.
Record needed settings before installation. Keep USB connected until completion.

If the port does not appear, check the cable/port. To enter CoreS3 download mode,
hold **RESET for 3 seconds** until the green LED lights, release, then select
the serial port again. See [M5Stack's CoreS3 documentation](https://docs.m5stack.com/en/core/CoreS3).
Reset after flashing if the console does not restart automatically.

1. Open **Home > System > WiFi**, then connect to a **2.4 GHz** network.
2. In **Location & Weather**, enter a US ZIP or city/state, review the lookup,
   and confirm the place.
3. Leave the API key blank for Open-Meteo; AccuWeather requires your own optional key.
4. Find the IP in **Device & Diagnostics** and open `http://<device-ip>` on the
   same trusted network for the device-hosted control panel.
5. Check conditions, forecasts, radar, themes, sound, LEDs, and saved settings
   after reboot. Do not expose the device's control portal to the public internet.

Credentials are entered on the device or its local portal, not on this public
website. Published images contain build assets, not a dump of an owner's NVS.

## Parts and flash layout

Offsets come from the CoreS3 board's `default_16MB.csv` and build output:

| Part | Offset | Purpose |
|---|---|---|
| [bootloader.bin](bootloader.bin) | `0x000000` | ESP32-S3 bootloader |
| [partitions.bin](partitions.bin) | `0x008000` | 16 MB partition table |
| [boot_app0.bin](boot_app0.bin) | `0x00E000` | Initial OTA selection data |
| [firmware.bin](firmware.bin) | `0x010000` | Application in `app0` |
| [spiffs.bin](spiffs.bin) | `0xC90000` | Filesystem, size `0x360000` |

Do not use these offsets with another board or partition layout. The installer
checks chip family, but cannot distinguish a CoreS3 from every other ESP32-S3 board.

## Rebuilding or updating

Use a clean checkout of the intended source revision:

```powershell
git clone https://github.com/Evil0ctopus/cores3_weather_console.git
Set-Location cores3_weather_console
git checkout --detach bf33e50b17afc80532bc753a80a694b93911c3fd
pio run -e m5stack-cores3
pio run -e m5stack-cores3 -t buildfs
```

The original build used the installed **pioarduino** Espressif32 platform
(`55.03.39`, reported by PlatformIO as `55.3.39`) and resolved dependency versions
listed in `build-info.json`. Upstream dependency ranges are not a lockfile;
a later build can resolve different versions and need fresh hardware validation.

Copy `bootloader.bin`, `partitions.bin`, `firmware.bin`, and `spiffs.bin`
from `.pio\build\m5stack-cores3`. Copy `boot_app0.bin` from the matching Arduino
framework's `tools\partitions` folder, not from an unrelated framework installation.
Inspect the actual generated partition table before changing the manifest.

Update the manifest/catalog version, source revision, build metadata, and all
SHA-256 hashes together. To calculate each hash:

```powershell
Get-FileHash firmware.bin -Algorithm SHA256
```

From the website root, run `node --test tests\flash-catalog.test.cjs`, preview the
installer over localhost, then perform a physical browser install and first-boot
smoke test. Commit/push the complete website package for GitHub Pages deployment.
Never publish placeholder binaries or credentials.

Pushing source changes to `cores3_weather_console` does not update this website's
compiled install package automatically. Rebuild and publish all parts and matching
metadata here for each source update; confirm the live manifest version and binary
checksums after GitHub Pages deploys.
