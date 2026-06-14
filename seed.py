"""Seed the KB with Ajit's engineering captures spread across the past week."""
import sqlite3
from db import init_db, get_all_embeddings, DB_PATH
from lm import embed, find_related

init_db()

# ── Seed content ───────────────────────────────────────────────────────────────
# Spread across June 7–13, 2026. All summaries/claims/questions are pre-written
# so seeding is deterministic and doesn't require the LLM.

SEEDS = [

    # ── June 7 ─────────────────────────────────────────────────────────────────

    {
        "date": "2026-06-07 09:12",
        "type": "text", "intent": "learn",
        "title": "KV Cache is Why Context Has a Cost",
        "raw": "Every token in an LLM's context window requires a KV cache entry. That cache grows O(n) in memory and causes O(n²) compute in attention. 128k context sounds great until you're paying for it.",
        "your_take": "This is why RAG beats long-context even when models support 128k — retrieval is cheaper than attending over everything",
        "summary": "KV cache memory grows linearly with context length while attention compute grows quadratically — making long-context expensive even when technically supported.",
        "claims": [
            "KV cache memory scales O(n) with context length",
            "Attention compute scales O(n²), making 128k context very expensive",
            "RAG is often cheaper than long-context because retrieval avoids full attention over all tokens",
        ],
        "tags": ["LLM", "KV cache", "attention", "inference", "AI engineering"],
        "recall_question": "What are the two separate scaling costs of increasing LLM context length according to this note",
    },
    {
        "date": "2026-06-07 14:33",
        "type": "text", "intent": "learn",
        "title": "Embedding Models Are Not Interchangeable",
        "raw": "Switching embedding models without re-embedding your entire corpus is silent data corruption. Cosine similarity is only meaningful within the same model family. BGE and MiniLM scores are not comparable.",
        "your_take": "Got burned by this building Mycelium — MiniLM embeddings in prod, switched models, search was quietly broken for days",
        "summary": "Embedding model outputs are not interchangeable — cosine similarity scores are only meaningful within a single model's vector space; mixing models silently corrupts retrieval.",
        "claims": [
            "Cosine similarity scores are only comparable within the same embedding model",
            "Switching models without re-embedding corrupts semantic search silently",
            "There is no way to 'convert' embeddings between model families",
        ],
        "tags": ["embeddings", "vector search", "AI engineering", "retrieval"],
        "recall_question": "Why does switching embedding models without re-embedding corrupt semantic search according to this note",
    },
    {
        "date": "2026-06-07 17:05",
        "type": "link", "intent": "reference",
        "source_url": "https://huggingface.co/spaces/mteb/leaderboard",
        "title": "MTEB Leaderboard",
        "raw": "https://huggingface.co/spaces/mteb/leaderboard",
        "summary": "MTEB (Massive Text Embedding Benchmark) leaderboard ranks embedding models across retrieval, clustering, classification, and semantic similarity tasks — the definitive reference for choosing an embedding model.",
        "claims": [
            "MTEB covers retrieval, clustering, classification and semantic similarity tasks",
            "BGE-base-en-v1.5 consistently ranks near the top for retrieval tasks at its size",
        ],
        "tags": ["MTEB", "embeddings", "benchmarks", "reference", "AI"],
        "recall_question": "What four task types does the MTEB benchmark cover for evaluating embedding models",
    },

    # ── June 8 ─────────────────────────────────────────────────────────────────

    {
        "date": "2026-06-08 08:45",
        "type": "link", "intent": "learn",
        "source_url": "https://karpathy.github.io/2019/04/25/recipe/",
        "title": "Karpathy's Neural Net Training Recipe",
        "raw": "https://karpathy.github.io/2019/04/25/recipe/",
        "your_take": "The 'overfit one batch first' trick alone has saved me hours of debugging",
        "summary": "Karpathy's systematic recipe for training neural networks: start simple, overfit a single batch before scaling, add complexity incrementally, visualize loss curves obsessively.",
        "claims": [
            "Overfit a single batch first to verify the model can learn before scaling",
            "Add one variable at a time — changing multiple things simultaneously makes debugging impossible",
            "Visualize everything: loss curves, activations, gradients — bugs hide in plain sight",
        ],
        "tags": ["Karpathy", "deep learning", "debugging", "training", "recipe"],
        "recall_question": "What is the first step in Karpathy's neural net debugging recipe and why does it work",
    },
    {
        "date": "2026-06-08 11:22",
        "type": "text", "intent": "learn",
        "title": "Prototype to Production Gap",
        "raw": "The gap between a working prototype and production-ready software is mostly edge cases and operational concerns, not features. A demo that works 80% of the time is worthless in prod.",
        "your_take": "Every side project I've shipped taught me this the hard way — the last 20% takes longer than the first 80%",
        "summary": "The prototype-to-production gap is dominated by edge case handling and operational concerns, not feature work — a system working 80% of the time is unusable in production.",
        "claims": [
            "Production failures come from the 20% of inputs a prototype wasn't tested on",
            "Operational concerns (monitoring, error handling, retries) add more time than features",
            "A demo working 80% of the time is a demo, not a product",
        ],
        "tags": ["engineering", "production", "software development", "shipping"],
        "recall_question": "What does this note say dominates the gap between prototype and production software",
    },
    {
        "date": "2026-06-08 16:40",
        "type": "text", "intent": "act",
        "title": "Evaluate BGE-base for Embedding Switch",
        "raw": "Try BAAI/bge-base-en-v1.5 as the embedding model — MTEB shows it beats MiniLM by ~10 points on retrieval. Same 768-dim output so the similarity threshold can stay roughly the same.",
        "your_take": "No trust_remote_code needed unlike nomic — cleaner for production",
        "summary": "Switch to BAAI/bge-base-en-v1.5 for embeddings — outperforms all-MiniLM-L6-v2 by ~10 MTEB points on retrieval tasks at the same 768-dim output size.",
        "claims": [
            "BGE-base-en-v1.5 scores ~10 MTEB points higher than MiniLM on retrieval",
            "Both output 768-dim vectors so the similarity threshold needs minimal adjustment",
        ],
        "tags": ["embeddings", "BGE", "retrieval", "AI engineering"],
        "recall_question": "What specific advantage does BGE-base-en-v1.5 have over MiniLM according to this note",
    },

    # ── June 9 ─────────────────────────────────────────────────────────────────

    {
        "date": "2026-06-09 09:55",
        "type": "text", "intent": "learn",
        "title": "Event Sourcing — What You Give Up",
        "raw": "Event sourcing gives you audit logs and time-travel debugging for free. The tradeoff: read models are eventually consistent and you need projections for every query pattern. Works well when writes dominate reads and history matters.",
        "your_take": "Worth it for financial systems or anything with compliance requirements — overkill for most CRUD apps",
        "summary": "Event sourcing provides free audit logs and time-travel debugging at the cost of eventual consistency and requiring projections per query pattern — best when write history matters more than read simplicity.",
        "claims": [
            "Event sourcing makes audit logs and time-travel debugging free by design",
            "Read models are eventually consistent — queries need pre-built projections",
            "Best fit is systems where write history matters: finance, compliance, collaborative editing",
        ],
        "tags": ["event sourcing", "system design", "architecture", "distributed systems"],
        "recall_question": "What are the two main costs of using event sourcing according to this note",
    },
    {
        "date": "2026-06-09 13:10",
        "type": "link", "intent": "learn",
        "source_url": "https://eugeneyan.com/writing/llm-patterns/",
        "title": "Eugene Yan — LLM Patterns for Production",
        "raw": "https://eugeneyan.com/writing/llm-patterns/",
        "your_take": "The evals section is the most underrated — everyone ships LLM apps without evals then wonders why they can't improve them",
        "summary": "Eugene Yan's taxonomy of production LLM patterns: RAG, fine-tuning, caching, guardrails, and evals — the evals pattern is most often skipped but most critical for iterating on quality.",
        "claims": [
            "Production LLM systems need five patterns: RAG, fine-tuning, caching, guardrails, evals",
            "Evals are the most skipped but most critical pattern for improving LLM quality over time",
            "Caching semantic-similar queries can cut LLM costs by 30-50% in high-traffic apps",
        ],
        "tags": ["LLM", "production", "RAG", "evals", "AI engineering"],
        "recall_question": "Which LLM production pattern does Eugene Yan say is most often skipped and why is it critical",
    },
    {
        "date": "2026-06-09 18:30",
        "type": "text", "intent": "reference",
        "title": "SQLite FTS5 Quick Reference",
        "raw": "SQLite FTS5 setup: CREATE VIRTUAL TABLE search USING fts5(content, title); INSERT INTO search SELECT content, title FROM captures; SELECT * FROM search WHERE search MATCH 'query' ORDER BY rank;",
        "summary": "SQLite FTS5 quick reference: virtual table with fts5, populated via INSERT SELECT, queried with MATCH and sorted by rank — no external search engine needed for keyword search.",
        "claims": [
            "FTS5 requires a virtual table — regular columns are not full-text indexed",
            "The rank column in FTS5 queries sorts by relevance automatically",
        ],
        "tags": ["SQLite", "FTS5", "search", "reference", "database"],
        "recall_question": "What SQL keyword does SQLite FTS5 use for full-text queries and how is relevance handled",
    },

    # ── June 10 ────────────────────────────────────────────────────────────────

    {
        "date": "2026-06-10 09:00",
        "type": "text", "intent": "learn",
        "title": "Show the Problem Before the Solution",
        "raw": "The best product demos show the problem for 30 seconds before showing the solution. Watching someone struggle with the thing you solved creates instant empathy and makes the demo memorable.",
        "your_take": "Every founder talk I've liked does this — the ones that skip to features feel like ads",
        "summary": "Effective product demos open with 30 seconds of the problem, not the solution — the audience needs to feel the pain before the fix can be satisfying.",
        "claims": [
            "30 seconds of problem context makes a demo more memorable than 3 minutes of features",
            "Skipping to features means the audience has no emotional frame for why they should care",
        ],
        "tags": ["demos", "product", "storytelling", "communication"],
        "recall_question": "What does this note say effective product demos show in the first 30 seconds and why",
    },
    {
        "date": "2026-06-10 11:45",
        "type": "link", "intent": "learn",
        "source_url": "https://simonwillison.net/2024/Apr/17/ai-for-data-journalism/",
        "title": "Simon Willison — Practical AI Use",
        "raw": "https://simonwillison.net/2024/Apr/17/ai-for-data-journalism/",
        "your_take": "Simon is the best writer on practical AI use — he actually builds things and writes about what breaks",
        "summary": "Simon Willison on using LLMs practically: the value is in automating the tedious middle 80% of a task, not replacing the judgment at the edges — human-in-the-loop remains essential.",
        "claims": [
            "LLMs are best at automating tedious middle work, not replacing edge-case judgment",
            "Human-in-the-loop is not a limitation but a feature for high-stakes AI applications",
            "The practical value of AI tools comes from combining them with domain expertise",
        ],
        "tags": ["Simon Willison", "LLM", "practical AI", "journalism", "human-in-the-loop"],
        "recall_question": "What does Simon Willison say LLMs are best at automating and what should humans still handle",
    },
    {
        "date": "2026-06-10 20:15",
        "type": "text", "intent": "ephemeral",
        "title": "ZeroGPU Debug War Story",
        "raw": "Spent 3 hours debugging a ZeroGPU cold start failure. Traced it through worker init, CUDA init, spaces wrappers. Turned out to be a module-level import of Qwen2_5_VLForConditionalGeneration that failed silently and put the Space in a restart loop. Fix was moving the import inside the function with a try/except. 2 lines.",
        "summary": "3-hour ZeroGPU debug traced to a module-level import failing silently and causing a restart loop — fixed by moving the import inside the function with a try/except fallback.",
        "claims": [
            "Module-level imports that fail put HF Spaces in a silent restart loop",
        ],
        "tags": ["ZeroGPU", "debugging", "HF Spaces", "Python"],
        "recall_question": "What caused the ZeroGPU restart loop in this debugging session",
    },

    # ── June 11 ────────────────────────────────────────────────────────────────

    {
        "date": "2026-06-11 08:30",
        "type": "text", "intent": "learn",
        "title": "INT4 Quantization Tradeoffs",
        "raw": "INT4 quantization cuts model size by 4x with roughly 2-3% accuracy loss on most benchmarks. The hidden cost: latency variance. Some tokens take much longer to decode because of dequantization overhead, making p99 latency worse than median.",
        "your_take": "vLLM handles the variance better than naive implementations — worth benchmarking before assuming quantization is drop-in",
        "summary": "INT4 quantization reduces model size 4x with ~2-3% accuracy loss, but introduces latency variance from dequantization overhead — p99 latency can be much worse than median.",
        "claims": [
            "INT4 quantization cuts model size 4x with only 2-3% accuracy loss on most tasks",
            "Dequantization overhead causes latency variance — p99 latency is much worse than median",
            "vLLM's implementation handles quantization variance better than naive approaches",
        ],
        "tags": ["quantization", "INT4", "LLM", "inference", "latency"],
        "recall_question": "What hidden latency cost does INT4 quantization introduce that median benchmarks miss",
    },
    {
        "date": "2026-06-11 10:20",
        "type": "text", "intent": "learn",
        "title": "Memory is Reconstructive Not Reproductive",
        "raw": "Spaced repetition works because memory is reconstructive, not reproductive. You're not playing back a recording — you're rebuilding the memory each time from fragments, which strengthens the neural pathway. Active recall beats re-reading because it forces reconstruction.",
        "your_take": "This is the neuroscience behind why Mycelium's recall questions work — you're exercising reconstruction, not recognition",
        "summary": "Memory is reconstructive: each recall rebuilds the memory from fragments rather than playing it back, which is why active recall strengthens retention more than passive re-reading.",
        "claims": [
            "Memory is reconstructive — each recall rebuilds rather than replays the memory",
            "Reconstruction during recall strengthens the neural pathway more than passive review",
            "Active recall beats re-reading because recognition is much easier than reconstruction",
        ],
        "tags": ["memory", "neuroscience", "spaced repetition", "learning", "active recall"],
        "recall_question": "Why does active recall strengthen memory more than passive re-reading according to the reconstructive memory model",
    },
    {
        "date": "2026-06-11 15:00",
        "type": "link", "intent": "act",
        "source_url": "https://github.com/vllm-project/vllm",
        "title": "vLLM — Production LLM Inference",
        "raw": "https://github.com/vllm-project/vllm",
        "summary": "vLLM is an open-source LLM inference engine optimized for throughput with continuous batching, PagedAttention for KV cache management, and support for quantized models — the standard for self-hosted production inference.",
        "claims": [
            "PagedAttention manages KV cache like virtual memory — eliminates fragmentation",
            "Continuous batching increases GPU utilization by mixing requests of different lengths",
        ],
        "tags": ["vLLM", "inference", "production", "LLM", "open source"],
        "recall_question": "What two techniques does vLLM use to improve throughput compared to naive inference servers",
    },

    # ── June 12 ────────────────────────────────────────────────────────────────

    {
        "date": "2026-06-12 09:10",
        "type": "text", "intent": "learn",
        "title": "Solo Building Means Ruthless Scoping",
        "raw": "Building a product solo means you're PM, designer, engineer, and support simultaneously. The only survival strategy: scope down until the core loop works end-to-end, then add. Partial features are technical debt disguised as progress.",
        "your_take": "Mycelium started with 10 planned screens — shipped with 4 that actually work. Right call.",
        "summary": "Solo product development requires ruthless scoping — the core loop must work end-to-end before adding features, because partial features are technical debt disguised as progress.",
        "claims": [
            "Solo builders must play PM, designer, engineer and support simultaneously",
            "The core loop working end-to-end is the only valid milestone when building alone",
            "Partial features create more debt than value — they commit future-you to maintenance without delivering user value",
        ],
        "tags": ["solo building", "product", "scoping", "indie hacking", "engineering"],
        "recall_question": "What does this note say is the only valid milestone for solo builders before adding new features",
    },
    {
        "date": "2026-06-12 11:30",
        "type": "text", "intent": "reference",
        "title": "ffmpeg: MP4 to GIF",
        "raw": "ffmpeg -i input.mp4 -vf 'fps=10,scale=640:-1:flags=lanczos' -loop 0 output.gif",
        "summary": "ffmpeg command to convert MP4 to GIF: 10fps, 640px wide with Lanczos scaling, infinite loop. Add -ss 00:00:02 -t 5 to trim to 5 seconds starting at 2s.",
        "claims": [
            "Lanczos filter (-flags=lanczos) produces sharper GIFs than the default bilinear filter",
        ],
        "tags": ["ffmpeg", "GIF", "video", "CLI", "reference"],
        "recall_question": "What ffmpeg filter flag produces sharper GIF output than the default according to this note",
    },
    {
        "date": "2026-06-12 16:45",
        "type": "text", "intent": "act",
        "title": "Read The Mom Test",
        "raw": "Read 'The Mom Test' by Rob Fitzpatrick before doing any more user interviews. Every question I ask is leading — I'm confirming what I want to hear, not learning what users actually do.",
        "summary": "Read 'The Mom Test' to fix leading user interview questions — current interviews confirm existing assumptions rather than revealing actual user behavior.",
        "claims": [
            "Leading questions in user interviews produce false validation — you hear what you want to hear",
        ],
        "tags": ["user research", "product", "reading", "interviews"],
        "recall_question": "What problem with the current user interview approach does this note identify",
    },

    # ── June 13 ────────────────────────────────────────────────────────────────

    {
        "date": "2026-06-13 08:00",
        "type": "text", "intent": "learn",
        "title": "RAG vs Fine-Tuning Decision Frame",
        "raw": "RAG when: knowledge changes frequently, sources need to be citable, context fits in the window. Fine-tune when: behavior/style needs to change, task is narrow and stable, latency matters more than accuracy. Most apps should try RAG first — it's reversible.",
        "your_take": "Fine-tuning a model for knowledge is almost always the wrong call — that's what RAG is for",
        "summary": "RAG is preferred for dynamic, citable knowledge; fine-tuning for stable narrow tasks requiring style/behavior changes — most applications should start with RAG because it's reversible.",
        "claims": [
            "RAG is better when knowledge changes frequently or sources need to be citable",
            "Fine-tuning is better when behavior or style must change for a narrow stable task",
            "RAG should be the default first attempt — it's reversible, fine-tuning is not",
        ],
        "tags": ["RAG", "fine-tuning", "LLM", "AI engineering", "system design"],
        "recall_question": "What does this note say is the key reason RAG should be tried before fine-tuning for most applications",
    },
    {
        "date": "2026-06-13 10:30",
        "type": "text", "intent": "learn",
        "title": "Second Brain Principle",
        "raw": "Your brain is optimized for having ideas and making connections, not for storage and retrieval. Every fact you try to hold in working memory is competing with the thing you're actually trying to think about. Offload storage, reclaim synthesis.",
        "your_take": "This is the entire premise of Mycelium — capture fast, think later, let the system surface what matters",
        "summary": "The second brain principle: offload fact storage to an external system to free cognitive resources for synthesis and creative connection-making — storage and retrieval are not what brains are for.",
        "claims": [
            "Working memory used for storage reduces capacity available for active thinking",
            "Offloading facts to external systems frees cognitive resources for synthesis",
            "Brains are optimized for generating and connecting ideas, not for storage and retrieval",
        ],
        "tags": ["second brain", "PKM", "cognition", "productivity", "knowledge management"],
        "recall_question": "What cognitive function does this note say is the brain's actual strength versus what it should offload",
    },
    {
        "date": "2026-06-13 14:20",
        "type": "link", "intent": "learn",
        "source_url": "https://www.benkuhn.net/speed/",
        "title": "Ben Kuhn — In Praise of Fast Things",
        "raw": "https://www.benkuhn.net/speed/",
        "your_take": "The 'fast tools change how you think' argument is underrated — I notice this with LLM autocomplete vs slow chat interfaces",
        "summary": "Ben Kuhn's argument for speed in tools: fast tools don't just save time, they change how you think — below certain latency thresholds, you maintain flow state and explore more freely.",
        "claims": [
            "Fast tools change how you think, not just how quickly — they enable exploration that slow tools discourage",
            "There are latency thresholds below which qualitatively different work becomes possible",
            "A 10x faster tool often enables more than 10x the value by changing usage patterns",
        ],
        "tags": ["speed", "tools", "productivity", "engineering", "latency"],
        "recall_question": "What does Ben Kuhn say fast tools enable beyond time savings according to this note",
    },
    {
        "date": "2026-06-13 17:00",
        "type": "link", "intent": "ephemeral",
        "source_url": "https://neal.fun/deep-sea/",
        "title": "The Deep Sea — Interactive Depth",
        "raw": "https://neal.fun/deep-sea/",
        "summary": "Interactive visualization of ocean depth — scroll from the surface to the Mariana Trench encountering creatures at each depth level. Oddly calming.",
        "claims": [],
        "tags": ["fun", "ocean", "interactive", "visualization"],
        "recall_question": None,
    },
]


def run():
    print(f"Seeding {len(SEEDS)} captures into {DB_PATH}…\n")
    all_embs = get_all_embeddings()
    inserted = []

    for s in SEEDS:
        summary = s["summary"]
        emb = embed(summary)
        related = find_related(emb, all_embs, exclude_id=0)  # placeholder id

        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute(
                """INSERT INTO captures
                   (type, raw, source_url, your_take, summary, title, tags, intent,
                    embedding, related_ids, recall_question, claims,
                    created_at, reviewed)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)""",
                (
                    s["type"],
                    s.get("raw"),
                    s.get("source_url"),
                    s.get("your_take"),
                    summary,
                    s.get("title"),
                    __import__("json").dumps(s.get("tags", [])),
                    s["intent"],
                    __import__("json").dumps(emb) if emb else None,
                    __import__("json").dumps([]),  # will backfill below
                    s.get("recall_question"),
                    __import__("json").dumps(s.get("claims", [])),
                    s["date"],
                ),
            )
            cid = cur.lastrowid

        if emb:
            all_embs.append((cid, emb))
        inserted.append(cid)
        print(f"  [{s['intent']:10}] {s.get('title', summary[:50])}")

    # backfill related_ids now that all embeddings exist
    print("\nBackfilling related_ids…")
    import json
    for cid, emb in [(cid, emb) for cid, emb in all_embs if cid in inserted]:
        related = find_related(emb, all_embs, exclude_id=cid)
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("UPDATE captures SET related_ids=? WHERE id=?",
                         (json.dumps(related), cid))

    print(f"\nDone — {len(inserted)} captures seeded with embeddings and connections.")


if __name__ == "__main__":
    run()
