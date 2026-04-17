# LeetCode Review Planner -- Agent Index

> v2.2.0 | Chrome Extension (Manifest V3) | No bundler, no framework

## 1. Project Overview

A Chrome extension that adds **spaced repetition** to LeetCode. Users add problems to a review plan; the extension schedules reviews based on forgetting-curve intervals, tracks completion, and optionally syncs to Google Calendar. Two UIs share the same data: a **content-script widget** injected on LeetCode pages, and a **toolbar popup**.

---

## 2. File Map

```
leetcode-review-helper/
├── manifest.json          # MV3 config: permissions, content scripts, service worker, oauth2
├── background.js          # Service worker. SpacedRepetitionManager -- all data logic, scheduling, Calendar API
├── content.js             # Content script. LeetCodeHelper class -- in-page floating widget + home modal
├── content.css            # Styles for everything injected on LeetCode pages
├── i18n.js                # LRS_I18N IIFE -- zh/en translation dictionary + DOM localizer
├── popup.html             # Toolbar popup shell (static HTML structure, tabs, settings)
├── popup.js               # PopupManager class -- popup logic, mirrors dashboard features
├── popup.css              # Styles for the toolbar popup
├── icons/                 # Extension icons (16/32/48/128 png) + icons.png (floating button image)
├── images/                # README screenshots
├── generate-icons.html    # Standalone HTML tool to regenerate icon PNGs via canvas
├── scripts/
│   └── trim_image_borders.py  # Tkinter utility for trimming README screenshot borders
├── README.md              # English documentation
├── README.zh-CN.md        # Chinese documentation
└── .gitignore
```

### File Roles at a Glance

| File | Role | Key Export / Class | Lines |
|------|------|--------------------|-------|
| `background.js` | Data layer + scheduling + Calendar | `SpacedRepetitionManager` (singleton) | ~806 |
| `content.js` | In-page UI + DOM scraping + home modal | `LeetCodeHelper` (singleton) + `LRS_SEARCH` IIFE | ~3359 |
| `popup.js` | Toolbar popup UI | `PopupManager` (singleton) + `LRS_SEARCH` IIFE (duplicate) | ~952 |
| `i18n.js` | i18n dictionary + helpers | `globalThis.LRS_I18N` IIFE | ~387 |
| `content.css` | Content script styles | CSS custom properties `--sr-*` | ~3800 |
| `popup.css` | Popup styles | Same `--sr-*` design tokens | ~1591 |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                  background.js                       │
│           SpacedRepetitionManager                    │
│  ┌──────────┐ ┌───────────┐ ┌────────────────────┐  │
│  │ Storage  │ │ Alarms &  │ │ Google Calendar    │  │
│  │ CRUD     │ │ Notifs    │ │ OAuth + REST API   │  │
│  └──────────┘ └───────────┘ └────────────────────┘  │
│          ▲ chrome.runtime.onMessage ▲                │
└──────────┼──────────────────────────┼────────────────┘
           │                          │
    sendMessage                sendMessage
           │                          │
┌──────────┴──────────┐  ┌────────────┴────────────┐
│    content.js       │  │      popup.js            │
│   LeetCodeHelper    │  │    PopupManager          │
│  (LeetCode pages)   │  │  (toolbar popup)         │
│                      │  │                          │
│  i18n.js loaded first│  │  i18n.js loaded first   │
│  content.css injected│  │  popup.css linked        │
└─────────────────────┘  └─────────────────────────┘
```

**Communication is one-directional**: content.js and popup.js send `chrome.runtime.sendMessage` to background.js, which replies via `sendResponse`. The only reverse message is `refreshStatus` (background -> content tabs) to trigger UI refresh after data changes.

---

## 4. Data Model

All persistent data lives in `chrome.storage.local`.

### 4.1 `problems` -- Core Data

```
problems: {
  [slug: string]: {
    // Identity
    number: number | string,
    title: string,
    slug: string,              // map key, e.g. "two-sum"
    difficulty: string,        // "Easy" | "Medium" | "Hard"
    tags: string[],
    url: string,
    site: string,              // "leetcode.com" | "leetcode.cn"

    // Plan
    addedAt: number,           // timestamp ms
    planBaseAt: number,        // start-of-day timestamp for interval calculation
    planType: string,          // "full" | "half" | "custom"
    intervals: number[],       // e.g. [1, 3, 7, 14, 30, 60]
    reviewDates: number[],     // absolute timestamps (20:00 on each scheduled day)

    // Progress
    completedReviews: number,
    currentInterval: number,   // index into intervals/reviewDates
    reviewHistory: [{
      timestamp: number,
      dayLabel: number,
      reviewNumber: number,
      time: string | null,     // user-entered solve time
      comment: string | null   // user note
    }],
    mastered: boolean,
    masteredAt?: number,

    // Metadata
    addHistory: [{ timestamp, planType, intervals }],
    calendarEventIds: string[],

    // Custom problem (optional)
    isCustom?: boolean,
    customBody?: string,
    customAnswer?: string
  }
}
```

### 4.2 Other Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `uiLanguage` | `'en' \| 'zh'` | UI language preference |
| `googleToken` | `string` | Google OAuth access token |
| `planTemplates` | `{ full: {name, intervals}, half: {name, intervals} }` | User-customizable plan presets |
| `planMigrationV1Done` | `boolean` | One-time migration flag |
| `reviewTime` | `string` | Reminder time setting (e.g. "20:00") |

### 4.3 Page localStorage (content.js only)

| Key | Purpose |
|-----|---------|
| `leetcode-sr-scale` | UI scale factor (default 1.2) |
| `leetcode-sr-default-plan` | Preferred plan type ("full" / "half") |
| `leetcode-sr-collapsed-v2` | Widget collapsed state |
| `leetcode-sr-pos` | Floating widget drag position |

---

## 5. Message Protocol

All communication uses `chrome.runtime.sendMessage({ action, ...params })`.

### 5.1 Content/Popup -> Background (request/response)

| action | Params | Response | Used by |
|--------|--------|----------|---------|
| `addProblem` | `problem, planType, customIntervals, time, comment` | `{ success, error? }` | content |
| `checkProblem` | `slug` | `{ exists, mastered, problem? }` | content |
| `getProblems` | -- | `{ problems: {slug: Problem} }` | both |
| `getProblem` | `slug` | `{ problem }` | content |
| `getTodayReviews` | -- | `{ reviews: Problem[] }` | both |
| `getTodayCompleted` | -- | `{ completed: Problem[] }` | both |
| `markReviewed` | `slug, time, comment` | `{ success, ... }` | both |
| `markMastered` | `slug` | `{ success }` | both |
| `unmarkMastered` | `slug` | `{ success }` | both |
| `readdProblem` | `slug, planType, customIntervals` | `{ success }` | content |
| `addExtraReview` | `slug, days` (`number` or `number[]`; duplicates removed, sorted) | `{ success }` | content |
| `removeReviewDate` | `slug, index` | `{ success }` | content |
| `deleteProblem` | `slug` | `{ success }` | both |
| `updateCustomFields` | `slug, fields` | `{ success }` | content |
| `syncToCalendar` | `slug` | `{ success }` | background internal |
| `connectCalendar` | -- | `{ success }` | popup |
| `getPlanTemplates` | -- | `{ templates }` | both |
| `openPopup` | -- | `{ success }` | content |
| `removeIntervalFromPlan` | `plan, index` | `{ success, templates }` | both |
| `addIntervalToPlan` | `plan, days` | `{ success, templates }` | both |
| `updatePlanIntervals` | `plan, intervals` | `{ success, templates }` | both |
| `getFullExportData` | -- | `{ version, problems, settings, planTemplates }` | both |
| `importFullData` | `data` | `{ success, imported }` | both |

### 5.2 Background -> Content (push)

| action | When | Effect |
|--------|------|--------|
| `refreshStatus` | After data mutations | Content script refreshes widget, today panel, home modal |

---

## 6. Content Script Sections (content.js)

The `LeetCodeHelper` class is organized into labeled sections. Use these markers to locate code:

| Section | Line Range | Purpose |
|---------|------------|---------|
| Scale Control | ~43-115 | Load/save UI scale, default plan, language |
| URL Change Watcher | ~253-310 | Detect SPA navigation on LeetCode, re-extract problem info |
| Problem Info Extraction | ~311-424 | Parse problem number, title, slug, difficulty, tags from DOM |
| Floating UI | ~425-581 | Create floating widget: toggle button, action buttons, icon |
| Drag | ~582-692 | Drag-to-reposition the floating widget, persist position |
| Today Review Status | ~693-790 | Badge counter, today-all-done state |
| Today Review Panel | ~791-891 | Side panel listing today's due/completed problems |
| Home Modal | ~892-1062 | Full-screen overlay with tabs: Today / All / Stats / Settings |
| Date Navigation | ~1063-1236 | Mini calendar, date picker, heatmap in home modal |
| Today Tab | ~1237-1310 | Today's problems list inside home modal |
| All Problems Tab | ~1311-1424 | Search + tag filter + problem cards in home modal |
| Statistics Tab | ~1425-1567 | Charts, metrics, completion stats |
| Home Card | ~1568-1671 | Reusable problem card component for home modal |
| Home Submit Review | ~1672-1729 | Submit review dialog within home modal context |
| Settings View | ~1730-1971 | Settings panel inside home modal (scale, plans, export, language) |
| Custom Problem Modal | ~1972-2207 | Create custom (non-LeetCode) problems |
| Add Review Modal | ~2208-2340 | "Add to review" dialog with plan selection |
| Submit Review Modal | ~2341-2473 | "Submit review" dialog with time/comment input |
| Problem Detail Modal | ~2474-2749 | Full problem detail: timeline, history, manage dates |
| Extra Review Modal | ~2750-2820 | Add extra review date(s); placeholder `eg. 30 60 90`; same `parseCustomIntervals` parsing (commas/spaces/etc.) |
| Readd Modal | ~2810-2910 | Re-add a mastered/completed problem with new plan |
| Global Keyboard Shortcuts | ~204-420 | `setupGlobalKeyboardShortcuts`, `keyboardEscapeTopLayer`, Space then Enter, Shift+Cmd/Ctrl+Enter, Escape |
| Utilities | ~3182-3231 | `safeSendMessage`, `showReloadPrompt`, `showNotification`, `setupMessageListener` |
| LRS_SEARCH IIFE | ~3233-3358 | Search/ranking algorithm (duplicated in popup.js) |

---

## 7. Background Script Sections (background.js)

| Section | Line Range | Purpose |
|---------|------------|---------|
| Constructor + Init | ~2-31 | Plan templates, message listener, alarm setup, onInstalled |
| Message Router | ~46-171 | `handleMessage` switch on `request.action` |
| Core Functions | ~173-565 | `addProblem`, `markProblemReviewed`, `getTodayReviews`, `checkProblemStatus`, `deleteProblem`, etc. |
| Daily Reminder | ~566-590 | `checkDailyReviews`: badge update + desktop notification |
| Google Calendar | ~591-660 | OAuth flow + Calendar event creation via REST API |
| Plan Editing | ~661-722 | `loadPlanTemplates`, `savePlanTemplates`, add/remove interval |
| Export / Import | ~723-794 | `getFullExportData`, `importFullData` with format migration |
| Init | ~795-806 | Instantiate `SpacedRepetitionManager` singleton |

---

## 8. Popup Sections (popup.js)

| Section | Line Range | Purpose |
|---------|------------|---------|
| Constructor + Init | ~2-63 | Tab setup, search init, data load, 30s auto-refresh |
| Week Overview | ~184-238 | 7-day strip with review counts |
| Today Tasks | ~239-282 | Merged due + completed list |
| All Problems | ~283-366 | Search/filter + sorted cards |
| Problem Card | ~367-503 | Card rendering with status badges, actions |
| Submit Review Dialog | ~504-548 | Time + comment input overlay |
| Record Dialog | ~549-660 | View review history timeline |
| Plan Preview | ~661-724 | Editable interval chips in settings |
| Settings | ~725-763 | Language, Calendar connect, review time |
| Export | ~764-784 | Full data JSON export |
| Import | ~785-952 | Import with validation + LRS_SEARCH IIFE (duplicate) |

---

## 9. Styling Architecture

### 9.1 Design Tokens

Both `content.css` and `popup.css` define the same `--sr-*` CSS custom properties on `:root`:

```css
--sr-font          /* System font stack */
--sr-text-strong   /* #1e293b - headings, primary text */
--sr-text          /* #475569 - body text */
--sr-text-soft     /* #94a3b8 - secondary/muted text */
--sr-surface       /* #ffffff - card/modal backgrounds */
--sr-surface-soft  /* #f8fafc - subtle background */
--sr-surface-softer/* #f1f5f9 - deeper background */
--sr-border        /* #e2e8f0 - default borders */
--sr-border-strong /* #bfdbfe - emphasized borders */
--sr-primary       /* #2563eb - primary actions (blue) */
--sr-primary-strong/* #1d4ed8 - hover/active primary */
--sr-success       /* #10b981 - success states (green) */
--sr-warning       /* #f59e0b - warning states (amber) */
--sr-danger        /* #ef4444 - destructive actions (red) */
--sr-radius-sm/md/lg   /* 8px / 10px / 14px */
--sr-shadow-sm/md/lg   /* Elevation levels */
--sr-focus-ring    /* Accessible focus indicator */
--sr-fast / --sr-base  /* Transition durations */
```

### 9.2 CSS Class Naming Convention

- **Content script**: `leetcode-sr-*` prefix for all injected elements (avoids collision with LeetCode styles)
- **Home modal**: `sr-hm-*` prefix for home modal sub-components
- **Popup**: Standard class names (isolated in popup context, no collision risk)

### 9.3 Key Style Sections (content.css)

| Section | Purpose |
|---------|---------|
| Floating Widget Unified v2.4 | Floating button + collapsible panel |
| Home Modal | Full-screen modal with header, tabs, content |
| Home Card | Problem card in home modal |
| Sub Dialog | Nested dialogs over the home modal |
| Dark Theme | `@media (prefers-color-scheme: dark)` overrides |
| Deep Blue Theme Upgrade | Enhanced blue-forward color scheme |
| Unified Visual System v2.3 | Final harmonization pass across all components |
| Responsive | `@media` queries for smaller viewports |

### 9.4 Dark Mode

Both CSS files include dark mode via `@media (prefers-color-scheme: dark)` that overrides `--sr-*` variables with dark-appropriate values. The content.css dark mode section starts at ~line 2675.

---

## 10. i18n System

`i18n.js` defines `globalThis.LRS_I18N` with:

- **Dictionary**: `zhToEn` map -- Chinese strings are canonical keys, English strings are values.
- **`getLanguage()`** / **`setLanguage(lang)`**: Read/write `uiLanguage` in `chrome.storage.local`.
- **`t(lang, zhText)`**: Returns English translation if `lang === 'en'`, otherwise returns the Chinese key.
- **`translateText(lang, text)`**: Translates a text string, handling compound patterns like "完整复习 (6次)".
- **`localizeElement(lang, root, opts)`**: Walks DOM tree, translates text nodes and attributes (`title`, `placeholder`, `aria-label`). `skipSelectors` prevents translation of dynamic content like problem titles.

**Usage pattern in both content.js and popup.js:**
```js
this.tr('Chinese text')        // -> calls LRS_I18N.t(this.uiLanguage, text)
this.trText('Chinese text')    // -> calls LRS_I18N.translateText(this.uiLanguage, text)
this.localize(domElement)      // -> calls LRS_I18N.localizeElement(this.uiLanguage, root, opts)
```

**Adding new strings**: Add the zh->en mapping in `i18n.js`'s `zhToEn` object. Use Chinese as the key in all UI code.

---

## 11. Known Patterns and Conventions

### 11.1 Code Style

- **Vanilla JS only** -- no framework, no build step, no npm
- **Single class per file** -- `SpacedRepetitionManager`, `LeetCodeHelper`, `PopupManager`
- **IIFE for utilities** -- `LRS_I18N`, `LRS_SEARCH` are immediately-invoked, attached to `globalThis`
- **Chinese-first strings** -- UI strings are written in Chinese, translated to English by `i18n.js`
- **Async messaging** -- all `chrome.runtime.onMessage` handlers return `true` and use async `sendResponse`
- **Section markers** -- `// ============ Section Name ============` for code navigation

### 11.2 DOM Construction

- All UI is built via `document.createElement` + direct property assignment or `innerHTML` templates
- No JSX, no template literals with tagged functions
- Modal pattern: create overlay div -> append modal content -> add to `document.body` -> remove on close

### 11.3 Known Technical Debt

- **`LRS_SEARCH` is duplicated** in both `content.js` (~line 2962) and `popup.js` (~line 862). Changes must be made in both places.
- **Design token definitions are duplicated** across `content.css` and `popup.css`. Changes to the design system must update both files.
- **Dark mode overrides** are extensive blocks at the end of both CSS files; keep them in sync.

---

## 12. Development Standards

### 12.1 Consistency and Continuity

- **Follow existing section-marker pattern**: every new logical block gets `// ============ Name ============`
- **Maintain the single-class-per-file structure**: do not split classes or introduce new files without justification
- **Use the established message protocol**: new features that need data go through a new `action` in `background.js handleMessage`, consumed via `safeSendMessage` in content.js or `chrome.runtime.sendMessage` in popup.js
- **Respect the slug-keyed map**: `problems[slug]` is the single source of truth; never introduce parallel data structures
- **Keep i18n complete**: every new user-facing string needs a `zhToEn` entry in `i18n.js`

### 12.2 Style Uniformity

- **Reuse `--sr-*` design tokens** for all colors, radii, shadows, transitions. Never use hardcoded values.
- **Follow the class naming convention**: `leetcode-sr-*` for content-script DOM, `sr-hm-*` for home modal sub-elements
- **Match existing component patterns**: cards, modals, badges, buttons all have established CSS classes -- extend them rather than creating parallel styles
- **Sync both CSS files**: when modifying design tokens or adding shared components, update both `content.css` and `popup.css`
- **Dark mode**: every new visual element must have a dark-mode override in the corresponding `@media (prefers-color-scheme: dark)` block

### 12.3 User-Friendly Design Principles

- **Feedback**: every action shows visible feedback (toast notification, badge update, state change)
- **Keyboard accessibility**: modals support Enter-to-confirm (`bindEnterActivatesPrimary`), arrow-key navigation for plan radios (`bindPlanArrowKeys`), focus management (`focusModalField`)
- **Global shortcuts (LeetCode tab, `content.js` `setupGlobalKeyboardShortcuts`)**:
  - **Space then Enter** (two-step chord; **Space** arms within ~2.5s, **Enter** confirms): If a confirmable extension modal is open (`#sr-modal-confirm`, `#sr-submit-review`, `#sr-extra-confirm`, `#sr-readd-confirm`, or home sub-dialog `#sr-sub-confirm`), activates that primary button. Otherwise, on a problem page, runs the same action as the floating main button (**加入复习** / **提交复习**) when focus is not in the host code editor (Monaco/CodeMirror) or another page text field. **Space** is ignored for arming when focus is in a typing field or when no confirm/main action applies; while armed, **Space** refreshes the chord timer. Does not change widget collapsed state.
  - **Shift+Cmd+Enter** (macOS) / **Shift+Ctrl+Enter** (Windows/Linux; no Alt): If no blocking overlay is open, same expand/collapse + **当日复习** behavior as the floating toggle (collapsed → expand and open today panel; expanded → collapse). Skipped when focus is in the host code editor or a host text field (same guards as the main floating shortcut).
  - **Escape**: Dismisses the innermost extension layer only: home submit sub-dialog (`#sr-home-sub-dialog`) → problem modal (`#leetcode-sr-modal-overlay`) → home settings (`#sr-settings-view` via `hideSettingsView`) → home modal (`#sr-home-overlay`) → today side panel → expanded floating widget (collapse). Ignored when focus is in the host code editor so native Esc behavior is preserved there.
- **Graceful degradation**: `safeSendMessage` catches extension disconnect and shows a reload prompt
- **Progressive disclosure**: widget starts collapsed; details are revealed on demand via modals
- **Responsive**: content.css has `@media` queries; popup has fixed 440px width optimized for Chrome popup

### 12.4 Code Quality

- **No dead code**: remove temporary/debug code before committing
- **Error handling**: wrap all `chrome.*` API calls in try/catch; handle `null`/`undefined` responses
- **Performance**: minimize DOM operations; use `requestAnimationFrame` for layout-sensitive work
- **No external dependencies**: this is a self-contained extension with zero runtime dependencies

---

## 13. Git Commit Instructions

When user says "commit" or "push to GitHub", execute these steps in order:

### Step 1 -- Version bump

Determine bump type from changes, then calculate new version:
- **PATCH** +1: bug fix, typo, micro tweak (v2.1.12 -> v2.1.13)
- **MINOR** +1, PATCH reset: new feature, UI change (v2.1.12 -> v2.2.0)
- **MAJOR** +1: breaking change, architecture rewrite (v2.x.x -> v3.0.0)

### Step 2 -- Update version in 3 places

1. `manifest.json` -- `"version"` field
2. `popup.html` -- footer `<span>vX.Y.Z</span>`
3. `history.md` -- append new version section at end (this file is gitignored)

### Step 3 -- Commit and push

```bash
git add -A
git commit -m "<type>(vX.Y.Z): <short description>

- version: vOLD -> vNEW
- change details (max 4 lines)
"
git push
```

Commit types: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`

### Step 4 -- Report to user

```
Committed and pushed vX.Y.Z.

Changes:
- <what changed, 1-3 lines>
```

### .gitignore

Excludes: `.DS_Store`, `.vscode/`, `node_modules/`, `.env`, `dist/`, `build/`, `cache/`, `output/`, `results/`, `*.log`, `*.tmp`, `WLOG.md`, `history.md`, `leetcode-reviews-*.json`, `*.zip`

---

## 14. Quick Reference: Where to Make Changes

| Task | Files to Modify |
|------|----------------|
| Add new data field to problems | `background.js` (storage logic) |
| Add new message action | `background.js` (handleMessage) + caller in `content.js` or `popup.js` |
| Add new UI to floating widget | `content.js` (Floating UI section) + `content.css` |
| Add new home modal tab | `content.js` (Home Modal section) + `content.css` (Home Modal styles) |
| Add new popup tab | `popup.html` (tab button + content div) + `popup.js` (tab logic) + `popup.css` |
| Add new dialog/modal | `content.js` (new section) + `content.css` (dialog styles) |
| Add new user-facing string | `i18n.js` (zhToEn mapping) + usage site |
| Change colors/design tokens | `content.css` + `popup.css` (`:root` block + dark mode block) |
| Change review algorithm | `background.js` (generateReviewDates, getIntervals, markProblemReviewed) |
| Add new plan template | `background.js` (planTemplates, loadPlanTemplates) |
| Modify search/ranking | `content.js` AND `popup.js` (LRS_SEARCH IIFE -- both copies) |
| Add Chrome permission | `manifest.json` (permissions or host_permissions) |
| Change extension metadata | `manifest.json` (name, version, description) |
| Bump version | See Section 13 (4-step commit workflow) |
| Update screenshots | `images/` directory + README files |
