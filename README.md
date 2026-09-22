# STP 学期工作台

根据每门课的 STP（Semester Teaching Plan）汇总学期信息，导出个性化 Excel，并和 Obsidian Day Planner 双向同步的学期日历。

内置 2026/27 Semester I 校历（含 9/20、10/10 补课日与国庆跨周）以及我的 6 门课：
FM（FIN3073）、BRM（BUS3023）、DA- NM（BA3033）、BF- ML（EBIS3113）、MIS（BUS4093）、Service L（GCAP3213）。

## 运行

```bash
npm install
npm run dev
```

然后用 **Chrome 或 Edge** 打开 http://localhost:5173 。连接 Obsidian 用的 File System Access API，Safari 不支持。

## 功能

| 页面 | 作用 |
| --- | --- |
| 仪表盘 | 今天的课 + Obsidian 待办 + 建议；接下来的截止（倒计时、状态）；每周负荷热力图；需要注意的问题 |
| 日历 | 日 / 3 天 / 周 / 月视图。上课、截止、Obsidian 待办、建议学习块四层可开关。拖动移动、拖底边改时长、点空白新建，全部直接写回 Daily Matter |
| 课程 | 核对与编辑所有抽取结果（中英分别编辑）；上课时间；评分构成（支持嵌套）；周计划；原始文件附件 |
| 学习规则 | 常规设置（课前预习、课后复习、提前 N 天完成个人作业、小组作业至少提前 N 天开始讨论 / 提前 N 天在 iSpace 提交、in-class assignment 至少提前 N 天复习整理、期末复习）+ 个人设置 + 小助手 |
| 导出 Excel | 语言（中 / 英 / 双语）、中英文字体分别选、9 套主题色 + 自定义 + 色弱友好、字号、隔行、类型配色；实时预览 |
| 设置 | 连接 Obsidian vault、明暗模式、备份 / 恢复 |

## Obsidian 同步

1. 设置 → 选择 vault 文件夹 → 选 `~/Documents/Obsidian Vault` → 允许读写。
2. 读写 `00日程管理/Daily Matter/YYYY-MM-DD.md` 的 `# Day planner` 段落，格式与 Day Planner 插件一致：`- [ ] 13:30 - 13:40 内容`。
3. 只改动目标那一行，其余内容原样保留。写入前会重读文件；如果那一行已经在 Obsidian 里被改过，放弃写入并提示。
4. 在 Obsidian 里的修改每 4 秒、以及切回窗口时自动读取。
5. 上课和截止只在工作台显示，不写进 Obsidian；建议学习块点「采纳」后才写入。

## 数据保存在哪里

- 课程、编辑、设置：浏览器 localStorage（键名 `stp-planner-v1`），关掉重开不会丢。
- 附件、vault 授权：浏览器 IndexedDB。
- 换电脑或清理浏览器前：设置 → 导出备份（JSON）。

## 代码结构

```
src/data/calendar.ts   校历：每周各个星期几的实际上课日期（已处理补课与假期）
src/data/courses.ts    6 门课的人工整理数据（中英双语）
src/lib/dates.ts       日期工具、上课场次、截止日期推算
src/lib/validate.ts    占比合计、冲突、TBA、高压周等校验
src/lib/scheduler.ts   确定性排程器（同样的输入永远得到同样的结果）
src/lib/obsidian.ts    Daily Matter 解析与逐行写入
src/lib/excel.ts       Excel 导出（按需加载 exceljs）
scripts/check.ts       数据层自检：npm run check
```

## 部署到 GitHub Pages（可选）

仓库里已有 `.github/workflows/deploy.yml`。推到 GitHub 后，在仓库 Settings → Pages 把 Source 设为 GitHub Actions，每次推送 main 会自动部署。
注意：GitHub Pages 上的网站是公开的，里面包含内置的课程数据（课程名、老师姓名、作业要求）。如果不想公开，把仓库设为私有并只在本地运行，或者换成需要登录的托管方式。
