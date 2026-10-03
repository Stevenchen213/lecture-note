# 录制指南 — LectureNote Agent 演示视频（手把手版）

> 目标：5–6 分钟（硬上限 8 分钟），人脸 + 屏幕同时可见。
> 每个步骤格式：【操作】+ 你要说的英文旁白（括号里是中文意思，不用说出口）。

---

## 第一部分：录制前的准备（约 15 分钟）

### 1. 设备方案（二选一）

**方案 A（推荐，零安装）：腾讯会议 / Zoom 单人会议**
1. 打开腾讯会议 → 点「快速会议」一个人进会
2. 打开摄像头 → 点「共享屏幕」（选整个屏幕）
3. 点「录制」→ 本地录制
4. 画面上就有你的摄像头小窗 + 屏幕内容，完全符合老师要求

**方案 B：OBS（效果更好但要装）**
下载 OBS → 加「显示器采集」+「视频采集设备（摄像头）」两个源 → 摄像头画面拖到左下角 → 点开始录制。

### 2. 录制前打开的窗口（按顺序准备好 4 个标签页）

| 标签页 | 网址 | 用途 |
|---|---|---|
| ① | https://lecture-note-tau.vercel.app | 产品首页 |
| ② | https://github.com/Stevenchen213/lecture-note | 架构讲解用（翻到 Architecture 图） |
| ③ | https://github.com/Stevenchen213/lecture-note/blob/master/evals/results/RESULTS.md | 评估结果表 |
| ④ | https://www.youtube.com/watch?v=ZK3O402wf1c&t=360s | MIT 线性代数课，**暂停在 6:00**，音量调到 70% |

### 3. 环境检查
- 手机静音、微信/钉钉通知关掉、关闭无关软件
- 电脑扬声器音量开大（产品的麦克风要"听"到 YouTube 的讲课声）
- 先试录 10 秒回放：确认人脸清晰 + 屏幕文字可读 + 有声音

---

## 第二部分：正式录制（照本宣科）

### 镜头 1 — 开场（0:00–0:30）｜画面：标签页 ① 首页

【操作】停在产品首页，先什么都不点，看镜头说话。

🗣️ 说：
> "Hi, I'm Chen Mingsong from Section C. My project is LectureNote Agent — a real-time AI copilot for students who attend English lectures in a non-native language. It turns live lecture audio into bilingual subtitles, a structured outline, and practice questions. Let me show you the product first, then how it's built, and how I evaluated it."

（你好，我是 C 班的陈铭嵩。我的项目是 LectureNote Agent——为非母语听课学生做的实时 AI 助手，把课堂音频变成双语字幕、结构化大纲和练习题。我先演示产品，再讲架构和评估。）

### 镜头 2 — 实时演示（0:30–2:30）｜画面：标签页 ① + ④

【操作 1】在首页点「开始上课 / Enter Room」（不传 PPT）。

🗣️ 说：
> "I enter a live session. No slides needed — just the microphone."

【操作 2】切到标签页 ④，**播放 YouTube**（让它大声放出来），立刻切回标签页 ①。字幕开始滚动后，说：

🗣️ 说：
> "Speech goes to Azure Speech for recognition, and every finalized sentence is translated by DeepSeek — or any OpenAI-compatible model — in real time. Notice the raw English stays next to the Chinese translation: that's our defense against silent failure. The user can always verify against what was actually said."

（语音送 Azure 识别，每句由大模型实时翻译。注意英文原文一直显示在翻译旁边——这是我们对"静默失败"的防线，用户随时可以对照原文验证。）

【操作 3】让视频放 60–90 秒。期间右侧大纲开始滚动时，鼠标指一下大纲面板：

🗣️ 说：
> "The outline on the right regenerates as content accumulates — the backend decides when to re-run each step. That's the agent layer."

（右边大纲随内容滚动重生成——后端自己决定何时重跑，这就是 agent 层。）

【操作 4】点「结束」。出现「正在生成大纲和练习题」时**不要停**，继续说：

🗣️ 说：
> "At session end it generates fifteen practice questions, weighted toward what the instructor emphasized — original numbers and examples, because that's what shows up on exams."

（结束时生成 15 道题，偏向老师强调的内容——原始数据和例子，因为考试就考这些。）

【操作 5】练习题出现后，翻一下题目，然后点「历史课程」展示记录列表，点一条记录的「▶️ 继续」：

🗣️ 说：
> "Sessions are saved locally, and I can resume any course from history — the outline then regenerates over the complete transcript."

（课程存在本地，可以从历史记录继续上课——大纲会基于完整转写重新生成。）

### 镜头 3 — 架构（2:30–3:30）｜画面：切到标签页 ②（GitHub README 架构图）

【操作】滚动到 Architecture 部分。

🗣️ 说：
> "Architecture: we rent both intelligence layers — Azure Speech and an LLM — and we own the orchestration: the WebSocket backend, the session state machine, and the outline merging. Cost check: one fifty-minute lecture costs about one US dollar end to end — and eighty percent of that is speech recognition, not the LLM. The LLM layer is provider-agnostic: during evaluation week we swapped DeepSeek for Kimi with three environment variables, no code changes."

（架构：两层智能都是租的——Azure 识别和大模型；编排层是我们自己建的。成本核算：一堂 50 分钟的课端到端约 1 美元，80% 是语音识别。LLM 层与供应商无关——评估周我们用三个环境变量就把 DeepSeek 换成了 Kimi，没改代码。）

### 镜头 4 — 评估（3:30–4:30）｜画面：切到标签页 ③（RESULTS.md）

【操作】滚到结果表格。

🗣️ 说：
> "My milestone-one metric — key-point coverage — had a trivial winner: dump the whole transcript and you score a hundred percent. So I rebuilt the evaluation: ten lecture segments, a hundred and three labeled key points, three candidates — the raw transcript as baseline, the product outline, and a length-capped outline — scored on coverage, precision, and length."

（我里程碑一的指标——关键点覆盖率——有个平凡赢家：把全文倒出来就是 100 分。所以我重建了评估：10 段讲座、103 个标注关键点、三个候选方案，从覆盖率、精确率、长度三个维度打分。）

🗣️ 指着最后一行说：
> "The result: the capped outline keeps ninety-one percent of key points in fifteen percent of the words — about seven times compression — at ninety-four percent precision. That's what the model actually earns."

（结果：限长大纲用 15% 的篇幅保住 91% 的关键点——约 7 倍压缩——精确率 94%。这才是模型真正的价值。）

### 镜头 5 — 收尾（4:30–5:00）｜画面：回到标签页 ① 或看镜头

🗣️ 说：
> "The hardest bugs were silent ones: recognition sessions dying quietly, malformed JSON, quota exhaustion — each fix made failures loud instead. Next step: close the loop by letting students mark which outline items actually appeared on their exams. Thank you!"

（最难的 bug 都是静默的：识别会话悄悄死掉、JSON 格式损坏、配额耗尽——每个修复都让失败变得可见。下一步是闭环：让学生标注哪些大纲条目真的考了。谢谢！）

---

## 第三部分：录完后

1. 回放检查：人脸可见？屏幕可读？声音清晰？总时长 < 8 分钟？
2. 超时怎么办：优先压缩镜头 2（YouTube 放 45 秒就够）和镜头 3
3. 识别卡住怎么办：刷新页面重来，YouTube 音量开大；Azure 偶尔抽风属正常，重录这一段
4. 导出 mp4，文件名建议 `PE6201_ChenMingsong_Demo.mp4`

## 常见翻车点（提前知道）

| 翻车点 | 对策 |
|---|---|
| 点了开始但没字幕 | YouTube 音量太小 / 浏览器没给麦克风权限 → 地址栏左侧锁图标里允许麦克风 |
| 结束后练习题等很久 | 推理模型需 30–60 秒，**镜头里继续说架构内容**，别冷场 |
| Render 冷启动慢 | 录制前 5 分钟先打开一次首页唤醒后端 |
| 紧张忘词 | 把这份指南打印或放手机上手拿着看，镜头拍到稿子没关系，自然就好 |
