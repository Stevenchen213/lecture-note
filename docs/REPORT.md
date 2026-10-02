# LectureNote Agent — Final Project Report

**CHEN MING SONG · Section C · PE6201 Emerging AI Technologies**

## 1. What we built, and why it matters

LectureNote Agent is a real-time lecture copilot for non-native-English-speaking students in English-medium programmes. The student opens a web page, allows the microphone, and attends class; the system streams live English subtitles with Chinese translation, and when the lecture ends it delivers a structured bilingual outline and fifteen practice questions weighted toward what the instructor emphasized.

What this changes versus today: today's alternatives are (a) taking incomplete notes while mentally translating, (b) recording audio nobody re-listens to, or (c) generic transcription apps that produce an 8,000-word wall of text with no structure, no translation, and no exam orientation. Our persona — a Chinese-speaking master's student at NTU — does not need a transcript; they need *less* to read, not more. That framing drove every design decision below, and it is also why our evaluation had to change (Section 3).

## 2. Architecture: rent the intelligence, own the orchestration

The pipeline is microphone → WebSocket → Azure Speech (narrow-ML ASR) → transcript buffer → DeepSeek (foundation model) for translation, outline, and quiz, coordinated by an agent-style Node backend that holds session state and decides *when* each step re-runs: translation per finalized sentence, outline regeneration as content accumulates, quiz generation once at session end.

We deliberately **built** the orchestration layer (session state machine, rolling outline merge, resume-from-history) and **rented** both intelligence layers. This was the right call: self-hosting ASR or an LLM would have consumed the whole project for zero user-visible gain, and the cost analysis (`docs/COST_ANALYSIS.md`) shows the rented path costs ≈ US$1 per 50-minute lecture — with ~80% of that being ASR, not the LLM. The agent layer is also our cost lever: outline re-run frequency dominates LLM input tokens, and DeepSeek's context caching makes the rolling design affordable.

## 3. Metrics: targeted, reached, and critiqued

**Targeted (Milestone 1):** note coverage ≥ 80% of instructor-emphasized key points.

**What intermediate feedback exposed:** coverage alone has a *trivial winner* — emit the whole transcript as the "outline" and coverage is ~100%. Worse, we had no baseline: if the raw transcript already contains every key point (it does — it is verbatim), coverage proves nothing about the model's contribution. The honest claim our system can make is not "we contain the key points" but **"we keep the key points while deleting ~85% of the words."**

**Revised evaluation** (`evals/`, 10 segments from 3 MIT OCW lectures, 102 atomic labeled key points):

| Candidate | Coverage | Precision | Length ratio |
|---|---|---|---|
| Raw transcript (baseline) | *TBD* | — (by definition ~100%, unbounded length) | 100% |
| Product outline (uncapped) | *TBD* | *TBD* | *TBD* |
| Length-capped outline (≤15%) | *TBD* | *TBD* | *TBD* |

*(Table populated from `evals/results/RESULTS.md`.)*

**Metrics critique.** Three lessons. First, *a metric that cannot distinguish the system from a copy-paste script is not a metric* — we now report coverage only alongside precision (share of outline items that are genuine key points) and a hard length budget. Second, the baseline must be run first: our baseline row exists to make the trivial winner visible rather than to hide it. Third, LLM-as-judge is a scaling tool, not ground truth — we mitigated by labeling *atomic, checkable* facts (numbers, formulas, named claims) so judgments are objective, and by spot-checking judge outputs by hand.

**Evals critique (remaining weaknesses).** Segments are ~6 minutes, not 50; published captions are cleaner than live ASR; key points come from a single annotator, so we cannot report inter-annotator agreement; and precision as defined under-credits correct outline content that was not labeled. We state these plainly because the eval's job is to bound our claim, not to inflate it.

## 4. Difficulties surpassed, and tuning that mattered

Four real failures shaped the final system — three of them *silent*:

1. **Silent session death.** Azure continuous recognition times out after ~10+ minutes; subtitles simply stopped appearing with no error. Fix: listen to `sessionStopped` and auto-restart recognition, guarded by an `isStopping` flag so a user-initiated stop is not "resurrected."
2. **Silent structural corruption.** DeepSeek intermittently emitted malformed outline JSON (a missing `{`), which the UI rendered as garbage. Fix: enforce `response_format: json_object`, eliminating the entire failure class — a case where the right tuning was *constraining the model*, not prompting harder.
3. **Over-segmentation.** Default ASR silence timeout (~500 ms) chopped sentences into unusable fragments, degrading both translation and outlines. Fix: `Speech_SegmentationSilenceTimeoutMs = 1500`.
4. **Hard quota failure.** Azure F0 (5 hrs/month) exhausts mid-lecture with `Quota exceeded (1007)`. Not fixable in code — but we made it a *loud* failure (user-facing banner) rather than a silent one.

We also tuned the generation prompts toward *evidence retention* (numbers, formulas, the instructor's original data and phrasing) after observing that generic outlines are useless for exam revision — the same insight the eval now measures.

## 5. Rough edges (honest list)

- **Hallucination risk is real and only mitigated, not solved**: the outline can assert things the instructor never said. Our affordances (raw transcript beside translation, AI-content labeling) help a vigilant user but do not protect a trusting one.
- **Accent sensitivity**: Indian-English model choice (`en-IN`) helped our test lectures but is a blunt instrument for mixed-accent classrooms.
- **Resume-from-history regenerates rather than appends**: resuming a course re-runs generation over the full transcript — correct but costs tokens.
- **No speaker diarization**: Q&A and multi-speaker classes blend into one stream.

## 6. Future path (optional)

Three directions: (1) closed-loop evals — let students mark outline items as "this was on the exam," feeding a real outcome metric; (2) RAG over the course's own past papers and slides so quiz questions track the instructor's style; (3) cost-driven autonomy — the agent choosing regeneration frequency from speech density and remaining budget, which is where this project most naturally grows into a fuller agent.

## 7. Conclusion

The most valuable thing we built was not the pipeline but the *measurement discipline*: our milestone-1 metric could not have distinguished the product from a copy-paste script, and fixing that — baseline first, precision beside coverage, length as a first-class constraint — is what lets us now say, with evidence rather than enthusiasm, what the model actually earns: roughly the same key points, in a fraction of the words, for about a dollar a lecture.

*(Word count: ~1,180)*
