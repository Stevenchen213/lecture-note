# Cost Analysis — One 50-minute Lecture, End to End

This document answers the missing rubric criterion 5 from the Milestone 1 feedback:
*What does it cost to run one full lecture through LectureNote?*

## Pricing inputs (retrieved 2026-10-02)

| Service | Price |
|---|---|
| Azure Speech to Text, Standard (S0) real-time | ~US$1.00 per audio hour (F0 free tier: 5 hrs/month) |
| DeepSeek API (`deepseek-chat`, peak) | Input (cache miss) $1.32 / 1M tokens · Output $3.96 / 1M tokens |
| DeepSeek API (`deepseek-chat`, off-peak) | Half of peak rates |
| DeepSeek context caching | Cache-hit input $0.044 / 1M tokens (~30× cheaper than miss) |
| Kimi API (`kimi-k2.6`, fallback provider) | Input $0.95 / 1M (cache hit $0.16) · Output $4.00 / 1M |

Sources: Azure Speech pricing page; DeepSeek API docs pricing page (peak/off-peak: off-peak = all hours except 01:00–04:00 and 06:00–10:00 UTC weekdays); Moonshot platform pricing page (verified 2026-10-02 — note all retired Kimi models 404, only `kimi-k3` / `kimi-k2.6` / `kimi-k2.7-code(-highspeed)` are on sale).

## Token budget per 50-minute lecture

Spoken English at ~150 wpm → ≈ 7,500 words ≈ **10k tokens** of transcript.

| Step | Calls per lecture | Input tokens | Output tokens | Notes |
|---|---|---|---|---|
| Real-time translation (final + partial subtitles) | ~120 short calls | ~20k | ~15k | Each call is one subtitle; partial-translation updates add overhead |
| Outline regeneration (rolling, ~every 5 min) | ~10 calls | ~50k | ~15k | Each call resends the accumulated transcript (avg 5k); this is where context caching pays off |
| Practice-question generation (once) | 1 call | ~15k | ~4k | Transcript capped at 15k chars |
| **Total LLM** | | **~85k** | **~34k** | |

## Cost per lecture

| Component | Peak | Off-peak |
|---|---|---|
| Azure Speech (0.83 hr × $1.00) | $0.83 | $0.83 |
| DeepSeek input (85k × $1.32/1M) | $0.11 | $0.06 |
| DeepSeek output (34k × $3.96/1M) | $0.13 | $0.07 |
| **Total per lecture** | **≈ $1.07** | **≈ $0.96** |
| …with F0 free ASR (first 5 hrs/month) | ≈ $0.24 | ≈ $0.13 |

**Cross-check with the fallback provider (Kimi `kimi-k2.6`):** same token budget →
input 85k × $0.95/1M ≈ $0.08, output 34k × $4.00/1M ≈ $0.14, LLM ≈ $0.22
→ **≈ $1.05 per lecture**. Swapping providers moves the total by less than 5% —
evidence that the cost structure is dominated by ASR and by *orchestration
decisions* (how often we re-run generation), not by which LLM we rent.

## Reading

- **One full lecture costs roughly US$1 end to end** (conservatively, at peak rates with no caching); a student taking 12 lectures/week pays about **$12/week**, and under $3/month if the free ASR tier covers their load.
- The dominant cost is **speech recognition (~80%)**, not the LLM — the "intelligence" is cheap, the "ears" are not. This directly shaped our build-vs-buy split: renting ASR is unavoidable, but LLM spend is small enough that we can afford quality over frugality (e.g. JSON mode, longer prompts).
- The agent-style backend is the main cost lever: **when** it decides to re-run outline generation dominates LLM input tokens. Rolling regeneration every 5 minutes roughly doubles input spend versus a single end-of-lecture run; we keep it because live notes are the product's core value, and DeepSeek's context caching (repeated transcript prefix) cuts most of that premium.
- Silent cost failure mode we hit in practice: the Azure F0 quota (5 hrs/month) is exhausted after ~6 lectures and the SDK fails with `Quota exceeded (1007)` — a hard stop, not a degradation. The app surfaces this to the user as an error banner rather than failing silently.
