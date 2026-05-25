# PrepTalk — AI Proctored Interview Platform v2.0

> Built for MEDO Hackathon · Powered by Gemini AI (Free)

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Add your Gemini API key
```bash
cp .env.example .env.local
```
Edit `.env.local` and paste your key from https://aistudio.google.com/app/apikey

### 3. Run
```bash
npm run dev
```
Open http://localhost:3000 in **Chrome or Edge** (required for voice input).

## Features
- 🧠 AI question generation from any job description (Gemini)
- 👁️ Live webcam proctoring (face, posture, gaze, lighting)
- 🚫 Tab-switch detection logged as violations
- 🎙️ Voice (speech-to-text) or typed answers
- ⚡ Instant per-answer evaluation with scores
- 📊 Full report with radar chart, hiring recommendation & proctoring timeline

## Project Structure
```
app/
  page.tsx              ← Landing page
  setup/page.tsx        ← Job description & config
  interview/page.tsx    ← Live interview session
  results/page.tsx      ← Report & analytics
  api/
    claude/             ← Gemini proxy
    generate-questions/ ← Question generation
    evaluate-answer/    ← Answer scoring
    generate-report/    ← Final report
components/
  proctoring/ProctoringEngine.tsx  ← CV-based proctoring
lib/
  store.ts              ← Zustand state
  useSpeechToText.ts    ← Speech recognition hook
styles/
  globals.css           ← Design system
```

## Environment Variables
| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Free key from aistudio.google.com |

## Deploy to Vercel
```bash
npx vercel
```
Add `GEMINI_API_KEY` in Vercel dashboard → Settings → Environment Variables.
