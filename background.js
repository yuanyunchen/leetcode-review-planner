// 后台服务脚本 - 遗忘曲线调度和Google Calendar集成

class SpacedRepetitionManager {
  constructor() {
    this.planTemplates = {
      full: { name: '完整复习 (6次)', intervals: [1, 3, 7, 14, 30, 60] },
      half: { name: '精简复习 (3次)', intervals: [3, 10, 30] },
    };
    this.init();
  }

  init() {
    this._planTemplatesReady = this.loadPlanTemplates();

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    chrome.alarms.create('dailyReviewCheck', { periodInMinutes: 60 });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'dailyReviewCheck') {
        this.checkDailyReviews();
      }
    });

    chrome.runtime.onInstalled.addListener(() => {
      this.onInstalled();
    });
  }

  async getUiLanguage() {
    try {
      const r = await chrome.storage.local.get('uiLanguage');
      return r.uiLanguage === 'zh' ? 'zh' : 'en';
    } catch (e) {
      return 'en';
    }
  }

  tr(lang, zhText, enText) {
    return lang === 'zh' ? zhText : enText;
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'addProblem': {
          const r = await this.addProblem(request.problem, request.planType, request.customIntervals, request.time, request.comment);
          sendResponse(r);
          break;
        }
        case 'checkProblem': {
          const s = await this.checkProblemStatus(request.slug);
          sendResponse(s);
          break;
        }
        case 'getProblems': {
          const p = await this.getAllProblems();
          sendResponse({ problems: p });
          break;
        }
        case 'getProblem': {
          const p = await this.getProblem(request.slug);
          sendResponse({ problem: p });
          break;
        }
        case 'getTodayReviews': {
          const r = await this.getTodayReviews();
          sendResponse({ reviews: r });
          break;
        }
        case 'getTodayCompleted': {
          const c = await this.getTodayCompleted();
          sendResponse({ completed: c });
          break;
        }
        case 'markReviewed': {
          const r = await this.markProblemReviewed(request.slug, request.time, request.comment);
          sendResponse(r);
          break;
        }
        case 'markMastered': {
          await this.markProblemMastered(request.slug);
          sendResponse({ success: true });
          break;
        }
        case 'unmarkMastered': {
          await this.unmarkProblemMastered(request.slug);
          sendResponse({ success: true });
          break;
        }
        case 'readdProblem': {
          const r = await this.readdProblem(request.slug, request.planType, request.customIntervals);
          sendResponse(r);
          break;
        }
        case 'addExtraReview': {
          const r = await this.addExtraReview(request.slug, request.days);
          sendResponse(r);
          break;
        }
        case 'removeReviewDate': {
          const r = await this.removeReviewDate(request.slug, request.index);
          sendResponse(r);
          break;
        }
        case 'deleteProblem': {
          await this.deleteProblem(request.slug);
          sendResponse({ success: true });
          break;
        }
        case 'syncToCalendar': {
          const r = await this.syncProblemToCalendar(request.slug);
          sendResponse(r);
          break;
        }
        case 'connectCalendar': {
          const r = await this.authenticateGoogle();
          sendResponse(r);
          break;
        }
        case 'getPlanTemplates': {
          await this._planTemplatesReady;
          sendResponse({ templates: this.planTemplates });
          break;
        }
        case 'openPopup': {
          chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
          sendResponse({ success: true });
          break;
        }
        case 'removeIntervalFromPlan': {
          const r = await this.removeIntervalFromPlan(request.plan, request.index);
          sendResponse(r);
          break;
        }
        case 'addIntervalToPlan': {
          const r = await this.addIntervalToPlan(request.plan, request.days);
          sendResponse(r);
          break;
        }
        case 'updatePlanIntervals': {
          const r = await this.updatePlanIntervals(request.plan, request.intervals);
          sendResponse(r);
          break;
        }
        case 'getFullExportData': {
          const data = await this.getFullExportData();
          sendResponse(data);
          break;
        }
        case 'importFullData': {
          const result = await this.importFullData(request.data);
          sendResponse(result);
          break;
        }
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // ============ 核心功能 ============

  getStartOfDayTs(ts = Date.now()) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  getCalendarDayDiff(fromTs, toTs = Date.now()) {
    const dayMs = 24 * 60 * 60 * 1000;
    const fromDay = this.getStartOfDayTs(fromTs);
    const toDay = this.getStartOfDayTs(toTs);
    return Math.max(0, Math.floor((toDay - fromDay) / dayMs));
  }

  async addProblem(problemInfo, planType = 'full', customIntervals = null, time = null, comment = null) {
    try {
      const storageResult = await chrome.storage.local.get('problems');
      const problemsMap = storageResult.problems || {};

      if (problemsMap[problemInfo.slug]) {
        return { success: false, error: '这道题已经在复习计划中了' };
      }

      const intervals = this.getIntervals(planType, customIntervals);
      if (!intervals || intervals.length === 0) {
        return { success: false, error: '请输入有效天数' };
      }
      const now = Date.now();
      const planBaseAt = this.getStartOfDayTs(now);
      const reviewDates = this.generateReviewDates(intervals, planBaseAt);

      const reviewHistory = [];
      // 添加第0天的提交记录（加入时的笔记）
      if (time || comment) {
        reviewHistory.push({
          timestamp: now,
          dayLabel: 0,
          reviewNumber: 0,
          time: time || null,
          comment: comment || null
        });
      }

      problemsMap[problemInfo.slug] = {
        ...problemInfo,
        addedAt: now,
        planBaseAt: planBaseAt,
        planType: planType,
        intervals: intervals,
        reviewDates: reviewDates,
        completedReviews: [],
        reviewHistory: reviewHistory,
        currentInterval: 0,
        mastered: false,
        addHistory: [{
          timestamp: now,
          type: 'add',
          planType: planType,
          intervals: [...intervals],
          planBaseAt: planBaseAt
        }],
        calendarEventIds: []
      };

      await chrome.storage.local.set({ problems: problemsMap });
      return { success: true, reviewDates, message: '成功添加到复习计划' };
    } catch (error) {
      console.error('Error adding problem:', error);
      return { success: false, error: error.message };
    }
  }

  getIntervals(planType, customIntervals) {
    if (planType === 'custom' && customIntervals && customIntervals.length > 0) {
      return [...new Set(customIntervals
        .map(v => parseInt(v, 10))
        .filter(v => Number.isInteger(v) && v >= 0)
      )].sort((a, b) => a - b);
    }
    const template = this.planTemplates[planType];
    return template ? [...template.intervals] : [...this.planTemplates.full.intervals];
  }

  generateReviewDates(intervals, baseTs = Date.now()) {
    const base = new Date(baseTs);
    base.setHours(0, 0, 0, 0);
    const dates = [];
    for (const interval of intervals) {
      const d = new Date(base);
      d.setDate(d.getDate() + interval);
      d.setHours(20, 0, 0, 0);
      dates.push(d.getTime());
    }
    return dates;
  }

  async checkProblemStatus(slug) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    if (problemsMap[slug]) {
      const problem = problemsMap[slug];
      const nextReview = problem.reviewDates[problem.currentInterval];
      return {
        exists: true,
        mastered: problem.mastered || false,
        nextReview: nextReview,
        completedReviews: problem.completedReviews.length,
        totalReviews: problem.reviewDates.length,
        problem: problem
      };
    }
    return { exists: false };
  }

  async getProblem(slug) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};
    return problemsMap[slug] || null;
  }

  async getAllProblems() {
    const storageResult = await chrome.storage.local.get('problems');
    return Object.values(storageResult.problems || {});
  }

  async getTodayReviews() {
    const problems = await this.getAllProblems();
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTs = tomorrow.getTime();

    return problems.filter(p => {
      if (p.mastered) return false;
      if (p.currentInterval >= p.reviewDates.length) return false;
      return p.reviewDates[p.currentInterval] < tomorrowTs;
    });
  }

  async getTodayCompleted() {
    const problems = await this.getAllProblems();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    return problems.filter(p => p.completedReviews.some(ts => ts >= todayTs));
  }

  async markProblemReviewed(slug, time = null, comment = null) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    if (problemsMap[slug]) {
      const problem = problemsMap[slug];
      const now = Date.now();

      if (!problem.reviewHistory) problem.reviewHistory = [];

      // 仅在“到计划日期或逾期”时推进计划；提前提交只记录历史不抵消计划
      const currentReviewDate = problem.reviewDates[problem.currentInterval];
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const dueDay = currentReviewDate ? new Date(currentReviewDate) : null;
      if (dueDay) dueDay.setHours(0, 0, 0, 0);
      const canConsumePlannedReview = !!dueDay && today.getTime() >= dueDay.getTime();

      // 计算天数标签（提前提交按实际天数）
      const planBaseAt = problem.planBaseAt || problem.addedAt || now;
      const daysSinceAdd = this.getCalendarDayDiff(planBaseAt, now);
      const intervalDay = (problem.intervals || [])[problem.currentInterval] || daysSinceAdd;

      const entry = {
        timestamp: now,
        dayLabel: canConsumePlannedReview ? intervalDay : daysSinceAdd,
        reviewNumber: canConsumePlannedReview ? (problem.currentInterval + 1) : 0,
        early: !canConsumePlannedReview,
        time: time || null,
        comment: comment || null
      };
      problem.reviewHistory.push(entry);

      if (canConsumePlannedReview) {
        problem.completedReviews.push(now);
        problem.currentInterval++;
        if (problem.currentInterval >= problem.reviewDates.length) {
          problem.mastered = true;
          problem.masteredAt = now;
        }
      }

      await chrome.storage.local.set({ problems: problemsMap });

      if (canConsumePlannedReview) {
        // 通知（仅计划复习被消费时）
      try {
          const lang = await this.getUiLanguage();
        const remaining = problem.reviewDates.length - problem.currentInterval;
          const msg = remaining > 0
            ? this.tr(
                lang,
                `${problem.number}. ${problem.title} - 下次复习: ${new Date(problem.reviewDates[problem.currentInterval]).toLocaleDateString()}`,
                `${problem.number}. ${problem.title} - Next review: ${new Date(problem.reviewDates[problem.currentInterval]).toLocaleDateString()}`
              )
            : this.tr(
                lang,
                `${problem.number}. ${problem.title} - 已完成所有复习计划`,
                `${problem.number}. ${problem.title} - All planned reviews completed`
              );
          chrome.notifications.create(`review-${slug}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: remaining > 0
              ? this.tr(lang, '复习完成！', 'Review done!')
              : this.tr(lang, '完成全部复习！', 'All reviews completed!'),
            message: msg
          }, () => { if (chrome.runtime.lastError) { /* ignore */ } });
        } catch (e) {
          console.warn('Notification failed:', e);
        }
      }

      return {
        success: true,
        counted: canConsumePlannedReview,
        message: canConsumePlannedReview ? '计划复习已完成' : '未到计划日期，仅记录笔记'
      };
    }

    return { success: false, error: '题目不存在' };
  }

  async markProblemMastered(slug) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};
    if (problemsMap[slug]) {
      const problem = problemsMap[slug];
      problem.mastered = true;
      problem.masteredAt = Date.now();
      // 手动标记掌握时清空后续复习计划（保留已完成历史与笔记历史）
      const completedCount = Math.max(0, Math.min(problem.currentInterval || 0, (problem.reviewDates || []).length));
      problem.reviewDates = (problem.reviewDates || []).slice(0, completedCount);
      problem.intervals = (problem.intervals || []).slice(0, completedCount);
      problem.currentInterval = completedCount;
      await chrome.storage.local.set({ problems: problemsMap });
    }
  }

  async unmarkProblemMastered(slug) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};
    if (problemsMap[slug]) {
      problemsMap[slug].mastered = false;
      delete problemsMap[slug].masteredAt;
      await chrome.storage.local.set({ problems: problemsMap });
    }
  }

  async readdProblem(slug, planType = 'full', customIntervals = null) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    if (problemsMap[slug]) {
      const problem = problemsMap[slug];
      const intervals = this.getIntervals(planType, customIntervals);
      if (!intervals || intervals.length === 0) {
        return { success: false, error: '请输入有效天数' };
      }
      const now = Date.now();
      const planBaseAt = this.getStartOfDayTs(now);
      const reviewDates = this.generateReviewDates(intervals, planBaseAt);

      if (!Array.isArray(problem.addHistory)) {
        problem.addHistory = [];
      }
      if (problem.addHistory.length === 0 && problem.addedAt) {
        problem.addHistory.push({
          timestamp: problem.addedAt,
          type: 'add',
          planType: problem.planType || 'full',
          intervals: Array.isArray(problem.intervals) ? [...problem.intervals] : [],
          planBaseAt: problem.planBaseAt || this.getStartOfDayTs(problem.addedAt)
        });
      }
      problem.addHistory.push({
        timestamp: now,
        type: 'readd',
        planType: planType,
        intervals: [...intervals],
        planBaseAt: planBaseAt
      });

      problem.planType = planType;
      problem.intervals = intervals;
      problem.reviewDates = reviewDates;
      problem.currentInterval = 0;
      problem.mastered = false;
      problem.addedAt = now;
      problem.planBaseAt = planBaseAt;
      delete problem.masteredAt;
      // reviewHistory is preserved

      await chrome.storage.local.set({ problems: problemsMap });
      return { success: true, reviewDates, message: '已重新加入复习计划' };
    }
    return { success: false, error: '题目不存在' };
  }

  async addExtraReview(slug, days) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    if (problemsMap[slug]) {
      const problem = problemsMap[slug];
      if (!Number.isInteger(days) || days < 0) {
        return { success: false, error: '请输入有效天数' };
      }
      const now = Date.now();
      const d = new Date();
      d.setDate(d.getDate() + days);
      d.setHours(20, 0, 0, 0);

      // 插入到正确位置（按时间排序）
      problem.reviewDates.push(d.getTime());
      problem.reviewDates.sort((a, b) => a - b);

      if (!problem.intervals) problem.intervals = [];
      problem.intervals.push(days);
      problem.intervals.sort((a, b) => a - b);

      // 记录 Add Review 历史（快照写入后不再变化）
      if (!Array.isArray(problem.addHistory)) {
        problem.addHistory = [];
      }
      problem.addHistory.push({
        timestamp: now,
        type: 'addExtra',
        planType: problem.planType || 'custom',
        intervals: [...problem.intervals],
        extraDays: days,
        planBaseAt: problem.planBaseAt || this.getStartOfDayTs(problem.addedAt || now)
      });

      await chrome.storage.local.set({ problems: problemsMap });
      return { success: true };
    }
    return { success: false, error: '题目不存在' };
  }

  async removeReviewDate(slug, index) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    if (problemsMap[slug]) {
      const problem = problemsMap[slug];
      if (index >= problem.currentInterval && index < problem.reviewDates.length) {
        problem.reviewDates.splice(index, 1);
        if (problem.intervals && problem.intervals.length > index) {
          problem.intervals.splice(index, 1);
        }
        await chrome.storage.local.set({ problems: problemsMap });
        return { success: true };
      }
      return { success: false, error: '无法删除已完成的复习' };
    }
    return { success: false, error: '题目不存在' };
  }

  async deleteProblem(slug) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};
    delete problemsMap[slug];
    await chrome.storage.local.set({ problems: problemsMap });
  }

  // ============ 每日提醒 ============

  async checkDailyReviews() {
    try {
      const reviews = await this.getTodayReviews();
      if (reviews.length > 0) {
        try {
          const lang = await this.getUiLanguage();
          chrome.notifications.create('daily-review', {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: this.tr(lang, '今日复习提醒', 'Today review reminder'),
            message: this.tr(lang, `你有 ${reviews.length} 道题需要复习！`, `You have ${reviews.length} problems to review today!`)
          }, () => { if (chrome.runtime.lastError) { /* ignore */ } });
        } catch (e) { console.warn('Notification failed:', e); }
        chrome.action.setBadgeText({ text: reviews.length.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#1d4ed8' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    } catch (error) {
      console.error('checkDailyReviews error:', error);
    }
  }

  // ============ Google Calendar ============

  isCalendarConfigured() {
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2 && manifest.oauth2.client_id;
    return clientId && !clientId.includes('YOUR_GOOGLE_CLIENT_ID');
  }

  async authenticateGoogle() {
    if (!this.isCalendarConfigured()) {
      return { success: false, error: '请先在manifest.json中配置Google OAuth client_id' };
    }
    try {
      const token = await chrome.identity.getAuthToken({ interactive: true });
      await chrome.storage.local.set({ googleToken: token.token || token });
      return { success: true, token: token.token || token };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getGoogleToken() {
    if (!this.isCalendarConfigured()) return null;
    try {
      const r = await chrome.storage.local.get('googleToken');
      if (r.googleToken) return r.googleToken;
      try {
        const t = await chrome.identity.getAuthToken({ interactive: false });
        const token = t.token || t;
        if (token) { await chrome.storage.local.set({ googleToken: token }); return token; }
      } catch (e) { /* silent */ }
      return null;
    } catch (error) { return null; }
  }

  async syncProblemToCalendar(slug) {
    if (!this.isCalendarConfigured()) return { success: false, error: '请先配置Google Calendar API' };
    const token = await this.getGoogleToken();
    if (!token) return { success: false, error: '请先在设置中连接Google Calendar' };

    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};
    const problem = problemsMap[slug];
    if (!problem) return { success: false, error: '题目不存在' };

    const eventIds = [];
    for (let i = problem.currentInterval; i < problem.reviewDates.length; i++) {
      const reviewDate = new Date(problem.reviewDates[i]);
      const endDate = new Date(reviewDate.getTime() + 3600000);
      const event = {
        summary: `复习: ${problem.number}. ${problem.title}`,
        description: `LeetCode题目复习\n难度: ${problem.difficulty}\n链接: ${problem.url}\n第 ${i + 1}/${problem.reviewDates.length} 次复习`,
        start: { dateTime: reviewDate.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: endDate.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
        colorId: '9'
      };
      try {
        const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        });
        if (resp.ok) { const d = await resp.json(); eventIds.push(d.id); }
      } catch (e) { console.error('Calendar event failed:', e); }
    }
    problem.calendarEventIds = eventIds;
    await chrome.storage.local.set({ problems: problemsMap });
    return { success: true, eventIds };
  }

  // ============ 复习间隔方案编辑 ============

  async removeIntervalFromPlan(planName, index) {
    if (!this.planTemplates[planName]) return { success: false, error: '方案不存在' };
    const intervals = this.planTemplates[planName].intervals;
    if (index < 0 || index >= intervals.length) return { success: false, error: '索引无效' };
    if (intervals.length <= 1) return { success: false, error: '至少保留一个间隔' };
    intervals.splice(index, 1);
    // Persist to storage
    await this.savePlanTemplates();
    return { success: true, templates: this.planTemplates };
  }

  async addIntervalToPlan(planName, days) {
    if (!this.planTemplates[planName]) return { success: false, error: '方案不存在' };
    const intervals = this.planTemplates[planName].intervals;
    if (intervals.includes(days)) return { success: false, error: '该天数已存在' };
    intervals.push(days);
    intervals.sort((a, b) => a - b);
    // Update plan name
    this.planTemplates[planName].name = this.planTemplates[planName].name.replace(/\(\d+次\)/, `(${intervals.length}次)`);
    await this.savePlanTemplates();
    return { success: true, templates: this.planTemplates };
  }

  async updatePlanIntervals(planName, newIntervals) {
    if (!this.planTemplates[planName]) return { success: false, error: '方案不存在' };
    this.planTemplates[planName].intervals = newIntervals.sort((a, b) => a - b);
    this.planTemplates[planName].name = this.planTemplates[planName].name.replace(/\(\d+次\)/, `(${newIntervals.length}次)`);
    await this.savePlanTemplates();
    return { success: true, templates: this.planTemplates };
  }

  async savePlanTemplates() {
    await chrome.storage.local.set({ planTemplates: this.planTemplates });
  }

  async loadPlanTemplates() {
    try {
      const result = await chrome.storage.local.get(['planTemplates', 'planMigrationV1Done']);
      if (result.planTemplates) {
        for (const key of Object.keys(result.planTemplates)) {
          if (this.planTemplates[key]) {
            this.planTemplates[key] = result.planTemplates[key];
          }
        }
      }
      if (!result.planMigrationV1Done && !result.planTemplates) {
        const half = this.planTemplates.half;
        if (half && Array.isArray(half.intervals)) {
          half.intervals = half.intervals.map(v => (v === 7 ? 10 : v));
          half.intervals = [...new Set(half.intervals)].sort((a, b) => a - b);
          this.planTemplates.half.name = this.planTemplates.half.name.replace(/\(\d+次\)/, `(${half.intervals.length}次)`);
          await this.savePlanTemplates();
        }
        await chrome.storage.local.set({ planMigrationV1Done: true });
      } else if (!result.planMigrationV1Done) {
        await chrome.storage.local.set({ planMigrationV1Done: true });
      }
    } catch (e) { /* ignore */ }
  }

  // ============ 数据导出导入 ============

  async getFullExportData() {
    const storageResult = await chrome.storage.local.get(null); // get ALL keys
    const problems = storageResult.problems || {};
    return {
      success: true,
      data: {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        problems: problems,
        settings: {
          reviewTime: storageResult.reviewTime || '20:00',
          googleToken: storageResult.googleToken || null
        },
        planTemplates: this.planTemplates
      }
    };
  }

  async importFullData(data) {
    try {
      if (!data) return { success: false, error: '无效数据' };

      // Support both old format (array) and new format (object with version)
      let problemsMap = {};
      let settings = {};

      if (data.version && data.problems) {
        // New format: { version, problems: { slug: problem }, settings }
        if (typeof data.problems === 'object' && !Array.isArray(data.problems)) {
          problemsMap = data.problems;
        } else if (Array.isArray(data.problems)) {
          data.problems.forEach(p => { if (p.slug) problemsMap[p.slug] = p; });
        }
        settings = data.settings || {};
      } else if (Array.isArray(data)) {
        // Old format: array of problems
        data.forEach(p => { if (p.slug) problemsMap[p.slug] = p; });
      } else if (typeof data === 'object') {
        // Maybe it's already a problems map
        Object.values(data).forEach(p => {
          if (p && p.slug) problemsMap[p.slug] = p;
        });
      }

      // Merge with existing data (don't overwrite, merge)
      const existing = await chrome.storage.local.get('problems');
      const existingMap = existing.problems || {};

      // Imported data takes priority, but preserve existing if not in import
      const mergedMap = { ...existingMap, ...problemsMap };

      const toSet = { problems: mergedMap };
      if (settings.reviewTime) toSet.reviewTime = settings.reviewTime;
      if (data.planTemplates) {
        toSet.planTemplates = data.planTemplates;
        // Also update in-memory templates
        for (const key of Object.keys(data.planTemplates)) {
          if (this.planTemplates[key]) {
            this.planTemplates[key] = data.planTemplates[key];
          }
        }
      }

      await chrome.storage.local.set(toSet);
      return { success: true, count: Object.keys(problemsMap).length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============ 初始化 ============

  async onInstalled() {
    console.log('LeetCode Spaced Repetition installed!');
    const r = await chrome.storage.local.get('problems');
    if (!r.problems) await chrome.storage.local.set({ problems: {} });
    this.checkDailyReviews();
  }
}

new SpacedRepetitionManager();
