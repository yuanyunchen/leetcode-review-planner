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


## Usage

**A) Problem-page entry and quick actions**  
The workflow starts directly on the problem page. Expand the floating widget to add or submit reviews, and open the Today panel to jump to due tasks immediately.

<p>
  <img src="images/01-problem-page-widget.png" alt="Problem page widget" width="49%" align="middle">
  <img src="images/02-widget-today-panel.png" alt="Today review panel from widget" width="49%" align="middle">
</p>

**B) Plan setup, submission, and records**  
When adding a problem, choose Full/Light/Custom intervals and optionally save notes/time. During review, submit time and notes in one focused modal, then track full progress in the record view.

<!-- <p>
  <img src="images/03-add-plan-modal.png" alt="Add to review plan modal" width="32.6%" align="middle">
  <img src="images/04-submit-review-modal.png" alt="Submit review modal" width="32.6%" align="middle">
  <img src="images/05-problem-record-modal.png" alt="Problem record modal" width="32.6%" align="middle">
</p> -->

<p>
  <img src="images/03-add-plan-modal.png" alt="Add to review plan modal" width="50%" align="middle">
  <img src="images/05-problem-record-modal.png" alt="Problem record modal" width="50%" align="middle">
</p>


**C) Home management and personalization**  
The Home "All Problems" view supports search, tags, and quick actions for daily management. Settings lets you tune language, default plan, UI scale, and interval templates.

<p>
  <img src="images/07-home-settings.png" alt="Home settings view" width="49%" align="middle">
  <img src="images/06-home-all-problems.png" alt="Home all problems view" width="49%" align="middle">
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

