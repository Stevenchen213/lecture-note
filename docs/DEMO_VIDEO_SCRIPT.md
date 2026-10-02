# Demo Video Script — LectureNote Agent（5 ± 3 分钟）

老师要求：人脸 + 电脑屏幕同时可见；5±3 分钟，超过 8 分钟只看前 8 分钟；关键词 Precision, Articulation, Succinctness。

设备建议：OBS / Teams 自拍模式 / 手机支架拍侧面，确保左下角画中画有人脸。全程英文讲解（旁白如下，可按自己语气微调）。

---

## Shot 1 — 开场（0:00–0:30）人脸为主

> "Hi, I'm Chen Mingsong from Section C. My project is LectureNote Agent — a real-time AI copilot for students like me who attend English lectures in a non-native language. It turns live lecture audio into bilingual subtitles, a structured outline, and practice questions. Let me show you the product first, then how it's built, and how I evaluated it."

## Shot 2 — 产品演示（0:30–2:30）屏幕共享

操作：打开网站首页 → 进入课堂 → 播放一段讲座音频（可用 MIT OCW 视频外放或直接对麦克风朗读）→ 展示实时字幕 + 中文翻译滚动。

> "Here's the live session. Speech goes to Azure Speech for recognition, and every finalized sentence is translated by DeepSeek in real time. Notice the raw English stays next to the translation — that's our defense against silent failure: the user can always verify against what was actually said."

操作：点暂停/继续，展示右侧大纲面板随内容增长。

> "The outline on the right regenerates as content accumulates — the backend decides when to re-run each step. That's the agent layer."

操作：点结束 → 展示「正在生成大纲和练习题」提示 → 展示 15 道练习题 + 历史记录 + 「继续上课」按钮。

> "At session end it generates fifteen practice questions weighted toward what the instructor emphasized — original numbers and examples, because that's what shows up on exams. Sessions are saved locally, and I can resume a course from history."

## Shot 3 — 架构（2:30–3:30）屏幕：架构图（README/PRODUCT_OVERVIEW）

> "Architecture: we rent both intelligence layers — Azure Speech and DeepSeek — and we own the orchestration: the WebSocket backend, session state machine, and outline merging. Cost check: one 50-minute lecture costs about one US dollar end to end — and 80% of that is speech recognition, not the LLM."

## Shot 4 — 评估（3:30–4:30）屏幕：evals/results/RESULTS.md 表格

> "My milestone-1 metric — key-point coverage — had a trivial winner: dump the whole transcript and you score 100%. So I rebuilt the evaluation: ten lecture segments, a hundred and two labeled key points, and I compare three candidates — the raw transcript as baseline, the product outline, and a length-capped outline — on coverage, precision, and length. The result: the model keeps [XX]% of key points in [XX]% of the words — that's what the model actually earns."

## Shot 5 — 收尾（4:30–5:00）人脸为主

> "The hardest bugs were silent ones: recognition sessions dying quietly, malformed JSON, and quota exhaustion — each fix made failures loud instead. Rough edges remain: hallucination is mitigated, not solved, and there's no speaker diarization. Next step: close the loop by letting students mark which outline items actually appeared on their exams. Thank you!"

---

## 录制检查清单

- [ ] 人脸 + 屏幕同屏（先试录 10 秒回放确认）
- [ ] 提前把讲座音频/视频备好，音量适中
- [ ] 提前打开：网站、架构图、RESULTS.md 三个窗口/标签页
- [ ] 总时长控制在 5–6 分钟（<8 分钟硬上限）
- [ ] Shot 4 的 [XX] 数字从 evals/results/RESULTS.md 里抄真实值
