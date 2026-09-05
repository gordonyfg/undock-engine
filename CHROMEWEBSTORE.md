# Chrome Web Store Listing — Undock Engine

> Last Updated: 2026-09-04

## Store Listing

**Extension Name** [REQUIRED]
Undock Engine: Multi-Monitor Reading Pane

**Short Description** [REQUIRED]
Decouple multi-pane web applications across monitors. Suppresses Gmail's embedded reading pane and projects it into a window.

**Detailed Description** [REQUIRED]
Undock Engine decouples multi-pane web apps across multi-monitor workstations, beginning with Gmail's Reading Pane.

By default, reading emails in Gmail's split-pane view compresses both your inbox list and email body onto a single screen. Undock Engine suppresses the embedded reading pane in your main browser tab and projects it into a persistent, synchronized secondary OS window.

Key Features:
- Seamless Multi-Monitor Workflow: View your full-width Gmail inbox on your primary display and open email threads on your secondary monitor.
- Zero-Latency Synchronization: Instant (<5ms) DOM mirroring, scroll sync, and real-time thread updates powered by MutationObserver.
- Style Parity: Complete cloning of fonts, colors, custom CSS variables, and Gmail dark mode themes without asset load delays.
- Full Triage Hotkeys: Single-stroke triage shortcuts (j/k for next/previous, e/y for archive, # for delete, s for star, r for reply) routed seamlessly across windows.
- Smart Input Protection: Automatically pauses hotkey interception when typing inside replies or search boxes to prevent collision.
- Coordinate Memory: Automatically saves and restores your preferred window dimensions and monitor placement across sessions.
- Delegated Actions: Archive, Delete, Star, Reply, and Snooze directly from the detached window.
- Universal Adapter Architecture: Extensible core engine designed for future expansion to GitHub, Linear, Jira, and Zendesk.

How to Use:
1. Open Gmail with Split Pane view enabled (Vertical or Horizontal split).
2. Click the "Undock" button in the Gmail toolbar or press Ctrl+Shift+U (Cmd+Shift+U on Mac).
3. The reading pane instantly pops out into your secondary window while the message list expands to 100% width.
4. Triage emails using standard Gmail shortcuts (j, k, e, #, s, r) from either window.
5. Close the pop-out window or click "Re-dock" at any time to restore the embedded layout.

Privacy & Security:
Undock Engine operates 100% locally within your browser. It does not collect, track, or transmit any email contents, personal data, or usage metrics off your device.

Support & Feedback:
For questions, feature requests, or issue reports, visit our open repository or contact support.

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
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | promo/screenshot-1.png |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | promo/screenshot-2.png |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | promo/promo-tile-440.png |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | promo/marquee-1400.png |

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
https://github.com/undock-engine/privacy-policy

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name** [REQUIRED]
Undock Engine Team

**Contact Email** [REQUIRED]
support@undockengine.dev

**Support URL / Email** [RECOMMENDED]
https://github.com/undock-engine/undock/issues

**Homepage URL** [RECOMMENDED]
https://undockengine.dev

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-09-04 | Initial MVP launch: Universal Undock Core Engine with Gmail Reading Pane Adapter | Draft |

## Review Notes

### Known Issues / Limitations
- Requires Gmail to be in split reading pane mode (either vertical or horizontal split). In non-split mode, email messages open in full view natively.
- Operates on mail.google.com exclusively; additional adapters (GitHub, Linear, Jira) planned for subsequent releases.
