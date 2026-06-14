# Field Notes: Building Mycelium for the Build Small Hackathon

*What I built, what broke, and what I actually learned.*

---

## The Problem I Was Trying to Solve

I am a compulsive saver. Screenshots, bookmarks, Notion pages, voice memos — I have years of captured information scattered across every surface. The problem isn't that I don't capture things. The problem is that I never see them again.

The information goes in and never comes back out at the right moment. It becomes a graveyard.

I wanted to build something that closes that loop. Not another note-taking app — there are enough of those. Something that actively resurfaces what you saved, connects ideas you forgot you had, and tests whether you actually learned anything.

That's Mycelium.

---

## What I Built

Mycelium is a local-first personal knowledge agent. You capture notes, links, and images. An LLM extracts the core insight, classifies your intent (are you learning something? acting on it? saving for reference?), and generates tags and recall questions. A sentence-transformer embeds everything into a vector space so related ideas find each other automatically.

Then it surfaces things back:

- **ASK** — semantic search across your knowledge base with LLM synthesis. Ask "what do I know about LLM inference?" and it finds the relevant captures, synthesizes across them, and tells you what gaps exist.
- **BRIEF** — a daily digest of what you captured, with synthesis across the day and a weekly thread.
- **REVIEW** — spaced repetition (SM-2) targeting specific claims from your own notes. Not generic flashcards — questions generated from what you actually wrote.
- **GRAPH** — a visual map of how your ideas connect via embedding similarity.

**Stack:** NVIDIA Nemotron-Mini-4B-Instruct (text), Qwen2.5-VL-7B (images), BAAI/bge-base-en-v1.5 (embeddings), FastAPI, SQLite, React + TypeScript, ZeroGPU.

---

## The Hard Parts

### 1. ZeroGPU took three rewrites to get right

I started with `gradio.Server` because it seemed like the cleanest way to run a FastAPI app under Gradio. It isn't. The `spaces` library patches `gr.Blocks.launch()` specifically — if you use `gradio.Server`, ZeroGPU never initializes and you get a `gradio_api/startup-events 404` with no useful error.

The working pattern is: `gr.Blocks()` → `demo.launch(prevent_thread_lock=True, ssr_mode=False)` → `app = demo.app` → add your API routes → `app.mount("/", StaticFiles(...))` → `demo.block_thread()`.

The `ssr_mode=False` is non-obvious. Gradio 5 runs a Node.js proxy on port 7860 that intercepts `GET /` before Python sees it. Disabling SSR mode removes the proxy.

Then Gradio 5 registers its own `GET /` route and a `Mount("/assets", ...)` for its own UI assets. Both collide with the React app. Fix: remove Gradio's `GET /` from `app.router.routes` after launch. Fix the assets collision: set `assetsDir: '_app'` in `vite.config.ts` so Vite doesn't output to `/assets/`.

### 2. Embedding models are not interchangeable

I started with `all-MiniLM-L6-v2`. Semantic search felt wrong. Switched to `BAAI/bge-base-en-v1.5` which scores ~10 MTEB points higher on retrieval tasks.

The lesson I had to learn twice: switching embedding models without re-embedding your entire corpus is silent data corruption. Cosine similarity is only meaningful within a single model's vector space. The DB had MiniLM embeddings, new captures got BGE embeddings, and search was quietly broken for days.

Also: `SentenceTransformer` must be pinned to `device="cpu"` on ZeroGPU. The spaces library doesn't manage the embed model. If it defaults to CUDA, it crashes outside the `@spaces.GPU` context.

### 3. The backfill bug that wiped everything on every restart

The startup logic re-computed `related_ids` for all captures on every cold start. The function it called, `update_capture()`, takes `recall_question`, `claims`, and `title` as optional parameters — but the backfill wasn't passing them, so they defaulted to `None` and got written as `NULL`.

Every restart wiped the recall questions and claims from the seed data. REVIEW went from 14 queued cards to zero on every cold start. Took two debugging sessions to find because the seed ran fine, the data looked right in the DB, and then disappeared silently 30 seconds later when the backfill ran.

Fix: the backfill now only updates `related_ids` directly via SQL, not through `update_capture()`.

### 4. Vision model inputs are model-specific and fragile

`Qwen2.5-VL` requires `apply_chat_template` with structured content blocks — `[{"type": "image"}, {"type": "text"}]`. If you call the processor directly with `processor(text=..., images=...)`, you get a `tokens: 0, features: 540` mismatch and the model produces garbage.

But other VL models (InternVL, older LLaVA variants) don't have `apply_chat_template`. So I built `_make_vl_inputs()` — tries `apply_chat_template` first, falls back to the plain processor call if it fails. Swap `HF_VL_MODEL` without changing code.

### 5. The graph threshold problem

With 22 AI/engineering-themed captures and `SIMILARITY_THRESHOLD=0.50`, every node connected to every other node. Hairball. Raised to 0.62 — almost no edges. The issue is domain-specific corpora: all captures are on similar topics so base similarity is high (0.45–0.58 for most pairs), leaving almost no room for a threshold that separates signal from noise.

Switched from threshold-based to rank-based: always keep the top 2 most similar captures per node, with a 0.40 floor to filter complete mismatches. Graph stays readable regardless of how topically similar the corpus is.

---

## What I'd Do Differently

**Start with the embedding model.** I spent days debugging "why does ASK feel wrong" before tracing it back to MiniLM. Embed model choice is a foundational decision — it determines the entire shape of your knowledge graph and retrieval quality. Should have benchmarked this on day one.

**Don't run seed data and startup backfill in the same function.** Having one path for "first run" and another for "restart" with shared code made the backfill bug easy to introduce and hard to spot. Seed once, explicitly, in a separate script. Backfill should be idempotent and narrow in scope.

**ZeroGPU cold starts during demo day are a real risk.** On deadline day, everyone is using ZeroGPU simultaneously. Had two captures fail mid-demo attempt with "No CUDA GPUs available" errors despite the GPU being "acquired." Record the demo locally where you control the environment.

---

## What Actually Worked

The neobrutalist UI design surprised me. Constraints produce good design decisions — the black borders, offset shadows, and amber/green intent badges made the interface feel intentional rather than generic. It was the first thing people commented on.

The BRIEF screen synthesis is genuinely useful. Seeing 6 captures from a day synthesized into one paragraph revealed connections I hadn't made consciously. That's the product thesis working.

The spaced repetition loop closes the loop in a way that felt meaningful. Getting a recall question from something I saved three days ago — phrased specifically around a claim I wrote — is different from re-reading the note. Active recall is the whole point.

---

## Try It

**Live Space:** https://huggingface.co/spaces/build-small-hackathon/mycelium

**Demo video:** https://www.youtube.com/watch?v=Kr7LxRm0JBs

**Code:** https://github.com/ajit3259/Mycelium

Built for the Build Small Hackathon 2026 — June 15 deadline, shipped.
