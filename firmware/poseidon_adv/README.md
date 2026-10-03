# POSEIDON Advanced - Deepwater 0.8.0

This is the standalone Cardputer-Adv package for the personal website's
[Flash hub](../../flash.html#poseidon_adv).

- Source release: [v0.8.0](https://github.com/Evil0ctopus/poseidon_adv/releases/tag/v0.8.0)
- Source revision: `206bbaaa58ea1651a99f18054537175140cbc94d`
- Factory image: `poseidon-factory.bin`, 2,872,832 bytes, offset `0x0`
- SHA-256: `7745c9802fb90202ca83fc46f8256ced01ed1eb9e60a961c6fba519aa99351ca`
- Hardware: M5Stack Cardputer-Adv, ESP32-S3, 8 MB flash, 240 x 135 display.

**Factory installation replaces the partition layout. Do not use this browser
installer over Launcher, Meshtastic or any multi-app installation.** Those
setups must use the release's `poseidon-launcher.bin` through Launcher's
SD/WebUI app installer. Raw app writes require reading the actual partition
table; the custom development layout is not universal.

All three v0.8.0 firmware profiles built successfully and 33 native tests passed.
The same Deepwater UI source was tested by safe navigation on a Cardputer-Adv:
maximum menu paint 41 ms, boot reveal 925 ms, preferences restored and partition
table unchanged after an app-only installation. The version-bumped 0.8.0
standalone factory installation has not independently been hardware-tested.
No transmit/destructive-operation testing is claimed.

The manifest and image here are independent of M5Stack catalog approval.
Future updates must replace the binary and update the manifest, catalog release
metadata and hashes together. Do not substitute an app-only image at offset zero.

Validation:

```sh
node scripts/validate-firmware-catalog.js
node --test tests/flash-catalog.test.cjs
```
