// Popup界面逻辑

class PopupManager {
  constructor() {
    this.currentTab = 'today';
    this.allProblems = [];
    this.searchQuery = '';
    this.activeTag = null;
    this.uiLanguage = 'en';
    this.init();
  }

  async init() {
    await this.loadLanguage();
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.currentTarget.dataset.tab);
      });
    });

    this.setupEventListeners();
    this.setupSearch();
    await this.loadData();
    this.localize(document.body);
    setInterval(() => this.loadData(), 30000);
  }

  async loadLanguage() {
    if (globalThis.LRS_I18N) {
      this.uiLanguage = await LRS_I18N.getLanguage();
      document.documentElement.lang = this.uiLanguage === 'zh' ? 'zh-CN' : 'en';
    }
  }

  async saveLanguage(lang) {
    if (globalThis.LRS_I18N) {
      this.uiLanguage = await LRS_I18N.setLanguage(lang);
      document.documentElement.lang = this.uiLanguage === 'zh' ? 'zh-CN' : 'en';
    }
  }

  tr(text) {
    if (!globalThis.LRS_I18N) return text;
    return LRS_I18N.t(this.uiLanguage, text);
  }

  trText(text) {
    if (!globalThis.LRS_I18N) return text;
    return LRS_I18N.translateText(this.uiLanguage, text);
  }

  _dayStartTs(ts = Date.now()) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  localize(root) {
    if (!globalThis.LRS_I18N || !root) return;
    LRS_I18N.localizeElement(this.uiLanguage, root, {
      skipSelectors: ['.problem-title', '.record-comment', '.card-last-review', '.tag']
    });
  }

  bindEnterActivatesPrimary(overlay, primarySelector) {
    if (!overlay) return;
    const primaryBtn = typeof primarySelector === 'string' ? overlay.querySelector(primarySelector) : primarySelector;
    if (!primaryBtn) return;
    const handler = (e) => {
      if (e.key !== 'Enter' || e.repeat) return;
      if (!overlay.contains(e.target)) return;
      const t = e.target;
      if (t.tagName === 'TEXTAREA') return;
      if (t.isContentEditable) return;
      if (t.tagName === 'SELECT') return;
      if (t.tagName === 'INPUT') {
        const type = (t.type || '').toLowerCase();
        if (type === 'radio' || type === 'checkbox') return;
        if (type === 'button' || type === 'submit' || type === 'reset') return;
      }
      const btn = t.closest && t.closest('button');
      if (btn && btn !== primaryBtn) return;
      if (t === primaryBtn || primaryBtn.contains(t)) return;
      e.preventDefault();
      e.stopPropagation();
      primaryBtn.click();
    };
    overlay.addEventListener('keydown', handler, true);
  }

  focusDialogField(overlay, selector) {
    if (!overlay || !selector) return;
    requestAnimationFrame(() => {
      overlay.querySelector(selector)?.focus();
    });
  }

  setupEventListeners() {
    document.getElementById('connectCalendar').addEventListener('click', () => this.connectCalendar());
    document.getElementById('reviewTime').addEventListener('change', (e) => this.saveReviewTime(e.target.value));
    document.getElementById('exportData').addEventListener('click', () => this.exportData());
    document.getElementById('importData').addEventListener('click', () => this.importData());
    document.getElementById('clearData').addEventListener('click', () => this.clearData());
    document.querySelectorAll('input[name="uiLanguage"]').forEach(input => {
      input.checked = input.value === this.uiLanguage;
      input.closest('.lang-option')?.classList.toggle('active', input.checked);
      input.addEventListener('change', async (e) => {
        await this.saveLanguage(e.target.value);
        document.querySelectorAll('.lang-option').forEach(o => o.classList.remove('active'));
        e.target.closest('.lang-option')?.classList.add('active');
        await this.loadData();
        this.localize(document.body);
      });
    });
  }

  setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      searchClear.classList.toggle('hidden', !this.searchQuery);
      this.renderFilteredProblems();
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      searchClear.classList.add('hidden');
      this.renderFilteredProblems();
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    const searchBar = document.getElementById('searchBar');
    searchBar.classList.toggle('hidden', tabName !== 'all');

    if (tabName === 'today') this.loadTodayTasks();
    else if (tabName === 'all') this.loadAllProblems();
    else if (tabName === 'settings') this.loadPlanTemplates();
  }

  async loadData() {
    await this.updateStats();
    await this.loadWeekOverview();
    if (this.currentTab === 'today') await this.loadTodayTasks();
    else if (this.currentTab === 'all') await this.loadAllProblems();
    else if (this.currentTab === 'settings') await this.loadPlanTemplates();
    this.localize(document.body);
  }

  async updateStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProblems' });
      const problems = response.problems || [];
      const todayResponse = await chrome.runtime.sendMessage({ action: 'getTodayReviews' });
      const todayReviews = todayResponse.reviews || [];
      const todayCompletedResponse = await chrome.runtime.sendMessage({ action: 'getTodayCompleted' });
      const todayCompleted = todayCompletedResponse.completed || [];
      const mastered = problems.filter(p => p.mastered).length;
      const totalReviewsDone = problems.reduce((sum, p) => sum + (p.completedReviews?.length || 0), 0);
      const completionRate = problems.length > 0 ? Math.round((mastered / problems.length) * 100) : 0;

      document.getElementById('totalProblems').textContent = problems.length;
      document.getElementById('todayReviews').textContent = todayReviews.length;
      document.getElementById('todayCompleted').textContent = todayCompleted.length;
      document.getElementById('masteredProblems').textContent = mastered;
      document.getElementById('totalReviewsDone').textContent = totalReviewsDone;
      document.getElementById('completionRate').textContent = completionRate + '%';
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  // ============ 本周概览 ============
  async loadWeekOverview() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProblems' });
      const problems = response.problems || [];
      const weekDays = document.getElementById('weekDays');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

      let html = '';
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dStart = d.getTime();
        const dEnd = dStart + 86400000;

        const count = problems.filter(p => {
          if (p.mastered) return false;
          if (p.currentInterval >= p.reviewDates.length) return false;
          const next = p.reviewDates[p.currentInterval];
          const dueDay = this._dayStartTs(next);
          return dueDay >= dStart && dueDay < dEnd;
        }).length;

        let overdueCount = 0;
        if (i === 0) {
          overdueCount = problems.filter(p => {
            if (p.mastered) return false;
            if (p.currentInterval >= p.reviewDates.length) return false;
            return this._dayStartTs(p.reviewDates[p.currentInterval]) < dStart;
          }).length;
        }

        const totalCount = count + overdueCount;
        const isToday = i === 0;
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const dayName = isToday ? '今天' : `周${dayNames[d.getDay()]}`;

        html += `
          <div class="week-day ${isToday ? 'today' : ''} ${totalCount > 0 ? 'has-reviews' : ''}">
            <div class="week-day-name">${dayName}</div>
            <div class="week-day-count">${totalCount}</div>
            <div class="week-day-date">${dateStr}</div>
          </div>
        `;
      }
      weekDays.innerHTML = html;
      this.localize(weekDays);
    } catch (error) {
      console.error('Error loading week overview:', error);
    }
  }

  // ============ 今日任务（合并复习+完成） ============
  async loadTodayTasks() {
    try {
      const [reviewResp, completedResp] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getTodayReviews' }),
        chrome.runtime.sendMessage({ action: 'getTodayCompleted' })
      ]);
      const reviews = reviewResp.reviews || [];
      const completed = completedResp.completed || [];
      const container = document.getElementById('todayList');

      if (reviews.length === 0 && completed.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🎉</div>
            <p>今天没有需要复习的题目</p>
            <small>继续保持！</small>
          </div>
        `;
        return;
      }

      let html = '';

      // 待复习
      if (reviews.length > 0) {
        html += `<div class="section-label pending-label">📋 待复习 (${reviews.length})</div>`;
        html += reviews.map(p => this.createProblemCard(p, 'today')).join('');
      }

      // 今日已完成
      if (completed.length > 0) {
        html += `<div class="section-label done-label">✅ 今日已完成 (${completed.length})</div>`;
        html += completed.map(p => this.createProblemCard(p, 'done')).join('');
      }

      container.innerHTML = html;
      this.attachCardListeners();
      this.localize(container);
    } catch (error) {
      console.error('Error loading today tasks:', error);
    }
  }

  // ============ 全部题目 ============
  async loadAllProblems() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProblems' });
      this.allProblems = response.problems || [];
      this.allProblems.sort((a, b) => b.addedAt - a.addedAt);
      this.buildTagFilter();
      this.renderFilteredProblems();
    } catch (error) {
      console.error('Error loading all problems:', error);
    }
  }

  buildTagFilter() {
    const tagCounts = {};
    this.allProblems.forEach(p => {
      (p.tags || []).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
    });

    const tagFilter = document.getElementById('tagFilter');
    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

    if (sortedTags.length === 0) { tagFilter.innerHTML = ''; return; }

    tagFilter.innerHTML = sortedTags.map(([tag, count]) => `
      <button class="tag-filter-btn ${this.activeTag === tag ? 'active' : ''}" data-tag="${tag}">
        ${tag} <span style="opacity:0.6">(${count})</span>
      </button>
    `).join('');

    tagFilter.querySelectorAll('.tag-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (this.activeTag === tag) {
          this.activeTag = null;
          btn.classList.remove('active');
        } else {
          this.activeTag = tag;
          tagFilter.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
        this.renderFilteredProblems();
      });
    });
  }

  renderFilteredProblems() {
    const container = document.getElementById('allList');
    let filtered = [...this.allProblems];

    if (this.searchQuery) {
      if (globalThis.LRS_SEARCH && typeof globalThis.LRS_SEARCH.filterAndRank === 'function') {
        filtered = globalThis.LRS_SEARCH.filterAndRank(filtered, this.searchQuery);
      } else {
        filtered = filtered.filter(p => {
          const tagsText = (p.tags || []).join(' ');
          return `${p.number} ${p.title} ${p.slug} ${tagsText}`
            .toLowerCase()
            .includes(this.searchQuery);
        });
      }
    }

    if (this.activeTag) {
      filtered = filtered.filter(p => (p.tags || []).includes(this.activeTag));
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${this.allProblems.length === 0 ? '➕' : '🔍'}</div>
          <p>${this.allProblems.length === 0 ? '还没有添加任何题目' : '没有找到匹配的题目'}</p>
          <small>${this.allProblems.length === 0 ? '打开LeetCode题目页面，点击浮动按钮添加' : '试试其他关键词或标签'}</small>
        </div>
      `;
      this.localize(container);
      return;
    }

    container.innerHTML = filtered.map(p => this.createProblemCard(p, 'all')).join('');
    this.attachCardListeners();
    this.localize(container);
  }

  // ============ 题目卡片 ============
  createProblemCard(problem, context) {
    const nextReview = problem.reviewDates[problem.currentInterval];
    const isCompleted = problem.currentInterval >= problem.reviewDates.length;
    const isMastered = problem.mastered;
    const tags = problem.tags || [];
    const progress = Math.min(problem.currentInterval || 0, problem.reviewDates.length);
    const total = problem.reviewDates.length;
    const progressPct = total > 0 ? Math.round((progress / total) * 100) : 0;
    const addedDate = new Date(problem.addedAt).toLocaleDateString();

    const todayStart = this._dayStartTs();
    const dueStart = nextReview != null ? this._dayStartTs(nextReview) : null;
    const isOverdue = dueStart != null && dueStart < todayStart && !isCompleted && !isMastered;

    const tagsHtml = tags.length > 0
      ? `<div class="problem-tags">${tags.map(tag => `<span class="tag" data-tag="${tag}">${tag}</span>`).join('')}</div>`
      : '';

    const masteredBadge = isMastered ? '<span class="mastered-badge">⭐ 已掌握</span>' : '';
    const overdueBadge = isOverdue ? '<span class="overdue-badge">⏰ 逾期</span>' : '';

    let metaText = '';
    if (isMastered) metaText = '⭐ 已掌握';
    else if (isCompleted) metaText = '✅ 已完成所有复习';
    else if (dueStart != null) metaText = `📅 下次: ${new Date(dueStart).toLocaleDateString()}`;

    // 最近一条复习记录
    const history = problem.reviewHistory || [];
    const lastReview = history.length > 0 ? history[history.length - 1] : null;
    let lastReviewHtml = '';
    if (lastReview) {
      const parts = [];
      if (lastReview.time) parts.push(`⏱ ${lastReview.time}`);
      if (lastReview.comment) parts.push(`📝 ${lastReview.comment}`);
      if (parts.length > 0) {
        lastReviewHtml = `<div class="card-last-review">${parts.join(' · ')}</div>`;
      }
    }

    // 操作按钮
    let actionsHtml = '';
    if (context === 'today') {
      actionsHtml = `
        <button class="btn-small btn-done" data-action="submit-review" data-slug="${problem.slug}">✅ 提交复习</button>
        <button class="btn-small btn-link" data-action="view-record" data-slug="${problem.slug}">📋 查看记录</button>
        <button class="btn-small btn-link" data-action="open" data-url="${problem.url}">打开题目</button>
      `;
    } else if (context === 'done') {
      actionsHtml = `
        <button class="btn-small btn-link" data-action="view-record" data-slug="${problem.slug}">📋 查看记录</button>
        <button class="btn-small btn-link" data-action="open" data-url="${problem.url}">打开题目</button>
      `;
    } else {
      actionsHtml = `
        ${!isCompleted && !isMastered ? `<button class="btn-small btn-done" data-action="submit-review" data-slug="${problem.slug}">✅ 提交复习</button>` : ''}
        <button class="btn-small btn-link" data-action="view-record" data-slug="${problem.slug}">📋 记录</button>
        <button class="btn-small btn-link" data-action="open" data-url="${problem.url}">打开</button>
        <button class="btn-small btn-delete" data-action="delete" data-slug="${problem.slug}">删除题目</button>
      `;
    }

    return `
      <div class="problem-card ${isMastered ? 'mastered' : ''} ${context === 'done' ? 'completed-card' : ''}" data-slug="${problem.slug}">
        <div class="problem-header">
          <div class="problem-title">
            <span class="problem-number">#${problem.number}</span>
            ${problem.title}
            ${masteredBadge}
            ${overdueBadge}
          </div>
          <span class="difficulty ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span>
        </div>
        ${tagsHtml}
        <div class="problem-meta">
          <span class="meta-item">${metaText}</span>
          <span class="meta-item">📊 ${progress}/${total}</span>
          <span class="meta-item meta-date">📎 ${addedDate}</span>
        </div>
        ${lastReviewHtml}
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPct}%"></div>
        </div>
        <div class="problem-actions">
          ${actionsHtml}
        </div>
      </div>
    `;
  }

  attachCardListeners() {
    // 打开题目
    document.querySelectorAll('[data-action="open"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: btn.dataset.url });
      });
    });

    // 提交复习
    document.querySelectorAll('[data-action="submit-review"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showSubmitReviewDialog(btn.dataset.slug);
      });
    });

    // 查看记录
    document.querySelectorAll('[data-action="view-record"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showRecordDialog(btn.dataset.slug);
      });
    });

    // 删除
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(this.tr('确定要删除这道题吗？'))) {
          await chrome.runtime.sendMessage({ action: 'deleteProblem', slug: btn.dataset.slug });
          await this.loadData();
        }
      });
    });

    // 标签点击
    document.querySelectorAll('.tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeTag = tag.dataset.tag;
        this.switchTab('all');
        this.loadAllProblems();
      });
    });
  }

  // ============ 提交复习弹窗 ============
  showSubmitReviewDialog(slug) {
    this.removeDialog();

    const overlay = document.createElement('div');
    overlay.className = 'popup-dialog-overlay';
    overlay.id = 'popup-dialog';

    overlay.innerHTML = `
      <div class="popup-dialog">
        <div class="popup-dialog-header">
          <h3>✅ 提交复习</h3>
          <button class="popup-dialog-close" id="dialog-close">&times;</button>
        </div>
        <div class="popup-dialog-body">
          <input type="text" id="dialog-time" placeholder="用时（如: 15min）" class="popup-dialog-input">
          <textarea id="dialog-comment" placeholder="笔记（可选）" class="popup-dialog-input popup-dialog-textarea" rows="2"></textarea>
        </div>
        <div class="popup-dialog-footer">
          <button class="popup-dialog-btn cancel" id="dialog-cancel">取消</button>
          <button class="popup-dialog-btn confirm" id="dialog-confirm">提交</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.localize(overlay);
    this.bindEnterActivatesPrimary(overlay, '#dialog-confirm');
    this.focusDialogField(overlay, '#dialog-time');

    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.removeDialog(); });
    document.getElementById('dialog-close').addEventListener('click', () => this.removeDialog());
    document.getElementById('dialog-cancel').addEventListener('click', () => this.removeDialog());
    document.getElementById('dialog-confirm').addEventListener('click', async () => {
      const time = document.getElementById('dialog-time').value.trim();
      const comment = document.getElementById('dialog-comment').value.trim();
      await chrome.runtime.sendMessage({
        action: 'markReviewed', slug,
        time: time || null, comment: comment || null
      });
      this.removeDialog();
      await this.loadData();
    });
  }

  // ============ 查看记录弹窗 ============
  async showRecordDialog(slug) {
    this.removeDialog();

    const response = await chrome.runtime.sendMessage({ action: 'getProblem', slug });
    if (!response || !response.problem) return;

    const problem = response.problem;
    const history = problem.reviewHistory || [];
    const addedDate = new Date(problem.addedAt).toLocaleDateString();
    const isCompleted = problem.currentInterval >= problem.reviewDates.length;
    const isMastered = problem.mastered;
    const doneInCurrentPlan = Math.min(problem.currentInterval || 0, problem.reviewDates.length);

    // 复习历史
    let historyHtml = '';
    if (history.length > 0) {
      historyHtml = history.map(h => {
        const dayLabel = h.dayLabel != null ? `第${h.dayLabel}天` : '笔记';
        const date = new Date(h.timestamp).toLocaleString();
        const parts = [];
        if (h.time) parts.push(`<span class="record-time">⏱ ${h.time}</span>`);
        if (h.comment) parts.push(`<span class="record-comment">📝 ${h.comment}</span>`);
        const contentHtml = parts.length > 0 ? `<div class="record-content">${parts.join('')}</div>` : '';
        return `
          <div class="record-item">
            <div class="record-header">
              <span class="record-day">${dayLabel}</span>
              <span class="record-date">${date}</span>
            </div>
            ${contentHtml}
          </div>
        `;
      }).join('');
    } else {
      historyHtml = '<div class="record-empty">暂无复习记录</div>';
    }

    // 未来计划
    let futureHtml = '';
    const futureItems = [];
    for (let i = problem.currentInterval; i < problem.reviewDates.length; i++) {
      const date = new Date(problem.reviewDates[i]);
      const intervalDay = (problem.intervals || [])[i];
      const dayDiff = Number.isInteger(intervalDay)
        ? intervalDay
        : Math.max(0, Math.floor(
          ((new Date(problem.reviewDates[i]).setHours(0, 0, 0, 0)) -
          (new Date(problem.planBaseAt || problem.addedAt || Date.now()).setHours(0, 0, 0, 0))) /
          (1000 * 60 * 60 * 24)
        ));
      futureItems.push(`
        <div class="record-future-item">
          <span class="record-future-day">第${dayDiff}天</span>
          <span class="record-future-date">${date.toLocaleDateString()}</span>
        </div>
      `);
    }
    futureHtml = futureItems.length > 0 ? futureItems.join('') : '<div class="record-empty">无待复习计划</div>';

    const overlay = document.createElement('div');
    overlay.className = 'popup-dialog-overlay';
    overlay.id = 'popup-dialog';

    overlay.innerHTML = `
      <div class="popup-dialog popup-dialog-wide">
        <div class="popup-dialog-header">
          <h3>📋 #${problem.number} ${problem.title}</h3>
          <button class="popup-dialog-close" id="dialog-close">&times;</button>
        </div>
        <div class="popup-dialog-body popup-dialog-scroll">
          <div class="record-stats">
            <div class="record-stat">
              <div class="record-stat-label">加入时间</div>
              <div class="record-stat-value">${addedDate}</div>
            </div>
            <div class="record-stat">
              <div class="record-stat-label">进度</div>
              <div class="record-stat-value">${doneInCurrentPlan}/${problem.reviewDates.length}</div>
            </div>
            <div class="record-stat">
              <div class="record-stat-label">状态</div>
              <div class="record-stat-value">${isMastered ? '⭐ 掌握' : isCompleted ? '✅ 完成' : '📖 复习中'}</div>
            </div>
          </div>

          <div class="record-section-title">复习历史</div>
          <div class="record-list">${historyHtml}</div>

          <div class="record-section-title">复习计划</div>
          <div class="record-future-list">${futureHtml}</div>
        </div>
        <div class="popup-dialog-footer">
          <button class="popup-dialog-btn cancel" id="dialog-close-btn">关闭</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.localize(overlay);
    this.bindEnterActivatesPrimary(overlay, '#dialog-close-btn');

    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.removeDialog(); });
    document.getElementById('dialog-close').addEventListener('click', () => this.removeDialog());
    document.getElementById('dialog-close-btn').addEventListener('click', () => this.removeDialog());
  }

  removeDialog() {
    const el = document.getElementById('popup-dialog');
    if (el) el.remove();
  }

  // ============ 复习间隔方案（可编辑） ============
  async loadPlanTemplates() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getPlanTemplates' });
      const templates = response?.templates || {};
      const container = document.getElementById('planPreview');
      if (!container) return;

      let html = '';
      for (const [key, plan] of Object.entries(templates)) {
        const isAlt = key === 'half';
        const tagsHtml = plan.intervals.map((d, i) => {
          return `<span class="interval-tag ${isAlt ? 'alt' : ''}">${d}<button class="interval-remove-btn" data-plan="${key}" data-idx="${i}" title="删除">×</button></span>`;
        }).join('<span class="interval-arrow">→</span>');

        const label = key === 'full' ? '🔥 完整' : '⚡ 精简';
        html += `
          <div class="plan-row">
            <span class="plan-label">${label}</span>
            <div class="intervals">${tagsHtml}</div>
            <button class="interval-add-btn" data-plan="${key}" title="添加天数">+</button>
          </div>
        `;
      }
      container.innerHTML = html;
      this.localize(container);

      // Bind remove buttons
      container.querySelectorAll('.interval-remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const plan = btn.dataset.plan;
          const idx = parseInt(btn.dataset.idx);
          const resp = await chrome.runtime.sendMessage({ action: 'removeIntervalFromPlan', plan, index: idx });
          if (resp && resp.success) {
            this.loadPlanTemplates();
          } else {
            alert(this.trText(resp?.error || '删除失败'));
          }
        });
      });

      // Bind add buttons
      container.querySelectorAll('.interval-add-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const plan = btn.dataset.plan;
          const days = prompt(this.tr('输入天数:'));
          if (days && parseInt(days) > 0) {
            const resp = await chrome.runtime.sendMessage({ action: 'addIntervalToPlan', plan, days: parseInt(days) });
            if (resp && resp.success) {
              this.loadPlanTemplates();
            } else {
              alert(this.trText(resp?.error || '添加失败'));
            }
          }
        });
      });
      this.localize(container);
    } catch (error) {
      console.error('Error loading plan templates:', error);
    }
  }

  // ============ 设置功能 ============
  async connectCalendar() {
    const btn = document.getElementById('connectCalendar');
    const status = document.getElementById('calendarStatus');
    btn.disabled = true;
    btn.textContent = '连接中...';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'connectCalendar' });
      if (response.success) {
        status.textContent = '✅ 已成功连接到 Google Calendar';
        status.className = 'status-message success';
        btn.textContent = '✅ 已连接';
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      status.textContent = '❌ 连接失败: ' + error.message;
      status.className = 'status-message error';
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"/>
          <line x1="16" y1="2" x2="16" y2="6" stroke-width="2"/>
          <line x1="8" y1="2" x2="8" y2="6" stroke-width="2"/>
          <line x1="3" y1="10" x2="21" y2="10" stroke-width="2"/>
        </svg>
        重试连接
      `;
    }
    status.classList.remove('hidden');
    this.localize(status);
    this.localize(btn);
  }

  async saveReviewTime(time) {
    await chrome.storage.local.set({ reviewTime: time });
  }

  // ============ 数据导出（完整格式，包含所有字段） ============
  async exportData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getFullExportData' });
      if (!response || !response.success) {
        alert(this.tr('导出失败'));
        return;
      }
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leetcode-reviews-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(this.trText('导出失败: ' + error.message));
    }
  }

  // ============ 数据导入（兼容新旧格式） ============
  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        const text = await file.text();
        const data = JSON.parse(text);

        const response = await chrome.runtime.sendMessage({
          action: 'importFullData',
          data: data
        });

        if (response && response.success) {
        await this.loadData();
          alert(this.trText(`✅ 数据导入成功！导入了 ${response.count} 道题目`));
        } else {
          throw new Error(this.trText(response?.error || '导入失败'));
        }
      } catch (error) {
        alert(this.trText('导入失败: ' + error.message));
      }
    };
    input.click();
  }

  async clearData() {
    if (confirm(this.tr('确定要清空所有数据吗？此操作不可恢复！'))) {
      if (confirm(this.tr('再次确认：真的要删除所有复习记录吗？'))) {
        await chrome.storage.local.set({ problems: {} });
        await this.loadData();
        alert(this.tr('所有数据已清空'));
      }
    }
  }
}

(function initLrsSearch() {
  'use strict';

  function normalizeForSearch(s) {
    if (s == null || s === '') return '';
    let t = String(s).normalize('NFKC').toLowerCase();
    t = t.replace(/[\s_\-./+|]+/g, ' ');
    try {
      t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ');
    } catch (e) {
      t = t.replace(/[^a-z0-9\u0080-\uFFFF\s]/gi, ' ');
    }
    return t.replace(/\s+/g, ' ').trim();
  }

  function tokenize(query) {
    const n = normalizeForSearch(query);
    if (!n) return [];
    return n.split(' ').filter(Boolean);
  }

  function isSubsequence(needle, hay) {
    if (!needle) return true;
    let i = 0;
    for (let j = 0; j < hay.length && i < needle.length; j++) {
      if (hay[j] === needle[i]) i++;
    }
    return i === needle.length;
  }

  function scoreProblem(problem, queryRaw) {
    const q = String(queryRaw || '').trim();
    if (!q) return { score: 0, match: true };

    const fullNorm = normalizeForSearch(q);
    const toks = tokenize(q);
    if (!fullNorm && toks.length === 0) return { score: 0, match: true };

    const titleN = normalizeForSearch(problem.title || '');
    const slugRaw = String(problem.slug || '');
    const slugN = normalizeForSearch(slugRaw.replace(/-/g, ' '));
    const slugCompact = normalizeForSearch(slugRaw.replace(/-/g, '')).replace(/\s/g, '');
    const numStr = String(problem.number != null ? problem.number : '').trim();
    const tags = problem.tags || [];
    const tagsN = tags.map(t => normalizeForSearch(t));

    const haystack = normalizeForSearch(
      [problem.title, numStr, slugRaw, tags.join(' ')].join(' ')
    );

    let score = 0;

    if (fullNorm.length >= 2 && haystack.includes(fullNorm)) {
      score += 130;
    }

    let tokenHits = 0;
    for (const tok of toks) {
      const ntok = normalizeForSearch(tok);
      if (!ntok) continue;

      let best = 0;

      if (numStr && numStr === ntok) {
        best = Math.max(best, 115);
      } else if (numStr && ntok.length >= 2 && numStr.includes(ntok)) {
        best = Math.max(best, 62);
      }

      if (titleN.startsWith(ntok)) best = Math.max(best, 62);
      else if (titleN.includes(ntok)) best = Math.max(best, 50);

      for (const t of tagsN) {
        if (t === ntok) best = Math.max(best, 52);
        else if (t.includes(ntok)) best = Math.max(best, 40);
      }

      if (slugN.includes(ntok)) best = Math.max(best, 34);
      const tokCompact = ntok.replace(/\s/g, '');
      if (tokCompact && slugCompact.includes(tokCompact)) best = Math.max(best, 30);

      if (best < 24 && haystack.includes(ntok)) best = Math.max(best, 26);

      if (best > 0) tokenHits++;
      score += best;
    }

    if (toks.length > 1 && tokenHits === toks.length) {
      score += 32;
    }

    const titleCompact = titleN.replace(/\s/g, '');
    const qCompact = fullNorm.replace(/\s/g, '');
    if (qCompact.length >= 2 && titleCompact.length >= qCompact.length) {
      if (isSubsequence(qCompact, titleCompact)) {
        score += score < 75 ? 52 : 18;
      }
    }

    return { score, match: score > 0 };
  }

  function filterAndRank(problems, queryRaw) {
    const q = String(queryRaw || '').trim();
    if (!q) return problems.slice();

    const scored = [];
    for (const p of problems) {
      const r = scoreProblem(p, q);
      if (r.match) scored.push({ p, score: r.score });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.p.addedAt || 0) - (a.p.addedAt || 0);
    });
    return scored.map(x => x.p);
  }

  globalThis.LRS_SEARCH = {
    normalizeForSearch,
    tokenize,
    scoreProblem,
    filterAndRank
  };
})();

new PopupManager();
