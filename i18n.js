// Simple built-in i18n (no external translator)
(function () {
  const STORAGE_KEY = 'uiLanguage';
  const DEFAULT_LANGUAGE = 'en';
  const SUPPORTED = ['en', 'zh'];

  const zhToEn = {
    'LeetCode 复习计划': 'LeetCode Review Planner',
    '基于遗忘曲线的智能复习系统': 'Smart spaced repetition based on forgetting curve',
    '总题数': 'Total',
    '待复习': 'Due',
    '今日完成': 'Done Today',
    '已掌握': 'Mastered',
    '本周复习概览': 'This Week Overview',
    '📅 本周复习概览': '📅 This Week Overview',
    '累计复习': 'Total Reviews',
    '📊 累计复习': '📊 Total Reviews',
    '次': 'times',
    '完成率': 'Completion Rate',
    '📈 完成率': '📈 Completion Rate',
    '今日任务': 'Today Tasks',
    '今日题目': 'Today Problems',
    '全部题目': 'All Problems',
    '数据统计': 'Statistics',
    '界面语言': 'Interface Language',
    '🌐 界面语言': '🌐 Interface Language',
    '设置': 'Settings',
    '搜索题号、题目名称...': 'Search by number or title...',
    '今天没有需要复习的题目': 'No reviews due today',
    '继续保持！': 'Keep it up!',
    '还没有添加任何题目': 'No problems added yet',
    '还没有添加题目': 'No problems added yet',
    '没有找到匹配的题目': 'No matching results',
    '没有匹配结果': 'No matching results',
    '试试其他关键词或标签': 'Try another keyword or tag',
    '试试其他关键词': 'Try another keyword',
    '在题目页面点击「加入复习」': 'Open a problem page and click "Add Review"',
    '打开LeetCode题目页面，点击浮动按钮添加': 'Open a LeetCode problem page and click the floating button to add',
    'Google Calendar 集成': 'Google Calendar Integration',
    '🔗 Google Calendar 集成': '🔗 Google Calendar Integration',
    '将复习计划自动同步到 Google Calendar': 'Sync review plans to Google Calendar',
    '连接 Google Calendar': 'Connect Google Calendar',
    '复习时间设置': 'Review Reminder Time',
    '⏰ 复习时间设置': '⏰ Review Reminder Time',
    '每天的复习提醒时间': 'Daily reminder time',
    '复习间隔方案': 'Review Interval Plans',
    '遗忘曲线间隔（天）· 点击 × 删除，点击 + 添加': 'Spaced intervals (days). Click × to remove, + to add',
    '数据管理': 'Data',
    '导出数据': 'Export Data',
    '导入数据': 'Import Data',
    '清空所有数据': 'Clear All Data',
    '📤 导出数据': '📤 Export Data',
    '📥 导入数据': '📥 Import Data',
    '🗑️ 清空所有数据': '🗑️ Clear All Data',
    '展开/折叠': 'Expand/Collapse',
    '当日复习': 'Today Review',
    '📋 当日复习': '📋 Today Review',
    '当日复习 ✓': 'Today Review ✓',
    '加入复习': 'Add Review',
    '📚 加入复习计划': '📚 Add to Review Plan',
    '提交复习': 'Submit Review',
    '✅ 提交复习': '✅ Submit Review',
    '记录': 'Record',
    '📋 查看记录': '📋 View Record',
    '📋 记录': '📋 Record',
    '主页': 'Home',
    '加载中...': 'Loading...',
    '已完成所有复习任务！': 'All reviews completed!',
    '加载失败': 'Load failed',
    '今天没有复习任务': 'No tasks today',
    '未完成任务': 'Missed Tasks',
    '⏰ 未完成任务': '⏰ Missed Tasks',
    '暂无未完成任务': 'No missed tasks',
    '忽略': 'Ignore',
    '打开题目': 'Open Problem',
    '打开': 'Open',
    '查看记录': 'View Record',
    '删除题目': 'Delete Problem',
    '删除': 'Delete',
    '已删除': 'Deleted',
    '逾期': 'Overdue',
    '已完成': 'Completed',
    '已完成所有复习': 'All reviews completed',
    '已掌握': 'Mastered',
    '⭐ 掌握': '⭐ Mastered',
    '✅ 完成': '✅ Completed',
    '下次': 'Next',
    '输入天数:': 'Enter days:',
    '取消': 'Cancel',
    '提交': 'Submit',
    '确认': 'Confirm',
    '关闭': 'Close',
    '添加中...': 'Adding...',
    '导出失败': 'Export failed',
    '导出失败: ': 'Export failed: ',
    '导入失败': 'Import failed',
    '导入失败: ': 'Import failed: ',
    '✅ 导出成功': '✅ Export successful',
    '删除失败': 'Delete failed',
    '添加失败': 'Add failed',
    '连接中...': 'Connecting...',
    '✅ 已成功连接到 Google Calendar': '✅ Connected to Google Calendar',
    '✅ 已连接': '✅ Connected',
    '重试连接': 'Retry',
    '✅ 复习已提交': '✅ Review submitted',
    '✅ 复习已提交！': '✅ Review submitted!',
    '✅ 已添加到复习计划！': '✅ Added to review plan!',
    '✅ 已添加复习计划': '✅ Added to plan',
    '✅ 已重新加入复习计划': '✅ Re-added to plan',
    '✅ 已标记为掌握': '✅ Marked as mastered',
    '已取消掌握标记': 'Mastered removed',
    '确定要删除这道题吗？': 'Delete this problem?',
    '确定要删除这道题的所有记录吗？': 'Delete all records of this problem?',
    '确定要清空所有数据吗？此操作不可恢复！': 'Clear all data? This cannot be undone.',
    '再次确认：真的要删除所有复习记录吗？': 'Confirm again: delete all review records?',
    '所有数据已清空': 'All data cleared',
    '无待复习计划': 'No upcoming reviews',
    '暂无复习记录': 'No review records',
    '加入时间': 'Added',
    '历史记录': 'History',
    '添加记录': 'Add Records',
    '进度': 'Progress',
    '复习进度': 'Progress',
    '状态': 'Status',
    '复习历史': 'Review History',
    '复习计划': 'Upcoming Plan',
    '+ 添加复习': '+ Add Review',
    '重新加入': 'Re-add',
    '⭐ 标记掌握': '⭐ Mark Mastered',
    '取消掌握': 'Unmark',
    '题目记录': 'Problem Record',
    '📋 题目记录': '📋 Problem Record',
    '添加复习': 'Add Review',
    '📅 添加复习': '📅 Add Review',
    '🔄 重新加入复习': '🔄 Re-add Review',
    '输入天数，将在对应天后安排一次复习。': 'Enter days to add one extra review at that day.',
    '天数（如: 7）': 'Days (e.g. 7)',
    '天数（如: 0）': 'Days (e.g. 0)',
    '将重置复习进度（历史记录会保留），确定吗？': 'This resets progress (history kept). Continue?',
    'ℹ️ 未到计划日期，仅记录笔记': 'ℹ️ Not due yet. Saved as note only',
    '加入复习计划': 'Add to Review Plan',
    '完整复习 (6次)': 'Full Plan (6)',
    '精简复习 (3次)': 'Light Plan (3)',
    '🔥 完整复习 (6次)': '🔥 Full Plan (6)',
    '⚡ 精简复习 (3次)': '⚡ Light Plan (3)',
    '🧪 自定义间隔': '🧪 Custom Intervals',
    '自定义间隔（如: 3,10,30 或 3 10 30）': 'Custom intervals (e.g. 3,10,30 or 3 10 30)',
    '自定义间隔（如: 0,3,10,30 或 0 3 10 30）': 'Custom intervals (e.g. 0,3,10,30 or 0 3 10 30)',
    '支持空格、逗号、分号': 'Supports spaces, commas, and semicolons',
    '添加笔记': 'Add Notes',
    '（可选）': '(optional)',
    '用时（如: 25min）': 'Time spent (e.g. 25min)',
    '用时（如: 15min）': 'Time spent (e.g. 15min)',
    '笔记（可选）': 'Notes (optional)',
    '确认添加': 'Add',
    '默认复习方案': 'Default Review Plan',
    '✅ 默认复习方案': '✅ Default Review Plan',
    '用于“加入复习/重新加入”页面的默认自动勾选': 'Preselected for Add/Re-add dialogs',
    '完整复习': 'Full Plan',
    '精简复习': 'Light Plan',
    '🔥 完整复习': '🔥 Full Plan',
    '⚡ 精简复习': '⚡ Light Plan',
    '显示大小': 'UI Scale',
    '🔍 显示大小': '🔍 UI Scale',
    '调整插件界面的显示比例': 'Adjust overall UI scale',
    '点击 × 删除间隔，点击 + 添加新天数': 'Click × to remove interval, + to add days',
    '📊 复习间隔方案': '📊 Review Interval Plans',
    '📈 数据管理': '📈 Data',
    '返回': 'Back',
    '← 返回': '← Back',
    '请输入有效天数': 'Please enter a valid day value',
    '连续天数': 'Streak',
    '平均用时': 'Avg Time',
    '掌握率': 'Mastery Rate',
    '总复习次数': 'Total Reviews',
    '复习活动（近14天）': 'Review Activity (14 days)',
    '📈 复习活动（近14天）': '📈 Review Activity (14 days)',
    '难度分布': 'Difficulty Distribution',
    '📊 难度分布': '📊 Difficulty Distribution',
    '本周概览': 'This Week',
    '📅 本周概览': '📅 This Week',
    '题目不存在': 'Problem not found',
    '方案不存在': 'Plan not found',
    '索引无效': 'Invalid index',
    '至少保留一个间隔': 'Keep at least one interval',
    '该天数已存在': 'This day already exists',
    '无法删除已完成的复习': 'Cannot remove completed review',
    '无效数据': 'Invalid data',
    '这道题已经在复习计划中了': 'This problem is already in review plan',
    '成功添加到复习计划': 'Added to review plan',
    '计划复习已完成': 'Planned review completed',
    '未到计划日期，仅记录笔记': 'Not due yet, note saved only',
    '已重新加入复习计划': 'Re-added to review plan',
    '复习完成！': 'Review done!',
    '完成全部复习！': 'All reviews completed!',
    '今日复习提醒': 'Today review reminder',
    '⚙️ 设置': '⚙️ Settings',
    '✅ 全部完成': '✅ Completed',
    '📖 复习中': '📖 In Progress',
    '🔥 完整': '🔥 Full',
    '⚡ 精简': '⚡ Light',
    '🧪 自定义': '🧪 Custom',
    '完整': 'Full',
    '精简': 'Light',
    '自定义': 'Custom',
    '移除': 'Remove',
    '添加天数': 'Add days',
    '已移除': 'Removed',
    '⚠️ 扩展已更新': '⚠️ Extension updated',
    '点击此处刷新页面以重新连接': 'Click to refresh and reconnect',
    '笔记': 'Notes',
    '英语': 'English',
    '中文': 'Chinese'
  };

  const enToZh = Object.fromEntries(Object.entries(zhToEn).map(([zh, en]) => [en, zh]));

  const zhPatterns = [
    [/^📋 待复习 \((\d+)\)$/, '📋 Due ($1)'],
    [/^📥 今日添加的题目 \((\d+)\)$/, '📥 Added Today ($1)'],
    [/^✅ 今日已完成 \((\d+)\)$/, '✅ Done Today ($1)'],
    [/^📋 当日复习 \((\d+)\)$/, '📋 Today Review ($1)'],
    [/^⏰ 未完成任务 \((\d+)\)$/, '⏰ Missed Tasks ($1)'],
    [/^第(\d+)天$/, 'Day $1'],
    [/^📅 下次: (.+)$/, '📅 Next: $1'],
    [/^周日$/, 'Sun'], [/^周一$/, 'Mon'], [/^周二$/, 'Tue'], [/^周三$/, 'Wed'], [/^周四$/, 'Thu'], [/^周五$/, 'Fri'], [/^周六$/, 'Sat'],
    [/^今天$/, 'Today'],
    [/^逾期 (\d+) 天$/, 'Overdue $1d'],
    [/^✅ 导入成功！(\d+) 道题$/, '✅ Import successful! $1 problems'],
    [/^✅ 数据导入成功！导入了 (\d+) 道题目$/, '✅ Import successful! Imported $1 problems'],
    [/^❌ 连接失败: (.+)$/, '❌ Connection failed: $1'],
    [/^你有 (\d+) 道题需要复习！$/, 'You have $1 problems to review today!']
  ];

  const enPatterns = [
    [/^📋 Due \((\d+)\)$/, '📋 待复习 ($1)'],
    [/^📥 Added Today \((\d+)\)$/, '📥 今日添加的题目 ($1)'],
    [/^✅ Done Today \((\d+)\)$/, '✅ 今日已完成 ($1)'],
    [/^📋 Today Review \((\d+)\)$/, '📋 当日复习 ($1)'],
    [/^⏰ Missed Tasks \((\d+)\)$/, '⏰ 未完成任务 ($1)'],
    [/^Day (\d+)$/, '第$1天'],
    [/^📅 Next: (.+)$/, '📅 下次: $1'],
    [/^Sun$/, '周日'], [/^Mon$/, '周一'], [/^Tue$/, '周二'], [/^Wed$/, '周三'], [/^Thu$/, '周四'], [/^Fri$/, '周五'], [/^Sat$/, '周六'],
    [/^Today$/, '今天'],
    [/^Overdue (\d+)d$/, '逾期 $1 天'],
    [/^✅ Import successful! (\d+) problems$/, '✅ 导入成功！$1 道题'],
    [/^✅ Import successful! Imported (\d+) problems$/, '✅ 数据导入成功！导入了 $1 道题目'],
    [/^❌ Connection failed: (.+)$/, '❌ 连接失败: $1'],
    [/^You have (\d+) problems to review today!$/, '你有 $1 道题需要复习！']
  ];

  function normalizeLanguage(lang) {
    return SUPPORTED.includes(lang) ? lang : DEFAULT_LANGUAGE;
  }

  async function getLanguage() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const lang = normalizeLanguage(result[STORAGE_KEY]);
      if (!result[STORAGE_KEY]) {
        await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_LANGUAGE });
      }
      return lang;
    } catch (e) {
      return DEFAULT_LANGUAGE;
    }
  }

  async function setLanguage(lang) {
    const normalized = normalizeLanguage(lang);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    } catch (e) { /* ignore */ }
    return normalized;
  }

  function applyPatterns(text, patterns) {
    for (const [re, replacement] of patterns) {
      if (re.test(text)) return text.replace(re, replacement);
    }
    return text;
  }

  function translateText(lang, text) {
    if (!text || typeof text !== 'string') return text;
    const trimmed = text.trim();
    if (!trimmed) return text;

    let out = trimmed;
    if (lang === 'en') {
      out = zhToEn[trimmed] || applyPatterns(trimmed, zhPatterns);
    } else {
      out = enToZh[trimmed] || applyPatterns(trimmed, enPatterns);
    }
    if (out === trimmed) return text;
    return text.replace(trimmed, out);
  }

  function localizeElement(lang, root, options = {}) {
    if (!root) return;
    const skipSelectors = options.skipSelectors || [];
    const shouldSkip = (node) => {
      if (!node || node.nodeType !== 1) return false;
      return skipSelectors.some(sel => node.matches(sel) || node.closest(sel));
    };

    const attrs = ['title', 'placeholder', 'aria-label'];
    if (root.nodeType === 1 && !shouldSkip(root)) {
      attrs.forEach(attr => {
        if (root.hasAttribute(attr)) {
          root.setAttribute(attr, translateText(lang, root.getAttribute(attr)));
        }
      });
    }

    const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
    allElements.forEach(el => {
      if (shouldSkip(el)) return;
      attrs.forEach(attr => {
        if (el.hasAttribute(attr)) {
          el.setAttribute(attr, translateText(lang, el.getAttribute(attr)));
        }
      });
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let current = walker.nextNode();
    while (current) {
      textNodes.push(current);
      current = walker.nextNode();
    }
    textNodes.forEach(node => {
      const parent = node.parentElement;
      if (!parent || shouldSkip(parent)) return;
      if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return;
      node.nodeValue = translateText(lang, node.nodeValue);
    });
  }

  globalThis.LRS_I18N = {
    STORAGE_KEY,
    DEFAULT_LANGUAGE,
    SUPPORTED,
    getLanguage,
    setLanguage,
    t: (lang, key) => translateText(lang, key),
    translateText,
    localizeElement
  };
})();
