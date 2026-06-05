# Mycelium

**A local-first personal knowledge agent that captures, connects, and surfaces what matters — when it matters.**

![Mycelium UI](assets/image.png)

---

## The Problem

Personal knowledge is broken at the retrieval end, not the capture end. People save articles, take screenshots, bookmark links, and write notes constantly — but nothing brings it back. Saved things become graveyards. The forgetting curve wins.

Three specific failures:
1. **Scattered capture** — text in Keep, links in Pocket, screenshots in Camera Roll, no unified signal
2. **No recall** — nothing surfaces saved content at the right time, in the right mood
3. **No connections** — two related ideas captured months apart never meet

---

## How It Works

```
Capture → Enrich (local LLM) → Store → Connect (embeddings) → Surface → Feedback
```

1. **Capture** — paste text, drop a URL, or upload an image
2. **Enrich** — a local LLM (LM Studio / Gemma 4B) extracts a summary, tags, and intent (`learn` / `act` / `reference` / `ephemeral`)
3. **Connect** — semantic embeddings find related captures across modalities
4. **Surface** — spaced repetition + intent scoring brings the right item back at the right time
5. **Feedback** — Done/Skip signals tune what resurfaces; skip streaks trigger re-enrichment

Everything runs locally. No cloud, no subscriptions, no data leaving your machine.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + SQLite + Python |
| LLM inference | LM Studio (OpenAI-compat API) |
| Model | `google/gemma-4-e4b` (4B, vision) |
| Embeddings | `text-embedding-nomic-embed-text-v1.5` (768-dim) |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Design | Neobrutalism — Space Grotesk + JetBrains Mono |

---

## Features

- **Three capture modes** — note, link, image (with preview + optional caption)
- **Local LLM enrichment** — summary, tags, intent classification, all on-device
- **Semantic connections** — cosine similarity over nomic embeddings surfaces related captures
- **Spaced repetition surfacing** — intent-weighted scoring with novelty and age bonuses
- **Browse & filter** — filter by intent (learn/act/reference/ephemeral) and type, full-text search
- **Click to surface** — click any feed card to pull it into the surface panel with connections
- **Image resize** — images downscaled to 768px before LLM to stay within context limits

---

## Setup

### Requirements

- Python 3.11+
- Node 18+
- [LM Studio](https://lmstudio.ai) with `google/gemma-4-e4b` and `text-embedding-nomic-embed-text-v1.5` loaded

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -c "from db import init_db; init_db()"
uvicorn main:app --reload
```

### Frontend (dev)

```bash
cd frontend
npm install
npm run dev
```

### Frontend (production build)

```bash
cd frontend
npm run build
# Output goes to ../static/, served automatically by FastAPI
```

Open [http://localhost:8000](http://localhost:8000).

---

## Project Structure

```
.
├── main.py          # FastAPI app — all endpoints
├── lm.py            # LLM + embedding calls (LM Studio)
├── db.py            # SQLite schema + queries
├── surface.py       # Spaced repetition scoring + pick logic
├── config.py        # LM Studio URL, model names, paths
├── requirements.txt
├── frontend/        # React + TypeScript + Vite
│   └── src/
│       ├── App.tsx
│       ├── api.ts
│       ├── types.ts
│       └── components/
│           ├── CaptureBar.tsx
│           ├── SurfacePanel.tsx
│           ├── Feed.tsx
│           ├── Browse.tsx
│           └── Card.tsx
├── assets/          # Screenshots and media for README
├── storage/         # Raw content files (created at runtime)
├── static/          # Built frontend (served by FastAPI)
└── DESIGN.md        # Full architecture + tradeoffs
```

---

## Submitted to

[HuggingFace Build Small Hackathon](https://huggingface.co/spaces/huggingface-projects/build-small-hackathon) — Track 1: Backyard AI
