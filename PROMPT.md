# 项目：STP 学期规划工作台（UIC Semester Planner）

> 使用方式：把本文件整体交给 vibe coding 工具（Claude Code / Cursor 等）作为项目的第一条指令。
> 附录 A–D 是真实数据，来自 2026/27 S1 校历、我的课表、6 门课的 STP、Rubrics 与作业说明。它们既是内置数据，也是验收用的标准答案。

---

## 0. 角色与目标

你是资深全栈工程师兼产品设计师。请从零构建一个个人学期规划 Web 应用，主要给我自己用（北师港浸大 BNBU / UIC 的三年级学生），以后可能开放给同学。

核心流程：
1. 上传每门课的 STP（Semester Teaching Plan）及相关文件（Rubrics、Syllabus、作业说明），每学期最多 10 门课。
2. LLM 抽取结构化信息，由我核对、编辑。
3. 导出 **Excel 汇总表**：一个总览页，加上每门课一个工作表，语言、字体、主题色都可以个性化。
4. 根据勾选的学习规则，导出 **个人学习日历（.ics）**。
5. **所有数据持久化保存**：换设备或重新登录后，上次的课程、编辑结果和设置都还在，不会被重置。

---

## 1. 技术栈与部署（定稿）

- 代码托管：GitHub 仓库（私有）
- 框架：Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- 部署：**Vercel**，连接 GitHub 仓库，推送后自动部署。
  不用 GitHub Pages，因为它只能托管静态页面，没法在服务端安全保存 API Key。
- 数据库、存储与登录：**Supabase**（免费档即可）
  - Auth：用 GitHub OAuth 登录，同时设白名单（环境变量 `ALLOWED_EMAILS`），先只允许我自己登录
  - Postgres：保存学期、课程、抽取结果、编辑历史、导出设置、日历规则
  - Storage：保存原始上传文件，方便日后重新解析、查看原文
  - 所有表开启 Row Level Security，按 `user_id` 隔离数据
- LLM：Anthropic Claude API，模型 `claude-sonnet-5`。用 tool use 加 JSON schema 强制结构化输出。API Key 只存在 Vercel 环境变量里
- 文件解析：
  - `.docx`：`mammoth`
  - `.doc`（旧版 Word，我有好几门课是这个格式）：`word-extractor`；失败时提示我"另存为 docx 或 PDF 后重传"
  - `.pdf`：`pdfjs-dist` 提取文本；某页文本少于 100 字时，把该页渲染成图片交给 Claude 视觉识别
  - `.png` / `.jpg`：Claude 视觉（用于课表截图、拍照的 STP）
  - `.pptx`：提取文本（可选）
- 导出：`exceljs` 生成 Excel；日历用 `ics` 库或手写 RFC 5545
- 校验：`zod`；状态管理：Zustand，并与 Supabase 同步（乐观更新）
- 时区：**Asia/Shanghai**（学校在珠海）

---

## 2. 数据模型（Supabase 表）

```
semesters      id, user_id, name("2026/27 S1"), calendar_json, created_at
courses        id, semester_id, code, name, section, instructor, units, color, sessions_json
source_files   id, course_id, storage_path, filename, file_type, doc_role("STP"|"Rubrics"|"Syllabus"|"Brief"|"TeacherTimetable"|"Other"),
               detected_semester, is_outdated, sha256
extractions    id, course_id, version, data_json(见 §4), warnings_json, created_at
edits          id, course_id, field_path, old_value, new_value, created_at   -- 编辑历史，可回滚
export_prefs   user_id, language, font_zh, font_en, theme, density, ...
planner_rules  id, semester_id, rules_json, natural_language_rules, confirmed
plans          id, semester_id, events_json, generated_at                     -- 已生成的日历，可重新生成
```

---

## 3. 用户流程（向导 + 仪表盘）

首次使用走 4 步向导。完成后首页变成**仪表盘**，显示：本周任务、未来 14 天截止、每周负荷热力图、各课占比环形图，以及"重新导出"入口。

### Step 1 · 学期与校历
- 内置 **2026/27 S1 校历预设**（附录 A），选择后直接使用；也支持上传新校历 PDF，由 LLM 解析后让我确认
- **周次到日期的映射不能简单用"第 1 周周一 + 7×(N−1)"来算**。必须逐周、逐个星期几存储实际上课日期，因为有补课日和跨周的情况（见附录 A 的"陷阱"一节）

### Step 2 · 课表
- 上传教务系统（BNBU MIS）的 "My Timetable" 截图，Claude 视觉识别出每门课的星期几、起止时间、教室、section、教师；也可以手动填写
- 按课程代码自动与 STP 匹配
- 内置我的课表作为测试数据（附录 B）
- 注意：截图里有学号和姓名，**识别时丢弃，不保存**

### Step 3 · 上传课程文件
- 以课程为单位上传，每门课可以传多个文件；系统自动判断每个文件的角色（STP、Rubrics、Syllabus、作业说明）
- **过期文件检测**：从文件名和正文识别学期（例如 `FIN3073_STP_Sem2_AY2025-26.doc` 是上学年的），标记为"过期"，默认不参与抽取
- **没有 STP 的课**：从多份文件（作业说明、课件）合并抽取，并提示"未找到 STP，周计划可能不完整"
- **有 STP 也有作业说明的课**（如 GCAP3213）：合并抽取；作业说明里的具体日期、页数、格式补充到对应 assessment，两者矛盾时报出冲突
- **课程归属校验**：文件正文里的课程代码与所上传的课程不一致时（例如把 BA3033 的 STP 传到了 GCAP3213 名下），弹出提示："这份文件看起来属于 BA3033，要移过去吗？"。同一份文件（sha256 相同）出现在两门课下时也要提示
- **教师个人课表 PDF**（如 `Timetable_S1_..._Dr_XXX.pdf`）：识别为 doc_role="TeacherTimetable"，只从中抽取 Consultation Hour 填进课程信息，忽略教师教的其他课
- 每个文件显示状态：排队中、解析中、完成、需确认、失败（可重试）。相同 sha256 的文件不重复调用 LLM

### Step 4 · 核对与编辑（必须经过）
- 每门课一个 Tab，表格可以直接编辑、增删行；每次修改都写入 `edits` 表，可以撤销
- 每条数据标注来源（文件名 + 页码），点击可以查看原文片段
- 自动校验并高亮显示：
  - 🔴 各项占比合计 ≠ 100%（例如只上传了 GCAP3213 的作业说明、没有上传 STP 时，只能凑出 90%）
  - 🟡 **周次与明确日期不一致**（例如 GCAP3213 的 IA2 写在 W11，但 11/27 按校历属于 W12）→ 以明确日期为准，并提示
  - 🔴 **同一份 STP 内部信息矛盾**（例如 FIN3073 的周表和 Remarks 对 Assignment 2、3 的发布周写得不一样），要把两处原文并排显示，让我选择以哪个为准
  - 🟡 截止日期只写了周次 → 按校历和课表换算，标注"推算"
  - 🟡 截止日期缺失或为 TBA（例如 BUS4093 的小组书面报告）
  - 🟡 截止日期落在 Reading Week 或假期
  - 🟡 同一天有 ≥2 个截止，或同一周总占比 ≥30% → 标为"高压周"

---

## 4. LLM 抽取 Schema

```ts
Course {
  courseCode: string; courseName: string; convener?: string; teachers?: string[]
  weeklyPlan: {
    week: number                     // 教学周（校历周）
    lectureNo?: number               // 部分 STP 另有独立的 Lecture 编号（如 BA3033），要保留，不能和周次混淆
    isReadingWeek?: boolean
    topic: string
    chapters?: string[]              // "DMA Ch. 4" / "Chapter 9"
    classActivity?: string           // Class Discussion / Lab Session 列
    homework?: string                // Homework Practice Questions 列
    assessmentEvents?: string[]      // "Assignment 1 posted"、"Group Formation" 等
    sourceRef: { file, page }
  }[]
  assessments: {
    id: string; name: string
    parentId?: string                // 支持嵌套：如 "Assignments 50%" 下面分 A1 15% / A2 15% / A3 20%
    type: "Participation"|"Individual"|"Group"|"InClass"|"Presentation"|"Report"|"FinalExam"|"Other"
    weight: number                   // 该项占总评的百分比；只给分数（如 "Total 40 marks"）时，标注 weightUnit="marks"，由我确认换算
    releaseWeek?: number             // "posted" / "Distribution of" / "uploaded to iSpace in Week N"
    dueWeek?: number; dueDate?: string; dueTime?: string   // 有明确日期时（如 "5pm, 24th September"）以明确日期为准
    isInClass?: boolean              // 课堂内完成的测验或作业：日历上标在对应课次，不需要提前 N 天完成
    requirements?: string            // 页数、字体、格式、组队、提交平台（iSpace）
    aiPolicy?: { level: "Prohibited"|"Restricted"|"ProofreadOnly"|"Allowed", similarityMax?: number, aiScoreMax?: number, note?: string }
    latePolicy?: string
    dateConfidence: "explicit"|"week-only"|"inferred"|"TBA"
    conflicts?: { field, valueA, sourceA, valueB, sourceB }[]
    sourceRef: { file, page }
  }[]
  keyDates: { date?|week?, event, sourceRef }[]    // 组队截止、选题截止、presentation 周等
  textbooks?: { required: string[], references: string[] }
  courseAiPolicy?: string
  extractionWarnings: string[]
}
```

抽取规则（写进 system prompt）：
- 只抽取原文中出现的信息，**禁止编造**；找不到就留空，并写进 extractionWarnings
- 本校 STP 使用统一模板（Faculty of Business and Management），包含以下部分：页眉表格（课程代码、名称、Convener、教师）、周计划表（列名因课而异）、Remarks（常含作业发布周和截止周）、"Detailed Assessment Components" 占比表（常有嵌套和两列小计）、AI 政策、教材。**Remarks 和周表都要读，两处都有信息时做交叉核对**
- `.doc` 转出的文本顺序可能是乱的（页眉跑到文末），要按语义理解，不能依赖行顺序
- 课程代码、人名、教材名保留原文

---

## 5. Excel 导出

### 5.1 结构
- **Sheet「总览 Overview」**：
  1. 所有截止事项按时间排序，列为：日期 | 星期 | 教学周 | 课程 | 事项 | 类型 | 占比 | 课内/课外 | 距今天数 | 状态（下拉：未开始 / 进行中 / 已提交）
  2. **每周负荷热力图**：行是 Week 1–14 加考试周，列是各门课，单元格为当周截止的占比之和，颜色越深负荷越高
  3. 各课总评构成的小表
- **每门课一个工作表**，表名为课程代码（≤31 字符，去掉 `\ / ? * [ ] :`），依次包含：
  1. 课程信息：名称、Convener、上课时间和教室
  2. Weekly Plan：教学周 | 日期 | Lecture No. | 主题 | 章节 | 课堂活动 | 作业练习 | 本周相关事项
  3. Assessment：名称 | 类型 | 占比（嵌套项缩进显示）| 发布 | 截止 | 要求 | AI 政策 | 迟交政策。末行是合计，合计 ≠ 100% 时标红。旁边放一个饼图
  4. 重要时间点
  5. 教材
- 统一格式：冻结表头，自动列宽并换行，打印设置为 A4 横向、适应页宽，Reading Week 整行灰底

### 5.2 个性化选项（右侧实时预览，设置保存到 Supabase）
- 语言：English / 中文 / 中英双语。翻译由 LLM 完成，课程代码、人名、教材名不翻译
- 中文字体：微软雅黑 / 苹方 / 思源黑体 / 等线 / 宋体 / 楷体
- 英文字体：Calibri / Arial / Times New Roman / Georgia / Helvetica
  （提示：xlsx 不嵌入字体，对方电脑没有该字体时会回退）
- 主题色：8 套预设色系（雾霾蓝、莫兰迪、森林绿、学院红、极简黑白、薄荷、薰衣草、暖橙），另支持自定义主色，自动派生表头色、隔行色、强调色；提供色弱友好选项
- 字号：紧凑 / 标准 / 宽松
- 类型配色：Individual、Group、Exam、InClass 各用一种颜色

---

## 6. 学期日历

### 6.1 常规设置（每项可勾选，参数可调）
- ☐ **课前预习**：每节 lecture 开始前 [1] 天，安排 [30] 分钟。标题写成"预习 FIN3073 W6: Valuation of forwards and futures"
- ☐ **课后复习**：lecture 结束后 [当天 / 次日]，安排 [45] 分钟
  - 一门课一周有两次课时（如 FIN3073 周三 2 小时 + 周五 1 小时），预习和复习可以选择"每次课都排"或"每周排一次"
- ☐ **提前 [3] 天完成 Individual Assignment**：目标完成日 = 截止日 − N 天；从发布周开始倒排工作块，占比越高，块越多
- ☐ **从第 [N] 周开始准备小组作业**：默认 N 取该小组作业的发布周；之后每周安排一次小组时间，截止前一周加密
- ☐ **期末复习**：从 Week [13] 开始按各课期末占比分配复习块；12 月 13–15 日为校历规定的复习日
- 课内完成的评估（isInClass）不排倒排块，只在对应课次前安排一次"准备"

### 6.2 个人设置
- 「每周 [周六 ▾] 不排 [任何 / 预习 / 复习 / 某门课 ▾] 的学习内容」，可以添加多条
- 每天学习时长上限 [3] 小时；可排学习的时段 [09:00–23:00]；自动避开上课时间（附录 B）
- 提醒：提前 [15 分钟 / 1 小时 / 1 天]；截止日另加提前 3 天的提醒
- **自定义规则（自然语言）**，例如："周二晚上有 BRM 到十点，周二不再排复习"、"FIN3073 比较难，复习时间加倍"、"期中之前两周不排小组作业"
  - LLM 把规则解析成结构化规则：
    `Rule{scope, taskType, action:"block"|"scale"|"shift"|"limit", weekdays?, timeWindow?, weeks?, factor?}`
  - 解析结果要翻译成一句中文给我确认，例如"✓ 每周二不安排复习任务"；确认后才生效；解析不了的规则要明确告诉我

### 6.3 小助手提示框（设置区下方）
> 🤖 小助手：不知道怎么选？建议「常规设置」全部勾选，对自己的学习负责哦！加油 :)
> [ 一键全部勾选 ]

### 6.4 排程器（确定性算法，不让 LLM 排）
- LLM 只负责抽取信息和解析规则，具体时间由代码里的排程器决定，同样的输入必须得到同样的结果
- 优先级：考试和高占比截止 > 作业倒排块 > 小组作业 > 预习和复习
- 时间冲突时顺延到最近的空闲时段；实在放不下的任务列进"未安排任务"清单
- 假期（国庆、中秋）和 Reading Week 默认不排预习和复习，但照常排作业倒排块（因为有些作业截止就在 Reading Week）
- 提供周视图预览，支持拖动调整和删除；调整结果保存到 `plans` 表

### 6.5 导出
- `.ics`：时区 Asia/Shanghai；每门课一种颜色（写入 `X-APPLE-CALENDAR-COLOR`）；任务类型写进 CATEGORIES；带 VALARM 提醒；上课事件带教室信息
- 可以导出为单个文件，也可以按课程或按类型拆分（上课 / 学习任务 / 截止）
- 可选：生成订阅链接（带 token 的 `/api/ics/[token]`），iPhone 订阅后，网站上的改动会自动同步到手机
- 附导入教程：iPhone 日历、Google Calendar、Outlook

---

## 7. 非功能要求
- 数据持久化到 Supabase；原始文件保存在 Storage，可以删除
- 成本控制：同一文件按 sha256 缓存抽取结果；显示本学期累计 token 用量
- 容错：一门课失败不影响其他课；LLM 输出先过 zod 校验，失败自动重试 1 次
- 手机上可用（至少能查看仪表盘、导出日历）；界面支持中英切换
- 视觉风格：简洁、圆角卡片、学生友好

---

## 8. 分阶段交付
- **P0**：GitHub 仓库、Vercel 部署、Supabase 登录（白名单）；内置校历（附录 A）；课表（附录 B）；上传与解析（docx / doc / pdf）；核对编辑；数据持久化
- **P1**：Excel 导出（总览页 + 热力图 + 每课一页 + 个性化）
- **P2**：日历常规设置、个人设置、排程器、.ics 导出、小助手提示框
- **P3**：自然语言规则、周视图拖拽、订阅链接、课表截图识别、上传新校历
- 每个阶段完成后给出：本地运行步骤、需要配置的环境变量、Supabase 建表 SQL，并用附录 C 的数据跑一遍验收

---

## 附录 A · 2026/27 S1 校历（BNBU，已从官方 PDF 核对）

| 教学周 | 周一 | 周二 | 周三 | 周四 | 周五 | 备注 |
|---|---|---|---|---|---|---|
| W1 | ~~8/31~~（学期 9/1 才开始）| 9/1 | 9/2 | 9/3 | 9/4 | 9/1–9/14 为 Add/Drop |
| W2 | 9/7 | 9/8 | 9/9 | 9/10 | 9/11 | |
| W3 | 9/14 | 9/15 | 9/16 | 9/17 | 9/18 | |
| W4 | 9/21 | 9/22 | 9/23 | 9/24 | **9/20（周日）补周五课** | 9/25–27 中秋放假 |
| W5 | **10/10（周六）补周一课** | 9/29 | 9/30 | **10/8** | **10/9** | 10/1–7 国庆放假；W5 横跨两个日历周（已确认）|
| W6 | 10/12 | 10/13 | 10/14 | 10/15 | 10/16 | |
| W7 | 10/19 | 10/20 | 10/21 | 10/22 | 10/23 | |
| W8 | — | — | — | — | — | **Reading Week 10/25–31** |
| W9 | 11/2 | 11/3 | 11/4 | 11/5 | 11/6 | |
| W10 | 11/9 | 11/10 | 11/11 | 11/12 | 11/13 | |
| W11 | 11/16 | 11/17 | 11/18 | 11/19 | 11/20 | |
| W12 | 11/23 | 11/24 | 11/25 | 11/26 | 11/27 | |
| W13 | 11/30 | 12/1 | 12/2 | 12/3 | 12/4 | |
| W14 | 12/7 | 12/8 | 12/9 | 12/10 | 12/11 | 12/11 为最后上课日 |

其他日期：12/12 CET；**12/13–15 期末复习**；**12/16–27 期末考试**；2027/1/11 发布成绩。

**陷阱**：
1. 9/20（周日）上的是周五的课；9/25（周五）放假。
2. 10/10（周六）上的是周一的课。
3. 10/8 和 10/9 照常上课，日历上那一周（10/4–10）没有周次编号，归入 W5（已确认）。
4. W8 是 Reading Week，但仍然有作业在这周截止。

## 附录 B · 我的课表（2026/27 S1，6 门课，周一无课）

| 课程 | 名称 | Section | 时间与教室 |
|---|---|---|---|
| BUS3023 | Business Research Methods | 1008 | 周二 19:00–21:50 T6-401 |
| FIN3073 | Financial Mathematics | 1005 | 周三 09:00–10:50 T6-202；周五 14:00–14:50 T4-603 |
| BUS4093 | Management Information Systems | 1004 | 周三 19:00–20:50 T5-404；周四 09:00–09:50 T4-403 |
| GCAP3213 | Service Leadership: Promoting a Better World | 1003 | 周二 14:00–15:50 T5-307；周五 15:00–15:50 T6-603 |
| EBIS3113 | Business Forecasting and Machine Learning | 1002 | 周二 10:00–11:50 T6-201；周三 13:00–13:50 T2-306 |
| BA3033 | Data Analysis in New Media | 1001 | 周二 13:00–13:50 T4-301；周五 10:00–11:50 T2-306 |

## 附录 C · 验收标准答案（从真实文件人工整理）

**FIN3073**（STP 为 .docx；同一文件夹里还有一份过期的 Sem2 AY2025-26 .doc，必须识别为过期）
- Participation 10%；Assignments 50%，其中 A1 15%（W2 发布，W5 截止）、A2 15%（W8 截止）、A3 20%（W14 截止）；Final Exam 40%（3 小时）
- ⚠️ 冲突：周表写 A2 在 W6 发布、A3 在 W11 发布；Remarks 写 A2 在 W5 发布、A3 在 W9 发布 → 必须报出冲突

**BUS3023**（STP 为 .doc，文本顺序是乱的）
- Participation 10%
- GA1 Topic 5%：**9/24（周四）17:00** 截止
- GA2 Proposal 10% 与 Presentation Slides：**10/30（周五）17:00** 截止（在 Reading Week）；Proposal Presentation 10% 在 W9
- GA3 Report 25%：**12/4（周五）17:00** 截止
- Final 40%
- AI：全部禁止；相似度 ≤30%

**BA3033**（周次与 Lecture 编号不同：W9 对应 Lecture 8）
- Participation 10%
- A1 10%：W3 发布，W5 截止
- A2 10%：W5 发布，W7 截止
- Group Project Presentation 10%：W4 发布，W11 交 slides，W12–13 做 presentation
- Group Project Final Report 20%：W14 截止
- Final 40%
- 其他：W2 组队
- AI：只允许用于校对，且必须声明

**EBIS3113**
- Participation 10%
- Individual Assignment 30%：**W6 课内完成**
- Group Project 30%，其中 Presentation 15%（W12–13）、Report 15%（W13 提交）；W3 确定组员，W4 发布
- Final 30%

**BUS4093**（同时有 STP 和 Syllabus）
- Participation 10%
- In-class Open-book Assignment 10%：**W6 课内完成**，禁用 AI
- Take-home Assignment 10%：W3 发布，W9 截止；AI 与相似度均 ≤20%，需附 AI Use Statement
- Group Project：Oral 20%（W12–13）、Written Report 10%（**截止日未写 → TBA**）
- Final 40%

**GCAP3213**（STP + Rubrics + 3 份作业说明；**没有期末考试**）
- Participation 10%
- IA1 30%（W1 发布）：**10/8（周四）17:00** 截止，属于 W5；最多 3 页，Calibri 12 号字，1.5 倍行距，交 PDF 到 iSpace
- IA2 20%（W1 发布）：**11/27（周五）17:00** 截止，属于 W12。⚠️ STP 周表把它写在 W11 那一行，Remarks 也写 "due in Week 11"，但按校历 11/27 属于 W12 → 以明确日期为准，同时报出"周次与日期不一致"
- Group Project I（Part I 报告）10%：**10/30（周五）17:00** 截止（在 Reading Week）
- Group Project II 30%：完整报告 20% 与 PPT 在 **12/4（周五）17:00** 截止（W13）；课堂 presentation 10% 在 W13–14
- W1 分组；W2、W4 有课内案例讨论
- 迟交：晚 1 天扣 20%、2 天扣 40%、3 天扣 60%，4 天及以上记 0 分
- AI：相似度和 AI 写作分都要 <20%；GenAI 不能用于生成实质内容
- 合计 100%
- 抽取器需要能处理"作业说明里的分数制"（Group Project 说明写的是 Total 40 marks）与 STP 百分比之间的对应关系：40 marks = GP I 10% + GP II 30%

## 附录 D · 我已确认的决定
- 先给自己用，部署到 GitHub + Vercel，数据要持久保存
- 需要总览页和热力图
- 开发工具不限
