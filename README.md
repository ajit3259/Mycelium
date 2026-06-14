# Mycelium

**A local-first personal knowledge agent that captures, connects, and surfaces what matters — when it matters.**

![Mycelium UI](assets/image.png)

🚀 **[Live demo](https://huggingface.co/spaces/build-small-hackathon/mycelium)** · 📹 **[Demo video](https://www.youtube.com/watch?v=Kr7LxRm0JBs)** · 📓 **[Field Notes](https://huggingface.co/blog/build-small-hackathon/mycelium)**

---

## The Problem

Everyone saves things. Nobody revisits them. Screenshots, bookmarks, notes-to-self — all gone dark in a week. The capture habit exists. The recall loop doesn't.

Mycelium fixes the recall loop.

---

## What It Does

- **Capture** — notes, links, images. Each processed by a local LLM into a structured summary with intent classification (`learn` / `act` / `reference` / `ephemeral`) and semantic tags.
- **ASK** — semantic search across your knowledge base with LLM synthesis, gap analysis, Feynman self-testing, and learning arc.
- **BRIEF** — daily digest with synthesis across captures and a weekly thread.
- **REVIEW** — spaced repetition (SM-2) targeting specific claims from your own notes.
- **GRAPH** — visual map of how your ideas connect via embedding similarity.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node 18+
- [LM Studio](https://lmstudio.ai) — for local LLM inference

### 1. Clone and install

```bash
git clone https://github.com/ajit3259/Mycelium
cd Mycelium
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Set up LM Studio

1. Download [LM Studio](https://lmstudio.ai)
2. Load a **chat model** — recommended: `google/gemma-3-4b-it` or any instruction-tuned model under 8B
3. Load an **embedding model** — recommended: `BAAI/bge-base-en-v1.5` (search it in LM Studio's Discover tab, download the GGUF version)
4. Start the Local Server (default: `http://localhost:1234`)

### 3. Initialize the database

```bash
python -c "from db import init_db; init_db()"
```

Optionally seed with 22 example captures to explore the UI:
```bash
python seed.py
```

### 4. Start the backend

```bash
uvicorn main:app --port 8000
```

### 5. Build the frontend

```bash
cd frontend
npm install
npm run build   # outputs to ../static/, served by FastAPI
```

Open [http://localhost:8000](http://localhost:8000).

> **Dev mode (hot reload):** `npm run dev` in the frontend folder — runs on port 5173 with proxy to backend.

---

## Configuration

All config is in `config.py` and can be overridden with environment variables:

| Variable | Default | Description |
|---|---|---|
| `LM_STUDIO_URL` | `http://localhost:1234/v1` | LM Studio server URL |
| `LM_MODEL` | auto-detected | Chat model name (leave blank to use whatever is loaded) |
| `EMBED_MODEL` | `BAAI/bge-base-en-v1.5` | Sentence-transformer embedding model |
| `DB_PATH` | `./mind.db` | SQLite database path |
| `UPLOADS_DIR` | `./uploads` | Directory for uploaded images |

---

## How It Works

```
Capture → LLM enrichment → Embed → Connect → Surface → Review
```

1. You capture a note, URL, or image
2. LM Studio extracts summary, tags, intent, claims, and a recall question
3. `BAAI/bge-base-en-v1.5` embeds the summary into a 768-dim vector
4. Related captures link automatically via cosine similarity (rank-based, top 2)
5. Surface engine resurfaces captures by intent + recency scoring
6. SM-2 spaced repetition schedules review of what you should remember

---

## Project Structure

```
.
├── main.py          # FastAPI app — all API endpoints
├── lm.py            # Unified LLM interface (LM Studio + HF Transformers)
├── db.py            # SQLite schema + all queries
├── surface.py       # Intent-weighted surfacing + scoring
├── config.py        # Config — auto-detects HF Spaces vs local
├── seed.py          # Optional: seed 22 example captures
├── requirements.txt
├── FIELD_NOTES.md   # Build post-mortem
├── frontend/        # React + TypeScript + Vite + Tailwind CSS
│   └── src/
│       ├── App.tsx
│       ├── api.ts
│       ├── types.ts
│       └── components/
│           ├── CaptureBar.tsx      # Note / Link / Image capture
│           ├── Feed.tsx            # Recent captures
│           ├── AskScreen.tsx       # Semantic search + synthesis
│           ├── BriefScreen.tsx     # Daily digest
│           ├── ReviewScreen.tsx    # Spaced repetition
│           ├── GraphView.tsx       # Knowledge graph
│           └── Card.tsx            # Shared capture card
└── static/          # Built frontend (served by FastAPI)
```

---

## HF Spaces Deployment

The `app.py` in the [HF Space](https://huggingface.co/spaces/build-small-hackathon/mycelium) replaces `main.py` with a Gradio-based launcher for ZeroGPU, running `nvidia/Nemotron-Mini-4B-Instruct` and `Qwen/Qwen2.5-VL-7B-Instruct` via HF Transformers. Everything else (`lm.py`, `db.py`, `surface.py`, `config.py`) is identical.

---

Built by [@ajit3259](https://github.com/ajit3259) · Submitted to [Build Small Hackathon 2026](https://huggingface.co/spaces/build-small-hackathon)
