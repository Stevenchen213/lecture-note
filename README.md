# 🎓 LectureNote Agent

> 课堂实时同声传译 + 中英双语结构化大纲笔记 — Eazo Global Youth AI Agent Hackathon (Singapore)

**Public URL**: [https://lecture-note-tau.vercel.app](https://lecture-note-tau.vercel.app)

---

## 📸 Screenshots

### Start Screen
Dark themed landing page with PPT upload and history access.

### Recording View (Dual Panel)

| Left: Real-time Bilingual Subtitles | Right: AI-Generated Outline |
|-------------------------------------|------------------------------|
| Live English speech recognition → Chinese translation | Auto-generated structured lecture notes |
| Pause / Resume / Stop controls | Editable rich-text with highlight toolbar |
| Yellow banner when paused | Practice questions after class |

### Replay View
Tabbed view: outline, subtitles, practice questions — with Word/PDF export.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎙️ **Real-time ASR** | Azure Speech Services, `en-IN` model optimized for Indian English |
| 🌐 **Live Translation** | DeepSeek API: English → Chinese simultaneous translation |
| 📝 **AI Outline** | Auto-generated bilingual structured outline every 30 seconds |
| 📎 **PPT Upload** | Upload `.pptx` files to provide lecture context for better outlines |
| ✏️ **Practice Questions** | AI generates quiz questions (MCQ / short answer / true-false) after class |
| ⏯️ **Pause / Resume** | Adapt to lecture breaks and discussions |
| 🎨 **Rich Text Editing** | 4-color highlighting, H1/H2/H3 headings, Bold/Italic/Underline |
| 📥 **Export** | Word document (`.doc`), PDF print, copy to clipboard |
| 📚 **Session History** | Auto-save lectures to browser, browse and replay past sessions |
| 🇬🇧 **English-Only Filter** | Automatically skips Chinese speech / pinyin to avoid noise |
| 🛡️ **Auto Wake-Up** | Pings Render backend on page load to wake from free-tier sleep |

---

## 🏗️ Architecture

```
Browser (React + Vite + TailwindCSS)
    │  WebSocket (audio binary + JSON messages)
    │  HTTP POST (PPT upload)
    ▼
Node.js Backend (Render)
    ├── Azure Speech Services (ASR, en-IN, 16kHz PCM)
    ├── DeepSeek API (translation + outline + questions)
    └── adm-zip (PPTX text extraction)

Frontend Deployed on: Vercel
Backend Deployed on:  Render
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Azure Speech Services API key (japaneast region)
- DeepSeek API key

### Setup

```bash
# Clone
git clone https://github.com/Stevenchen213/lecture-note.git
cd lecture-note

# Frontend
npm install
npm run dev          # → http://localhost:3000

# Backend (in another terminal)
cd server
npm install
cp ../.env.example .env   # then edit .env with your API keys
node index.js        # → ws://localhost:8080
```

### Environment Variables

Create `server/.env`:

```env
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=japaneast
DEEPSEEK_API_KEY=your_deepseek_api_key
```

For production frontend:

```env
VITE_WS_URL=wss://your-render-backend.onrender.com
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite 5, TailwindCSS 3 |
| Backend | Node.js 20, WebSocket (`ws`) |
| ASR | Azure Speech Services (en-IN, continuous recognition) |
| LLM | DeepSeek API (OpenAI-compatible) |
| PPT Parsing | `adm-zip` (PPTX = ZIP of XML) |
| Frontend Hosting | Vercel (free) |
| Backend Hosting | Render (free) |

---

## 📁 Project Structure

```
lecture-note/
├── index.html                    # Entry HTML
├── vite.config.js                # Vite config
├── tailwind.config.js            # TailwindCSS config
├── vercel.json                   # Vercel deployment config
├── src/
│   ├── main.jsx                  # React entry
│   ├── App.jsx                   # Root component + routing
│   ├── index.css                 # Global styles + animations
│   ├── components/
│   │   ├── StartScreen.jsx       # Landing page + PPT upload
│   │   ├── SubtitlePanel.jsx     # Real-time bilingual subtitles
│   │   ├── OutlinePanel.jsx      # Editable outline + questions
│   │   ├── RichTextEditor.jsx    # contentEditable + floating toolbar
│   │   ├── HistoryPanel.jsx      # Past sessions list
│   │   └── ReplayView.jsx        # View past session
│   ├── hooks/
│   │   ├── useAudioRecorder.js   # Browser mic → Int16 PCM
│   │   └── useWebSocket.js       # WebSocket connection manager
│   └── utils/
│       ├── outlineMerge.js       # AI + user edit merge logic
│       ├── export.js             # Word / PDF / clipboard export
│       └── sessionStore.js       # localStorage session persistence
├── server/
│   ├── index.js                  # WebSocket + HTTP server
│   ├── azure-speech.js           # Azure ASR integration
│   ├── deepseek.js               # DeepSeek API (translate + outline + questions)
│   └── package.json              # Server dependencies
└── .env.example                  # Environment variables template
```

---

## 🏆 Hackathon

- **Event**: Eazo Global Youth AI Agent Hackathon
- **Track**: Personal Agent Challenge
- **Location**: Singapore
- **Deadline**: August 10, 2026, 22:00 (UTC+8)

---

## 👤 Author

**Steven Chen** — [GitHub](https://github.com/Stevenchen213)
