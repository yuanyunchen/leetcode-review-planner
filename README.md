# <img src="icons/icon32.png" alt="LeetCode Review Planner icon" width="36"> LeetCode Review Planner - Chrome Extension

[English](README.md) | [简体中文](README.zh-CN.md)


`LeetCode Review Planner` is a Chrome extension for `leetcode.com`.
It helps you review solved problems with Ebbinghaus-style intervals, notes, time tracking, and a clean dashboard.

> Never forget solved problems again.  
> Learn once, retain long-term with spaced repetition.

## Forgetting Curve 

The Ebbinghaus forgetting curve says memory drops quickly after learning, then slows down.  
The best strategy is short, repeated reviews at increasing intervals.


| Plan | Review Days |
|---|---|
| Full | 1, 3, 7, 14, 30, 60 |
| Light | 3, 10, 30 |

You can also edit interval plans in Settings.


## Quick Start

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select folder: `leetcode-review-helper/`

Optional:
- Google Calendar sync: `SETUP_GUIDE.md`
- Quick setup guide: `QUICK_START.md`

## Usage

**A) Problem-page entry and quick actions**  
The workflow starts directly on the problem page. First you see the compact floating entry; after expanding it, you can immediately choose what to do next: add this problem to a review plan, submit a review, or open the record panel.

<p>
  <img src="images/01-problem-page-widget-collapsed.png" alt="Problem page - widget collapsed" width="49%" align="middle">
  <img src="images/02-problem-page-widget-expanded.png" alt="Problem page - widget expanded" width="49%" align="middle">
</p>

**B) Plan setup and record tracking**  
When adding a problem, you pick Full or Light intervals and can attach optional notes/time to keep context. Later, the record page shows your progress, review history, and upcoming review dates so you always know what to practice next.

<p>
  <img src="images/03-add-to-review-modal.png" alt="Add to review modal" width="49%" align="middle">
  <img src="images/04-problem-record-modal.png" alt="Problem record modal" width="49%" align="middle">
</p>

**C) Daily management and personalization**  
The Home panel is your daily command center for searching, filtering, and bulk actions across all tracked problems. Settings lets you personalize language, UI scale, interval templates, and data backup flow for long-term use.

<p>
  <img src="images/05-home-all-problems.png" alt="Home - all problems" width="49%" align="middle">
  <img src="images/06-settings-panel.png" alt="Settings panel" width="49%" align="middle">
</p>


## ✨ Features

- **One-click review workflow** on LeetCode problem pages.
- **Spaced repetition plans** (`Full` / `Light`) with editable intervals.
- **Problem record view**: added date, progress, review history, future plan.
- **Home dashboard**: Today / All Problems / Statistics / Settings.
- **Tag search + filters** to quickly locate problems.
- **Bilingual UI**: English by default, Chinese optional.
- **Data backup**: full JSON export/import for migration between versions.


## FAQ

### Does it support both LeetCode sites?
Yes. It supports `leetcode.com` and `leetcode.cn`.

### Is my data private?
Yes. Data is stored in Chrome local storage. No external user-data server is used.

### Will data be lost after updates?
Use built-in JSON export/import for backup and migration across versions.


## Version

`v2.0` · Made by Kenzie & Ethan

If this helps your interview prep, a ⭐ is appreciated.

