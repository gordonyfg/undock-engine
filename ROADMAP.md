# Undock Engine — Solo Release Roadmap

This is the practical plan for taking Undock Engine from working prototype to a small, understandable Chrome extension release.

The project is intentionally scoped for one developer. The priority is dependable behavior, not a large process or a large toolchain.

## Current baseline

- Gmail Manifest V3 extension is implemented.
- Icons exist at 16×16, 48×48, and 128×128 pixels.
- Chrome Web Store listing draft exists in [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md).
- No promotional screenshots exist yet.
- Basic CI workflow now exists in `.github/workflows/ci.yml`.
- 74 automated tests pass.
- TypeScript typecheck and production build pass.
- Playwright E2E is intentionally deferred until the core workflow and release process are stable.

## Milestone 1 — Core reliability

Goal: make undock, use, and re-dock safe and predictable.

Tasks:

- Keep the wide-inbox/quick-action fix.
- Verify re-docking restores Gmail's original layout.
- Verify closing the child window cleans up observers and listeners.
- Verify archive, delete, star, reply, and forward target the correct source control.
- Add a regression test for every real bug found.
- Manually test long emails, drafts, Gmail reloads, popup blocking, and both split orientations.

Exit condition: undock, re-dock, and child-window close work without obvious Gmail layout corruption.

## Milestone 2 — Small testing foundation

Use four testing concepts:

- **Unit:** one decision or helper in isolation.
- **Integration:** several project components working together.
- **End-to-end:** the built extension used like a user.
- **Regression:** a test that prevents a fixed bug from returning.

First browser flow to automate later:

1. Open Gmail or a controlled Gmail-like fixture.
2. Enable Reading Pane.
3. Click **Undock**.
4. Confirm the second window appears.
5. Confirm inbox actions are visible.
6. Click **Re-dock**.
7. Confirm the original layout returns.

Status: deferred. Manual smoke testing covers this flow for the current MVP.

Do not add coverage dashboards or performance frameworks until they answer a real question.

## Milestone 3 — GitHub-ready repository

Goal: make the repository understandable and safe to publish before preparing
Chrome Web Store marketing material.

Tasks:

- Choose the final public repository name and URL.
- Replace placeholder repository, support, privacy, and contact URLs.
- Confirm no credentials, real email content, generated ZIPs, or local profiles are committed.
- Keep CI green on every push and pull request.
- Add a first release tag only after the manual Gmail smoke checklist passes.
- Document the exact build and packaging commands in the README.

Exit condition: a new developer can clone the repository, run the checks, build
`dist/`, and understand the known limitations without private context.

## Milestone 4 — Visual identity

Create one simple master icon:

- Two offset windows.
- One clear outward arrow.
- Blue and white primary version.
- Readable at 16×16 pixels.
- No text inside the icon.

Preferred asset structure:

```text
graphics/icon-master.svg
icons/icon-16.png
icons/icon-48.png
icons/icon-128.png
```

The SVG is the source of truth; PNGs are generated outputs.

## Milestone 5 — User guide

The user guide should answer:

1. How do I install the extension?
2. How do I enable Gmail Reading Pane?
3. How do I undock?
4. How do I move the window to another monitor?
5. Which shortcuts work?
6. How do I re-dock?
7. What should I do if it fails?

[README.md](README.md) is the main guide. Keep it short and practical.

## Milestone 6 — Chrome Web Store design

Minimum store package:

- Final 128×128 icon.
- Screenshot 1: full-width inbox on the main display and detached email on the second display.
- Screenshot 2: Undock/Re-dock control and quick-action workflow.
- Accurate short description and permission explanation.
- Privacy policy and support links.

Use synthetic or fully redacted email data in screenshots. Do not publish real subjects, names, addresses, or message content.

Optional later assets:

- Keyboard-shortcut screenshot.
- Promo tile.
- Short demo video or GIF.

## Milestone 7 — Small CI/CD loop

### CI now

Run this on every pull request and push:

```text
npm ci
npm run typecheck
npm test
npm run build
```

Upload `dist/` as a CI artifact so the tested build can be loaded into Chrome.

### CD later

For now, release manually:

1. Create a version tag.
2. Run `npm run package`.
3. Inspect the ZIP.
4. Load it manually in Chrome.
5. Run the Gmail smoke test.
6. Upload it to the Chrome Web Store.

Do not automate store publishing until the manual release process is reliable.

## Recommended order

1. Core reliability.
2. Regression tests.
3. GitHub-ready repository.
4. Manual release checklist.
5. One browser E2E test when the project justifies it.
6. Icon redesign.
7. Screenshots and store listing.

## Definition of done for a milestone

- The user-visible outcome works.
- A meaningful failure case was checked.
- A regression test exists for any fixed bug.
- `npm run typecheck`, `npm test`, and `npm run build` pass.
- The README or store documentation is updated when user behavior changes.
- Remaining risks are written down plainly.
