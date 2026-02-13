# LeetCode Review Plan - 基于遗忘曲线的 LeetCode 复习插件

[English](README.md) | [简体中文](README.zh-CN.md)

![Version](https://img.shields.io/badge/version-v2.0-7c5cff)
![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-4285F4)
![Manifest](https://img.shields.io/badge/Manifest-V3-34A853)
![Language](https://img.shields.io/badge/UI-English%20%7C%20Chinese-0ea5e9)

> 做过的题，不再反复“重新学”。  
> 用间隔复习把解题能力沉淀成长期记忆。

这是一个支持 `leetcode.com` 与 `leetcode.cn` 的 Chrome 插件。  
它通过遗忘曲线安排复习节奏，帮助你管理题目记录、复习历史、标签筛选和统计数据。

## ✨ 功能亮点

- 题目页右侧浮窗，**一键加入复习** / **提交复习** / **查看记录**
- 内置 `完整` / `精简` 两种复习方案，支持自定义间隔编辑
- 题目记录页可查看：加入时间、复习进度、历史笔记、后续计划
- 主页包含：今日题目、全部题目、数据统计、设置
- 支持标签搜索与筛选
- 默认英文，可切换中文
- 支持完整 JSON 导出/导入，便于备份与迁移

## 搜索关键词（便于发现）

LeetCode 复习插件，遗忘曲线，间隔复习，刷题复盘，面试准备，LeetCode Chrome 插件，spaced repetition LeetCode

## 快速开始

1. 打开 `chrome://extensions/`
2. 开启右上角 **Developer mode**
3. 点击 **Load unpacked**
4. 选择目录：`leetcode-review-helper/`

可选：
- Google Calendar 同步配置：`SETUP_GUIDE.md`
- 快速配置说明：`QUICK_START.md`

## 使用说明

### 1）进入 LeetCode 题目页
右侧会出现插件入口按钮。

![Problem page - widget collapsed](images/01-problem-page-widget-collapsed.png)

### 2）展开浮窗并选择操作
可选 `Add Review`、`Submit Review`、`Record`。

![Problem page - widget expanded](images/02-problem-page-widget-expanded.png)

### 3）加入复习计划
选择 `Full` 或 `Light`，并可填写用时和笔记。

![Add to review modal](images/03-add-to-review-modal.png)

### 4）查看题目记录与后续计划
可查看进度、历史记录与未来复习日期。

![Problem record modal](images/04-problem-record-modal.png)

### 5）在主页管理全部题目
支持搜索、标签筛选、快速打开/提交/删除。

![Home - all problems](images/05-home-all-problems.png)

### 6）在设置中个性化配置
可调整语言、界面比例、复习间隔方案、数据导入导出。

![Settings panel](images/06-settings-panel.png)

## 常见问题

### 支持 leetcode.com 和 leetcode.cn 吗？
支持，两者都可用。

### 数据安全吗？
数据保存在 Chrome 本地存储，不依赖外部用户数据服务器。

### 版本更新会丢数据吗？
建议定期使用 JSON 导出；插件支持导入恢复与迁移。

## 社区与反馈

- 如果这个项目对你有帮助，欢迎点个 Star
- 遇到问题或有建议，欢迎提 Issue
- 欢迎分享你的使用截图与学习流程

## 版本

`v2.0` · Made by Kenzie & Ethan
