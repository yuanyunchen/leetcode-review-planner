# LeetCode Review Helper

A Chrome extension that uses **Ebbinghaus forgetting curve** to intelligently schedule LeetCode problem reviews, with Google Calendar integration.

> Never forget how to solve a problem again.

## ✨ Features

- **One-Click Add**: Floating button on LeetCode problem pages to instantly add to your review plan
- **Smart Scheduling**: Automatically schedules reviews based on the Ebbinghaus forgetting curve
- **Google Calendar Sync**: Syncs review events to your Google Calendar with reminders
- **Daily Notifications**: Chrome notifications remind you of today's reviews
- **Tag Extraction**: Automatically captures problem tags (Array, DP, Tree, etc.)
- **Progress Tracking**: Track your review completion with stats dashboard
- **Data Management**: Export/import your review data as JSON

## 📊 Forgetting Curve Intervals

Reviews are scheduled at scientifically-backed intervals:

| Review | Interval |
|--------|----------|
| 1st | 1 day |
| 2nd | 3 days |
| 3rd | 7 days |
| 4th | 14 days |
| 5th | 30 days |
| 6th | 60 days |

After 6 reviews, the problem is considered mastered and moved to long-term memory.

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/KimAu197/leetcode-review-helper.git
cd leetcode-review-helper
```

### 2. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **"Load unpacked"**
4. Select the project folder

### 3. (Optional) Set Up Google Calendar

To enable Google Calendar sync:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google Calendar API**
4. Set up **OAuth consent screen** (add yourself as a test user)
5. Create an **OAuth 2.0 Client ID** (type: Chrome Extension)
6. Copy the Client ID into `manifest.json` under `oauth2.client_id`

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions.

### 4. (Optional) Add Icons

Place PNG icons in the `icons/` folder:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

You can use `generate-icons.html` to quickly generate them.

## 🚀 Usage

### Adding a Problem

1. Open any LeetCode problem page (supports both `leetcode.com` and `leetcode.cn`)
2. Click the **"Add to Review"** floating button on the right side
3. The problem is saved with 6 scheduled review dates

### Reviewing

1. Click the extension icon in Chrome toolbar
2. Check the **"Today's Review"** tab for problems due today
3. Click **"Open Problem"** to re-solve it on LeetCode
4. Click **"Mark Done"** when finished
5. The next review is automatically scheduled

### Popup Dashboard

| Tab | Description |
|-----|-------------|
| Today's Review | Problems due for review today |
| Completed Today | Problems you've reviewed today |
| All Problems | Full list of tracked problems |
| Settings | Google Calendar, data management |

### Stats Panel

The top of the popup shows 4 key metrics:
- **Total** — Total problems tracked
- **Due** — Problems due for review today
- **Done Today** — Problems reviewed today
- **Mastered** — Problems that completed all 6 reviews

## 🛠️ Tech Stack

- **Chrome Manifest V3** — Latest extension standard
- **Vanilla JavaScript** — Zero dependencies, lightweight
- **Google Calendar API** — Calendar event sync
- **Chrome Storage API** — Local data persistence
- **Chrome Alarms API** — Periodic review checks

## 📂 Project Structure

```
leetcode-review-helper/
├── manifest.json        # Extension configuration
├── background.js        # Service worker (scheduling, API)
├── content.js           # Content script (floating button, scraping)
├── content.css          # Content script styles
├── popup.html           # Popup UI
├── popup.css            # Popup styles
├── popup.js             # Popup logic
├── icons/               # Extension icons
├── generate-icons.html  # Icon generator tool
├── SETUP_GUIDE.md       # Detailed setup guide
├── QUICK_START.md       # Quick start guide
└── README.md
```

## 🔒 Privacy

- All data is stored **locally** in Chrome Storage
- Google Calendar is accessed **only** after explicit user authorization
- **No data collection** — nothing is sent to any server
- Fully open source — audit the code yourself

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Floating button not showing | Refresh the LeetCode page; make sure you're on a `/problems/` page |
| "Extension context invalidated" | Refresh the LeetCode page after reloading the extension |
| Google Calendar connection failed | Check Client ID in manifest.json; add yourself as a test user in OAuth consent screen |
| Problem info not captured | LeetCode may have updated their DOM; refresh and retry |

## 🚧 Roadmap

- [ ] Custom review intervals
- [ ] Statistics charts and learning curves
- [ ] Anki card export
- [ ] Daily streak tracking
- [ ] Multi-language UI support
- [ ] Mobile companion app

## 📝 Changelog

### v1.0.0
- Initial release
- Ebbinghaus forgetting curve scheduling
- Google Calendar integration
- Floating button on LeetCode pages
- Problem tag extraction
- Today's review / completed today / all problems views
- Data export & import

## 📄 License

MIT License

## 👨‍💻 Author

Made with ❤️ by Kenzie

---

If you find this useful, give it a ⭐!
