# Evals — Explainer

Evaluation harness for LectureNote's outline generation, built to fix the three
problems raised in Milestone 1 feedback:

1. **Trivial winner** — raw coverage alone is gameable (dump the transcript, score ~100%).
2. **No baseline** — we never measured what the raw transcript already contains.
3. **No length control** — a summary must compress, not just contain.

## How to run

```bash
# prerequisite: DEEPSEEK_API_KEY in server/.env
# (or point at any OpenAI-compatible provider, e.g. Kimi:)
#   LLM_BASE_URL=https://api.moonshot.ai/v1
#   LLM_MODEL=kimi-k2.6
#   LLM_API_KEY=sk-...
# Note: with a custom provider, temperature is not sent (Kimi locks it).
# Kimi free tier = 3 RPM — the script retries 429s with 65s backoff,
# so a full run on the free tier takes ~30 min; Tier1 ($10) is much faster.
node evals/label_keypoints.mjs   # (optional) regenerate AI-drafted key points
node evals/run_evals.mjs         # main evaluation → evals/results/
```

Outputs: `results/results.csv` (per-segment), `results/RESULTS.md` (summary tables),
`results/raw/segNN/` (the actual outlines generated, for inspection).

## What it measures

For each of the 10 segments (`data/segments/`), three candidates are compared
against the ground-truth key points (`data/keypoints/`):

| Candidate | What it is |
|---|---|
| **Baseline** | The raw transcript itself |
| **Uncapped outline** | The product's real `generateOutline()` (`server/deepseek.js`, unmodified) |
| **Capped outline** | Same prompt + a hard length rule: English outline ≤ 15% of transcript words |

Metrics:

- **Coverage** = share of labeled key points conveyed by the candidate (paraphrase counts).
- **Precision** = share of outline bullet items that correspond to a labeled key point
  (the "not padded with filler" metric — this is what kills the trivial winner).
- **Length ratio** = outline words / transcript words.

## Judging method

Judgments are made by an LLM (`deepseek-chat`, temperature 0) with strict prompts:
a key point is covered only if the specific fact/number/definition is present,
in any wording or language. All raw judge inputs/outputs are reproducible by
re-running the script. We treat LLM-as-judge as a scaling tool, not ground truth:
the labeled key points are atomic facts, and spot-checking judge decisions on
2 segments showed no disagreement with human judgment.

## Why this design answers the feedback

- The **baseline row** shows the transcript already contains ~all key points —
  so coverage alone proves nothing. Our value must come from **compression**.
- **Capped vs uncapped** shows coverage survives a hard 15% length budget,
  proving the model selects rather than copies.
- **Precision** shows the outline is dense with real key points, not diluted.

See `results/RESULTS.md` for the numbers and `docs/REPORT.md` for the critique.
