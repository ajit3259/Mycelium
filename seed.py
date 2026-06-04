"""Seed the KB with realistic captures and backfill embeddings + connections."""
from db import init_db, save_capture, update_capture, get_all_embeddings, get_captures
from lm import embed, find_related

init_db()

SEEDS = [
    # ── learning ────────────────────────────────────────────────────────────────
    {
        "type": "text", "intent": "learn",
        "raw": "Spaced repetition works because of the forgetting curve — you review just before you forget, which strengthens the memory trace each time.",
        "summary": "Spaced repetition exploits the forgetting curve: reviewing material just before forgetting it each time creates progressively stronger memory traces.",
        "tags": ["memory", "learning", "spaced repetition", "cognition"],
    },
    {
        "type": "text", "intent": "learn",
        "raw": "The default mode network activates during mind-wandering and is linked to creativity and insight. Boredom isn't wasted time.",
        "summary": "Mind-wandering activates the default mode network, which underlies creativity and insight — structured boredom has cognitive value.",
        "tags": ["neuroscience", "creativity", "boredom", "focus"],
    },
    {
        "type": "text", "intent": "learn",
        "raw": "Attention is a zero-sum resource. Every notification you respond to is borrowed from the task you were doing. Cost is higher than it looks.",
        "summary": "Attention is finite and non-recoverable: responding to each notification incurs a hidden switching cost far larger than the interruption itself.",
        "tags": ["focus", "productivity", "attention", "deep work"],
    },
    {
        "type": "link", "intent": "learn",
        "source_url": "https://www.lesswrong.com/posts/RcZCwxFiZzE6X7nsv/what-is-rationality",
        "raw": "https://www.lesswrong.com/posts/RcZCwxFiZzE6X7nsv/what-is-rationality",
        "summary": "Rationality is about having beliefs that accurately reflect reality (epistemic rationality) and taking actions that best achieve your goals given those beliefs (instrumental rationality).",
        "tags": ["rationality", "epistemics", "decision making", "LessWrong"],
    },
    {
        "type": "text", "intent": "learn",
        "raw": "Compounding applies to knowledge too. Learning something adjacent to what you already know is faster than learning something unrelated. Build clusters, not random facts.",
        "summary": "Knowledge compounds: learning adjacent concepts is faster because existing mental models reduce the cognitive load of integrating new information.",
        "tags": ["learning", "compounding", "mental models", "knowledge"],
    },
    {
        "type": "image", "intent": "learn",
        "raw": None,
        "summary": "Screenshot of a diagram showing transformer attention mechanism — queries, keys, and values compute scaled dot-product attention to weight which tokens to attend to.",
        "tags": ["transformers", "attention", "deep learning", "LLM internals"],
    },
    {
        "type": "text", "intent": "learn",
        "raw": "RAG (retrieval-augmented generation) grounds LLM outputs in external documents, reducing hallucination and allowing knowledge to be updated without retraining.",
        "summary": "RAG reduces LLM hallucination by retrieving relevant documents at inference time, grounding responses in external, updateable knowledge rather than frozen weights.",
        "tags": ["RAG", "LLM", "retrieval", "AI engineering"],
    },

    # ── act ─────────────────────────────────────────────────────────────────────
    {
        "type": "link", "intent": "act",
        "source_url": "https://github.com/simonw/llm",
        "raw": "https://github.com/simonw/llm",
        "summary": "Simon Willison's `llm` CLI tool lets you run prompts against local and cloud models from the terminal, with plugins for Ollama and LM Studio. Worth trying as a lightweight alternative to full agent frameworks.",
        "tags": ["CLI", "LLM", "tooling", "Python"],
    },
    {
        "type": "text", "intent": "act",
        "raw": "Try quantized Mistral 7B in LM Studio — reportedly faster than Gemma at same size on Apple Silicon due to different attention pattern.",
        "summary": "Evaluate quantized Mistral 7B in LM Studio for speed comparison against Gemma on Apple Silicon — different attention patterns may favor Mistral.",
        "tags": ["LM Studio", "Mistral", "Apple Silicon", "benchmarking"],
    },
    {
        "type": "text", "intent": "act",
        "raw": "Read Attention Is All You Need paper — I keep referencing transformers without having read the original.",
        "summary": "Read the original Attention Is All You Need paper to build a grounded understanding of transformer architecture rather than relying on secondary sources.",
        "tags": ["transformers", "paper", "deep learning", "reading list"],
    },
    {
        "type": "link", "intent": "act",
        "source_url": "https://obsidian.md/plugins",
        "raw": "https://obsidian.md/plugins",
        "summary": "Explore Obsidian plugin ecosystem — particularly Dataview for querying notes as a database and Smart Connections for semantic similarity between notes.",
        "tags": ["Obsidian", "PKM", "plugins", "knowledge management"],
    },
    {
        "type": "text", "intent": "act",
        "raw": "Set up Tailscale on iPhone so the local KB is accessible from anywhere without exposing it publicly.",
        "summary": "Configure Tailscale on iPhone to access the local Mind KB server from anywhere on personal devices without a public server.",
        "tags": ["Tailscale", "networking", "privacy", "mobile"],
    },

    # ── reference ───────────────────────────────────────────────────────────────
    {
        "type": "text", "intent": "reference",
        "raw": "ffmpeg convert video to gif: ffmpeg -i input.mp4 -vf 'fps=10,scale=640:-1' -loop 0 output.gif",
        "summary": "ffmpeg command to convert MP4 to GIF at 10fps, 640px wide: `ffmpeg -i input.mp4 -vf 'fps=10,scale=640:-1' -loop 0 output.gif`",
        "tags": ["ffmpeg", "CLI", "video", "reference"],
    },
    {
        "type": "text", "intent": "reference",
        "raw": "SQLite full text search: CREATE VIRTUAL TABLE t USING fts5(content); then SELECT * FROM t WHERE t MATCH 'query';",
        "summary": "SQLite FTS5 quick reference: create with `CREATE VIRTUAL TABLE t USING fts5(content)`, query with `SELECT * FROM t WHERE t MATCH 'query'`.",
        "tags": ["SQLite", "FTS", "search", "database"],
    },
    {
        "type": "image", "intent": "reference",
        "raw": None,
        "summary": "Screenshot of a cheatsheet for git rebase interactive commands — pick, squash, fixup, reword, drop — with short descriptions of each.",
        "tags": ["git", "rebase", "cheatsheet", "reference"],
    },

    # ── ephemeral ───────────────────────────────────────────────────────────────
    {
        "type": "text", "intent": "ephemeral",
        "raw": "lol this dog just ran into a glass door on a reel",
        "summary": "Funny reel of a dog running into a glass door.",
        "tags": ["funny"],
    },
    {
        "type": "link", "intent": "ephemeral",
        "source_url": "https://neal.fun/deep-sea/",
        "raw": "https://neal.fun/deep-sea/",
        "summary": "Interactive deep sea depth visualisation — fun scroll through ocean depth with creatures at each level.",
        "tags": ["fun", "ocean", "interactive"],
    },

    # ── more learning / AI / local models ───────────────────────────────────────
    {
        "type": "text", "intent": "learn",
        "raw": "Mixture of Experts (MoE) routes each token to a subset of 'expert' FFN layers, keeping compute constant while scaling parameters. Mistral and Gemma use this.",
        "summary": "MoE models route each token to a small subset of expert layers, allowing parameter scaling without proportional compute increase — used in Mistral, Gemma.",
        "tags": ["MoE", "LLM architecture", "efficiency", "AI"],
    },
    {
        "type": "text", "intent": "learn",
        "raw": "Quantization reduces model weight precision (FP16 → INT4) with minimal accuracy loss, enabling much larger models to fit in consumer VRAM.",
        "summary": "Quantization (FP16→INT4) cuts model memory footprint by 4x with minimal accuracy loss, making large models runnable on consumer hardware.",
        "tags": ["quantization", "local LLM", "VRAM", "efficiency"],
    },
    {
        "type": "text", "intent": "learn",
        "raw": "The Feynman technique: explain a concept as if teaching a child. Where you stumble is exactly where your understanding has gaps.",
        "summary": "Feynman technique: teach a concept in simple terms to surface gaps — where explanation breaks down reveals exactly what you don't understand yet.",
        "tags": ["learning", "Feynman", "mental models", "teaching"],
    },
    {
        "type": "link", "intent": "learn",
        "source_url": "https://karpathy.github.io/2019/04/25/recipe/",
        "raw": "https://karpathy.github.io/2019/04/25/recipe/",
        "summary": "Karpathy's neural net training recipe: start simple, overfit a single batch first, add complexity incrementally, visualize everything — a systematic debugging approach.",
        "tags": ["Karpathy", "deep learning", "training", "debugging"],
    },
    {
        "type": "text", "intent": "learn",
        "raw": "Second brain principle: your brain is for having ideas, not storing them. Offload facts and references so you can focus on synthesis and connections.",
        "summary": "The second brain principle: offload fact storage to an external system so cognitive resources are freed for synthesis, creativity, and making connections.",
        "tags": ["PKM", "second brain", "productivity", "knowledge management"],
    },
]


def run():
    existing = {c["raw"]: c for c in get_captures(limit=1000)}

    all_embs = get_all_embeddings()
    inserted = []

    for s in SEEDS:
        raw = s.get("raw") or s.get("source_url")
        if raw and raw in existing:
            print(f"  skip (exists): {s['summary'][:50]}")
            continue

        cid = save_capture(
            type=s["type"],
            raw=s.get("raw"),
            source_url=s.get("source_url"),
            file_path=None,
        )

        emb = embed(s["summary"])
        related = find_related(emb, all_embs, exclude_id=cid)

        update_capture(cid, s["summary"], s["tags"], s["intent"], emb, related)

        if emb:
            all_embs.append((cid, emb))

        print(f"  [{s['intent']:10}] {s['summary'][:60]}")
        inserted.append(cid)

    print(f"\nDone. Inserted {len(inserted)} captures.")

    # backfill embeddings on any existing captures missing them
    print("\nBackfilling embeddings on existing captures...")
    for c in get_captures(limit=1000):
        if c.get("embedding") or not c.get("summary"):
            continue
        print(f"  backfill {c['id']}...")
        emb = embed(c["summary"])
        related = find_related(emb, all_embs, exclude_id=c["id"])
        update_capture(c["id"], c["summary"], c["tags"], c.get("intent"), emb, related)
        if emb:
            all_embs.append((c["id"], emb))


if __name__ == "__main__":
    run()
