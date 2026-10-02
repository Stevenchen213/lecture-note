# Evaluation Data — Explainer

This folder holds the dataset used to evaluate LectureNote's outline generation,
created in response to Milestone 1 feedback ("3 to 5 lecture segments is thin — get it to 10").

## Contents

- `segments/seg01.txt … seg10.txt` — 10 lecture transcript excerpts, ~700–800 words each (~6 minutes of speech, ≈ 1,000 tokens).
- `keypoints/segNN.keypoints.json` — the ground-truth key points for each segment (8–12 per segment, 102 in total).
- `raw/` — original VTT caption files and the slicing script (`slice_segments.py`) that produced the segments, for full reproducibility.

## Sources

All excerpts come from real MIT OpenCourseWare lectures on YouTube (human-reviewed captions where available, auto-captions otherwise):

| Segments | Lecture | Minutes used |
|---|---|---|
| seg01–03 | MIT 18.06 Linear Algebra, Lecture 1 (Gilbert Strang) | 6–13, 20–28, 34–42 |
| seg04, 05, 07, 08 | MIT 6.006 Introduction to Algorithms, Lecture 1 | 33–41, 43–51, 6–13, 20–28 |
| seg06, 09, 10 | MIT 14.01 Principles of Microeconomics, Lecture 1 | 34–42, 6–14, 22–30 |

Three different lecturers, three disciplines (math / CS / economics), native-speaker
classroom English — a reasonable proxy for the English-medium lectures our target
users attend. Using published captions as the transcript lets us **isolate the
language model's contribution from ASR errors**; ASR robustness is discussed
separately in the report (risks section).

## Key-point labeling method

Each segment was read end-to-end and 8–12 **atomic, checkable** key points were
extracted: definitions, formulas, numbers, named concepts, examples, and claims the
instructor emphasizes (e.g. "on n = 10 million, the Θ(n) algorithm takes 13 s vs
0.001 s for Θ(log n)"). Points are ordered by exam-worthiness.

Labels were drafted by an AI assistant and are flagged `"human_verified": false`
in each JSON; they are intended for human spot-checking. We chose atomic,
fact-style points specifically so that coverage judgments are objective
("is this fact present?") rather than vibes-based.

## Known limitations

- Excerpts (~6 min) are shorter than a real 50-min lecture; results may not extrapolate to full-lecture length.
- Caption transcripts are cleaner than live ASR output (no misrecognitions, no accent noise).
- Key points were labeled by one annotator; a second annotator would let us measure inter-annotator agreement.
