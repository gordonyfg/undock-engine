# Undock Engine

A Chrome extension that moves Gmail's split Reading Pane into a second window so the inbox can use the full main screen.

This README is written for a solo developer with an electronics/R&D background. It explains enough architecture and testing to build, debug, discuss, and improve the project without copying the process of a large software company.

## 1. What it does

When Gmail Reading Pane split mode is enabled, Undock Engine:

1. Opens a lightweight secondary window.
2. Moves Gmail's original Reading Pane off-screen without deleting it.
3. Clones the selected email into the secondary window.
4. Watches Gmail for changes and refreshes the clone.
5. Sends supported clicks and keyboard actions back to Gmail's original DOM.
6. Restores Gmail when the user re-docks or closes the secondary window.

The original Gmail page is always the source of truth. The detached window is only a view of it.

### Current scope

- Chrome Manifest V3.
- `mail.google.com` only.
- Gmail Reading Pane split mode.
- One detached window per Gmail tab.
- No server, analytics, or intentional storage of email content.

### Main shortcuts

| Key | Action |
|---|---|
| `j` / `k` | Next / previous conversation |
| `e` / `y` | Archive |
| `#` / `Delete` | Delete |
| `s` | Star or unstar |
| `r` | Reply |
| `f` | Forward |
| `t` | Open appearance settings |
| `u` | Re-dock |

Shortcuts are ignored while the user is typing in an input or draft.

## 2. How the project is built

```text
Gmail page
    |
    v
UndockEngine          Controls the undock/re-dock lifecycle
    |
    +-- GmailAdapter  Knows Gmail's DOM and selectors
    +-- WindowManager Opens and manages the second window
    +-- SyncObserver  Clones the Reading Pane and proxies clicks
    +-- KeyboardBroker Handles keyboard shortcuts safely
    +-- StyleCloner   Copies Gmail styles into the second window
```

### Source layout

```text
src/
├── content.ts                 Starts the extension inside Gmail
├── background/
│   └── service-worker.ts      Handles the Chrome toolbar button and badge
├── core/
│   ├── engine.ts              Main lifecycle coordinator
│   ├── window-manager.ts      Secondary-window lifecycle
│   ├── sync-observer.ts       DOM cloning and interaction proxying
│   ├── keyboard-broker.ts     Keyboard routing
│   └── style-cloner.ts        Style copying
├── adapters/
│   ├── base.ts                Adapter contract
│   └── gmail/                 Gmail-specific code
├── ui/                        Button, menu, palette, and toast
└── utils/                     Shared DOM helpers

test/                          Automated tests
dist/                          Generated extension loaded by Chrome
```

### The five rules worth remembering

1. Gmail's original DOM owns the real state.
2. Gmail-specific selectors stay inside the Gmail adapter.
3. Anything changed during undock must be restored during re-dock.
4. Every observer, timer, and listener needs cleanup.
5. If a destructive action cannot find one clear target, do nothing.

Those five rules are more valuable for this project than a long style guide.

## 3. Setup and commands

### Requirements

- Node.js 18 or newer.
- npm.
- Google Chrome.
- A Gmail test account or disposable test messages.

### Install and check the project

```bash
npm ci
npm run typecheck
npm test
npm run build
```

### Available commands

| Command | Purpose |
|---|---|
| `npm run typecheck` | Find TypeScript mistakes |
| `npm test` | Run all automated tests once |
| `npm run test:watch` | Rerun tests while editing |
| `npm run build` | Build the extension into `dist/` |
| `npm run watch` | Rebuild during development |
| `npm run package` | Create a Chrome Web Store ZIP |

### Load it in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select `dist/`.
5. Enable Gmail **Settings → Reading pane → Right of inbox**.
6. Reload Gmail after rebuilding the extension.

## 4. Testing without the overwhelm

You only need four testing ideas for this project:

- Unit testing.
- Integration testing.
- End-to-end testing.
- Regression testing.

An electronics analogy:

| Software term | Electronics/R&D analogy |
|---|---|
| Unit test | Test one circuit block or component independently |
| Integration test | Connect several blocks and test their interfaces |
| End-to-end test | Power the complete device and operate it like a customer |
| Regression test | Repeat a test after a modification to prove an old fault did not return |

### 4.1 Unit tests

A unit test checks one small behavior in isolation.

Examples in this project:

- Does the keyboard broker ignore shortcuts inside a text box?
- Does an adapter configuration reject a missing selector?
- Does source-element matching choose the correct ID?

Use a unit test when the logic can be tested without starting the whole extension.

### 4.2 Integration tests

An integration test checks whether several parts work together.

Examples:

- Does `UndockEngine` ask the Gmail adapter to suppress the Reading Pane?
- Does re-docking disconnect synchronization and restore the page?
- Does clicking a cloned action reach the matching Gmail element?

Most existing tests in this repository are unit or lightweight integration tests using jsdom.

### 4.3 End-to-end tests

An end-to-end, or E2E, test operates the built product like a user.

For this project, a useful E2E test would:

1. Start Chromium with the built extension.
2. Open a controlled Gmail-like fixture.
3. Click **Undock**.
4. Confirm the second window appears.
5. Confirm the inbox actions remain visible.
6. Re-dock and confirm the original layout returns.

The repository does not have automated E2E tests yet. For now, the real-Gmail check is manual.

### 4.4 Regression tests

Regression describes why a test exists, not a separate test level. A regression test can be a unit, integration, or E2E test.

The recent wide-inbox bug is a good example:

- Fault: extension CSS changed Gmail's table into a flex container.
- User symptom: row quick actions moved beyond the visible right edge.
- Fix: keep the inbox as a bounded table and pin the action column.
- Regression test: verify the grid remains a table and the action cell stays sticky.

The simplest professional habit is:

> When you fix a bug, add a test that would fail if the bug came back.

### 4.5 How much testing is enough?

For a one-person project, test in this order:

1. The main user path.
2. Anything destructive, such as delete or archive.
3. Anything that must be restored or cleaned up.
4. The failure that caused the current bug.
5. Small helper logic only when it contains meaningful decisions.

Do not test every getter, line, or CSS declaration. Test behavior that would matter to you or a user.

### 4.6 The current test suite

The project currently has 74 passing tests across 9 test files.

| Area | What is checked |
|---|---|
| Adapter | Gmail detection, suppression, restoration, and actions |
| Engine | Initialization and undock/re-dock lifecycle |

### 4.7 How to tell whether the tests are good enough

The number of tests is not a quality score. Seventy-four weak tests can be
worse than ten tests that protect the important behavior. Use this small review
before calling a change safe.

#### Start from behavior, not implementation

Write down the user-visible requirement first:

```text
When the reading pane is undocked and an email is opened,
the detached window shows the email and the inbox still shows
the subject and quick actions.
```

Then ask: “What would I observe if this broke?” Those observations become test
assertions. Avoid asserting private helper names or incidental CSS unless that
detail is the actual contract.

#### Use a tiny risk matrix

| Risk | Test that should catch it |
|---|---|
| Main path stops working | One integration or manual E2E check |
| A destructive action targets the wrong email | A focused action-proxy test |
| Gmail changes its DOM shape | A fixture test with realistic markup |
| A fixed bug returns | A regression test named after the symptom |
| Undock leaves Gmail damaged | A restore/re-dock test |

If a row has no test, either add one or consciously accept the risk. This is a
better decision tool than chasing an arbitrary coverage percentage.

#### Test boundaries and failure paths

For each important behavior, check at least:

1. The normal case.
2. The empty or missing-element case.
3. The repeated-operation case, such as undock twice or re-dock twice.
4. Cleanup, such as observers, timers, classes, and styles being removed.

This is similar to testing a circuit at nominal voltage, disconnected input,
power cycling, and shutdown—not just measuring one successful output.

#### Use coverage as a warning light

Coverage answers “which lines or branches ran?”, not “is the product correct?”
It is useful for finding completely untested code, but it cannot tell whether a
test asserted the right behavior. Do not add a coverage gate yet; first make the
four checks above reliable. If coverage becomes useful later, add it with:

```bash
npx vitest run --coverage
```

and review the report for untested branches in lifecycle and action-routing
code—not for a vanity target such as 100%.

#### What CI reports today

The current CI workflow reports pass/fail for typecheck, tests, and build, and
uploads the generated `dist/` folder as an artifact. It does not yet publish
coverage, browser screenshots, or performance benchmarks. That is intentional:
for this solo project, a reliable small suite is more valuable than several
reporting systems nobody reviews.

#### The repeatable change loop

For every bug or feature:

1. Describe the user-visible behavior.
2. Add a test that fails before the fix.
3. Make the smallest fix.
4. Run `npm run typecheck`, `npm test`, and `npm run build`.
5. Manually smoke-test the changed user path in Chrome.
6. Keep the test if it would catch the bug returning.

That loop is the practical definition of regression testing for this project.
| Sync observer | DOM cloning and source matching |
| Keyboard broker | Shortcuts and typing protection |
| Window manager | Child-window state and appearance controls |
| UI | Toolbar button, menu, and toast behavior |

The important missing layer is a real-browser E2E test.

### 4.7 A small workflow for every change

Before editing:

```text
What should the user see?
What could break?
Which one test would give me confidence?
```

While editing:

```bash
npm run test:watch
```

Before finishing:

```bash
npm run typecheck
npm test
npm run build
```

Then manually try the changed behavior in Chrome.

That is enough process for this project's current size.

## 5. Code standard for one developer

Keep the standard short enough to remember:

- Use strict TypeScript.
- Prefer small functions with one responsibility.
- Avoid `any` when data crosses a Chrome or DOM boundary.
- Keep Gmail details in the Gmail adapter.
- Preserve original page state before changing it.
- Clean up listeners, observers, intervals, and timeouts.
- Handle expected failures without leaving Gmail broken.
- Add a regression test for every confirmed bug.
- Add a dependency only when it removes more complexity than it adds.
- Comments should explain why, not translate the code into English.

The project does not currently need a large design-pattern framework, dozens of interfaces, or separate microservices.

## 6. What about coverage, performance, and CI?

These are useful, but they are not all urgent.

### Code coverage

Coverage shows which code ran during tests. It does not prove the result was correct.

For now:

- Do not chase a percentage.
- Use coverage later to find important code with no tests.
- Prioritize the lifecycle, Gmail adapter, and destructive actions.

Add a coverage report when the test suite becomes difficult to understand, not because every project is supposed to have one.

### Performance

Do not build a benchmark system until there is a measured performance problem.

For now, manually check:

- Does a long email open without an obvious pause?
- Does Gmail remain responsive while undocked?
- Does repeated undock/re-dock increase memory or create duplicate behavior?
- Does the production bundle grow unexpectedly?

If users report slowness, record a Chrome Performance trace and measure the slow operation before optimizing it.

### CI

CI means a clean machine runs the checks automatically after a push or pull request.

A one-person CI workflow only needs:

```text
npm ci
npm run typecheck
npm test
npm run build
```

That is a useful future improvement because it catches “works on my machine” problems. Complex dashboards, nightly benchmarks, multiple report formats, and automatic store publishing are unnecessary at this stage.

The repository now has a basic CI workflow at `.github/workflows/ci.yml`. It runs typecheck, tests, and build, then uploads `dist/` as an artifact. Browser E2E testing and store publishing remain manual.

## 7. Debugging guide

| Problem | Look here first |
|---|---|
| Undock button is missing | `src/ui/undock-button.ts` and Gmail toolbar selectors |
| Chrome toolbar icon does nothing | Service-worker console and runtime messaging |
| Wrong Gmail area disappears | `GmailAdapter.findDetailContainer()` |
| Inbox becomes too wide | Gmail adapter's injected expanded-list CSS |
| Detached email is unstyled | `StyleCloner` and child body classes |
| A cloned button triggers the wrong action | `SyncObserver.findMatchingSourceElement()` |
| Shortcut fires while typing | `KeyboardBroker.isInputCollision()` |
| Gmail does not restore correctly | Adapter suppression/restoration methods |

When reporting a bug, write:

```text
Given: the starting state
When: the exact action
Then: what should happen
Actual: what happened instead
```

Also record Chrome version, operating system, Gmail layout, and relevant console errors.

## 8. A small interview-ready explanation

### “How do you test your work?”

> I use unit tests for isolated decisions, integration tests for component boundaries, and E2E or manual browser tests for the real user flow. When I fix a defect, I add a regression test at the cheapest layer that can reproduce it. Before finishing a change, I run type checking, the full test suite, the production build, and a manual smoke test.

### “What is the difference between unit, integration, and E2E tests?”

> A unit test checks one component in isolation. An integration test checks components working together. An E2E test checks the complete product through the same interface a user uses. I use more fast unit tests and only a few E2E tests for critical workflows.

### “What is regression testing?”

> It means proving that an existing behavior or previously fixed defect still works after a change. A regression test is not necessarily an E2E test; it should live at the lowest realistic level that reproduces the failure.

### “Is high code coverage enough?”

> No. Coverage shows execution, not correctness. I use it to locate untested risk, but I judge tests by the behavior and failure cases they prove.

That is a solid testing answer for many technical interviews. You do not need to sound like a dedicated QA automation engineer.

## 9. Simple prompt template for a new project

Use this instead of the earlier enterprise-sized prompt:

```text
Build [PROJECT] for [USER].

Problem:
[What problem should it solve?]

Main user flow:
1. [Starting condition]
2. [User action]
3. [Expected result]

Scope:
- Must support: [platform and features]
- Does not need: [non-goals]
- Data/privacy constraints: [what must remain private]

Architecture:
- Source of truth: [where real state lives]
- Main components: [short list and responsibility]
- Important rules: [what must always be true]

Code standard:
- Use strict [language].
- Keep components small and responsibilities separate.
- Handle failures and clean up resources.
- Avoid unnecessary dependencies and abstractions.

Testing:
- Unit-test important logic.
- Integration-test component boundaries.
- Add one E2E or manual test for the main user flow.
- Every bug fix needs a regression test.

Before finishing:
- Run type checking, tests, and the production build.
- Manually verify the main user flow.
- Report what changed, what passed, and any remaining risk.

Acceptance criteria:
1. Given [state], when [action], then [result].
2. Given [failure], the product remains [safe/recoverable].
3. The main user flow is covered by an appropriate test.
```

The prompt does not need to name every software practice. It needs to state the user outcome, boundaries, important risks, and proof of completion.

## 10. Current priorities

Keep the next steps small:

1. Continue fixing real Gmail usability problems with regression tests.
2. Add one built-extension browser smoke test when manual checking becomes repetitive.
3. Add one browser E2E test to the CI workflow.
4. Consider coverage or performance automation only when it answers a real question.
5. Add another website adapter only after Gmail behavior is dependable.

## Privacy and release documents

- [Privacy policy](PRIVACY.md)
- [Chrome Web Store information](CHROMEWEBSTORE.md)
- [License](LICENSE)

These files remain separate because they serve users and the Chrome Web Store, not because the codebase needs more architecture.
