# 🎓 LectureNote Agent — Product Documentation

> **One-liner**: a real-time lecture copilot — live English-to-Chinese interpretation plus bilingual structured notes. Open in a browser, record the lecture, get notes and exam questions at the end.

**Live app**: [https://lecture-note-tau.vercel.app](https://lecture-note-tau.vercel.app)

---

## 🎯 Persona & Problem

**Persona**: a non-native-English-speaking university student (primarily Chinese-speaking) attending English-medium lectures in Singapore.

| Pain point | Status quo | Our approach |
|---|---|---|
| Heavy-accent professors hard to follow (e.g. Indian English) | Rely on interpretation or guess | ✅ Browser-based live capture, Azure ASR tuned for `en-IN` |
| Raw interpretation is fragmentary | Manually reorganize after class | ✅ LLM identifies lecture structure and builds a hierarchical outline |
| Post-class cleanup takes hours | 2-hour lecture → 3–4 hours of notes | ✅ One-click Word/PDF export at session end |
| Translation without understanding | Existing tools translate word-for-word | ✅ LLM understands content, extracts key points and logic |
| No exam-oriented review material | Find questions yourself, or skip | ✅ Auto-generated practice questions (MCQ / short answer / true-false) |

---

## 🖥️ Product Form

**Web app** — no install; open the URL in a browser. UI is bilingual (English default, 中文 toggle top-right).

### User flow

```
Home (dark theme)
  ├── 📎 Upload courseware (.pptx / .pdf, optional)
  ├── 🎙️ Start Lecture → enter the room
  └── 📚 History → replay past sessions

Room page (dual panel)
  ├── Ready → click Start → live capture + translation
  ├── ⏸️ Pause for breaks
  └── Stop → auto-save + generate practice questions

Replay page
  ├── 📝 Outline (read-only)
  ├── 💬 Bilingual subtitles (read-only)
  └── ✏️ Practice questions (with answers)
```

### Dual-panel layout

```
┌─────────────────┬──────────────────────────────┐
│  🎙️ Live        │  📝 Outline (auto-generated)  │
│  Subtitles      │                              │
│                 │  Ch5: Neural Networks      AI │
│  EN: Today      │  Ch5: Neural Networks        │
│  we'll discuss  │                              │
│  neural nets    │  5.1 Activation Functions  AI │
│                 │   • Sigmoid — maps to (0,1)  │
│  ZH: 今天我们讨 │   • ReLU — common activation │
│  论神经网络…    │                              │
│                 │  5.2 Backpropagation       AI │
│  ● Recognizing… │   • Gradient & chain rule    │
│                 │                              │
│                 │  ✏️ Practice Questions     AI │
│                 │  MCQ 1/5                     │
│                 │  Range of Sigmoid?           │
│                 │  A. (-1,1) B. (0,1) C. ℝ    │
│                 │  [Show answer] → B. (0,1)    │
└─────────────────┴──────────────────────────────┘
```

---

## ✅ Feature List

| # | Feature | Notes | Status |
|---|---------|-------|:--:|
| 1 | **Real-time ASR** | Browser mic → Azure Speech `en-IN`, accent-optimized | ✅ |
| 2 | **Simultaneous translation** | LLM streaming translation, translates partial text for lower perceived latency | ✅ |
| 3 | **Smart outline** | LLM understands content, refreshes every ~30s, auto-hierarchized | ✅ |
| 4 | **Courseware upload** | `.pptx` / `.pdf` provides context for more accurate outlines; image PDFs auto-OCR | ✅ |
| 5 | **15 exam questions** | Picks the most exam-worthy points; instructor hints ("this will be on the exam") prioritized | ✅ |
| 6 | **Pause / Resume** | For breaks and Q&A | ✅ |
| 7 | **Rich-text editing** | 4 highlight colors + H1/H2/H3 + bold/italic/underline | ✅ |
| 8 | **Edit protection** | User-edited nodes are never overwritten by AI; AI/manual source tags | ✅ |
| 9 | **Word export** | `.doc` download with formatting | ✅ |
| 10 | **PDF export** | Print-to-PDF | ✅ |
| 11 | **Session history & replay** | Auto-saved (max 20), replay outline/subtitles/questions | ✅ |
| 12 | **Resume from history** | Continue an interrupted lecture; outline regenerates over the full transcript | ✅ |
| 13 | **Non-English filtering** | Skips Chinese/pinyin input to avoid noise | ✅ |
| 14 | **Filler-word filtering** | Drops hesitation words (yeah/OK/um…) | ✅ |
| 15 | **Smart auto-scroll** | Follows new subtitles; pauses when user scrolls up to read history | ✅ |
| 16 | **Auto wake-up** | Pings the Render backend to wake the free tier | ✅ |
| 17 | **MCP server** | Self-hosted Model Context Protocol server (Streamable HTTP): translate / outline / questions / health | ✅ |
| 18 | **Bilingual UI** | English/Chinese toggle, persisted | ✅ |

---

## 🏗️ Architecture

```
Browser (React + Vite + TailwindCSS)
    │  WebSocket (audio binary + JSON)
    │  HTTP POST (courseware upload)
    ▼
Node.js Backend (Render)
    ├── Azure Speech Services (ASR, en-IN, 16kHz PCM)
    ├── LLM API (translation + outline + questions)
    │     default: DeepSeek; any OpenAI-compatible provider via env vars
    ├── adm-zip (PPTX text extraction)
    ├── pdfjs-dist + canvas (PDF text + render)
    └── Tesseract.js (image-PDF OCR fallback)

MCP Server (Render, standalone deployment)
    ├── @modelcontextprotocol/server v2
    ├── LLM API (same provider switch)
    └── Streamable HTTP transport

Frontend: Vercel (free) · Backend: Render (free) · MCP: Render (free)
```

**Input → Output**: microphone audio → Azure ASR → transcript buffer → LLM (per-sentence translation; rolling outline regeneration; end-of-class question generation) → bilingual subtitles + outline + practice questions in the browser. Session state, outline merging and user edits are orchestrated by the backend and React state; user-edited outline nodes are never overwritten (merge logic in `src/utils/outlineMerge.js`).

### MCP Server

Self-hosted MCP (Model Context Protocol) server with a Streamable HTTP endpoint:

| Tool | Function |
|------|----------|
| `translate` | EN→ZH simultaneous translation, tuned for lectures |
| `generate_outline` | Bilingual structured outline |
| `generate_questions` | 15 core practice questions |
| `health` | Health check |

**Endpoint**: [https://mcp-server-9mz7.onrender.com/mcp](https://mcp-server-9mz7.onrender.com/mcp)

---

## 📏 Metrics: Targeted vs Reached

Method and data: [data/README.md](data/README.md) and [evals/README.md](evals/README.md);
critique: [docs/REPORT.md](docs/REPORT.md); cost: [docs/COST_ANALYSIS.md](docs/COST_ANALYSIS.md).

**Targeted (Milestone 1)**: ≥ 80% coverage of instructor-emphasized key points.

**Metric fix (after interim feedback)**: single-metric coverage is gameable (paste the whole transcript ≈ 100%) — the "trivial winner" problem. We now report three metrics against a raw-transcript baseline. The evaluation ran on Kimi via the OpenAI-compatible provider switch (Section above and [docs/REPORT.md](docs/REPORT.md)):

| Candidate | Coverage | Precision | Length ratio |
|---|---|---|---|
| Raw transcript (baseline) | 99.1% | — | 100% |
| Product outline (uncapped) | 100% | 75.9% | 74% |
| Length-capped outline (≤15%) | **91.3%** | **93.6%** | **15%** |

**Takeaway**: the capped outline keeps 91.3% of instructor-emphasized key points in 15% of the words (~7× compression) at 93.6% precision — meeting and beating the original ≥80% target on a metric that can't be gamed by copying. Per-segment data: [evals/results/RESULTS.md](evals/results/RESULTS.md).

**Evaluation scale**: 10 segments from 3 MIT OCW lectures (3 lecturers, math / CS / economics), 103 atomic labeled key points.

**Cost**: ≈ US$1 per 50-minute lecture end-to-end (~80% ASR, ~20% LLM).

---

## 🔗 Links

- **App**: [https://lecture-note-tau.vercel.app](https://lecture-note-tau.vercel.app)
- **Backend**: `lecture-note-2we1.onrender.com`
- **MCP**: [https://mcp-server-9mz7.onrender.com/mcp](https://mcp-server-9mz7.onrender.com/mcp)
- **GitHub**: [https://github.com/Stevenchen213/lecture-note](https://github.com/Stevenchen213/lecture-note)

---

## 👤 Author

**Chen Mingsong (Steven Chen)** — [GitHub](https://github.com/Stevenchen213)
