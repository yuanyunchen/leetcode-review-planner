// LeetCode页面内容脚本 - 浮动按钮、题目信息抓取、主页弹窗 v2.0

class LeetCodeHelper {
  constructor() {
    this.floatingButton = null;
    this.problemInfo = null;
    this.currentSlug = null;
    this.modalOverlay = null;
    this.todayPanelOpen = false;
    this.isDragging = false;
    this.isCollapsed = true;
    this.todayAllDone = false;
    this.scale = 1.2;
    this.defaultPlan = 'full';
    this.uiLanguage = 'en';
    this.homeCurrentTab = 'today';
    this.homeTodayDate = null;
    this.homeAllProblems = [];
    this.homeSearchQuery = '';
    this.homeActiveTag = null;
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async setup() {
    this.loadScale();
    this.loadDefaultPlan();
    await this.loadLanguage();
    this.extractProblemInfo();
    this.createFloatingUI();
    this.setupMessageListener();
    this.setupURLWatcher();
  }

  // ============ Scale Control ============
  loadScale() {
    try {
      const saved = localStorage.getItem('leetcode-sr-scale');
      if (saved) this.scale = parseFloat(saved) || 1.2;
    } catch (e) { /* ignore */ }
  }

  saveScale(val) {
    this.scale = val;
    try { localStorage.setItem('leetcode-sr-scale', String(val)); } catch (e) { /* ignore */ }
    this.applyScale();
  }

  loadDefaultPlan() {
    try {
      const saved = localStorage.getItem('leetcode-sr-default-plan');
      if (saved === 'full' || saved === 'half') this.defaultPlan = saved;
    } catch (e) { /* ignore */ }
  }

  saveDefaultPlan(plan) {
    if (plan !== 'full' && plan !== 'half') return;
    this.defaultPlan = plan;
    try { localStorage.setItem('leetcode-sr-default-plan', plan); } catch (e) { /* ignore */ }
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

  localize(root) {
    if (!globalThis.LRS_I18N || !root) return;
    LRS_I18N.localizeElement(this.uiLanguage, root, {
      skipSelectors: [
        '.sr-problem-name',
        '.problem-title',
        '.sr-hm-card-title',
        '.sr-hm-overdue-title',
        '.sr-today-title',
        '.sr-history-comment',
        '.record-comment',
        '.card-last-review',
        '.tag',
        '.sr-hm-card-tag'
      ]
    });
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  parseCustomIntervals(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    const tokens = rawText
      .replace(/[，、；;]/g, ',')
      .split(/[\s,]+/)
      .map(t => t.trim())
      .filter(Boolean);
    const nums = tokens
      .map(t => parseInt(t, 10))
      .filter(n => Number.isInteger(n) && n >= 0);
    return [...new Set(nums)].sort((a, b) => a - b);
  }

  getStartOfDayTs(ts = Date.now()) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  applyScale() {
    const zoom = this.scale;
    const container = document.getElementById('leetcode-sr-container');
    if (container) container.style.zoom = zoom;
    const homeModal = document.querySelector('.sr-home-modal');
    if (homeModal) homeModal.style.zoom = zoom;
    document.querySelectorAll('.leetcode-sr-modal').forEach(el => { el.style.zoom = zoom; });
    document.querySelectorAll('.sr-sub-dialog').forEach(el => { el.style.zoom = zoom; });
  }

  // ============ URL变化监听 ============
  setupURLWatcher() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const self = this;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      self.onURLChange();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      self.onURLChange();
    };

    window.addEventListener('popstate', () => this.onURLChange());

    let debounceTimer = null;
    let lastPath = window.location.pathname;
    const observer = new MutationObserver(() => {
      const currentPath = window.location.pathname;
      if (currentPath !== lastPath) {
        lastPath = currentPath;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.onURLChange(), 500);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  onURLChange() {
    const urlMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
    const newSlug = urlMatch ? urlMatch[1] : '';
    this.updateProblemButtonsVisibility();
    if (newSlug && newSlug !== this.currentSlug) {
      this.currentSlug = newSlug;
      setTimeout(() => {
        this.extractProblemInfo();
        this.updateFloatingButton();
      }, 1000);
    } else if (!newSlug && this.currentSlug) {
      this.currentSlug = '';
    }
  }

  isOnProblemPage() {
    return /\/problems\/[^\/]+/.test(window.location.pathname);
  }

  updateProblemButtonsVisibility() {
    const onProblem = this.isOnProblemPage();
    const btnRow = document.getElementById('leetcode-sr-btn-row');
    const viewBtn = document.getElementById('leetcode-sr-view-btn');
    if (btnRow) btnRow.style.display = onProblem ? '' : 'none';
    if (viewBtn) viewBtn.style.display = onProblem ? '' : 'none';
  }

  // ============ 题目信息提取 ============
  extractProblemInfo() {
    const isCN = window.location.hostname.includes('leetcode.cn');
    const urlMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
    const slug = urlMatch ? urlMatch[1] : '';
    this.currentSlug = slug;

    if (!slug) {
      this.problemInfo = {
        number: '', title: '', slug: '', difficulty: '',
        tags: [], url: window.location.href,
        site: isCN ? 'leetcode.cn' : 'leetcode.com',
        timestamp: Date.now()
      };
      return;
    }

    let title = '', difficulty = '', number = '';

    const titleSelectors = [
      'div[data-cy="question-title"]',
      'span.mr-2.text-label-1',
      '[class*="text-title-large"]',
      'a[data-difficulty]',
      'div[class*="title"] a[href*="/problems/"]',
      'a[href*="/problems/"] span',
      '.css-v3d350'
    ];

    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const fullTitle = el.textContent.trim();
        const match = fullTitle.match(/^(\d+)\.\s*(.+)$/);
        if (match) { number = match[1]; title = match[2]; break; }
        else if (fullTitle.length > 1 && fullTitle.length < 200) { title = fullTitle; }
      }
    }

    if (!number || !title) {
      const pageTitle = document.title || '';
      const ptMatch = pageTitle.match(/^(\d+)\.\s*(.+?)(?:\s*[-–|]|\s*-\s*LeetCode)/);
      if (ptMatch) {
        if (!number) number = ptMatch[1];
        if (!title) title = ptMatch[2].trim();
      }
    }

    if (!number) {
      const allEls = document.querySelectorAll('a[href*="/problems/"], span, div');
      for (const el of allEls) {
        const t = el.textContent.trim();
        const m = t.match(/^(\d+)\.\s*(.+)$/);
        if (m && m[2].length > 2 && m[2].length < 100) {
          number = m[1]; if (!title) title = m[2];
        break;
        }
      }
    }

    const diffSelectors = [
      'div[diff]', '[class*="text-difficulty"]',
      'div[class*="difficulty"]', 'span[class*="difficulty"]',
      '.css-10o4wqw', 'div.mt-3 > div'
    ];

    for (const sel of diffSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.trim().toLowerCase();
        if (text.includes('easy') || text.includes('简单')) difficulty = 'Easy';
        else if (text.includes('medium') || text.includes('中等')) difficulty = 'Medium';
        else if (text.includes('hard') || text.includes('困难')) difficulty = 'Hard';
        if (difficulty) break;
      }
    }

    if (!difficulty) {
      const body = document.body.innerHTML;
      const diffMatch = body.match(/"difficulty"\s*:\s*"(Easy|Medium|Hard)"/i);
      if (diffMatch) difficulty = diffMatch[1].charAt(0).toUpperCase() + diffMatch[1].slice(1).toLowerCase();
    }

    const tags = this.extractTags();

    this.problemInfo = {
      number: number || 'Unknown',
      title: title || slug,
      slug, difficulty: difficulty || 'Unknown',
      tags, url: window.location.href,
      site: isCN ? 'leetcode.cn' : 'leetcode.com',
      timestamp: Date.now()
    };
  }

  extractTags() {
    const tags = [];
    const tagSelectors = [
      'a[href*="/tag/"]', 'a[href*="/topics/"]',
      '[class*="topic-tag"]', 'div.mt-2 a.rounded-xl',
      'a.no-underline.hover\\:text-current'
    ];
    for (const sel of tagSelectors) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length < 30 && !tags.includes(text)) tags.push(text);
        });
        if (tags.length > 0) break;
      } catch (e) { /* skip */ }
    }
    return tags;
  }

  // ============ 浮动UI ============
  createFloatingUI() {
    const container = document.createElement('div');
    container.id = 'leetcode-sr-container';
    container.className = 'leetcode-sr-floating';
    container.style.zoom = this.scale;
    const appIconUrl = chrome.runtime.getURL('icons/icons.png');

    // 折叠/展开按钮 (drag handle)
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'leetcode-sr-toggle';
    toggleBtn.className = 'leetcode-sr-toggle-btn';
    toggleBtn.innerHTML = `<img class="sr-app-icon" src="${appIconUrl}" alt="App">`;
    const toggleIconEl = toggleBtn.querySelector('.sr-app-icon');
    if (toggleIconEl) {
      toggleIconEl.addEventListener('error', () => { toggleBtn.textContent = '📚'; });
    }
    toggleBtn.title = '展开/折叠';
    toggleBtn.addEventListener('mousedown', (e) => {
      this._toggleMouseDown = { x: e.clientX, y: e.clientY, time: Date.now() };
    });
    toggleBtn.addEventListener('mouseup', (e) => {
      if (this._toggleMouseDown) {
        const dx = Math.abs(e.clientX - this._toggleMouseDown.x);
        const dy = Math.abs(e.clientY - this._toggleMouseDown.y);
        const dt = Date.now() - this._toggleMouseDown.time;
        if (dx < 5 && dy < 5 && dt < 300) this.toggleCollapse();
        this._toggleMouseDown = null;
      }
    });

    // 可折叠区域
    const collapsible = document.createElement('div');
    collapsible.id = 'leetcode-sr-collapsible';
    collapsible.className = 'leetcode-sr-collapsible';

    // 当日复习按钮 (full width)
    const todayBtn = document.createElement('button');
    todayBtn.id = 'leetcode-sr-today-btn';
    todayBtn.className = 'leetcode-sr-today-btn';
    todayBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke-width="2"/>
        <line x1="8" y1="2" x2="8" y2="6" stroke-width="2"/>
        <line x1="3" y1="10" x2="21" y2="10" stroke-width="2"/>
      </svg>
      <span>当日复习</span>
    `;
    todayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.isDragging) this.toggleTodayPanel();
    });

    // 当日复习侧面板
    const todayPanel = document.createElement('div');
    todayPanel.id = 'leetcode-sr-today-panel';
    todayPanel.className = 'leetcode-sr-today-panel hidden';

    // 按钮行 (提交/加入 + 查看记录)
    const btnRow = document.createElement('div');
    btnRow.id = 'leetcode-sr-btn-row';
    btnRow.className = 'leetcode-sr-btn-row';

    const mainButton = document.createElement('button');
    mainButton.id = 'leetcode-sr-button';
    mainButton.className = 'leetcode-sr-main-btn';
    mainButton.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 5v14M5 12h14" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <span>加入复习</span>
    `;
    mainButton.addEventListener('click', () => this.handleMainButtonClick());
    btnRow.appendChild(mainButton);

    // 底部按钮行 (记录 + 添加自定义 + 主页)
    const bottomRow = document.createElement('div');
    bottomRow.className = 'leetcode-sr-bottom-row';

    // 添加自定义题目按钮
    const addCustomBtn = document.createElement('button');
    addCustomBtn.id = 'leetcode-sr-add-custom-btn';
    addCustomBtn.className = 'leetcode-sr-home-btn';
    addCustomBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0b8c4" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
    addCustomBtn.title = '添加自定义题目';
    addCustomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.isDragging) this.showCustomProblemModal();
    });

    // 主页按钮 (小)
    const homeBtn = document.createElement('button');
    homeBtn.id = 'leetcode-sr-home-btn';
    homeBtn.className = 'leetcode-sr-home-btn';
    homeBtn.innerHTML = '🏠';
    homeBtn.title = '主页';
    homeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.isDragging) this.showHomeModal();
    });

    bottomRow.appendChild(addCustomBtn);
    bottomRow.appendChild(homeBtn);

    // 组装
    collapsible.appendChild(todayBtn);
    collapsible.appendChild(todayPanel);
    collapsible.appendChild(btnRow);
    collapsible.appendChild(bottomRow);

    container.appendChild(toggleBtn);
    container.appendChild(collapsible);
    document.body.appendChild(container);
    this.localize(container);

    this.setupDrag(container, toggleBtn);
    this.floatingButton = container;
    this.restorePosition(container);
    this.updateProblemButtonsVisibility();
    if (this.isOnProblemPage()) {
      this.checkProblemStatus();
    }
    this.checkTodayStatus();

    this.isCollapsed = true;
    collapsible.style.display = 'none';
  }

  loadCollapsedState() {
    try {
      const v2 = localStorage.getItem('leetcode-sr-collapsed-v2');
      if (v2 === 'true' || v2 === 'false') return v2 === 'true';

      // Migrate legacy key (old value was accidentally inverted).
      const legacy = localStorage.getItem('leetcode-sr-collapsed');
      if (legacy === 'true' || legacy === 'false') {
        const migratedCollapsed = legacy === 'false';
        localStorage.setItem('leetcode-sr-collapsed-v2', String(migratedCollapsed));
        return migratedCollapsed;
      }
    } catch (e) { /* ignore */ }
    return true; // first visit: collapsed by default
  }

  saveCollapsedState() {
    try { localStorage.setItem('leetcode-sr-collapsed-v2', String(this.isCollapsed)); } catch (e) { /* ignore */ }
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    const collapsible = document.getElementById('leetcode-sr-collapsible');
    if (collapsible) collapsible.style.display = this.isCollapsed ? 'none' : '';
    if (this.isCollapsed) this.closeTodayPanel();
    this.saveCollapsedState();
  }

  // ============ 拖拽 ============
  setupDrag(container, handle) {
    let startMouseX, startMouseY;
    let startLeft, startRight, startTop;
    let dragByLeft = false;
    let hasMoved = false;
    let dragActive = false;

    const onMouseDown = (e) => {
      e.preventDefault();
      this.isDragging = false;
      hasMoved = false;
      const rect = container.getBoundingClientRect();
      startMouseX = e.clientX;
      startMouseY = e.clientY;
      startLeft = rect.left;
      startRight = window.innerWidth - rect.right;
      startTop = rect.top;
      dragByLeft = !!container.style.left && container.style.left !== 'auto';
      container.style.transition = 'none';
      dragActive = true;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('blur', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!dragActive) return;
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
        this.isDragging = true;
      }
      if (!hasMoved) return;

      const rect = container.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxRight = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);
      const targetTop = startTop + dy;
      if (dragByLeft) {
        const targetLeft = startLeft + dx;
        container.style.right = 'auto';
        container.style.left = Math.max(0, Math.min(targetLeft, maxLeft)) + 'px';
      } else {
        const targetRight = startRight - dx;
        container.style.left = 'auto';
        container.style.right = Math.max(0, Math.min(targetRight, maxRight)) + 'px';
      }
      container.style.top = Math.max(0, Math.min(targetTop, maxTop)) + 'px';
    };

    const onMouseUp = () => {
      if (!dragActive) return;
      dragActive = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onMouseUp);
      container.style.transition = '';
      if (hasMoved) {
        try {
          const right = (container.style.right && container.style.right !== 'auto')
            ? (parseInt(container.style.right, 10) || 0)
            : Math.max(0, Math.round(window.innerWidth - (parseInt(container.style.left, 10) || 0) - container.getBoundingClientRect().width));
          const top = parseInt(container.style.top, 10) || 0;
          const rect = container.getBoundingClientRect();
          const left = Math.max(0, Math.round(window.innerWidth - right - rect.width));
          localStorage.setItem('leetcode-sr-pos', JSON.stringify({
            top,
            left,
            right
          }));
        } catch (e) { /* ignore */ }
      }
      this.isDragging = false;
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  restorePosition(container) {
    try {
      const saved = localStorage.getItem('leetcode-sr-pos');
      if (!saved) {
        // First visit default: near top-right corner.
        container.style.top = '108px';
        container.style.right = '18px';
        container.style.left = 'auto';
        return;
      }
      if (saved) {
        const pos = JSON.parse(saved);
        if (Number.isFinite(pos.top) && pos.top >= 0 && pos.top < window.innerHeight - 50) {
          if (Number.isFinite(pos.right) && pos.right >= 0 && pos.right < window.innerWidth - 50) {
            container.style.top = pos.top + 'px';
            container.style.right = pos.right + 'px';
            container.style.left = 'auto';
          } else if (Number.isFinite(pos.left) && pos.left >= 0 && pos.left < window.innerWidth - 40) {
            // Backward compatibility with old stored positions.
            container.style.top = pos.top + 'px';
            container.style.left = pos.left + 'px';
            container.style.right = 'auto';
          }
        }
      }
    } catch (e) { /* ignore */ }
  }

  updateFloatingButton() { this.checkProblemStatus(); }

  // ============ 当日复习状态 ============
  async checkTodayStatus() {
    try {
      const response = await this.safeSendMessage({ action: 'getTodayReviews' });
      const reviews = response?.reviews || [];
      this.todayAllDone = reviews.length === 0;
      this.updateTodayBtnStyle();
    } catch (e) { /* ignore */ }
  }

  updateTodayBtnStyle() {
    const todayBtn = document.getElementById('leetcode-sr-today-btn');
    if (!todayBtn) return;
    if (this.todayAllDone) {
      todayBtn.classList.add('all-done');
      todayBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M9 12l2 2 4-4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
        </svg>
        <span>当日复习 ✓</span>
      `;
    } else {
      todayBtn.classList.remove('all-done');
      todayBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"/>
          <line x1="16" y1="2" x2="16" y2="6" stroke-width="2"/>
          <line x1="8" y1="2" x2="8" y2="6" stroke-width="2"/>
          <line x1="3" y1="10" x2="21" y2="10" stroke-width="2"/>
        </svg>
        <span>当日复习</span>
      `;
    }
    this.localize(todayBtn);
  }

  async checkProblemStatus() {
    if (!this.isOnProblemPage() || !this.problemInfo || !this.problemInfo.slug) return;
    try {
      const response = await this.safeSendMessage({ action: 'checkProblem', slug: this.problemInfo.slug });
      if (!response) return;

      const mainButton = document.getElementById('leetcode-sr-button');
      const btnRow = document.getElementById('leetcode-sr-btn-row');
      const bottomRow = document.querySelector('.leetcode-sr-bottom-row');
      if (!mainButton || !btnRow) return;

      if (response.exists) {
        mainButton.classList.add('added');
        mainButton.classList.remove('adding');
        mainButton.dataset.mode = 'added';
        mainButton.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 12l2 2 4-4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
          </svg>
          <span>提交复习</span>
        `;

        let viewBtn = document.getElementById('leetcode-sr-view-btn');
        if (!viewBtn && bottomRow) {
          viewBtn = document.createElement('button');
          viewBtn.id = 'leetcode-sr-view-btn';
          viewBtn.className = 'leetcode-sr-home-btn';
          viewBtn.innerHTML = '📖';
          viewBtn.title = this.tr('记录');
          viewBtn.addEventListener('click', () => {
            if (!this.isDragging) this.showProblemDetailModal();
          });
          const homeBtn = document.getElementById('leetcode-sr-home-btn');
          bottomRow.insertBefore(viewBtn, homeBtn);
        }
      } else {
        mainButton.classList.remove('added', 'adding');
        mainButton.dataset.mode = 'add';
        mainButton.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 5v14M5 12h14" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <span>加入复习</span>
        `;
        const viewBtn = document.getElementById('leetcode-sr-view-btn');
        if (viewBtn) viewBtn.remove();
      }
      this.localize(document.getElementById('leetcode-sr-container'));
    } catch (error) {
      console.warn('checkProblemStatus failed:', error);
    }
  }

  handleMainButtonClick() {
    if (this.isDragging) return;
    const mainButton = document.getElementById('leetcode-sr-button');
    if (mainButton.dataset.mode === 'added') this.showSubmitReviewModal();
    else this.showPlanSelectionModal();
  }

  // ============ 当日复习面板 ============
  closeTodayPanel() {
    const panel = document.getElementById('leetcode-sr-today-panel');
    if (panel) panel.classList.add('hidden');
    this.todayPanelOpen = false;
  }

  async toggleTodayPanel() {
    if (this.isDragging) return;
    const panel = document.getElementById('leetcode-sr-today-panel');
    if (!panel) return;

    if (this.todayPanelOpen) {
      panel.classList.add('hidden');
      this.todayPanelOpen = false;
      return;
    }

    this.todayPanelOpen = true;
    panel.classList.remove('hidden');
    panel.innerHTML = `<div class="sr-today-loading">${this.tr('加载中...')}</div>`;
    await this.refreshTodayPanel();
  }

  async refreshTodayPanel() {
    const panel = document.getElementById('leetcode-sr-today-panel');
    if (!panel || !this.todayPanelOpen) return;

    try {
      const response = await this.safeSendMessage({ action: 'getTodayReviews' });
      const reviews = response?.reviews || [];
      this.todayAllDone = reviews.length === 0;
      this.updateTodayBtnStyle();

      if (reviews.length === 0) {
        panel.innerHTML = `
          <div class="sr-today-header">
            <span>${this.tr('📋 当日复习')}</span>
            <button class="sr-today-close" id="sr-today-close">✕</button>
          </div>
          <div class="sr-today-empty">
            <div class="sr-today-done-icon">🎉</div>
            <div>${this.tr('已完成所有复习任务！')}</div>
          </div>
        `;
      } else {
        const todayStart = this.getStartOfDayTs();
        const itemsHtml = reviews.map(p => {
          const dueTs = p.reviewDates[p.currentInterval];
          const dueStart = dueTs ? this.getStartOfDayTs(dueTs) : todayStart;
          const isOverdue = dueStart < todayStart;
          const overdueDays = isOverdue ? Math.round((todayStart - dueStart) / 86400000) : 0;

          const baseTs = p.planBaseAt || p.addedAt || 0;
          const planBase = baseTs ? this.getStartOfDayTs(baseTs) : 0;
          const scheduledDay = dueTs ? Math.max(0, Math.round((dueStart - planBase) / 86400000)) : null;
          const dayLabel = scheduledDay != null ? this.trText(`第${scheduledDay}天`) : '';
          const isLast = p.currentInterval === (p.reviewDates || []).length - 1;
          const lastBadge = isLast ? `<span class="sr-today-last">${this.tr('最后一次')}</span>` : '';
          const overdueBadge = isOverdue ? `<span class="sr-today-overdue">${this.trText(`逾期 ${overdueDays} 天`)}</span>` : '';
          const isCustom = !!p.isCustom;
          const numSpan = isCustom ? '<span class="sr-today-num">📝</span>' : `<span class="sr-today-num">#${p.number}</span>`;
          const itemAttrs = isCustom ? `data-slug="${p.slug}"` : `data-url="${p.url}"`;
          return `
            <div class="sr-today-item ${isOverdue ? 'sr-today-overdue-item' : ''}" ${itemAttrs}>
              ${numSpan}
              <span class="sr-today-title">${p.title}</span>
              ${lastBadge}
              ${overdueBadge}
              <span class="sr-today-day">${dayLabel}</span>
            </div>
          `;
        }).join('');
        panel.innerHTML = `
          <div class="sr-today-header">
            <span>${this.trText(`📋 当日复习 (${reviews.length})`)}</span>
            <button class="sr-today-close" id="sr-today-close">✕</button>
          </div>
          <div class="sr-today-list">${itemsHtml}</div>
        `;
      }

      const closeBtn = panel.querySelector('#sr-today-close');
      if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.closeTodayPanel(); });

      panel.querySelectorAll('.sr-today-item').forEach(item => {
        item.addEventListener('click', () => {
          if (item.dataset.slug) {
            this.showProblemDetailModal(item.dataset.slug);
          } else if (item.dataset.url) {
            window.location.href = item.dataset.url;
          }
        });
      });
      this.localize(panel);
    } catch (error) {
      panel.innerHTML = `<div class="sr-today-loading">加载失败</div>`;
      this.localize(panel);
    }
  }

  // ============ 主页弹窗 (全屏覆盖) ============
  showHomeModal() {
    this.closeHomeModal();
    this.closeTodayPanel();

    const overlay = document.createElement('div');
    overlay.id = 'sr-home-overlay';
    overlay.className = 'leetcode-sr-overlay';

    const modal = document.createElement('div');
    modal.className = 'sr-home-modal';
    modal.style.zoom = this.scale;

    modal.innerHTML = `
      <div class="sr-hm-header">
        <div class="sr-hm-brand">
          <div class="sr-hm-brand-text">
            <div class="sr-hm-title">LeetCode Review Planner</div>
            <div class="sr-hm-subtitle">基于遗忘曲线的智能复习系统</div>
          </div>
        </div>
        <button class="sr-hm-close" id="sr-hm-close">&times;</button>
      </div>

      <div class="sr-hm-stats" id="sr-hm-stats"></div>
      <div class="sr-hm-extra" id="sr-hm-extra"></div>

      <div class="sr-hm-tabs" id="sr-hm-tabs">
        <button class="sr-hm-tab active" data-tab="today">
          <span>📋</span> 今日题目
        </button>
        <button class="sr-hm-tab" data-tab="all">
          <span>📁</span> 全部题目
        </button>
        <button class="sr-hm-tab" data-tab="stats">
          <span>📊</span> 数据统计
        </button>
      </div>

      <div class="sr-hm-search hidden" id="sr-hm-search">
        <div class="sr-hm-search-wrap">
          <svg class="sr-hm-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" stroke-width="2"/>
            <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <input type="text" placeholder="搜索题号、题目名称..." id="sr-hm-search-input" class="sr-hm-search-input">
        </div>
      </div>

      <div class="sr-hm-content" id="sr-hm-content"></div>

      <div class="sr-hm-footer" id="sr-hm-footer">
        <span class="sr-hm-version">v2.0 · Made by Kenzie & Ethan</span>
        <button class="sr-hm-settings-btn" id="sr-hm-settings" title="设置">⚙️</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.localize(modal);

    // Events
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeHomeModal(); });
    modal.querySelector('#sr-hm-close').addEventListener('click', () => this.closeHomeModal());
    modal.querySelector('#sr-hm-settings').addEventListener('click', () => this.showSettingsView());

    // Tabs
    modal.querySelectorAll('.sr-hm-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.sr-hm-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.homeCurrentTab = tab.dataset.tab;
        const searchBar = modal.querySelector('#sr-hm-search');
        searchBar.classList.toggle('hidden', tab.dataset.tab !== 'all');
        this.loadHomeTab(tab.dataset.tab);
      });
    });

    // Search
    const searchInput = modal.querySelector('#sr-hm-search-input');
    searchInput.addEventListener('input', (e) => {
      this.homeSearchQuery = e.target.value.trim().toLowerCase();
      this.homeActiveTag = null;
      this.renderHomeAllList();
    });

    this.homeCurrentTab = 'today';
    this.homeTodayDate = this.getStartOfDayTs();
    this.loadHomeStats();
    this.loadHomeTab('today');
  }

  closeHomeModal() {
    const overlay = document.getElementById('sr-home-overlay');
    if (overlay) overlay.remove();
  }

  refreshHomeIfOpen() {
    if (document.getElementById('sr-home-overlay')) {
      this.loadHomeStats();
      this.loadHomeTab(this.homeCurrentTab);
    }
  }

  async loadHomeStats() {
    try {
      const [problemsResp, todayResp, completedResp] = await Promise.all([
        this.safeSendMessage({ action: 'getProblems' }),
        this.safeSendMessage({ action: 'getTodayReviews' }),
        this.safeSendMessage({ action: 'getTodayCompleted' })
      ]);
      const problems = problemsResp?.problems || [];
      const todayReviews = todayResp?.reviews || [];
      const todayCompleted = completedResp?.completed || [];
      const mastered = problems.filter(p => p.mastered).length;
      const totalReviews = problems.reduce((s, p) => s + (p.completedReviews?.length || 0), 0);
      const completionRate = problems.length > 0 ? Math.round((mastered / problems.length) * 100) : 0;

      const statsEl = document.getElementById('sr-hm-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div class="sr-hm-stat-card total"><div class="sr-hm-stat-val">${problems.length}</div><div class="sr-hm-stat-lbl">总题数</div></div>
          <div class="sr-hm-stat-card pending"><div class="sr-hm-stat-val">${todayReviews.length}</div><div class="sr-hm-stat-lbl">待复习</div></div>
          <div class="sr-hm-stat-card done"><div class="sr-hm-stat-val">${todayCompleted.length}</div><div class="sr-hm-stat-lbl">今日完成</div></div>
          <div class="sr-hm-stat-card mastered"><div class="sr-hm-stat-val">${mastered}</div><div class="sr-hm-stat-lbl">已掌握</div></div>
        `;
        this.localize(statsEl);
      }

      const extraEl = document.getElementById('sr-hm-extra');
      if (extraEl) {
        extraEl.innerHTML = `
          <span>📊 累计复习 <b>${totalReviews}</b> 次</span>
          <span class="sr-hm-dot">·</span>
          <span>📈 完成率 <b>${completionRate}%</b></span>
        `;
        this.localize(extraEl);
      }
    } catch (error) {
      console.error('loadHomeStats error:', error);
    }
  }

  loadHomeTab(tab) {
    if (tab === 'today') this.loadHomeTodayTab();
    else if (tab === 'all') this.loadHomeAllTab();
    else if (tab === 'stats') this.loadHomeStatsTab();
  }

  // ============ Date Navigation ============
  _buildDateNav() {
    if (!this.homeTodayDate) this.homeTodayDate = this.getStartOfDayTs();
    const viewDate = new Date(this.homeTodayDate);
    const realToday = this.getStartOfDayTs();
    const isToday = this.homeTodayDate === realToday;
    const mm = String(viewDate.getMonth() + 1).padStart(2, '0');
    const dd = String(viewDate.getDate()).padStart(2, '0');
    const displayDate = `${mm}/${dd}`;
    const todayLabel = isToday ? ` · ${this.tr('今天')}` : '';
    return `
      <div class="sr-date-nav">
        <button class="sr-date-arrow" id="sr-date-prev" title="${this.tr('前一天')}">‹</button>
        <span class="sr-date-label" id="sr-date-label" title="${this.tr('点击选择日期')}">${displayDate}${todayLabel}</span>
        <button class="sr-date-arrow" id="sr-date-next" title="${this.tr('后一天')}" ${isToday ? 'disabled' : ''}>›</button>
      </div>
    `;
  }

  _buildMiniCalendar(year, month, problems) {
    const realToday = this.getStartOfDayTs();
    const realTodayDate = new Date(realToday);
    const selectedDate = new Date(this.homeTodayDate);
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const isEn = this.uiLanguage === 'en';
    const monthNames = isEn
      ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      : ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    const dowLabels = isEn
      ? ['Su','Mo','Tu','We','Th','Fr','Sa']
      : ['日','一','二','三','四','五','六'];
    const titleText = isEn ? `${monthNames[month]} ${year}` : `${year}年${monthNames[month]}`;

    const activityMap = {};
    (problems || []).forEach(p => {
      if (p.addedAt) {
        const d = new Date(p.addedAt);
        const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        activityMap[k] = (activityMap[k] || 0) + 1;
      }
      (p.completedReviews || []).forEach(ts => {
        const d = new Date(ts);
        const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        activityMap[k] = (activityMap[k] || 0) + 1;
      });
    });

    const canGoNext = !(year === realTodayDate.getFullYear() && month === realTodayDate.getMonth());
    let html = `<div class="sr-cal-wrap"><div class="sr-cal">`;
    html += `<div class="sr-cal-header">`;
    html += `<button class="sr-cal-nav" data-cal-action="prev-month">‹</button>`;
    html += `<span class="sr-cal-title">${titleText}</span>`;
    html += `<button class="sr-cal-nav" data-cal-action="next-month" ${canGoNext ? '' : 'disabled style="opacity:0.3;pointer-events:none"'}>›</button>`;
    html += `</div>`;
    html += `<div class="sr-cal-grid">`;
    dowLabels.forEach(d => { html += `<div class="sr-cal-dow">${d}</div>`; });

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="sr-cal-day empty"></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      dayDate.setHours(0, 0, 0, 0);
      const dayTs = dayDate.getTime();
      const isFuture = dayTs > realToday;
      const isSelectedDay = dayDate.getFullYear() === selectedDate.getFullYear() &&
        dayDate.getMonth() === selectedDate.getMonth() && dayDate.getDate() === selectedDate.getDate();
      const isTodayDay = dayDate.getFullYear() === realTodayDate.getFullYear() &&
        dayDate.getMonth() === realTodayDate.getMonth() && dayDate.getDate() === realTodayDate.getDate();
      const aKey = `${year}-${month}-${day}`;
      const count = activityMap[aKey] || 0;
      let heatClass = '';
      if (!isFuture && count > 0) {
        if (count >= 8) heatClass = 'heat-7';
        else if (count >= 6) heatClass = 'heat-6';
        else if (count === 5) heatClass = 'heat-5';
        else if (count === 4) heatClass = 'heat-4';
        else if (count === 3) heatClass = 'heat-3';
        else if (count === 2) heatClass = 'heat-2';
        else heatClass = 'heat-1';
      }
      const classes = ['sr-cal-day'];
      if (isFuture) classes.push('future');
      if (isTodayDay) classes.push('today');
      if (isSelectedDay) classes.push('selected');
      if (heatClass) classes.push(heatClass);
      html += `<div class="${classes.join(' ')}" data-cal-day="${day}">${day}</div>`;
    }
    html += `</div></div></div>`;
    return html;
  }

  _bindDateNavEvents(problems) {
    const prev = document.getElementById('sr-date-prev');
    const next = document.getElementById('sr-date-next');
    const label = document.getElementById('sr-date-label');
    if (prev) prev.addEventListener('click', () => {
      this.homeTodayDate -= 86400000;
      this.loadHomeTodayTab();
    });
    if (next) next.addEventListener('click', () => {
      const realToday = this.getStartOfDayTs();
      if (this.homeTodayDate < realToday) {
        this.homeTodayDate += 86400000;
        if (this.homeTodayDate > realToday) this.homeTodayDate = realToday;
        this.loadHomeTodayTab();
      }
    });
    if (label) {
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleMiniCalendar(problems);
      });
    }
  }

  _toggleMiniCalendar(problems) {
    const nav = document.querySelector('.sr-date-nav');
    if (!nav) return;
    const existing = nav.querySelector('.sr-cal-wrap');
    if (existing) { existing.remove(); return; }
    const viewDate = new Date(this.homeTodayDate);
    this._calViewYear = viewDate.getFullYear();
    this._calViewMonth = viewDate.getMonth();
    this._renderCalendarInNav(problems);
  }

  _renderCalendarInNav(problems) {
    const nav = document.querySelector('.sr-date-nav');
    if (!nav) return;
    const old = nav.querySelector('.sr-cal-wrap');
    if (old) old.remove();
    const calHtml = this._buildMiniCalendar(this._calViewYear, this._calViewMonth, problems);
    nav.insertAdjacentHTML('beforeend', calHtml);

    const wrap = nav.querySelector('.sr-cal-wrap');
    if (!wrap) return;

    wrap.addEventListener('click', (e) => e.stopPropagation());

    wrap.querySelectorAll('[data-cal-action="prev-month"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._calViewMonth--;
        if (this._calViewMonth < 0) { this._calViewMonth = 11; this._calViewYear--; }
        this._renderCalendarInNav(problems);
      });
    });
    wrap.querySelectorAll('[data-cal-action="next-month"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._calViewMonth++;
        if (this._calViewMonth > 11) { this._calViewMonth = 0; this._calViewYear++; }
        this._renderCalendarInNav(problems);
      });
    });
    wrap.querySelectorAll('.sr-cal-day:not(.empty):not(.future)').forEach(cell => {
      cell.addEventListener('click', () => {
        const day = +cell.dataset.calDay;
        const d = new Date(this._calViewYear, this._calViewMonth, day);
        d.setHours(0, 0, 0, 0);
        this.homeTodayDate = d.getTime();
        this.loadHomeTodayTab();
      });
    });

    const closeHandler = (e) => {
      if (!wrap.contains(e.target) && e.target.id !== 'sr-date-label') {
        wrap.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }

  // ============ 今日题目 Tab ============
  async loadHomeTodayTab() {
    const content = document.getElementById('sr-hm-content');
    if (!content) return;
    if (!this.homeTodayDate) this.homeTodayDate = this.getStartOfDayTs();

    try {
      const problemsResp = await this.safeSendMessage({ action: 'getProblems' });
      const allProblems = problemsResp?.problems || [];
      const dayStart = this.homeTodayDate;
      const dayEnd = dayStart + 86400000;
      const realToday = this.getStartOfDayTs();
      const isToday = dayStart === realToday;

      const addedThisDay = allProblems
        .filter((p) => p.addedAt >= dayStart && p.addedAt < dayEnd)
        .sort((a, b) => (b.addedAt - a.addedAt) || (a.number - b.number));

      const completedThisDay = allProblems
        .filter(p => (p.completedReviews || []).some(ts => ts >= dayStart && ts < dayEnd));

      let reviews = [];
      if (isToday) {
        const [reviewResp, completedResp] = await Promise.all([
          this.safeSendMessage({ action: 'getTodayReviews' }),
          this.safeSendMessage({ action: 'getTodayCompleted' })
        ]);
        reviews = reviewResp?.reviews || [];
        const todayCompletedFromMsg = completedResp?.completed || [];
        if (todayCompletedFromMsg.length > completedThisDay.length) {
          completedThisDay.length = 0;
          completedThisDay.push(...todayCompletedFromMsg);
        }
      }

      const dateNavHtml = this._buildDateNav();

      if (reviews.length === 0 && addedThisDay.length === 0 && completedThisDay.length === 0) {
        content.innerHTML = `
          ${dateNavHtml}
          <div class="sr-hm-empty">
            <div class="sr-hm-empty-icon">🎉</div>
            <div class="sr-hm-empty-text">今天没有复习任务</div>
            <div class="sr-hm-empty-sub">继续保持！</div>
          </div>
        `;
        this._bindDateNavEvents(allProblems);
        this.localize(content);
        return;
      }

      let html = dateNavHtml;
      if (addedThisDay.length > 0) {
        html += `<div class="sr-hm-section-label added-label">${this.trText(`📥 已添加 (${addedThisDay.length})`)}</div>`;
        html += addedThisDay.map(p => this.createHomeCard(p, 'added')).join('');
      }
      if (reviews.length > 0) {
        html += `<div class="sr-hm-section-label pending-label">${this.trText(`📋 待复习 (${reviews.length})`)}</div>`;
        html += reviews.map(p => this.createHomeCard(p, 'today')).join('');
      }
      if (completedThisDay.length > 0) {
        html += `<div class="sr-hm-section-label done-label">${this.trText(`✅ 已完成 (${completedThisDay.length})`)}</div>`;
        html += completedThisDay.map(p => this.createHomeCard(p, 'done')).join('');
      }
      content.innerHTML = html;
      this._bindDateNavEvents(allProblems);
      this.bindHomeCardEvents(content);
      this.localize(content);
    } catch (error) {
      content.innerHTML = `<div class="sr-hm-empty"><div class="sr-hm-empty-text">加载失败</div></div>`;
      this.localize(content);
    }
  }

  // ============ 全部题目 Tab ============
  async loadHomeAllTab() {
    const content = document.getElementById('sr-hm-content');
    if (!content) return;

    try {
      // 每次进入“全部题目”都刷新搜索和tag筛选状态
      this.homeSearchQuery = '';
      this.homeActiveTag = null;
      const input = document.getElementById('sr-hm-search-input');
      if (input) input.value = '';

      const resp = await this.safeSendMessage({ action: 'getProblems' });
      this.homeAllProblems = resp?.problems || [];
      this.homeAllProblems.sort((a, b) => b.addedAt - a.addedAt);
      this.renderHomeAllList();
    } catch (error) {
      content.innerHTML = `<div class="sr-hm-empty"><div class="sr-hm-empty-text">加载失败</div></div>`;
    }
  }

  renderHomeAllList() {
    const content = document.getElementById('sr-hm-content');
    if (!content) return;

    const tagCountMap = {};
    this.homeAllProblems.forEach(p => {
      (p.tags || []).forEach(tag => { tagCountMap[tag] = (tagCountMap[tag] || 0) + 1; });
    });
    const sortedTags = Object.entries(tagCountMap).sort((a, b) => b[1] - a[1]);
    const tagsPanelHtml = sortedTags.length > 0
      ? `
        <div class="sr-hm-tag-panel">
          <div class="sr-hm-tag-list">
            ${sortedTags.map(([tag, count]) => `<button class="sr-hm-top-tag ${this.homeActiveTag === tag ? 'active' : ''}" data-top-tag="${tag}">${tag} <span class="count">(${count})</span></button>`).join('')}
          </div>
        </div>
      `
      : '';

    let filtered = [...this.homeAllProblems];
    if (this.homeSearchQuery) {
      filtered = filtered.filter(p => {
        const tagsText = (p.tags || []).join(' ');
        return `${p.number} ${p.title} ${p.slug} ${tagsText}`
          .toLowerCase()
          .includes(this.homeSearchQuery);
      });
    }
    if (this.homeActiveTag) {
      filtered = filtered.filter(p => (p.tags || []).includes(this.homeActiveTag));
    }

    if (filtered.length === 0) {
      content.innerHTML = `
        ${tagsPanelHtml}
        <div class="sr-hm-empty">
          <div class="sr-hm-empty-icon">${this.homeAllProblems.length === 0 ? '➕' : '🔍'}</div>
          <div class="sr-hm-empty-text">${this.homeAllProblems.length === 0 ? '还没有添加题目' : '没有匹配结果'}</div>
          <div class="sr-hm-empty-sub">${this.homeAllProblems.length === 0 ? '在题目页面点击「加入复习」' : '试试其他关键词'}</div>
        </div>
      `;
      return;
    }

    content.innerHTML = `${tagsPanelHtml}${filtered.map(p => this.createHomeCard(p, 'all')).join('')}`;
    this.bindHomeCardEvents(content);
    this.localize(content);

    content.querySelectorAll('.sr-hm-top-tag[data-top-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.topTag;
        if (this.homeActiveTag === tag) this.homeActiveTag = null;
        else this.homeActiveTag = tag;
        this.renderHomeAllList();
      });
    });
  }

  // ============ 数据统计 Tab ============
  async loadHomeStatsTab() {
    const content = document.getElementById('sr-hm-content');
    if (!content) return;

    try {
      const resp = await this.safeSendMessage({ action: 'getProblems' });
      const problems = resp?.problems || [];
      const total = problems.length;
      const mastered = problems.filter(p => p.mastered).length;
      const completionRate = total > 0 ? Math.round((mastered / total) * 100) : 0;
      const easyCount = problems.filter(p => p.difficulty === 'Easy').length;
      const mediumCount = problems.filter(p => p.difficulty === 'Medium').length;
      const hardCount = problems.filter(p => p.difficulty === 'Hard').length;

      // 近14天复习活动
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const dailyReviews = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const dStart = d.getTime(), dEnd = dStart + 86400000;
        let count = 0;
        problems.forEach(p => {
          (p.completedReviews || []).forEach(ts => { if (ts >= dStart && ts < dEnd) count++; });
        });
        dailyReviews.push({ date: d, count, label: `${d.getMonth() + 1}/${d.getDate()}` });
      }
      const maxReview = Math.max(...dailyReviews.map(d => d.count), 1);

      // 连续打卡
      let streak = 0;
      for (let i = 0; i <= 365; i++) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const dStart = d.getTime(), dEnd = dStart + 86400000;
        const has = problems.some(p => (p.completedReviews || []).some(ts => ts >= dStart && ts < dEnd));
        if (has) streak++;
        else if (i > 0) break;
      }

      // 平均用时
      let totalTimes = 0, timeCount = 0;
      problems.forEach(p => {
        (p.reviewHistory || []).forEach(h => {
          if (h.time) {
            const m = h.time.match(/(\d+)/);
            if (m) { totalTimes += parseInt(m[1]); timeCount++; }
          }
        });
      });
      const avgTime = timeCount > 0 ? Math.round(totalTimes / timeCount) : 0;
      const totalReviewsDone = problems.reduce((s, p) => s + (p.completedReviews?.length || 0), 0);

      // Bar chart
      const barsHtml = dailyReviews.map((d, idx) => {
        const height = d.count > 0 ? Math.max(8, Math.round((d.count / maxReview) * 100)) : 3;
        const showLabel = idx % 2 === 0 || idx === 13;
        return `
          <div class="sr-chart-col">
            <div class="sr-chart-val">${d.count || ''}</div>
            <div class="sr-chart-bar ${d.count > 0 ? 'active' : ''}" style="height:${height}%"></div>
            <div class="sr-chart-label">${showLabel ? d.label : ''}</div>
          </div>
        `;
      }).join('');

      // Donut chart
      const diffTotal = easyCount + mediumCount + hardCount;
      let conicGrad = '#e2e8f0 0deg 360deg';
      if (diffTotal > 0) {
        const eDeg = (easyCount / diffTotal) * 360;
        const mDeg = eDeg + (mediumCount / diffTotal) * 360;
        conicGrad = `#10b981 0deg ${eDeg}deg, #f59e0b ${eDeg}deg ${mDeg}deg, #ef4444 ${mDeg}deg 360deg`;
      }

      // Week overview
      const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
      let weekHtml = '';
      for (let i = 0; i < 7; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        const dStart = d.getTime(), dEnd = dStart + 86400000;
        let count = problems.filter(p => {
          if (p.mastered || p.currentInterval >= p.reviewDates.length) return false;
          const next = p.reviewDates[p.currentInterval];
          return next >= dStart && next < dEnd;
        }).length;
        if (i === 0) {
          count += problems.filter(p => {
            if (p.mastered || p.currentInterval >= p.reviewDates.length) return false;
            return p.reviewDates[p.currentInterval] < dStart;
          }).length;
        }
        const isToday = i === 0;
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const dayName = isToday ? '今天' : `周${dayNames[d.getDay()]}`;
        weekHtml += `
          <div class="sr-stat-week-day ${isToday ? 'today' : ''} ${count > 0 ? 'has-reviews' : ''}">
            <div class="sr-stat-week-name">${dayName}</div>
            <div class="sr-stat-week-count">${count}</div>
            <div class="sr-stat-week-date">${dateStr}</div>
          </div>
        `;
      }

      content.innerHTML = `
        <div class="sr-stats-mini-grid">
          <div class="sr-stats-mini"><div class="sr-stats-mini-icon">🔥</div><div class="sr-stats-mini-val">${streak}</div><div class="sr-stats-mini-lbl">连续天数</div></div>
          <div class="sr-stats-mini"><div class="sr-stats-mini-icon">⏱</div><div class="sr-stats-mini-val">${avgTime > 0 ? avgTime + 'min' : '—'}</div><div class="sr-stats-mini-lbl">平均用时</div></div>
          <div class="sr-stats-mini"><div class="sr-stats-mini-icon">📈</div><div class="sr-stats-mini-val">${completionRate}%</div><div class="sr-stats-mini-lbl">掌握率</div></div>
          <div class="sr-stats-mini"><div class="sr-stats-mini-icon">📚</div><div class="sr-stats-mini-val">${totalReviewsDone}</div><div class="sr-stats-mini-lbl">总复习次数</div></div>
        </div>

        <div class="sr-stats-section">
          <div class="sr-stats-section-title">📈 复习活动（近14天）</div>
          <div class="sr-chart-bars">${barsHtml}</div>
        </div>

        <div class="sr-stats-section">
          <div class="sr-stats-section-title">📊 难度分布</div>
          <div class="sr-stats-diff-row">
            <div class="sr-stats-donut" style="background:conic-gradient(${conicGrad})">
              <div class="sr-stats-donut-center">${diffTotal}</div>
            </div>
            <div class="sr-stats-diff-legend">
              <div class="sr-stats-diff-item"><span class="sr-stats-diff-dot easy"></span><span>Easy</span><b>${easyCount}</b></div>
              <div class="sr-stats-diff-item"><span class="sr-stats-diff-dot medium"></span><span>Medium</span><b>${mediumCount}</b></div>
              <div class="sr-stats-diff-item"><span class="sr-stats-diff-dot hard"></span><span>Hard</span><b>${hardCount}</b></div>
            </div>
          </div>
        </div>

        <div class="sr-stats-section">
          <div class="sr-stats-section-title">📅 本周概览</div>
          <div class="sr-stat-week">${weekHtml}</div>
        </div>
      `;
      this.localize(content);
    } catch (error) {
      content.innerHTML = `<div class="sr-hm-empty"><div class="sr-hm-empty-text">加载失败</div></div>`;
      this.localize(content);
    }
  }

  // ============ Home Card ============
  createHomeCard(problem, context) {
    const nextReview = problem.reviewDates[problem.currentInterval];
    const nextDate = nextReview ? new Date(nextReview) : null;
    const isCompleted = problem.currentInterval >= problem.reviewDates.length;
    const isMastered = problem.mastered;
    const progress = Math.min(problem.currentInterval || 0, problem.reviewDates.length);
    const totalR = problem.reviewDates.length;
    const pct = totalR > 0 ? Math.round((progress / totalR) * 100) : 0;
    const tags = (problem.tags || []).slice(0, 3);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const isOverdue = nextDate && nextDate < now && !isCompleted && !isMastered;
    const overdueDays = isOverdue && nextDate ? Math.round((now.getTime() - nextDate.getTime()) / 86400000) : 0;

    let statusText = '';
    if (isMastered) statusText = this.tr('⭐ 已掌握');
    else if (isCompleted) statusText = this.tr('✅ 已完成');
    else if (nextDate) statusText = `📅 ${nextDate.toLocaleDateString()}`;

    const tagsHtml = tags.length > 0
      ? `<div class="sr-hm-card-tags">${tags.map(t => `<span class="sr-hm-card-tag" data-tag="${t}">${t}</span>`).join('')}</div>`
      : '';

    const actionsHtml = `
      <button class="sr-hm-btn" data-action="view" data-slug="${problem.slug}">记录</button>
      <button class="sr-hm-btn danger" data-action="delete" data-slug="${problem.slug}">删除</button>
    `;

    const isCustom = !!problem.isCustom;
    const numBadge = isCustom ? '<span class="sr-hm-card-num sr-custom-badge">📝</span>' : `<span class="sr-hm-card-num">#${problem.number}</span>`;
    const diffSpan = isCustom ? '' : `<span class="sr-hm-card-diff ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span>`;
    const titleAction = isCustom ? `data-action="view" data-slug="${problem.slug}"` : `data-action="open-title" data-url="${problem.url}"`;
    const titleTip = isCustom ? this.tr('查看详情') : this.tr('打开题目');

    return `
      <div class="sr-hm-card ${isMastered ? 'mastered' : ''} ${context === 'done' ? 'done-card' : ''} ${context === 'added' ? 'added-card' : ''} ${context === 'today' ? 'due-card' : ''} ${isOverdue ? 'overdue' : ''}">
        <div class="sr-hm-card-header">
          <div class="sr-hm-card-title sr-hm-card-title-link" ${titleAction} title="${titleTip}">
            ${numBadge}
            ${problem.title}
            ${isMastered ? '<span class="sr-hm-badge gold">⭐</span>' : ''}
            ${isOverdue ? `<span class="sr-hm-badge red">${this.trText(`逾期 ${overdueDays} 天`)}</span>` : ''}
          </div>
          ${diffSpan}
        </div>
        ${tagsHtml}
        <div class="sr-hm-card-meta">
          <span>${statusText}</span>
          <span>📊 ${progress}/${totalR}</span>
        </div>
        <div class="sr-hm-card-progress"><div class="sr-hm-card-progress-fill" style="width:${pct}%"></div></div>
        <div class="sr-hm-card-actions">${actionsHtml}</div>
      </div>
    `;
  }

  bindHomeCardEvents(container) {
    container.querySelectorAll('[data-action="open-title"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.url) window.location.href = btn.dataset.url;
      });
    });
    container.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showProblemDetailModal(btn.dataset.slug);
      });
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(this.tr('确定要删除这道题吗？'))) {
          await this.safeSendMessage({ action: 'deleteProblem', slug: btn.dataset.slug });
          this.showNotification('已删除', 'info');
          this.refreshHomeIfOpen();
          this.checkProblemStatus();
        }
      });
    });

    // 点击已有 tag 直接用于全部题目搜索
    container.querySelectorAll('.sr-hm-card-tag[data-tag]').forEach(tagEl => {
      tagEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = tagEl.dataset.tag || '';
        const modal = document.querySelector('.sr-home-modal');
        if (!modal) return;

        // 切换到“全部题目”并填充搜索词
        if (this.homeCurrentTab !== 'all') {
          const allTab = modal.querySelector('.sr-hm-tab[data-tab="all"]');
          if (allTab) allTab.click();
        }

        this.homeSearchQuery = '';
        this.homeActiveTag = tag;
        const input = modal.querySelector('#sr-hm-search-input');
        if (input) input.value = '';
        this.renderHomeAllList();
      });
    });
  }

  // ============ Home 内提交复习 ============
  showHomeSubmitDialog(slug) {
    // Remove existing sub-dialog
    const old = document.getElementById('sr-home-sub-dialog');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sr-home-sub-dialog';
    overlay.className = 'leetcode-sr-overlay sr-sub-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'sr-sub-dialog';
    dialog.style.zoom = this.scale;
    dialog.innerHTML = `
      <div class="leetcode-sr-modal-header">
        <h3>✅ 提交复习</h3>
        <button class="leetcode-sr-modal-close" id="sr-sub-close">&times;</button>
      </div>
      <div class="leetcode-sr-modal-body">
        <div class="sr-note-form-compact">
          <input type="text" id="sr-sub-time" placeholder="用时（如: 15min）" class="sr-text-input">
          <textarea id="sr-sub-comment" placeholder="笔记（可选）" class="sr-text-input sr-textarea" rows="2"></textarea>
        </div>
      </div>
      <div class="leetcode-sr-modal-footer">
        <button class="sr-btn-cancel" id="sr-sub-cancel">取消</button>
        <button class="sr-btn-confirm" id="sr-sub-confirm">提交</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    this.localize(dialog);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    dialog.querySelector('#sr-sub-close').addEventListener('click', () => overlay.remove());
    dialog.querySelector('#sr-sub-cancel').addEventListener('click', () => overlay.remove());
    dialog.querySelector('#sr-sub-confirm').addEventListener('click', async () => {
      const time = document.getElementById('sr-sub-time').value.trim();
      const comment = document.getElementById('sr-sub-comment').value.trim();
      const resp = await this.safeSendMessage({
        action: 'markReviewed', slug,
        time: time || null, comment: comment || null
      });
      overlay.remove();
      if (resp && resp.success && resp.counted === false) {
        this.showNotification('ℹ️ 未到计划日期，仅记录笔记', 'info');
      } else {
        this.showNotification('✅ 复习已提交', 'success');
      }
      this.refreshHomeIfOpen();
      this.checkProblemStatus();
      this.checkTodayStatus();
    });
  }

  // ============ 设置视图 (in home modal) ============
  showSettingsView() {
    const modal = document.querySelector('.sr-home-modal');
    if (!modal) return;

    // Hide main content
    modal.querySelector('.sr-hm-stats')?.classList.add('hidden');
    modal.querySelector('.sr-hm-extra')?.classList.add('hidden');
    modal.querySelector('#sr-hm-tabs')?.classList.add('hidden');
    modal.querySelector('#sr-hm-search')?.classList.add('hidden');
    modal.querySelector('#sr-hm-content')?.classList.add('hidden');
    modal.querySelector('#sr-hm-footer')?.classList.add('hidden');

    const settingsDiv = document.createElement('div');
    settingsDiv.id = 'sr-settings-view';
    settingsDiv.className = 'sr-settings-view';

    settingsDiv.innerHTML = `
      <div class="sr-settings-nav">
        <button class="sr-settings-back" id="sr-settings-back">← 返回</button>
        <span class="sr-settings-title">⚙️ 设置</span>
      </div>
      <div class="sr-settings-body">
        <div class="sr-settings-section">
          <h4>🌐 界面语言</h4>
          <div class="sr-default-plan-group">
            <label class="sr-default-plan-option ${this.uiLanguage === 'en' ? 'active' : ''}">
              <input type="radio" name="sr-ui-lang" value="en" ${this.uiLanguage === 'en' ? 'checked' : ''}>
              English
            </label>
            <label class="sr-default-plan-option ${this.uiLanguage === 'zh' ? 'active' : ''}">
              <input type="radio" name="sr-ui-lang" value="zh" ${this.uiLanguage === 'zh' ? 'checked' : ''}>
              中文
            </label>
          </div>
        </div>

        <div class="sr-settings-section">
          <h4>✅ 默认复习方案</h4>
          <p class="sr-settings-desc">用于“加入复习/重新加入”页面的默认自动勾选</p>
          <div class="sr-default-plan-group">
            <label class="sr-default-plan-option ${this.defaultPlan === 'full' ? 'active' : ''}" data-plan="full">
              <input type="radio" name="sr-default-plan" value="full" ${this.defaultPlan === 'full' ? 'checked' : ''}>
              🔥 完整复习
            </label>
            <label class="sr-default-plan-option ${this.defaultPlan === 'half' ? 'active' : ''}" data-plan="half">
              <input type="radio" name="sr-default-plan" value="half" ${this.defaultPlan === 'half' ? 'checked' : ''}>
              ⚡ 精简复习
            </label>
          </div>
        </div>

        <div class="sr-settings-section">
          <h4>🔍 显示大小</h4>
          <p class="sr-settings-desc">调整插件界面的显示比例</p>
          <div class="sr-scale-row">
            <span class="sr-scale-a-small">A</span>
            <input type="range" min="0.8" max="1.6" step="0.05" value="${this.scale}" id="sr-scale-slider" class="sr-scale-slider">
            <span class="sr-scale-a-large">A</span>
            <span class="sr-scale-value" id="sr-scale-value">${Math.round(this.scale * 100)}%</span>
          </div>
        </div>

        <div class="sr-settings-section">
          <h4>📊 复习间隔方案</h4>
          <p class="sr-settings-desc">点击 × 删除间隔，点击 + 添加新天数</p>
          <div id="sr-settings-plans"></div>
        </div>

        <div class="sr-settings-section">
          <h4>📈 数据管理</h4>
          <div class="sr-settings-data-row">
            <button class="sr-settings-data-btn" id="sr-settings-export">📤 导出数据</button>
            <button class="sr-settings-data-btn" id="sr-settings-import">📥 导入数据</button>
          </div>
          <button class="sr-settings-danger-btn" id="sr-settings-clear">🗑️ 清空所有数据</button>
        </div>
      </div>
    `;
    this.localize(settingsDiv);

    modal.appendChild(settingsDiv);

    // Back
    settingsDiv.querySelector('#sr-settings-back').addEventListener('click', () => this.hideSettingsView());

    // Default plan selector
    settingsDiv.querySelectorAll('.sr-default-plan-option[data-plan]').forEach(option => {
      option.addEventListener('click', () => {
        settingsDiv.querySelectorAll('.sr-default-plan-option[data-plan]').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        const input = option.querySelector('input');
        input.checked = true;
        this.saveDefaultPlan(input.value);
      });
    });

    settingsDiv.querySelectorAll('input[name="sr-ui-lang"]').forEach(input => {
      input.addEventListener('change', async (e) => {
        await this.saveLanguage(e.target.value);
        this.closeHomeModal();
        this.showHomeModal();
        this.checkProblemStatus();
        this.checkTodayStatus();
      });
    });

    // Scale slider
    const slider = settingsDiv.querySelector('#sr-scale-slider');
    const valueLabel = settingsDiv.querySelector('#sr-scale-value');
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      valueLabel.textContent = Math.round(val * 100) + '%';
      this.saveScale(val);
    });

    // Load interval plans
    this.renderSettingsIntervals(settingsDiv.querySelector('#sr-settings-plans'));

    // Export
    settingsDiv.querySelector('#sr-settings-export').addEventListener('click', async () => {
      try {
        const resp = await this.safeSendMessage({ action: 'getFullExportData' });
        if (!resp || !resp.success) { this.showNotification('导出失败', 'error'); return; }
        const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leetcode-reviews-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('✅ 导出成功', 'success');
      } catch (err) {
        this.showNotification('导出失败', 'error');
      }
    });

    // Import
    settingsDiv.querySelector('#sr-settings-import').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (ev) => {
        try {
          const file = ev.target.files[0];
          const text = await file.text();
          const data = JSON.parse(text);
          const resp = await this.safeSendMessage({ action: 'importFullData', data });
          if (resp && resp.success) {
            this.showNotification(`✅ 导入成功！${resp.count} 道题`, 'success');
            this.hideSettingsView();
            this.refreshHomeIfOpen();
            this.checkProblemStatus();
            this.checkTodayStatus();
          } else {
            throw new Error(resp?.error || '导入失败');
          }
        } catch (err) {
          this.showNotification('导入失败: ' + err.message, 'error');
        }
      };
      input.click();
    });

    // Clear
    settingsDiv.querySelector('#sr-settings-clear').addEventListener('click', async () => {
      if (confirm(this.tr('确定要清空所有数据吗？此操作不可恢复！'))) {
        if (confirm(this.tr('再次确认：真的要删除所有复习记录吗？'))) {
          await chrome.storage.local.set({ problems: {} });
          this.showNotification('所有数据已清空', 'info');
          this.hideSettingsView();
          this.refreshHomeIfOpen();
          this.checkProblemStatus();
        }
      }
    });
  }

  hideSettingsView() {
    const modal = document.querySelector('.sr-home-modal');
    if (!modal) return;
    const settingsDiv = document.getElementById('sr-settings-view');
    if (settingsDiv) settingsDiv.remove();

    modal.querySelector('.sr-hm-stats')?.classList.remove('hidden');
    modal.querySelector('.sr-hm-extra')?.classList.remove('hidden');
    modal.querySelector('#sr-hm-tabs')?.classList.remove('hidden');
    modal.querySelector('#sr-hm-content')?.classList.remove('hidden');
    modal.querySelector('#sr-hm-footer')?.classList.remove('hidden');
    // Search only visible in 'all' tab
    if (this.homeCurrentTab === 'all') {
      modal.querySelector('#sr-hm-search')?.classList.remove('hidden');
    }
  }

  async renderSettingsIntervals(container) {
    if (!container) return;
    try {
      const resp = await this.safeSendMessage({ action: 'getPlanTemplates' });
      const templates = resp?.templates || {};
      let html = '';
      for (const [key, plan] of Object.entries(templates)) {
        const isAlt = key === 'half';
        const label = key === 'full' ? '🔥 完整' : '⚡ 精简';
        const tagsHtml = plan.intervals.map((d, i) =>
          `<span class="sr-settings-itag ${isAlt ? 'alt' : ''}">${d}<button class="sr-settings-itag-rm" data-plan="${key}" data-idx="${i}">×</button></span>`
        ).join('<span class="sr-settings-iarrow">→</span>');

        html += `
          <div class="sr-settings-plan-row">
            <span class="sr-settings-plan-label">${label}</span>
            <div class="sr-settings-plan-tags">${tagsHtml}</div>
            <button class="sr-settings-plan-add" data-plan="${key}" title="添加天数">+</button>
          </div>
        `;
      }
      container.innerHTML = html;

      container.querySelectorAll('.sr-settings-itag-rm').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.safeSendMessage({ action: 'removeIntervalFromPlan', plan: btn.dataset.plan, index: parseInt(btn.dataset.idx) });
          this.renderSettingsIntervals(container);
        });
      });

      container.querySelectorAll('.sr-settings-plan-add').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const days = prompt(this.tr('输入天数:'));
          if (days && parseInt(days) > 0) {
            await this.safeSendMessage({ action: 'addIntervalToPlan', plan: btn.dataset.plan, days: parseInt(days) });
            this.renderSettingsIntervals(container);
          }
        });
      });
    } catch (error) {
      container.innerHTML = `<div style="color:#94a3b8;font-size:12px;">${this.tr('加载失败')}</div>`;
    }
    this.localize(container);
  }

  // ============ 自定义题目弹窗 ============
  showCustomProblemModal() {
    this.removeModal();

    const overlay = document.createElement('div');
    overlay.id = 'leetcode-sr-modal-overlay';
    overlay.className = 'leetcode-sr-overlay';

    const modal = document.createElement('div');
    modal.className = 'leetcode-sr-modal';
    modal.style.zoom = this.scale;
    modal.innerHTML = `
      <div class="leetcode-sr-modal-header">
        <h3>📝 ${this.tr('添加自定义题目')}</h3>
        <button class="leetcode-sr-modal-close" id="sr-modal-close">&times;</button>
      </div>
      <div class="leetcode-sr-modal-body">
        <div class="sr-section-title">${this.tr('题目标题')} <span style="color:#ef4444;font-weight:700">*</span></div>
        <input type="text" id="sr-custom-title" placeholder="${this.tr('输入题目标题')}" class="sr-text-input" style="margin-bottom:10px;">
        <div class="sr-section-title">${this.tr('题干')} <span style="font-weight:400;color:#9ca3af;font-size:12px">${this.tr('（选填）')}</span></div>
        <textarea id="sr-custom-body" placeholder="${this.tr('输入题目描述...')}" class="sr-text-input sr-textarea" rows="4" style="margin-bottom:10px;"></textarea>
        <div class="sr-section-title">${this.tr('答案')} <span style="font-weight:400;color:#9ca3af;font-size:12px">${this.tr('（选填）')}</span></div>
        <textarea id="sr-custom-answer" placeholder="${this.tr('输入答案...')}" class="sr-text-input sr-textarea" rows="3"></textarea>
      </div>
      <div class="leetcode-sr-modal-footer">
        <button class="sr-btn-cancel" id="sr-modal-cancel">${this.tr('取消')}</button>
        <button class="sr-btn-confirm" id="sr-modal-confirm">${this.tr('下一步')}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;
    this.localize(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.removeModal(); });
    modal.querySelector('#sr-modal-close').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-cancel').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-confirm').addEventListener('click', () => this.showCustomProblemPlanModal());
  }

  showCustomProblemPlanModal() {
    const title = document.getElementById('sr-custom-title')?.value.trim();
    if (!title) {
      this.showNotification(this.tr('请输入题目标题'), 'info');
      return;
    }
    const body = document.getElementById('sr-custom-body')?.value.trim() || '';
    const answer = document.getElementById('sr-custom-answer')?.value.trim() || '';

    this._pendingCustomProblem = { title, body, answer };

    this.removeModal();
    const defaultIsHalf = this.defaultPlan === 'half';

    const overlay = document.createElement('div');
    overlay.id = 'leetcode-sr-modal-overlay';
    overlay.className = 'leetcode-sr-overlay';

    const modal = document.createElement('div');
    modal.className = 'leetcode-sr-modal';
    modal.style.zoom = this.scale;
    modal.innerHTML = `
      <div class="leetcode-sr-modal-header">
        <h3>📚 ${this.tr('选择复习计划')}</h3>
        <button class="leetcode-sr-modal-close" id="sr-modal-close">&times;</button>
      </div>
      <div class="leetcode-sr-modal-body">
        <div class="leetcode-sr-modal-info">
          <span class="sr-custom-badge" style="font-size:15px">📝</span>
          <span class="sr-problem-name" style="font-size:16px;font-weight:700;color:#1e40af">${this._escapeHtml(title)}</span>
        </div>
        <div class="leetcode-sr-plan-options">
          <label class="leetcode-sr-plan-option ${defaultIsHalf ? '' : 'selected'}" data-plan="full">
            <input type="radio" name="sr-plan" value="full" ${defaultIsHalf ? '' : 'checked'}>
            <div class="sr-plan-content"><div class="sr-plan-title">🔥 完整复习 (6次)</div></div>
          </label>
          <label class="leetcode-sr-plan-option ${defaultIsHalf ? 'selected' : ''}" data-plan="half">
            <input type="radio" name="sr-plan" value="half" ${defaultIsHalf ? 'checked' : ''}>
            <div class="sr-plan-content"><div class="sr-plan-title">⚡ 精简复习 (3次)</div></div>
          </label>
          <label class="leetcode-sr-plan-option" data-plan="custom">
            <input type="radio" name="sr-plan" value="custom">
            <div class="sr-plan-content"><div class="sr-plan-title">🧪 自定义间隔</div></div>
          </label>
        </div>
        <div class="sr-plan-custom-wrap hidden" id="sr-add-custom-wrap">
          <input type="text" id="sr-custom-intervals" placeholder="自定义间隔（如: 0,3,10,30 或 0 3 10 30）" class="sr-text-input">
          <div class="sr-plan-custom-hint">支持空格、逗号、分号</div>
        </div>
        <div class="sr-section-title" style="margin-top:16px">${this.tr('添加笔记')} <span style="font-weight:400;color:#9ca3af;font-size:12px">${this.tr('（可选）')}</span></div>
        <div class="sr-note-form-compact">
          <input type="text" id="sr-add-time" placeholder="${this.tr('用时（如: 25min）')}" class="sr-text-input">
          <textarea id="sr-add-comment" placeholder="${this.tr('笔记（可选）')}" class="sr-text-input sr-textarea" rows="2"></textarea>
        </div>
      </div>
      <div class="leetcode-sr-modal-footer">
        <button class="sr-btn-cancel" id="sr-modal-back">${this.tr('上一步')}</button>
        <button class="sr-btn-confirm" id="sr-modal-confirm">${this.tr('添加题目')}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;
    this.localize(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.removeModal(); });
    modal.querySelector('#sr-modal-close').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-back').addEventListener('click', () => this.goBackToCustomInput());
    modal.querySelector('#sr-modal-confirm').addEventListener('click', () => this.confirmAddCustomProblem());

    modal.querySelectorAll('.leetcode-sr-plan-option').forEach(option => {
      option.addEventListener('click', () => {
        modal.querySelectorAll('.leetcode-sr-plan-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        const input = option.querySelector('input');
        input.checked = true;
        const customWrap = modal.querySelector('#sr-add-custom-wrap');
        if (customWrap) customWrap.classList.toggle('hidden', input.value !== 'custom');
      });
    });
  }

  goBackToCustomInput() {
    const pending = this._pendingCustomProblem;
    this.removeModal();

    const overlay = document.createElement('div');
    overlay.id = 'leetcode-sr-modal-overlay';
    overlay.className = 'leetcode-sr-overlay';

    const modal = document.createElement('div');
    modal.className = 'leetcode-sr-modal';
    modal.style.zoom = this.scale;
    modal.innerHTML = `
      <div class="leetcode-sr-modal-header">
        <h3>📝 ${this.tr('添加自定义题目')}</h3>
        <button class="leetcode-sr-modal-close" id="sr-modal-close">&times;</button>
      </div>
      <div class="leetcode-sr-modal-body">
        <div class="sr-section-title">${this.tr('题目标题')} <span style="color:#ef4444;font-weight:700">*</span></div>
        <input type="text" id="sr-custom-title" placeholder="${this.tr('输入题目标题')}" class="sr-text-input" style="margin-bottom:10px;" value="${this._escapeHtml(pending?.title || '')}">
        <div class="sr-section-title">${this.tr('题干')} <span style="font-weight:400;color:#9ca3af;font-size:12px">${this.tr('（选填）')}</span></div>
        <textarea id="sr-custom-body" placeholder="${this.tr('输入题目描述...')}" class="sr-text-input sr-textarea" rows="4" style="margin-bottom:10px;">${this._escapeHtml(pending?.body || '')}</textarea>
        <div class="sr-section-title">${this.tr('答案')} <span style="font-weight:400;color:#9ca3af;font-size:12px">${this.tr('（选填）')}</span></div>
        <textarea id="sr-custom-answer" placeholder="${this.tr('输入答案...')}" class="sr-text-input sr-textarea" rows="3">${this._escapeHtml(pending?.answer || '')}</textarea>
      </div>
      <div class="leetcode-sr-modal-footer">
        <button class="sr-btn-cancel" id="sr-modal-cancel">${this.tr('取消')}</button>
        <button class="sr-btn-confirm" id="sr-modal-confirm">${this.tr('下一步')}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;
    this.localize(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.removeModal(); });
    modal.querySelector('#sr-modal-close').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-cancel').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-confirm').addEventListener('click', () => this.showCustomProblemPlanModal());
  }

  async confirmAddCustomProblem() {
    const pending = this._pendingCustomProblem;
    if (!pending || !pending.title) {
      this.showNotification(this.tr('请输入题目标题'), 'info');
      return;
    }
    const { title, body, answer } = pending;

    const selectedPlanInput = document.querySelector('input[name="sr-plan"]:checked');
    if (!selectedPlanInput) return;
    const selectedPlan = selectedPlanInput.value;
    let customIntervals = null;
    if (selectedPlan === 'custom') {
      const raw = document.getElementById('sr-custom-intervals')?.value || '';
      customIntervals = this.parseCustomIntervals(raw);
      if (customIntervals.length === 0) {
        this.showNotification('请输入有效天数', 'info');
        return;
      }
    }

    const time = document.getElementById('sr-add-time')?.value.trim() || '';
    const comment = document.getElementById('sr-add-comment')?.value.trim() || '';
    this.removeModal();

    try {
      const slug = 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const problemInfo = {
        number: '',
        title: title,
        slug: slug,
        difficulty: '',
        tags: [],
        url: '',
        site: window.location.hostname.includes('leetcode.cn') ? 'leetcode.cn' : 'leetcode.com',
        timestamp: Date.now(),
        isCustom: true,
        customBody: body,
        customAnswer: answer
      };

      const response = await this.safeSendMessage({
        action: 'addProblem',
        problem: problemInfo,
        planType: selectedPlan,
        customIntervals,
        time: time || null,
        comment: comment || null
      });

      if (response && response.success) {
        this._pendingCustomProblem = null;
        this.showNotification(this.tr('✅ 自定义题目已添加！'), 'success');
        this.checkTodayStatus();
        this.refreshHomeIfOpen();
      } else {
        throw new Error(response?.error || '添加失败');
      }
    } catch (error) {
      this.showNotification('❌ ' + error.message, 'error');
    }
  }

  // ============ 加入复习弹窗 ============
  showPlanSelectionModal() {
    this.removeModal();
    const defaultIsHalf = this.defaultPlan === 'half';

    const overlay = document.createElement('div');
    overlay.id = 'leetcode-sr-modal-overlay';
    overlay.className = 'leetcode-sr-overlay';

    const modal = document.createElement('div');
    modal.className = 'leetcode-sr-modal';
    modal.style.zoom = this.scale;
    modal.innerHTML = `
      <div class="leetcode-sr-modal-header">
        <h3>📚 加入复习计划</h3>
        <button class="leetcode-sr-modal-close" id="sr-modal-close">&times;</button>
      </div>
      <div class="leetcode-sr-modal-body">
        <div class="leetcode-sr-modal-info">
          <span class="sr-problem-badge">#${this.problemInfo.number}</span>
          <span class="sr-problem-name">${this.problemInfo.title}</span>
          <span class="sr-difficulty-badge ${this.problemInfo.difficulty.toLowerCase()}">${this.problemInfo.difficulty}</span>
        </div>
        <div class="leetcode-sr-plan-options">
          <label class="leetcode-sr-plan-option ${defaultIsHalf ? '' : 'selected'}" data-plan="full">
            <input type="radio" name="sr-plan" value="full" ${defaultIsHalf ? '' : 'checked'}>
            <div class="sr-plan-content"><div class="sr-plan-title">🔥 完整复习 (6次)</div></div>
          </label>
          <label class="leetcode-sr-plan-option ${defaultIsHalf ? 'selected' : ''}" data-plan="half">
            <input type="radio" name="sr-plan" value="half" ${defaultIsHalf ? 'checked' : ''}>
            <div class="sr-plan-content"><div class="sr-plan-title">⚡ 精简复习 (3次)</div></div>
          </label>
          <label class="leetcode-sr-plan-option" data-plan="custom">
            <input type="radio" name="sr-plan" value="custom">
            <div class="sr-plan-content"><div class="sr-plan-title">🧪 自定义间隔</div></div>
          </label>
        </div>
        <div class="sr-plan-custom-wrap hidden" id="sr-add-custom-wrap">
          <input type="text" id="sr-custom-intervals" placeholder="自定义间隔（如: 0,3,10,30 或 0 3 10 30）" class="sr-text-input">
          <div class="sr-plan-custom-hint">支持空格、逗号、分号</div>
        </div>
        <div class="sr-section-title" style="margin-top:16px">添加笔记 <span style="font-weight:400;color:#9ca3af;font-size:12px">（可选）</span></div>
        <div class="sr-note-form-compact">
          <input type="text" id="sr-add-time" placeholder="用时（如: 25min）" class="sr-text-input">
          <textarea id="sr-add-comment" placeholder="笔记（可选）" class="sr-text-input sr-textarea" rows="2"></textarea>
        </div>
      </div>
      <div class="leetcode-sr-modal-footer">
        <button class="sr-btn-cancel" id="sr-modal-cancel">取消</button>
        <button class="sr-btn-confirm" id="sr-modal-confirm">确认添加</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;
    this.localize(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.removeModal(); });
    modal.querySelector('#sr-modal-close').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-cancel').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-confirm').addEventListener('click', () => this.confirmAddProblem());

    modal.querySelectorAll('.leetcode-sr-plan-option').forEach(option => {
      option.addEventListener('click', () => {
        modal.querySelectorAll('.leetcode-sr-plan-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        const input = option.querySelector('input');
        input.checked = true;
        const customWrap = modal.querySelector('#sr-add-custom-wrap');
        if (customWrap) customWrap.classList.toggle('hidden', input.value !== 'custom');
      });
    });
  }

  async confirmAddProblem() {
    const selectedPlanInput = document.querySelector('input[name="sr-plan"]:checked');
    if (!selectedPlanInput) return;
    const selectedPlan = selectedPlanInput.value;
    let customIntervals = null;
    if (selectedPlan === 'custom') {
      const raw = document.getElementById('sr-custom-intervals')?.value || '';
      customIntervals = this.parseCustomIntervals(raw);
      if (customIntervals.length === 0) {
        this.showNotification('请输入有效天数', 'info');
        return;
      }
    }
    const time = document.getElementById('sr-add-time').value.trim();
    const comment = document.getElementById('sr-add-comment').value.trim();
    this.removeModal();

    const mainButton = document.getElementById('leetcode-sr-button');
    if (mainButton) {
      mainButton.classList.add('adding');
      mainButton.innerHTML = `<div class="spinner"></div><span>添加中...</span>`;
    }

    try {
      const response = await this.safeSendMessage({
        action: 'addProblem',
        problem: this.problemInfo,
        planType: selectedPlan,
        customIntervals,
        time: time || null,
        comment: comment || null
      });

      if (!response) {
        if (mainButton) mainButton.classList.remove('adding');
        this.checkProblemStatus();
        return;
      }

      if (response.success) {
        this.showNotification('✅ 已添加到复习计划！', 'success');
        this.checkProblemStatus();
        this.checkTodayStatus();
        this.refreshHomeIfOpen();
      } else {
        throw new Error(response.error || '添加失败');
      }
    } catch (error) {
      if (mainButton) mainButton.classList.remove('adding');
      this.checkProblemStatus();
      this.showNotification('❌ ' + error.message, 'error');
    }
  }

  // ============ 提交复习弹窗 ============
  showSubmitReviewModal() {
    this.removeModal();

    const overlay = document.createElement('div');
    overlay.id = 'leetcode-sr-modal-overlay';
    overlay.className = 'leetcode-sr-overlay';

    const modal = document.createElement('div');
    modal.className = 'leetcode-sr-modal';
    modal.style.zoom = this.scale;
    modal.innerHTML = `
      <div class="leetcode-sr-modal-header">
        <h3>✅ 提交复习</h3>
        <button class="leetcode-sr-modal-close" id="sr-modal-close">&times;</button>
      </div>
      <div class="leetcode-sr-modal-body">
        <div class="leetcode-sr-modal-info">
          <span class="sr-problem-badge">#${this.problemInfo.number}</span>
          <span class="sr-problem-name">${this.problemInfo.title}</span>
          <span class="sr-difficulty-badge ${this.problemInfo.difficulty.toLowerCase()}">${this.problemInfo.difficulty}</span>
        </div>
        <div class="sr-note-form-compact">
          <input type="text" id="sr-review-time" placeholder="用时（如: 15min）" class="sr-text-input">
          <textarea id="sr-review-comment" placeholder="笔记（可选）" class="sr-text-input sr-textarea" rows="2"></textarea>
        </div>
      </div>
      <div class="leetcode-sr-modal-footer">
        <button class="sr-btn-cancel" id="sr-modal-cancel">取消</button>
        <button class="sr-btn-confirm" id="sr-modal-confirm">提交</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;
    this.localize(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.removeModal(); });
    modal.querySelector('#sr-modal-close').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-cancel').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-confirm').addEventListener('click', async () => {
      const time = document.getElementById('sr-review-time').value.trim();
      const comment = document.getElementById('sr-review-comment').value.trim();
      const resp = await this.safeSendMessage({
        action: 'markReviewed', slug: this.problemInfo.slug,
        time: time || null, comment: comment || null
      });
      if (resp && resp.success && resp.counted === false) {
        this.showNotification('ℹ️ 未到计划日期，仅记录笔记', 'info');
      } else {
        this.showNotification('✅ 复习已提交！', 'success');
      }
      this.removeModal();
      this.checkProblemStatus();
      this.checkTodayStatus();
      this.refreshHomeIfOpen();
      if (this.todayPanelOpen) await this.refreshTodayPanel();
    });
  }

  showDetailSubmitReviewModal(problem) {
    this.removeModal();
    const isCustom = !!problem.isCustom;
    const infoBadge = isCustom
      ? `<span class="sr-custom-badge" style="font-size:15px">📝</span>`
      : `<span class="sr-problem-badge">#${problem.number}</span>`;
    const diffBadge = isCustom
      ? ''
      : `<span class="sr-difficulty-badge ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span>`;
    const titleStyle = isCustom ? ' style="font-size:16px;font-weight:700;color:#1e40af"' : '';

    const overlay = document.createElement('div');
    overlay.id = 'leetcode-sr-modal-overlay';
    overlay.className = 'leetcode-sr-overlay';

    const modal = document.createElement('div');
    modal.className = 'leetcode-sr-modal';
    modal.style.zoom = this.scale;
    modal.innerHTML = `
      <div class="leetcode-sr-modal-header">
        <h3>✅ ${this.tr('提交复习')}</h3>
        <button class="leetcode-sr-modal-close" id="sr-modal-close">&times;</button>
      </div>
      <div class="leetcode-sr-modal-body">
        <div class="leetcode-sr-modal-info">
          ${infoBadge}
          <span class="sr-problem-name"${titleStyle}>${problem.title}</span>
          ${diffBadge}
        </div>
        <div class="sr-note-form-compact">
          <input type="text" id="sr-review-time" placeholder="${this.tr('用时（如: 15min）')}" class="sr-text-input">
          <textarea id="sr-review-comment" placeholder="${this.tr('笔记（可选）')}" class="sr-text-input sr-textarea" rows="2"></textarea>
        </div>
      </div>
      <div class="leetcode-sr-modal-footer">
        <button class="sr-btn-cancel" id="sr-modal-cancel">${this.tr('取消')}</button>
        <button class="sr-btn-confirm" id="sr-modal-confirm">${this.tr('提交')}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;
    this.localize(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.removeModal(); });
    modal.querySelector('#sr-modal-close').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-cancel').addEventListener('click', () => this.removeModal());
    modal.querySelector('#sr-modal-confirm').addEventListener('click', async () => {
      const time = document.getElementById('sr-review-time').value.trim();
      const comment = document.getElementById('sr-review-comment').value.trim();
      const resp = await this.safeSendMessage({
        action: 'markReviewed', slug: problem.slug,
        time: time || null, comment: comment || null
      });
      if (resp && resp.success && resp.counted === false) {
        this.showNotification('ℹ️ ' + this.tr('未到计划日期，仅记录笔记'), 'info');
      } else {
        this.showNotification('✅ ' + this.tr('复习已提交！'), 'success');
      }
      this.removeModal();
      this.checkProblemStatus();
      this.checkTodayStatus();
      this.refreshHomeIfOpen();
      if (this.todayPanelOpen) await this.refreshTodayPanel();
    });
  }

  // ============ 题目详情弹窗 ============
  async showProblemDetailModal(slugParam) {
    if (this.isDragging) return;
    this.removeModal();

    const slug = slugParam || this.problemInfo.slug;
    const response = await this.safeSendMessage({ action: 'getProblem', slug });
    if (!response || !response.problem) {
      this.showNotification('❌ 无法获取题目信息', 'error');
      return;
    }

    const problem = response.problem;
    const isCompleted = problem.currentInterval >= problem.reviewDates.length;
    const isMastered = problem.mastered;
    const history = problem.reviewHistory || [];
    const doneInCurrentPlan = Math.min(problem.currentInterval || 0, problem.reviewDates.length);
    const addedDate = new Date(problem.addedAt).toLocaleDateString();
    const addHistory = Array.isArray(problem.addHistory) && problem.addHistory.length > 0
      ? [...problem.addHistory]
      : (problem.addedAt ? [{
        timestamp: problem.addedAt,
        type: 'add',
        planType: problem.planType || 'full',
        intervals: Array.isArray(problem.intervals) ? [...problem.intervals] : []
      }] : []);

    const mergedHistory = [];
    addHistory.forEach(h => {
      const planLabel = h.planType === 'full'
        ? this.tr('🔥 完整')
        : (h.planType === 'half' ? this.tr('⚡ 精简') : this.tr('🧪 自定义'));
      const intervalsLabel = Array.isArray(h.intervals) && h.intervals.length > 0 ? h.intervals.join(' / ') : '-';
      const title = h.type === 'readd' ? 'Re-add Review' : 'Add Review';
      const addExtraLabel = Number.isInteger(h.extraDays) ? this.trText(`第${h.extraDays}天`) : '';
      const lineText = addExtraLabel || `${planLabel} · ${intervalsLabel}`;
      mergedHistory.push({
        timestamp: h.timestamp,
        kind: 'add',
        title,
        detailLines: [{ className: 'sr-history-line', text: lineText }]
      });
    });
    history.forEach(h => {
      const dayLabel = h.dayLabel != null ? `Day ${h.dayLabel}` : 'Notes';
      const detailLines = [];
      if (h.dueDate && h.submittedAt) {
        const dueDayStart = this.getStartOfDayTs(h.dueDate);
        const submitDayStart = this.getStartOfDayTs(h.submittedAt);
        if (submitDayStart > dueDayStart) {
          const lateDays = Math.round((submitDayStart - dueDayStart) / 86400000);
          detailLines.push({
            className: 'sr-history-late',
            text: `⏰ ${this.tr('计划')} ${new Date(h.dueDate).toLocaleDateString()} · ${this.trText(`补交(+${lateDays}天)`)}`
          });
        }
      }
      if (h.comment) detailLines.push({ className: 'sr-history-comment', text: `📝 ${h.comment}` });
      mergedHistory.push({
        timestamp: h.timestamp,
        kind: 'review',
        title: dayLabel,
        inlineTime: h.time ? `⏱ ${h.time}` : '',
        detailLines
      });
    });

    const historyHtml = mergedHistory.length > 0
      ? mergedHistory
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(item => `
          <div class="sr-history-item ${item.kind === 'add' ? 'is-add' : 'is-review'}">
            <div class="sr-history-header">
              <div class="sr-history-main">
                <span class="sr-history-num">${item.title}</span>
                ${item.inlineTime ? `<span class="sr-history-inline-time">${item.inlineTime}</span>` : ''}
              </div>
              <span class="sr-history-date">${new Date(item.timestamp).toLocaleString()}</span>
            </div>
            ${item.detailLines.map(line => `<div class="${line.className}">${line.text}</div>`).join('')}
          </div>
        `).join('')
      : '<div class="sr-empty-history">暂无复习记录</div>';

    const futureItems = [];
    const planBase = new Date(problem.planBaseAt || problem.addedAt || Date.now());
    planBase.setHours(0, 0, 0, 0);
    const planBaseMs = planBase.getTime();
    for (let i = problem.currentInterval; i < problem.reviewDates.length; i++) {
      const date = new Date(problem.reviewDates[i]);
      const reviewDay = new Date(problem.reviewDates[i]);
      reviewDay.setHours(0, 0, 0, 0);
      const dayDiff = Math.max(0, Math.round((reviewDay.getTime() - planBaseMs) / 86400000));
      futureItems.push(`
        <div class="sr-future-item">
          <span class="sr-future-day">${this.trText(`第${dayDiff}天`)}</span>
          <span class="sr-future-date">${date.toLocaleDateString()}</span>
          <button class="sr-future-remove" data-remove-index="${i}" title="移除">✕</button>
        </div>
      `);
    }
    const futurePlanHtml = futureItems.length > 0
      ? futureItems.join('')
      : '<div class="sr-empty-history">无待复习计划</div>';

    const overlay = document.createElement('div');
    overlay.id = 'leetcode-sr-modal-overlay';
    overlay.className = 'leetcode-sr-overlay';

    const modal = document.createElement('div');
    modal.className = 'leetcode-sr-modal leetcode-sr-modal-detail';
    modal.style.zoom = this.scale;
    const isCustom = !!problem.isCustom;
    const infoBadge = isCustom
      ? `<span class="sr-problem-badge sr-custom-badge">📝</span>`
      : `<span class="sr-problem-badge">#${problem.number}</span>`;
    const diffBadge = isCustom
      ? ''
      : `<span class="sr-difficulty-badge ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span>`;

    let customSectionsHtml = '';
    if (isCustom) {
      const bodyText = problem.customBody || '';
      const answerText = problem.customAnswer || '';
      customSectionsHtml = `
        <div class="sr-custom-section">
          <div class="sr-custom-section-header" data-toggle="sr-custom-body-content">
            <span>${this.tr('题干')}</span>
            <span class="sr-custom-toggle-icon">▶</span>
          </div>
          <div class="sr-custom-section-content" id="sr-custom-body-content" style="display:none;">
            <textarea class="sr-custom-editable sr-textarea" id="sr-custom-body-edit" rows="4" placeholder="${this.tr('暂无题干')}">${this._escapeHtml(bodyText)}</textarea>
            <button class="sr-custom-save-btn" id="sr-save-body">${this.tr('保存')}</button>
          </div>
        </div>
        <div class="sr-custom-section">
          <div class="sr-custom-section-header" data-toggle="sr-custom-answer-content">
            <span>${this.tr('答案')}</span>
            <span class="sr-custom-toggle-icon">▶</span>
          </div>
          <div class="sr-custom-section-content" id="sr-custom-answer-content" style="display:none;">
            <textarea class="sr-custom-editable sr-textarea" id="sr-custom-answer-edit" rows="4" placeholder="${this.tr('暂无答案')}">${this._escapeHtml(answerText)}</textarea>
            <button class="sr-custom-save-btn" id="sr-save-answer">${this.tr('保存')}</button>
          </div>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="leetcode-sr-modal-header">
        <h3>📋 ${this.tr('题目记录')}</h3>
        <button class="leetcode-sr-modal-close" id="sr-modal-close">&times;</button>
      </div>
      <div class="leetcode-sr-modal-body">
        <div class="leetcode-sr-modal-info">
          ${infoBadge}
          <span class="sr-problem-name">${problem.title}</span>
          ${diffBadge}
        </div>
        <div class="sr-detail-stats">
          <div class="sr-detail-stat"><span class="sr-stat-label">${this.tr('加入时间')}</span><span class="sr-stat-value">${addedDate}</span></div>
          <div class="sr-detail-stat"><span class="sr-stat-label">${this.tr('复习进度')}</span><span class="sr-stat-value">${doneInCurrentPlan} / ${problem.reviewDates.length}</span></div>
          <div class="sr-detail-stat"><span class="sr-stat-label">${this.tr('状态')}</span><span class="sr-stat-value">${isMastered ? this.tr('⭐ 已掌握') : isCompleted ? this.tr('✅ 全部完成') : this.tr('📖 复习中')}</span></div>
        </div>
        ${customSectionsHtml}
        <div class="sr-section-title">${this.tr('历史记录')}</div>
        <div class="sr-history-list">${historyHtml}</div>
        <div class="sr-section-title" style="margin-top:12px">${this.tr('复习计划')}</div>
        <div class="sr-future-list">${futurePlanHtml}</div>
        <div class="sr-plan-actions-inline">
          <button class="sr-btn-add-review" id="sr-add-extra">${this.tr('+ 添加复习')}</button>
          <button class="sr-btn-readd" id="sr-readd">${this.tr('重新加入')}</button>
        </div>
      </div>
      <div class="leetcode-sr-modal-footer sr-footer-multi">
        <button class="sr-btn-home" id="sr-modal-home" title="主页" aria-label="主页"><span class="sr-btn-home-icon">🏠</span></button>
        <button class="sr-btn-submit-review" id="sr-submit-review">${this.tr('✅ 提交复习')}</button>
        <button class="sr-btn-master ${isMastered ? 'sr-unmaster' : ''}" id="sr-master">${isMastered ? '取消掌握' : '⭐ 标记掌握'}</button>
        <button class="sr-btn-delete" id="sr-delete">删除题目</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;
    this.localize(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.removeModal(); });
    modal.querySelector('#sr-modal-home').addEventListener('click', () => {
      this.removeModal();
      this.showHomeModal();
    });
    modal.querySelector('#sr-modal-close').addEventListener('click', () => this.removeModal());

    modal.querySelectorAll('.sr-future-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const index = parseInt(btn.dataset.removeIndex);
        await this.safeSendMessage({ action: 'removeReviewDate', slug: problem.slug, index });
        this.showNotification('已移除', 'info');
        this.showProblemDetailModal(slug);
      });
    });

    modal.querySelector('#sr-add-extra').addEventListener('click', () => {
      this.showAddExtraReviewDialog(problem.slug, true);
    });

    modal.querySelector('#sr-readd').addEventListener('click', () => {
      this.removeModal();
      this.showReaddModal(problem.slug, true);
    });

    modal.querySelector('#sr-submit-review').addEventListener('click', () => {
      this.removeModal();
      this.showDetailSubmitReviewModal(problem);
    });

    modal.querySelector('#sr-master').addEventListener('click', async () => {
      if (isMastered) {
        await this.safeSendMessage({ action: 'unmarkMastered', slug: problem.slug });
        this.showNotification('已取消掌握标记', 'info');
      } else {
        await this.safeSendMessage({ action: 'markMastered', slug: problem.slug });
        this.showNotification('⭐ 已标记为掌握', 'success');
      }
      this.removeModal();
      this.checkProblemStatus();
      this.refreshHomeIfOpen();
    });

    modal.querySelector('#sr-delete').addEventListener('click', async () => {
      if (confirm(this.tr('确定要删除这道题的所有记录吗？'))) {
        await this.safeSendMessage({ action: 'deleteProblem', slug: problem.slug });
        this.showNotification('已删除', 'info');
        this.removeModal();
        this.checkProblemStatus();
        this.refreshHomeIfOpen();
      }
    });

    if (isCustom) {
      modal.querySelectorAll('.sr-custom-section-header').forEach(header => {
        header.addEventListener('click', () => {
          const targetId = header.dataset.toggle;
          const content = document.getElementById(targetId);
          const icon = header.querySelector('.sr-custom-toggle-icon');
          if (content) {
            const open = content.style.display !== 'none';
            content.style.display = open ? 'none' : '';
            if (icon) icon.textContent = open ? '▶' : '▼';
          }
        });
      });

      const saveBodyBtn = modal.querySelector('#sr-save-body');
      if (saveBodyBtn) {
        saveBodyBtn.addEventListener('click', async () => {
          const val = document.getElementById('sr-custom-body-edit')?.value || '';
          const r = await this.safeSendMessage({ action: 'updateCustomFields', slug: problem.slug, fields: { customBody: val } });
          if (r?.success) this.showNotification('✅ 题干已保存', 'success');
          else this.showNotification('保存失败', 'error');
        });
      }

      const saveAnswerBtn = modal.querySelector('#sr-save-answer');
      if (saveAnswerBtn) {
        saveAnswerBtn.addEventListener('click', async () => {
          const val = document.getElementById('sr-custom-answer-edit')?.value || '';
          const r = await this.safeSendMessage({ action: 'updateCustomFields', slug: problem.slug, fields: { customAnswer: val } });
          if (r?.success) this.showNotification('✅ 答案已保存', 'success');
          else this.showNotification('保存失败', 'error');
        });
      }
    }
  }

  // ============ 添加复习天数弹窗 ============
  showAddExtraReviewDialog(slug, returnToDetail = false) {
    this.removeModal();

    const overlay = document.createElement('div');
    overlay.id = 'leetcode-sr-modal-overlay';
    overlay.className = 'leetcode-sr-overlay';

    const modal = document.createElement('div');
    modal.className = 'leetcode-sr-modal';
    modal.style.zoom = this.scale;
    modal.innerHTML = `
      <div class="leetcode-sr-modal-header">
        <h3>📅 添加复习</h3>
        <button class="leetcode-sr-modal-close" id="sr-modal-close">&times;</button>
      </div>
      <div class="leetcode-sr-modal-body">
        <p style="color:#6b7280;font-size:14px;margin-bottom:14px;">输入天数，将在对应天后安排一次复习。</p>
        <input type="number" id="sr-extra-days" placeholder="天数（如: 0）" class="sr-text-input" min="0" style="font-size:15px;padding:11px 14px;">
      </div>
      <div class="leetcode-sr-modal-footer">
        <button class="sr-btn-cancel" id="sr-modal-cancel">取消</button>
        <button class="sr-btn-confirm" id="sr-extra-confirm">确认添加</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;
    this.localize(overlay);

    const closeDialog = () => {
      this.removeModal();
      if (returnToDetail) this.showProblemDetailModal(slug);
    };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });
    modal.querySelector('#sr-modal-close').addEventListener('click', closeDialog);
    modal.querySelector('#sr-modal-cancel').addEventListener('click', closeDialog);

    modal.querySelector('#sr-extra-confirm').addEventListener('click', async () => {
      const days = parseInt(document.getElementById('sr-extra-days').value);
      if (!Number.isInteger(days) || days < 0) {
        this.showNotification('请输入有效天数', 'info');
        return;
      }
      await this.safeSendMessage({ action: 'addExtraReview', slug, days });
      this.showNotification('✅ 已添加复习计划', 'success');
      this.removeModal();
      this.showProblemDetailModal(slug);
    });

    setTimeout(() => {
      const input = document.getElementById('sr-extra-days');
      if (input) input.focus();
    }, 100);
  }

  // ============ 重新加入弹窗 ============
  showReaddModal(slug, returnToDetail = false) {
    this.removeModal();
    const defaultIsHalf = this.defaultPlan === 'half';

    const overlay = document.createElement('div');
    overlay.id = 'leetcode-sr-modal-overlay';
    overlay.className = 'leetcode-sr-overlay';

    const modal = document.createElement('div');
    modal.className = 'leetcode-sr-modal';
    modal.style.zoom = this.scale;
    modal.innerHTML = `
      <div class="leetcode-sr-modal-header">
        <h3>🔄 重新加入复习</h3>
        <button class="leetcode-sr-modal-close" id="sr-modal-close">&times;</button>
      </div>
      <div class="leetcode-sr-modal-body">
        <p style="color:#6b7280;font-size:14px;margin-bottom:14px;">将重置复习进度，历史记录会保留。</p>
        <div class="leetcode-sr-plan-options">
          <label class="leetcode-sr-plan-option ${defaultIsHalf ? '' : 'selected'}" data-plan="full">
            <input type="radio" name="sr-readd-plan" value="full" ${defaultIsHalf ? '' : 'checked'}>
            <div class="sr-plan-content"><div class="sr-plan-title">🔥 完整复习 (6次)</div></div>
          </label>
          <label class="leetcode-sr-plan-option ${defaultIsHalf ? 'selected' : ''}" data-plan="half">
            <input type="radio" name="sr-readd-plan" value="half" ${defaultIsHalf ? 'checked' : ''}>
            <div class="sr-plan-content"><div class="sr-plan-title">⚡ 精简复习 (3次)</div></div>
          </label>
          <label class="leetcode-sr-plan-option" data-plan="custom">
            <input type="radio" name="sr-readd-plan" value="custom">
            <div class="sr-plan-content"><div class="sr-plan-title">🧪 自定义间隔</div></div>
          </label>
        </div>
        <div class="sr-plan-custom-wrap hidden" id="sr-readd-custom-wrap">
          <input type="text" id="sr-readd-custom-intervals" placeholder="自定义间隔（如: 0,3,10,30 或 0 3 10 30）" class="sr-text-input">
          <div class="sr-plan-custom-hint">支持空格、逗号、分号</div>
        </div>
      </div>
      <div class="leetcode-sr-modal-footer">
        <button class="sr-btn-cancel" id="sr-modal-cancel">取消</button>
        <button class="sr-btn-confirm" id="sr-readd-confirm">确认</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;
    this.localize(overlay);

    const closeDialog = () => {
      this.removeModal();
      if (returnToDetail) this.showProblemDetailModal(slug);
    };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });
    modal.querySelector('#sr-modal-close').addEventListener('click', closeDialog);
    modal.querySelector('#sr-modal-cancel').addEventListener('click', closeDialog);

    modal.querySelectorAll('.leetcode-sr-plan-option').forEach(option => {
      option.addEventListener('click', () => {
        modal.querySelectorAll('.leetcode-sr-plan-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        const input = option.querySelector('input');
        input.checked = true;
        const customWrap = modal.querySelector('#sr-readd-custom-wrap');
        if (customWrap) customWrap.classList.toggle('hidden', input.value !== 'custom');
      });
    });

    modal.querySelector('#sr-readd-confirm').addEventListener('click', async () => {
      const selectedPlanInput = document.querySelector('input[name="sr-readd-plan"]:checked');
      if (!selectedPlanInput) return;
      const selectedPlan = selectedPlanInput.value;
      let customIntervals = null;
      if (selectedPlan === 'custom') {
        const raw = document.getElementById('sr-readd-custom-intervals')?.value || '';
        customIntervals = this.parseCustomIntervals(raw);
        if (customIntervals.length === 0) {
          this.showNotification('请输入有效天数', 'info');
          return;
        }
      }
      await this.safeSendMessage({ action: 'readdProblem', slug, planType: selectedPlan, customIntervals });
      this.showNotification('✅ 已重新加入复习计划', 'success');
      this.removeModal();
      this.checkProblemStatus();
      this.refreshHomeIfOpen();
      if (returnToDetail) this.showProblemDetailModal(slug);
    });
  }

  removeModal() {
    const existing = document.getElementById('leetcode-sr-modal-overlay');
    if (existing) existing.remove();
    this.modalOverlay = null;
  }

  // ============ 通用工具 ============
  async safeSendMessage(message) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) { this.showReloadPrompt(); return null; }
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.warn('Message failed:', error);
      this.showReloadPrompt();
      return null;
    }
  }

  showReloadPrompt() {
    if (document.getElementById('leetcode-sr-reload-prompt')) return;
    const prompt = document.createElement('div');
    prompt.id = 'leetcode-sr-reload-prompt';
    prompt.className = 'leetcode-sr-reload-prompt';
    prompt.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px;">⚠️ 扩展已更新</div>
      <div style="font-size:13px;color:#78716c;">点击此处刷新页面以重新连接</div>
    `;
    prompt.addEventListener('click', () => window.location.reload());
    document.body.appendChild(prompt);
    this.localize(prompt);
  }

  showNotification(message, type = 'info') {
    document.querySelectorAll('.leetcode-sr-notification').forEach(n => n.remove());
    const notification = document.createElement('div');
    notification.className = `leetcode-sr-notification ${type}`;
    notification.textContent = this.trText(message);
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'refreshStatus') {
        this.checkProblemStatus();
        this.checkTodayStatus();
        if (this.todayPanelOpen) this.refreshTodayPanel();
        this.refreshHomeIfOpen();
      }
    });
  }
}

new LeetCodeHelper();
