import type { Assessment, Course, L, WeekRow } from '../types'

/**
 * 2026/27 S1 六门课，人工从 STP / Rubrics / 作业说明中整理。
 * 原始文件位于 Y3S1/<课程>/STP/。
 */

const l = (en: string, zh = ''): L => ({ en, zh })

const w = (
  week: number,
  topic: L,
  extra: Partial<Omit<WeekRow, 'week' | 'topic'>> = {},
): WeekRow => ({ week, topic, ...extra })

const reading = (week = 8, events?: L): WeekRow => ({
  week,
  readingWeek: true,
  topic: l('Reading Week', '阅读周'),
  events,
})

const a = (x: Omit<Assessment, 'status'>): Assessment => ({ status: 'todo', ...x })

const LATE_20_40_60 = l(
  '−20% / −40% / −60% for 1 / 2 / 3 calendar days late; 0 marks if 4+ days late',
  '迟交 1 / 2 / 3 天分别扣 20% / 40% / 60%，4 天及以上记 0 分',
)

// ───────────────────────── FIN3073 ─────────────────────────
const FIN3073: Course = {
  code: 'FIN3073',
  short: 'FM',
  name: l('Financial Mathematics', '金融数学'),
  section: '1005',
  convener: 'Dr. Tao HUANG',
  teacher: 'Dr. Tao HUANG',
  color: '#2f6f8f',
  sessions: [
    { weekday: 3, start: '09:00', end: '10:50', room: 'T6-202' },
    { weekday: 5, start: '14:00', end: '14:50', room: 'T4-603' },
  ],
  weekly: [
    w(1, l('Course Introduction', '课程介绍')),
    w(2, l('The Time Value of Money', '货币的时间价值'), {
      activity: l('PV and FV of cash flows; continuous compounding; bond valuation', '现金流的现值与终值；连续复利；债券估值'),
      events: l('Assignment 1 posted', '发布作业 1'),
    }),
    w(3, l('Interest Rates and Related Issues 1', '利率及相关问题（一）'), {
      activity: l('Types of interest rates; bond yield', '利率的类型；债券收益率'),
    }),
    w(4, l('Interest Rates and Related Issues 2', '利率及相关问题（二）'), {
      activity: l('Forward rates; zero rates and bootstrap method; Nelson-Siegel calibration', '远期利率；零息利率与 bootstrap 方法；Nelson-Siegel 校准'),
    }),
    w(5, l('Introduction to Derivatives and Their Valuation', '衍生品及其定价导论'), {
      activity: l('Forward contract; futures contract; options; hedging, arbitrage and speculation', '远期、期货与期权；套期保值、套利与投机'),
      events: l('Assignment 1 due', '作业 1 截止'),
    }),
    w(6, l('Introduction to Derivatives and Their Valuation (cont.)', '衍生品及其定价导论（续）'), {
      activity: l('Valuation of forwards and futures contracts', '远期与期货合约的定价'),
      events: l('Assignment 2 posted', '发布作业 2'),
    }),
    w(7, l('Discrete Version of Brownian Motion – Binomial Trees I', '布朗运动的离散形式：二叉树（一）'), {
      activity: l('Probability models in finance; one-step tree model of option; no-arbitrage condition', '金融中的概率模型；期权的单步二叉树；无套利条件'),
    }),
    reading(8, l('Assignment 2 due', '作业 2 截止')),
    w(9, l('Discrete Version of Brownian Motion – Binomial Trees II', '布朗运动的离散形式：二叉树（二）'), {
      activity: l('Risk-neutral valuation; two-step binomial trees; American vs. European options', '风险中性定价；两步二叉树；美式与欧式期权'),
    }),
    w(10, l("Wiener Process & Ito's Lemma", '维纳过程与伊藤引理'), {
      activity: l('The Markov property; the Wiener process; generalized Wiener process; Ito process', '马尔可夫性；维纳过程；广义维纳过程；伊藤过程'),
    }),
    w(11, l("Wiener Process & Ito's Lemma; The Black-Scholes-Merton Model", '维纳过程与伊藤引理；Black-Scholes-Merton 模型'), {
      activity: l('Lognormal distribution', '对数正态分布'),
      events: l('Assignment 3 posted', '发布作业 3'),
    }),
    w(12, l('The Black-Scholes-Merton Model', 'Black-Scholes-Merton 模型'), {
      activity: l('BSM differential equation; BSM formula and its proof; applications with approximations', 'BSM 微分方程；BSM 公式及其证明；应用与近似'),
    }),
    w(13, l('Other Numerical Methods', '其他数值方法')),
    w(14, l('Revision or Make-up Classes', '复习或补课'), { events: l('Assignment 3 due', '作业 3 截止') }),
  ],
  assessments: [
    a({ id: 'fin-cp', name: l('Class Participation', '课堂参与'), type: 'Participation', weight: 10 }),
    a({ id: 'fin-as', name: l('Assignments', '作业'), type: 'Individual', weight: 50 }),
    a({
      id: 'fin-a1', parentId: 'fin-as', name: l('Assignment 1', '作业 1'), type: 'Individual', weight: 15,
      releaseWeek: 2, dueWeek: 5, requirements: l('Questions uploaded to iSpace', '题目发布在 iSpace'),
    }),
    a({
      id: 'fin-a2', parentId: 'fin-as', name: l('Assignment 2', '作业 2'), type: 'Individual', weight: 15,
      releaseWeek: 5, dueWeek: 8,
      conflict: l('Release week: the weekly table says Week 6, the Remarks say Week 5.', '发布周矛盾：周计划表写第 6 周，Remarks 写第 5 周。'),
    }),
    a({
      id: 'fin-a3', parentId: 'fin-as', name: l('Assignment 3', '作业 3'), type: 'Individual', weight: 20,
      releaseWeek: 9, dueWeek: 14,
      conflict: l('Release week: the weekly table says Week 11, the Remarks say Week 9.', '发布周矛盾：周计划表写第 11 周，Remarks 写第 9 周。'),
    }),
    a({ id: 'fin-fe', name: l('Final Examination (3 hours)', '期末考试（3 小时）'), type: 'FinalExam', weight: 40 }),
  ],
  keyDates: [],
  textbooks: {
    required: [
      'Hull, J. C. (2018). Options, Futures, and Other Derivatives (10th ed.). Pearson. (9th ed. acceptable)',
      'Ross, S. A., Westerfield, R. W., & Jaffe, J. (2012). Corporate Finance (10th ed.). McGraw-Hill.',
      'Deutsch, H.-P., & Beinker, M. W. (2019). Derivatives and Internal Models (5th ed.). Springer.',
      'Luenberger, D. (2013). Investment Science (2nd ed.). Oxford University Press.',
      'Capinski, M., & Zastawniak, T. (2003). Mathematics for Finance. Springer.',
      'Shreve, S. E. (2004). Stochastic Calculus for Finance I & II. Springer.',
    ],
    references: [],
  },
  finalExam: true,
  sources: ['FM/STP/FIN3073_STP_Sem1_2026_27.docx', 'FM/STP/FIN3073_Rubrics_Sem1_2026_27.docx'],
}

// ───────────────────────── BUS3023 ─────────────────────────
const PROPOSAL_CONSULT = l('Proposal writing & consultation', '开题报告写作与答疑')
const BUS3023: Course = {
  code: 'BUS3023',
  short: 'BRM',
  name: l('Business Research Methods', '商业研究方法'),
  section: '1008',
  convener: 'Mr. Alex Ning XIAO',
  teacher: 'Dr. Don Junyi CHAI',
  color: '#7a4f9a',
  sessions: [{ weekday: 2, start: '19:00', end: '21:50', room: 'T6-401' }],
  weekly: [
    w(1, l('Introduction; Research Foundations and Fundamentals', '课程介绍；研究基础'), {
      chapters: 'Ch 1',
      activity: l('The role of business research', '商业研究的作用'),
      homework: l('How to read academic articles', '如何阅读学术论文'),
    }),
    w(2, l('The Research Process: An Overview', '研究过程概述'), {
      chapters: 'Ch 2', activity: l('Literature search', '文献检索'), homework: l('Literature search practice', '文献检索练习'),
      events: l('Groups confirmed by end of Week 2', '第 2 周结束前确认分组'),
    }),
    w(3, l('Clarifying the Research Question', '明确研究问题'), {
      chapters: 'Ch 3', activity: l('Topic exploration', '选题探索'), homework: l('Topic discussion', '选题讨论'),
    }),
    w(4, l('The Research Design: An Overview', '研究设计概述'), {
      chapters: 'Ch 4', activity: l('Literature review', '文献综述'),
      events: l('GA1 Research Topic due 5pm, 24 Sep', '小组作业 1 选题 9/24 17:00 截止'),
    }),
    w(5, l('Sampling Design', '抽样设计'), {
      chapters: 'Ch 5', activity: l('Research design practice', '研究设计练习'), homework: PROPOSAL_CONSULT,
    }),
    w(6, l('Data Collection Design: Experiments', '数据收集设计：实验'), {
      chapters: 'Ch 8', activity: l('Lab experiment development exercise', '实验设计练习'), homework: PROPOSAL_CONSULT,
    }),
    w(7, l('Data Collection Design: Survey', '数据收集设计：问卷调查'), {
      chapters: 'Ch 9', activity: l('Survey questionnaire development exercise', '问卷设计练习'), homework: PROPOSAL_CONSULT,
    }),
    reading(8, l('GA2 Proposal & slides due 5pm, 30 Oct', '小组作业 2 开题报告与 PPT 10/30 17:00 截止')),
    w(9, l('Research Proposal Presentation', '开题报告展示'), {
      activity: l('Presentation, Q&A', '展示与问答'), homework: l('Research proposal feedback', '开题反馈'),
    }),
    w(10, l('Measurement Foundations', '测量基础'), {
      chapters: 'Ch 10', activity: l('Data collection design practice', '数据收集设计练习'), homework: l('Data collection', '数据收集'),
    }),
    w(11, l('Measurement Questions', '测量问题设计'), {
      chapters: 'Ch 11', activity: l('Data analysis practice', '数据分析练习'), homework: l('Analyzing data with statistical packages', '用统计软件分析数据'),
    }),
    w(12, l('Data Collection/Analysis Methods for the Respective Programme', '本专业的数据收集与分析方法'), {
      activity: l('Data analysis methods', '数据分析方法'), homework: l('Research report writing', '研究报告写作'),
    }),
    w(13, l('Data Collection/Analysis Methods for the Respective Programme', '本专业的数据收集与分析方法'), {
      activity: l('Discuss initial data analysis results', '讨论初步分析结果'),
      events: l('GA3 Research Report due 5pm, 4 Dec', '小组作业 3 研究报告 12/4 17:00 截止'),
    }),
    w(14, l('Collect, Prepare, and Examine Data / Final Review', '数据的收集、准备与检查／期末复习'), {
      chapters: 'Ch 13', activity: l('Data analysis reflections & review', '数据分析反思与复习'), homework: l('Revision', '复习'),
    }),
  ],
  assessments: [
    a({ id: 'brm-cp', name: l('Class Participation', '课堂参与'), type: 'Participation', weight: 10 }),
    a({
      id: 'brm-ga1', name: l('Group Assignment 1: Research Topic Identification', '小组作业 1：确定研究选题'), type: 'Group', group: true, weight: 5,
      releaseWeek: 1, dueWeek: 4, dueDate: '2026-09-24', dueTime: '17:00',
      requirements: l('300–500 words; background, importance, research gaps; one submission per group via Turnitin (iSpace)', '300–500 词；背景、重要性、研究缺口；每组提交一份，经 iSpace 的 Turnitin'),
    }),
    a({
      id: 'brm-ga2', name: l('Group Assignment 2: Research Proposal', '小组作业 2：开题报告'), type: 'Group', group: true, weight: 10,
      releaseWeek: 4, dueWeek: 8, dueDate: '2026-10-30', dueTime: '17:00',
      requirements: l('Main body ≤ 6 pages; Times New Roman 12; APA references; submit proposal and presentation slides together', '正文不超过 6 页；Times New Roman 12 号；APA 格式参考文献；开题报告与展示 PPT 一起提交'),
    }),
    a({
      id: 'brm-ga2p', name: l('Group Assignment 2: Proposal Presentation', '小组作业 2：开题展示'), type: 'Presentation', group: true, weight: 10,
      dueWeek: 9, inClass: true,
      requirements: l('Based on the research proposal; presented in class in Week 9', '基于开题报告，第 9 周课上展示'),
    }),
    a({
      id: 'brm-ga3', name: l('Group Assignment 3: Research Report', '小组作业 3：研究报告'), type: 'Group', group: true, weight: 25,
      releaseWeek: 8, dueWeek: 13, dueDate: '2026-12-04', dueTime: '17:00',
      requirements: l('Revised proposal + data analysis + results; 5,000–10,000 words; Times New Roman 12, 1.5 spacing; page numbers bottom centre', '修改后的开题 + 数据分析 + 结果；5,000–10,000 词；Times New Roman 12 号，1.5 倍行距；页码底部居中'),
    }),
    a({ id: 'brm-fe', name: l('Final Examination (3 hours)', '期末考试（3 小时）'), type: 'FinalExam', weight: 40 }),
  ],
  keyDates: [
    { week: 2, event: l('Groups (6–7 people, min. 5) confirmed by end of Week 2', '第 2 周结束前确认分组（6–7 人，至少 5 人）') },
    { event: l('Group issues must be reported at least 1 week before any deadline', '小组内部问题须在任何截止日前至少 1 周报告') },
  ],
  textbooks: {
    required: [
      'Schindler, P. (2025). Business Research Methods (15th ed.). McGraw-Hill.',
      'Ghauri, P., Grønhaug, K., & Strange, R. (2020). Research Methods in Business Studies (5th ed.). Cambridge University Press.',
    ],
    references: [
      'Zikmund, W. G., Babin, B. J., Carr, J. C., & Griffin, M. (2013). Business Research Methods. Cengage Learning.',
      'Sekaran, U., & Bougie, R. (2019). Research Methods for Business (8th ed.). Wiley.',
    ],
  },
  aiPolicy: l('All AI tools prohibited for all CRA assignments; similarity ≤ 30%', '所有平时作业禁止使用任何 AI 工具；相似度不超过 30%'),
  finalExam: true,
  sources: ['BRM/STP/1.1-BUS3023_STP_Sem1_2026_27_Student.doc', 'BRM/2.1–2.3 Assignment briefs'],
}

// ───────────────────────── BA3033 ─────────────────────────
const BA3033: Course = {
  code: 'BA3033',
  short: 'DA- NM',
  name: l('Data Analysis in New Media', '新媒体数据分析'),
  section: '1001',
  convener: 'Dr. Xunxing DIAO',
  teacher: 'Dr. Xunxing DIAO',
  consultation: 'Tue 15:00–16:50; Wed–Fri 13:00–14:50',
  color: '#b25f3a',
  sessions: [
    { weekday: 2, start: '13:00', end: '13:50', room: 'T4-301' },
    { weekday: 5, start: '10:00', end: '11:50', room: 'T2-306' },
  ],
  weekly: [
    w(1, l('Understanding the Digital Ecosystem and New Media Analytics', '理解数字生态与新媒体分析'), {
      lectureNo: 1, chapters: 'DMA Ch 1',
      activity: l('Digital ecosystem and new media data source discussion', '数字生态与新媒体数据源讨论'),
      events: l('CRA rubrics distributed', '发放评分标准'),
    }),
    w(2, l('Digital Analytics Concepts: Metrics, Data Sources, and Measurement Frameworks', '数字分析概念：指标、数据源与测量框架'), {
      lectureNo: 2, chapters: 'DMA Ch 2',
      activity: l('KPI design, metric classification, and data source mapping', 'KPI 设计、指标分类与数据源映射'),
      events: l('Group formation', '组队'),
    }),
    w(3, l('Analytics Tools and Marketing Technology Evaluation', '分析工具与营销技术评估'), {
      lectureNo: 3, chapters: 'DMA Ch 3',
      activity: l('Analytics tool comparison and evaluation', '分析工具的比较与评估'),
      events: l('Assignment 1 distributed', '发布作业 1'),
    }),
    w(4, l('Digital Brand Analysis', '数字品牌分析'), {
      lectureNo: 4, chapters: 'DMA Ch 4',
      activity: l('Brand performance and digital evidence analysis', '品牌表现与数字证据分析'),
      events: l('Group project distributed', '发布小组项目'),
    }),
    w(5, l('Audience Analysis and Social Media Users', '受众分析与社交媒体用户'), {
      lectureNo: 5, chapters: 'DMA Ch 5; SMDMA Ch 1',
      activity: l('Audience profiling and user behaviour analysis', '受众画像与用户行为分析'),
      events: l('Assignment 1 due / Assignment 2 distributed', '作业 1 截止／发布作业 2'),
    }),
    w(6, l('Digital Ecosystem Mapping and Network Analysis', '数字生态图谱与网络分析'), {
      lectureNo: 6, chapters: 'DMA Ch 6; SMDMA Ch 2',
      activity: l('Ecosystem mapping and network interpretation', '生态图谱绘制与网络解读'),
    }),
    w(7, l('Digital Analytics for Marketing Programmes and ROI Evaluation', '营销项目的数字分析与 ROI 评估'), {
      lectureNo: 7, chapters: 'DMA Ch 7, 9',
      activity: l('Campaign performance, search/owned/media analysis, and ROI interpretation', '活动表现、搜索与自有媒体分析、ROI 解读'),
      events: l('Assignment 2 due', '作业 2 截止'),
    }),
    reading(8),
    w(9, l('Crisis Monitoring and Early Warning Analytics', '危机监测与预警分析'), {
      lectureNo: 8, chapters: 'DMA Ch 11; SMDMA Ch 3, 4',
      activity: l('Detecting crisis signals, timing patterns, and word cues', '识别危机信号、时间模式与词语线索'),
    }),
    w(10, l('Crisis Content, Reporting, and Recovery Analytics', '危机内容、报告与恢复分析'), {
      lectureNo: 9, chapters: 'DMA Ch 11, 14; SMDMA Ch 4',
      activity: l('Crisis content analysis, reporting cadence, post-crisis correction, and report design', '危机内容分析、报告节奏、危机后修正与报告设计'),
    }),
    w(11, l('Future Directions for Online Data and Analytics', '在线数据与分析的未来方向'), {
      lectureNo: 10, chapters: 'Instructor materials',
      activity: l('Privacy, AI, platform data access, influence, and analytics limitations', '隐私、AI、平台数据获取、影响力与分析局限'),
      events: l('Group project presentation slides due', '小组项目展示 PPT 截止'),
    }),
    w(12, l('Group Project Presentation', '小组项目展示')),
    w(13, l('Group Project Presentation', '小组项目展示')),
    w(14, l('Catch-up and Final Review', '补课与期末复习'), { events: l('Group project final report due', '小组项目最终报告截止') }),
  ],
  assessments: [
    a({ id: 'ba-cp', name: l('Class Participation', '课堂参与'), type: 'Participation', weight: 10 }),
    a({ id: 'ba-as', name: l('Assignments', '作业'), type: 'Individual', weight: 20 }),
    a({ id: 'ba-a1', parentId: 'ba-as', name: l('Assignment 1', '作业 1'), type: 'Individual', weight: 10, releaseWeek: 3, dueWeek: 5, latePolicy: LATE_20_40_60 }),
    a({ id: 'ba-a2', parentId: 'ba-as', name: l('Assignment 2', '作业 2'), type: 'Individual', weight: 10, releaseWeek: 5, dueWeek: 7, latePolicy: LATE_20_40_60 }),
    a({ id: 'ba-gp', name: l('Group Project', '小组项目'), type: 'Group', group: true, weight: 30 }),
    a({
      id: 'ba-gpp', parentId: 'ba-gp', name: l('Group Project: Presentation', '小组项目：展示'), type: 'Presentation', group: true, weight: 10,
      releaseWeek: 4, dueWeek: 12, dueWeekEnd: 13, inClass: true,
      requirements: l('Slides due in Week 11; presentations in Weeks 12–13', 'PPT 第 11 周截止；第 12–13 周课上展示'),
    }),
    a({
      id: 'ba-gpr', parentId: 'ba-gp', name: l('Group Project: Final Report', '小组项目：最终报告'), type: 'Group', group: true, weight: 20,
      releaseWeek: 4, dueWeek: 14,
    }),
    a({ id: 'ba-fe', name: l('Final Examination (3 hours)', '期末考试（3 小时）'), type: 'FinalExam', weight: 40 }),
  ],
  keyDates: [
    { week: 2, event: l('Group formation', '组队') },
    { week: 11, event: l('Group project presentation slides due', '小组项目展示 PPT 截止') },
  ],
  textbooks: {
    required: [
      'Hemann, C., & Burbary, K. (2018). Digital Marketing Analytics (2nd ed.). Pearson. [DMA]',
      'Szabo, G., Polatkan, G., Boykin, P. O., & Chalkiopoulos, A. (2018). Social Media Data Mining and Analytics. Wiley. [SMDMA]',
    ],
    references: [
      'Russell, M. A., & Klassen, M. (2019). Mining the Social Web (3rd ed.). O’Reilly.',
      'Sharda, R., Delen, D., & Turban, E. (2017). Business Intelligence, Analytics, and Data Science (4th ed.). Pearson.',
    ],
  },
  aiPolicy: l('Generative AI only for proofreading, with acknowledgement on the cover page; any other use is not permitted', '生成式 AI 只能用于校对语法，且须在封面或摘要处声明；其他用途一律不允许'),
  finalExam: true,
  sources: ['Data analysis in new media/STP/BA3033_STP_Sem1_2026_27 (Student Use).pdf', 'BA3033_Rubrics_Sem1_2026_27 (Student Use).pdf'],
}

// ───────────────────────── EBIS3113 ─────────────────────────
const EBIS3113: Course = {
  code: 'EBIS3113',
  short: 'BF- ML',
  name: l('Business Forecasting and Machine Learning', '商业预测与机器学习'),
  section: '1002',
  convener: 'Dr. Shilei LI',
  teacher: 'Dr. Shilei LI',
  color: '#3f7f5a',
  sessions: [
    { weekday: 2, start: '10:00', end: '11:50', room: 'T6-201' },
    { weekday: 3, start: '13:00', end: '13:50', room: 'T2-306' },
  ],
  weekly: [
    w(1, l('Course Overview', '课程概览'), { activity: l('Lab: Excel basics', '实验课：Excel 基础'), events: l('Discuss assessment rubrics', '讨论评分标准') }),
    w(2, l('Data Collection and Data Cleaning', '数据收集与数据清洗'), { activity: l('Lab: Data cleaning', '实验课：数据清洗') }),
    w(3, l('Linear Regression', '线性回归'), { activity: l('Lab: Hypothesis test', '实验课：假设检验'), events: l('Finalize group membership list', '确定小组成员名单') }),
    w(4, l('Time Series 1', '时间序列（一）'), { activity: l('Lab: Time series', '实验课：时间序列'), events: l('Group project distributed', '发布小组项目') }),
    w(5, l('Time Series 2', '时间序列（二）'), { activity: l('Lab: Time series', '实验课：时间序列') }),
    w(6, l('Logistic Regression', '逻辑回归'), { activity: l('Lab: SPSS basics', '实验课：SPSS 基础'), events: l('In-class individual assignment', '课堂个人作业') }),
    w(7, l('Decision Tree', '决策树'), { activity: l('Lab: Decision tree', '实验课：决策树') }),
    reading(8),
    w(9, l('Clustering', '聚类'), { activity: l('Lab: Clustering', '实验课：聚类') }),
    w(10, l('Survival Analysis', '生存分析'), { activity: l('Lab: Survival analysis', '实验课：生存分析') }),
    w(11, l('Cox Regression', 'Cox 回归'), { activity: l('Lab: Cox regression', '实验课：Cox 回归') }),
    w(12, l('Group Project Presentation', '小组项目展示')),
    w(13, l('Group Project Presentation', '小组项目展示'), { events: l('Group project submission', '小组项目提交') }),
    w(14, l('Final Revision', '期末复习')),
  ],
  assessments: [
    a({ id: 'eb-cp', name: l('Class Participation', '课堂参与'), type: 'Participation', weight: 10 }),
    a({
      id: 'eb-ia', name: l('Individual Assignment (in class)', '个人作业（课堂完成）'), type: 'InClass', weight: 30,
      dueWeek: 6, inClass: true,
      requirements: l('Completed in class in Week 6; exact session not specified', '第 6 周课上完成，未写明是哪一次课'),
    }),
    a({ id: 'eb-gp', name: l('Group Project', '小组项目'), type: 'Group', group: true, weight: 30 }),
    a({ id: 'eb-gpp', parentId: 'eb-gp', name: l('Group Project: Presentation', '小组项目：展示'), type: 'Presentation', group: true, weight: 15, releaseWeek: 4, dueWeek: 12, dueWeekEnd: 13, inClass: true }),
    a({ id: 'eb-gpr', parentId: 'eb-gp', name: l('Group Project: Report', '小组项目：报告'), type: 'Group', group: true, weight: 15, releaseWeek: 4, dueWeek: 13 }),
    a({ id: 'eb-fe', name: l('Final Examination (3 hours)', '期末考试（3 小时）'), type: 'FinalExam', weight: 30 }),
  ],
  keyDates: [
    { week: 3, event: l('Finalize group membership list', '确定小组成员名单') },
  ],
  textbooks: {
    required: [
      "Kelleher, J. D., Mac Namee, B., & D'Arcy, A. (2020). Fundamentals of Machine Learning for Predictive Data Analytics. MIT Press.",
      'Cronk, B. C. (2024). How to Use IBM SPSS Statistics. Routledge.',
    ],
    references: [
      'Stock, J. H., & Watson, M. W. (2020). Introduction to Econometrics. Pearson.',
      'Hanke, J. E., & Wichern, D. W. (2014). Business Forecasting (9th ed.). Pearson.',
    ],
  },
  finalExam: true,
  sources: ['BF-ML/STP/EBIS3113_STP for students.pdf', 'BF-ML/STP/EBIS3113_Course syllabus for students.pdf'],
}

// ───────────────────────── BUS4093 ─────────────────────────
const cases = (pages: string) => l(`Interactive sessions / case studies: ${pages}`, `互动环节／案例：${pages}`)
const BUS4093: Course = {
  code: 'BUS4093',
  short: 'MIS',
  name: l('Management Information Systems', '管理信息系统'),
  section: '1004',
  convener: 'Dr. Na JIANG',
  teacher: 'Prof. Lingyun QIU',
  color: '#8f3a4f',
  sessions: [
    { weekday: 3, start: '19:00', end: '20:50', room: 'T5-404' },
    { weekday: 4, start: '09:00', end: '09:50', room: 'T4-403' },
  ],
  weekly: [
    w(1, l('Information Systems in Global Business Today', '当今全球商业中的信息系统'), { chapters: 'Ch 1', activity: cases('p.3, 18, 28'), events: l('STP, rubrics and syllabus distributed', '发放 STP、评分标准与大纲') }),
    w(2, l('Global E-business and Collaboration', '全球电子商务与协作'), { chapters: 'Ch 2', activity: cases('p.36, 53, 63') }),
    w(3, l('Information Systems, Organizations, and Strategy', '信息系统、组织与战略'), { chapters: 'Ch 3', activity: cases('p.72, 97, 100'), events: l('Common Assignment 1 (take-home) distributed', '发布共同作业 1（课后作业）') }),
    w(4, l('Ethical and Social Issues in Information Systems', '信息系统中的伦理与社会问题'), { chapters: 'Ch 4', activity: cases('p.109, 130, 139') }),
    w(5, l('IT Infrastructure and Emerging Technologies', 'IT 基础设施与新兴技术'), { chapters: 'Ch 5', activity: cases('p.146, 177') }),
    w(6, l('Foundations of Business Intelligence: Databases and Information Management', '商业智能基础：数据库与信息管理'), { chapters: 'Ch 6', activity: cases('p.184, 208, 211'), events: l('Common Assignment 2 (open-book, in class)', '共同作业 2（开卷，课堂完成）') }),
    w(7, l('Achieving Operational Excellence and Customer Intimacy: Enterprise Applications', '企业应用：实现卓越运营与客户亲密'), { chapters: 'Ch 9', activity: cases('p.295, 305, 317') }),
    reading(8),
    w(9, l('E-commerce: Digital Markets, Digital Goods', '电子商务：数字市场与数字商品'), { chapters: 'Ch 10', activity: cases('p.324, 344, 354'), events: l('Common Assignment 1 due', '共同作业 1 截止') }),
    w(10, l('Artificial Intelligence', '人工智能'), { chapters: 'Ch 11', activity: cases('p.362, 385, 388') }),
    w(11, l('Enhancing Decision Making with Data Analytics and Business Intelligence', '用数据分析与商业智能改进决策'), { chapters: 'Ch 12', activity: cases('p.395, 408, 417') }),
    w(12, l('MIS Project Presentation', 'MIS 项目展示')),
    w(13, l('MIS Project Presentation', 'MIS 项目展示')),
    w(14, l('Final Review', '期末复习')),
  ],
  assessments: [
    a({ id: 'mis-cp', name: l('Class Participation', '课堂参与'), type: 'Participation', weight: 10, aiPolicy: l('Prohibited', '禁止使用 AI') }),
    a({ id: 'mis-as', name: l('Assignments', '作业'), type: 'Individual', weight: 20 }),
    a({
      id: 'mis-ca2', parentId: 'mis-as', name: l('Common Assignment 2: Open-book In-class Assignment', '共同作业 2：开卷课堂作业'), type: 'InClass', weight: 10,
      dueWeek: 6, inClass: true, aiPolicy: l('Prohibited', '禁止使用 AI'),
      requirements: l('Permitted course materials may be consulted', '可以查阅允许使用的课程资料'),
    }),
    a({
      id: 'mis-ca1', parentId: 'mis-as', name: l('Common Assignment 1: Take-home Assignment', '共同作业 1：课后作业'), type: 'Individual', weight: 10,
      releaseWeek: 3, dueWeek: 9,
      requirements: l('~1,500-word report + appendices (fieldwork log, interview guide); one PDF', '约 1,500 词报告 + 附录（调研日志、访谈提纲）；提交一个 PDF'),
      aiPolicy: l('Restricted: AI Use Statement required; AI writing ≤ 20%, similarity ≤ 20%', '限制使用：须附 AI 使用声明；AI 写作分 ≤ 20%，相似度 ≤ 20%'),
    }),
    a({ id: 'mis-gp', name: l('Group Project', '小组项目'), type: 'Group', group: true, weight: 30 }),
    a({
      id: 'mis-gpo', parentId: 'mis-gp', name: l('Group Project: Oral Presentation', '小组项目：口头展示'), type: 'Presentation', group: true, weight: 20,
      dueWeek: 12, dueWeekEnd: 13, inClass: true,
      aiPolicy: l('Restricted: AI may help with slides; live Q&A answered independently', '限制使用：可用 AI 辅助制作 PPT，现场问答须独立回答'),
    }),
    a({
      id: 'mis-gpw', parentId: 'mis-gp', name: l('Group Project: Written Report', '小组项目：书面报告'), type: 'Group', group: true, weight: 10,
      tba: true, requirements: l('Deadline not stated in the STP', 'STP 未写截止日期'),
    }),
    a({ id: 'mis-fe', name: l('Final Examination (3 hours)', '期末考试（3 小时）'), type: 'FinalExam', weight: 40 }),
  ],
  keyDates: [],
  textbooks: {
    required: ['Laudon, K. C., Laudon, J. P., & Traver, C. G. (2025). Management Information Systems: Managing the Digital Firm (18th ed.). Pearson.'],
    references: [],
  },
  finalExam: true,
  sources: ['MIS/STP/BUS4093-AY2026-27 Sem1-STP[STUDENT].pdf', 'MIS/STP/BUS4093_AY2026-27 Sem1 Syllabus.pdf'],
}

// ───────────────────────── GCAP3213 ─────────────────────────
const PREP_GP = l('Prepare group project report', '准备小组项目报告')
const PREP_IA2 = l('Prepare individual assignment II', '准备个人作业 II')
const GCAP_AI = l('Similarity and AI writing score < 20%; GenAI must not generate substantive content', '相似度与 AI 写作分都须低于 20%；不得用 GenAI 生成实质内容')
const GCAP3213: Course = {
  code: 'GCAP3213',
  short: 'Service L',
  name: l('Service Leadership: Promoting a Better World', '服务型领导：促进更美好的世界'),
  section: '1003',
  convener: 'Dr. Rita Lai-Ying CHAN',
  teacher: 'Dr. Rita Lai-Ying CHAN',
  color: '#a07a2c',
  sessions: [
    { weekday: 2, start: '14:00', end: '15:50', room: 'T5-307' },
    { weekday: 5, start: '15:00', end: '15:50', room: 'T6-603' },
  ],
  weekly: [
    w(1, l('Introduction to Service Leadership', '服务型领导导论'), {
      chapters: 'Ch 1',
      activity: l('What is service leadership? Why? Who is a service leader?', '什么是服务型领导？为什么需要？谁是服务型领导者？'),
      homework: l('Group project and individual assignments explained; form groups', '讲解小组项目与个人作业；分组'),
    }),
    w(2, l('21st Century Realities', '21 世纪的现实'), { chapters: 'Ch 2', activity: l('The relationship of the service economy to leadership', '服务经济与领导力的关系'), homework: l('In-class case study', '课堂案例分析') }),
    w(3, l('Leadership Reorganized', '领导力的重构'), { chapters: 'Ch 3', activity: l('Visions of leadership; tools needed for transformation', '领导愿景；转型所需的工具'), homework: l('Prepare individual assignment I', '准备个人作业 I') }),
    w(4, l('Service Leadership Method', '服务型领导方法'), { chapters: 'Ch 4', activity: l('Dynamics of service leadership; psychology of leadership', '服务型领导的动态；领导心理学'), homework: l('In-class case study', '课堂案例分析') }),
    w(5, l('Dynamics of Service Leadership', '服务型领导的动态'), {
      chapters: 'Ch 5',
      activity: l('Increased ROI; trust building within and outside the organization; autonomy of decision making', '提高投资回报；组织内外的信任建立；决策自主'),
      homework: PREP_GP,
      events: l('Individual assignment I due 17:00, Thu 8 Oct', '个人作业 I 10/8（周四）17:00 截止'),
    }),
    w(6, l('Joyful Leadership', '快乐领导力'), { chapters: 'Ch 6', activity: l('Elements of joyful leadership', '快乐领导力的要素'), homework: PREP_GP }),
    w(7, l('Ethical Dilemmas Facing Service Leaders', '服务型领导者面临的伦理困境'), { chapters: 'Ch 7', activity: l('Personal ethics and service leadership', '个人伦理与服务型领导'), homework: PREP_GP }),
    reading(8, l('Group report (Part I) due 17:00, Fri 30 Oct', '小组报告第一部分 10/30（周五）17:00 截止')),
    w(9, l('Entrepreneurial Path in Service Leadership', '服务型领导的创业路径'), { chapters: 'Ch 8', activity: l("Review prior weeks' learning materials", '复习前几周内容'), homework: PREP_IA2 }),
    w(10, l('Organic vs. Mechanistic Structure for Leadership', '有机式与机械式领导结构'), { chapters: 'Ch 9', activity: l('Entrepreneurial developments in the service industry', '服务业的创业发展'), homework: PREP_IA2 }),
    w(11, l('Microenterprises and Service Leadership', '微型企业与服务型领导'), {
      chapters: 'Ch 10', activity: l('How to develop organic leadership in an organization', '如何在组织中培养有机式领导'),
      events: l('Individual assignment II due 17:00, Fri 27 Nov (listed in Week 11)', '个人作业 II 11/27（周五）17:00 截止（STP 写在第 11 周）'),
    }),
    w(12, l('Service Leadership in Times of Crisis', '危机中的服务型领导'), { chapters: 'Ch 11', activity: l('Microenterprises in the service sector', '服务业中的微型企业'), homework: l('Prepare group project', '准备小组项目') }),
    w(13, l('Group Project Presentation', '小组项目展示'), {
      activity: l("Educating students for service leadership to deal with life's crises", '培养学生以服务型领导应对人生危机'),
      events: l('Full report and PPT due 17:00, Fri 4 Dec', '完整报告与 PPT 12/4（周五）17:00 截止'),
    }),
    w(14, l('Group Project Presentation and Final Review', '小组项目展示与期末复习')),
  ],
  assessments: [
    a({ id: 'sl-cp', name: l('Class Participation', '课堂参与'), type: 'Participation', weight: 10 }),
    a({
      id: 'sl-ia1', name: l('Individual Assignment I: Interview & Analysis', '个人作业 I：访谈与分析'), type: 'Individual', weight: 30,
      releaseWeek: 1, dueWeek: 5, dueDate: '2026-10-08', dueTime: '17:00',
      requirements: l('Interview one leader and analyse via competence, character and care; ≤ 3 pages; Calibri 12, 1.5 spacing, A4; one PDF to iSpace; consent form + one-page evidence log', '访谈一位领导者，从能力、品格、关怀三方面分析；不超过 3 页；Calibri 12 号、1.5 倍行距、A4；提交一个 PDF 到 iSpace；附同意书与一页证据记录'),
      aiPolicy: GCAP_AI, latePolicy: LATE_20_40_60,
    }),
    a({
      id: 'sl-ia2', name: l('Individual Assignment II: Self-reflection & Improvement Plan', '个人作业 II：自我反思与改进计划'), type: 'Individual', weight: 20,
      releaseWeek: 1, dueWeek: 12, dueDate: '2026-11-27', dueTime: '17:00',
      requirements: l('≤ 3 pages; Calibri 12, 1.5 spacing, A4; one PDF to iSpace', '不超过 3 页；Calibri 12 号、1.5 倍行距、A4；提交一个 PDF 到 iSpace'),
      aiPolicy: GCAP_AI, latePolicy: LATE_20_40_60,
      conflict: l('The STP lists it under Week 11 ("due in Week 11"), but 27 Nov falls in Week 12 of the academic calendar.', 'STP 把它写在第 11 周（"due in Week 11"），但按校历 11/27 属于第 12 周。'),
    }),
    a({
      id: 'sl-gp1', name: l('Group Project I: Part I Report', '小组项目 I：第一部分报告'), type: 'Group', group: true, weight: 10,
      releaseWeek: 1, dueWeek: 8, dueDate: '2026-10-30', dueTime: '17:00',
      requirements: l('Goals and significance of the service plan; max. 4 pages', '服务计划的目标与意义；最多 4 页'),
      aiPolicy: GCAP_AI, latePolicy: LATE_20_40_60,
    }),
    a({ id: 'sl-gp2', name: l('Group Project II', '小组项目 II'), type: 'Group', group: true, weight: 30 }),
    a({
      id: 'sl-gp2r', parentId: 'sl-gp2', name: l('Group Project II: Full Report & PPT', '小组项目 II：完整报告与 PPT'), type: 'Group', group: true, weight: 20,
      releaseWeek: 1, dueWeek: 13, dueDate: '2026-12-04', dueTime: '17:00',
      requirements: l('Part I + Part II implementation plan; APA 7th; submit report and PPT as PDF to iSpace', '第一部分 + 第二部分实施计划；APA 第 7 版；报告与 PPT 以 PDF 提交到 iSpace'),
      aiPolicy: GCAP_AI, latePolicy: LATE_20_40_60,
    }),
    a({
      id: 'sl-gp2p', parentId: 'sl-gp2', name: l('Group Project II: Presentation', '小组项目 II：课堂展示'), type: 'Presentation', group: true, weight: 10,
      dueWeek: 13, dueWeekEnd: 14, inClass: true,
      requirements: l('≤ 20 minutes, all members present; hard copy of slides (4 per page) before presenting', '不超过 20 分钟，全员参与；展示前交 PPT 纸质版（每页 4 张）'),
    }),
  ],
  keyDates: [
    { week: 1, event: l('Form groups', '分组') },
    { week: 2, event: l('In-class case study', '课堂案例分析') },
    { week: 4, event: l('In-class case study', '课堂案例分析') },
  ],
  textbooks: {
    required: [
      'Clark, N., Kent, B., & Beddow, A. (2017). Professional Services Leadership Handbook. Kogan Page.',
      'Hoshmand, A. R., & Chung, P. (2021). Service Leadership: Leading with Competence, Character and Care in the Service Economy. Routledge.',
    ],
    references: [],
  },
  aiPolicy: GCAP_AI,
  finalExam: false,
  sources: ['Service Leadership/STP/GCAP3213_STP_26-27_sem1 (S).pdf', 'IA1 / IA2 / Group Project briefs'],
}

export const SEED_COURSES: Course[] = [FIN3073, BUS3023, BA3033, EBIS3113, BUS4093, GCAP3213]
