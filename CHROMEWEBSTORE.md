# Chrome Web Store Listing — Undock Engine (Technical Draft)

> Last Updated: 2026-09-05
>
> This document is a technical preparation checklist, not a final public listing. Do not submit until the real publisher identity, support contact, privacy-policy URL, and default-branch links are confirmed.

## Store Listing

**Extension Name** [REQUIRED]
Undock Engine: Multi-Monitor Reading Pane

**Short Description** [REQUIRED]
Undock Gmail's reading pane into a separate window for a cleaner multi-monitor workflow.

**Detailed Description** [REQUIRED]
Undock Engine separates Gmail's Reading Pane into a second browser window so your inbox list can use the full width of the main window.

By default, reading emails in Gmail's split-pane view compresses both your inbox list and email body onto a single screen. Undock Engine suppresses the embedded reading pane in your main browser tab and projects it into a persistent, synchronized secondary OS window.

Key Features:
- Multi-monitor workflow: View the Gmail inbox list in the main window and the selected message in a separate window.
- Synchronized view: The detached window follows the selected Gmail message and supported state changes.
- Familiar Gmail interactions: Use the detached message view for normal reading and supported Gmail actions.
- Input protection: Keyboard handling is limited while typing in search, reply, compose, and other editable fields.
- Window memory: Your preferred detached-window size and position are saved locally.
- Local processing: Email content is handled in the browser; the extension does not send it to an external service.

How to Use:
1. Open Gmail with Split Pane view enabled (Vertical or Horizontal split).
2. Click the "Undock" button in the Gmail toolbar.
3. The reading pane instantly pops out into your secondary window while the message list expands to 100% width.
4. Read and use the supported Gmail controls from the detached window.
5. Close the pop-out window or click "Re-dock" at any time to restore the embedded layout.

Privacy & Security:
Undock Engine operates 100% locally within your browser. It does not collect, track, or transmit any email contents, personal data, or usage metrics off your device.

Support & Feedback:
For questions, feature requests, or issue reports, use the GitHub repository and issue tracker listed below.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Decouples Gmail's embedded reading pane into a synchronized secondary OS window for multi-monitor workstations.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | icons/icon-128.png |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ✅ Ready | promo/screenshot-1.png |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ✅ Ready | promo/screenshot-2.png |
| Small Promo Tile [RECOMMENDED] | 440×280 | ✅ Ready | promo/promo-tile-440.png |
| Marquee Promo Tile | 1400×560 | ⬜ Optional | promo/marquee-1400.png |

### Screenshot Notes
- Screenshot 1: Dual-monitor workstation view showing full-width Gmail inbox list on Display 1 and detached email detail thread on Display 2.
- Screenshot 2: Close-up of the injected "Undock" / "Re-dock" button and command palette in Gmail.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| storage | permissions | Required to persist user window coordinates (width, height, screenX, screenY) and active tab session state across browser restarts. |
| https://mail.google.com/* | host_permissions | Required to detect the Gmail Reading Pane DOM, inject the undock trigger button, mirror email thread contents into the secondary window, and route triage actions. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | N/A | No |
| Health info | No | No | N/A | No |
| Financial info | No | No | N/A | No |
| Authentication info | No | No | N/A | No |
| Personal communications | No | No | N/A | No |
| Location | No | No | N/A | No |
| Web history | No | No | N/A | No |
| User activity | No | No | N/A | No |
| Website content | No | No | N/A | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [RECOMMENDED]
https://github.com/gordonyfg/undock-engine/blob/main/PRIVACY.md

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name** [REQUIRED]
Gordon Yeung

**Contact Email** [REQUIRED]
gordon.yeung.toa@gmail.com

**Support URL / Email** [RECOMMENDED]
https://github.com/gordonyfg/undock-engine/issues

**Homepage URL** [RECOMMENDED]
https://github.com/gordonyfg/undock-engine

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-09-05 | Initial MVP: Gmail Reading Pane undock workflow | Draft |

## Review Notes

### Known Issues / Limitations
- Operates on mail.google.com exclusively in this release.
- Requires Gmail's split reading pane mode (vertical or horizontal) for the undock control to appear.

## Submission blockers

Resolve these items in the Chrome Web Store dashboard before publishing:

1. Replace the publisher name and contact email with real, monitored values.
2. Confirm that the `main` branch contains `PRIVACY.md`; otherwise use the exact public branch URL temporarily.
3. Create at least one real screenshot showing the extension in Gmail. Promotional tiles are optional for the first release.
4. Confirm the final store description matches the behavior tested in the release candidate.
5. Upload the ZIP generated by `npm run package`; do not upload the repository root.
