import io
import re
import json
import math
import base64
from openai import OpenAI
from PIL import Image
from config import LM_STUDIO_URL, LM_MODEL

EMBED_MODEL = "text-embedding-nomic-embed-text-v1.5"

client = OpenAI(base_url=LM_STUDIO_URL, api_key="lm-studio")

FALLBACK = {"summary": None, "tags": [], "intent": None}
INTENTS = ("learn", "act", "reference", "ephemeral")


def _loaded_model():
    if LM_MODEL:
        return LM_MODEL
    try:
        models = client.models.list()
        return models.data[0].id if models.data else None
    except Exception:
        return None


def _parse(text):
    try:
        text = text.strip()
        if text.startswith("```"):
            parts = text.split("```")
            # parts[1] is the content between first and second ```
            text = parts[1].lstrip("json").strip()
        return json.loads(text)
    except Exception:
        return FALLBACK


def _chat(messages, model):
    resp = client.chat.completions.create(model=model, messages=messages)
    return resp.choices[0].message.content


EXTRACT_PROMPT = """\
Extract key insights from the content below and classify it.

Intent options:
  learn = knowledge worth reinforcing over time
  act = something to do, buy, watch, or follow up on
  reference = useful to look up later but not critical to remember
  ephemeral = fun or transient, no need to resurface

{take_section}Reply ONLY with valid JSON. No markdown. Start with {{ and end with }}.
Format: {{"title": "3-6 word title", "summary": "one sentence capturing the core idea", "claims": ["distinct insight 1", "distinct insight 2", "distinct insight 3"], "tags": ["tag1", "tag2", "tag3"], "intent": "learn"}}

Rules:
- title: 3-6 words, like a book chapter title, not a sentence
- summary: single sentence, the most important idea
- claims: 2-5 distinct, specific insights (not restatements of each other). If the user provided their take, make the first claim reflect their perspective.
- tags: 3-5 short lowercase tags

Content:
"""


def _parse_rich(text: str) -> dict:
    """Parse extraction response that includes title, summary, claims."""
    try:
        text = text.strip()
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1].lstrip("json").strip()
        data = json.loads(text)
        claims = data.get("claims") or []
        if isinstance(claims, str):
            claims = [claims]
        return {
            "title": (data.get("title") or "").strip(),
            "summary": data.get("summary") or "",
            "claims": [str(c) for c in claims[:5] if c],
            "tags": data.get("tags") or [],
            "intent": data.get("intent"),
        }
    except Exception:
        return {**FALLBACK, "title": "", "claims": []}


def _build_take_section(your_take: str) -> str:
    if your_take and your_take.strip():
        return f'The person\'s own take: "{your_take.strip()}"\n\n'
    return ""


def process_text(content: str, your_take: str = "") -> dict:
    model = _loaded_model()
    if not model:
        return {**FALLBACK, "claims": []}
    try:
        take_section = _build_take_section(your_take)
        prompt = EXTRACT_PROMPT.format(take_section=take_section) + content
        raw = _chat([{"role": "user", "content": prompt}], model)
        return _parse_rich(raw)
    except Exception:
        return {**FALLBACK, "claims": []}


def process_link(url: str, page_text: str, your_take: str = "", page_title: str = "") -> dict:
    model = _loaded_model()
    if not model:
        return {**FALLBACK, "title": page_title, "claims": []}
    try:
        take_section = _build_take_section(your_take)
        title_hint = f"Page title: {page_title}\n" if page_title else ""
        content = f"URL: {url}\n{title_hint}\nContent:\n{page_text[:8000]}"
        prompt = EXTRACT_PROMPT.format(take_section=take_section) + content
        raw = _chat([{"role": "user", "content": prompt}], model)
        result = _parse_rich(raw)
        # Fall back to page title if LM didn't produce one
        if not result.get("title") and page_title:
            result["title"] = page_title
        return result
    except Exception:
        return {**FALLBACK, "title": page_title, "claims": []}


def embed(text: str) -> list:
    """Generate a 768-dim embedding for a piece of text."""
    try:
        resp = client.embeddings.create(model=EMBED_MODEL, input=text[:2000])
        return resp.data[0].embedding
    except Exception:
        return []


def _cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    mag = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(x * x for x in b))
    return dot / mag if mag else 0.0


SIMILARITY_THRESHOLD = 0.70

def find_related(embedding: list, all_embeddings: list, exclude_id: int, top_n: int = 3) -> list:
    """Return top_n most similar capture IDs above the similarity threshold."""
    if not embedding or not all_embeddings:
        return []
    scored = [
        (cid, _cosine(embedding, emb))
        for cid, emb in all_embeddings
        if cid != exclude_id
    ]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [cid for cid, score in scored[:top_n] if score >= SIMILARITY_THRESHOLD]


RECALL_QUESTION_PROMPT = """\
You are writing a spaced-repetition recall question for a personal knowledge note.

The question must:
- Target ONE specific, verifiable fact or insight from the note
- Be unanswerable without having actually read the note (not inferable from the question alone)
- Name the topic but not give away the answer
- Be a single sentence, max 15 words

Bad: "What is the main idea of this note?" (too generic)
Bad: "What does the article say about caching?" (answerable from the question)
Good: "What threshold triggers batch normalization instability according to this note?"

Note content:
{content}

Reply with ONLY the question. No quotes, no punctuation at the end.
"""

def generate_recall_question(summary: str, intent: str, claims: list = []) -> str:
    """Generate a recall question targeting a specific claim."""
    FALLBACKS = {
        "learn":     "What's the key insight here?",
        "act":       "What were you going to do?",
        "reference": "When would you reach for this?",
        "ephemeral": "Why did this catch your attention?",
    }
    model = _loaded_model()
    if not model or not summary:
        return FALLBACKS.get(intent, "What do you remember about this?")
    # Build content block: use claims if available (more specific targets)
    if claims:
        content = "Summary: " + summary + "\nKey claims:\n" + "\n".join(f"- {c}" for c in claims[:4])
    else:
        content = summary
    try:
        q = _chat([{"role": "user", "content": RECALL_QUESTION_PROMPT.format(content=content)}], model)
        q = q.strip().strip('"').strip("'").rstrip('.')
        if q and 10 < len(q) < 150:
            return q
    except Exception:
        pass
    return FALLBACKS.get(intent, "What do you remember about this?")


def _parse_extend(text: str) -> dict:
    """Robustly parse extend JSON — handles markdown fences, key variants, partial output."""
    text = re.sub(r'```json|```', '', text).strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            gap = str(data.get("gap") or data.get("gaps") or "").strip()
            questions = data.get("questions") or data.get("question") or []
            if isinstance(questions, str):
                questions = [questions]
            return {"gap": gap, "questions": list(questions)[:3]}
        except Exception:
            pass
    return {"gap": "", "questions": []}


SYNTHESIZE_PROMPT = """\
You are a personal knowledge assistant. The user asked: "{query}"

Here are their relevant notes (numbered):
{notes}

Write a concise answer (3-5 sentences) grounded strictly in these notes.
If the notes don't fully answer the question, say what they cover and what's missing.
Do not add knowledge beyond what is in the notes.
If any notes contradict each other on a key point, add one line at the end:
[TENSION: <note A says X, note B says Y>]
Reply in plain prose only. No bullet points, no headers, no markdown.\
"""

EXTEND_PROMPT = """\
The user is learning about: "{query}"

Their current knowledge from their notes:
{synthesis}

Reply ONLY with valid JSON. No markdown, no explanation. Start with {{ and end with }}.
Identify:
1. The single most important concept or gap NOT covered in their notes (1 sentence, "gap" key)
2. Three specific follow-up questions worth capturing answers to ("questions" key, array of 3 strings)

Example: {{"gap": "You haven't captured anything about ...", "questions": ["What is ...?", "How does ...?", "Why does ...?"]}}
"""


def synthesize_answer(query: str, captures: list) -> str:
    """LM synthesizes a grounded answer from the user's captures. Returns prose string."""
    model = _loaded_model()
    if not model or not captures:
        return ""
    notes = "\n".join(
        f"{i+1}. {c.get('summary') or c.get('raw') or ''}"
        for i, c in enumerate(captures)
        if c.get('summary') or c.get('raw')
    )
    if not notes.strip():
        return ""
    prompt = SYNTHESIZE_PROMPT.format(query=query, notes=notes)
    try:
        resp = _chat([{"role": "user", "content": prompt}], model)
        return resp.strip()[:1500]
    except Exception:
        return ""


FEYNMAN_PROMPT = """\
You are testing someone on their own notes about "{query}".

Their notes:
{notes}

Generate exactly 3 short questions (one sentence each) that test recall of the most important points in these notes.
Make each question specific — it should reference something actually in the notes, not be generic.
Reply ONLY with valid JSON. No markdown. Start with {{ and end with }}.
Example: {{"questions": ["What is X?", "Why does Y happen according to these notes?", "How does Z work?"]}}
"""

GRADE_PROMPT = """\
You are grading self-test answers based on someone's own notes.

IMPORTANT RULES:
- If an answer is blank, empty, or "(blank)", ALWAYS assign verdict "wrong" and feedback "No answer was provided."
- Do not infer or fill in what the person might have meant — grade only what they wrote.

Notes:
{notes}

Grade each Q&A pair below.
Verdict options: "right" (answer captures the key point), "partial" (incomplete or vague), "wrong" (missed the point or blank).
Provide 1-sentence feedback for each.
Reply ONLY with valid JSON. No markdown. Start with {{ and end with }}.
Example: {{"grades": [{{"verdict": "right", "feedback": "Correct, the notes say X."}}, ...]}}

Q&A pairs:
{qa_pairs}
"""

ARC_PROMPT = """\
The user has been capturing notes about "{query}" over multiple dates. Identify how their understanding evolved.

Notes sorted oldest first:
{notes_with_dates}

Find 2-4 distinct phases. For each:
- label: 2-4 words describing the phase (e.g. "First exposure", "Going deeper")
- insight: 1-2 sentences on what they understood in this phase
- start_date, end_date (YYYY-MM-DD from the note dates)
- capture_count: number of notes in this phase

Reply ONLY with valid JSON. No markdown. Start with {{ and end with }}.
Example: {{"periods": [{{"label": "...", "start_date": "...", "end_date": "...", "insight": "...", "capture_count": 2}}]}}
"""


def generate_feynman_questions(query: str, captures: list) -> list:
    model = _loaded_model()
    if not model or not captures:
        return []
    notes = "\n".join(
        f"{i+1}. {c.get('summary') or c.get('raw') or ''}"
        for i, c in enumerate(captures[:8])
        if c.get('summary') or c.get('raw')
    )
    if not notes.strip():
        return []
    try:
        resp = _chat([{"role": "user", "content": FEYNMAN_PROMPT.format(query=query, notes=notes)}], model)
        resp = re.sub(r'```json|```', '', resp).strip()
        m = re.search(r'\{.*\}', resp, re.DOTALL)
        if m:
            data = json.loads(m.group())
            qs = data.get("questions") or []
            return [str(q) for q in qs[:3] if q]
    except Exception:
        pass
    return []


def grade_feynman_answers(qa_pairs: list, captures: list) -> list:
    model = _loaded_model()
    if not model or not captures or not qa_pairs:
        return [{"verdict": "?", "feedback": "Could not grade."} for _ in qa_pairs]
    notes = "\n".join(
        f"{i+1}. {c.get('summary') or c.get('raw') or ''}"
        for i, c in enumerate(captures[:8])
        if c.get('summary') or c.get('raw')
    )
    qa_text = "\n".join(
        f"Q{i+1}: {p['question']}\nA{i+1}: {p.get('answer') or '(blank)'}"
        for i, p in enumerate(qa_pairs)
    )
    try:
        resp = _chat([{"role": "user", "content": GRADE_PROMPT.format(notes=notes, qa_pairs=qa_text)}], model)
        resp = re.sub(r'```json|```', '', resp).strip()
        m = re.search(r'\{.*\}', resp, re.DOTALL)
        if m:
            data = json.loads(m.group())
            grades = data.get("grades") or []
            result = [
                {"verdict": str(g.get("verdict") or "partial"), "feedback": str(g.get("feedback") or "")}
                for g in grades[:len(qa_pairs)]
            ]
            while len(result) < len(qa_pairs):
                result.append({"verdict": "?", "feedback": "Could not grade this answer."})
            return result
    except Exception:
        pass
    return [{"verdict": "?", "feedback": "Grading failed."} for _ in qa_pairs]


def generate_learning_arc(query: str, captures: list) -> list:
    model = _loaded_model()
    if not model or not captures:
        return []
    sorted_caps = sorted(captures, key=lambda c: c.get('created_at') or '')
    notes_with_dates = "\n".join(
        f"[{c.get('created_at', '')[:10]}] {c.get('summary') or c.get('raw') or ''}"
        for c in sorted_caps[:15]
        if c.get('summary') or c.get('raw')
    )
    if not notes_with_dates.strip():
        return []
    try:
        resp = _chat([{"role": "user", "content": ARC_PROMPT.format(query=query, notes_with_dates=notes_with_dates)}], model)
        resp = re.sub(r'```json|```', '', resp).strip()
        m = re.search(r'\{.*\}', resp, re.DOTALL)
        if m:
            data = json.loads(m.group())
            periods = data.get("periods") or []
            if isinstance(periods, list):
                return periods[:4]
    except Exception:
        pass
    return []


BRIEF_SYNTHESIS_PROMPT = """\
You are summarizing someone's personal knowledge captures for {date_label}.

They captured {count} item(s). Here is what they captured:
{notes}

Write a synthesis (3-4 sentences) speaking directly to them:
1. Name the main theme(s) across these captures
2. Surface the single most memorable insight
3. If captures span different areas, briefly connect them or note the contrast

Rules:
- Be specific — reference actual ideas from their captures, not generic summaries
- Write like a thoughtful friend reviewing their captures with them
- No bullet points, no headers, no markdown. Plain prose only.
"""

WEEKLY_SYNTHESIS_PROMPT = """\
Here are someone's daily synthesis notes from the past week:

{daily_entries}

Write a weekly synthesis (4-5 sentences) speaking directly to them:
1. What theme or idea kept resurfacing across different days?
2. How did any idea evolve or deepen from one day to the next?
3. Any surprising connection between things captured on different days?

Rules:
- Be specific — name the actual ideas, not just "you explored X"
- Surface something they might not have noticed themselves
- No bullet points, no headers, no markdown. Plain prose only.
"""


def generate_weekly_synthesis(daily_entries: list) -> str:
    """Takes [{date, synthesis, count}], returns a week-in-review paragraph."""
    model = _loaded_model()
    if not model or not daily_entries:
        return ""
    lines = "\n".join(
        f"{e['date']} ({e.get('count', '?')} captures): {e['synthesis']}"
        for e in daily_entries
        if e.get('synthesis', '').strip()
    )
    if not lines.strip():
        return ""
    prompt = WEEKLY_SYNTHESIS_PROMPT.format(daily_entries=lines)
    try:
        resp = _chat([{"role": "user", "content": prompt}], model)
        return resp.strip()[:900]
    except Exception:
        return ""


def generate_brief_synthesis(captures: list, date_label: str = "") -> str:
    model = _loaded_model()
    if not model or not captures:
        return ""
    notes = "\n".join(
        f"- [{c.get('intent', '?')}] {c.get('title') or ''}: {c.get('summary') or c.get('raw') or ''}".strip()
        for c in captures
        if c.get('summary') or c.get('raw')
    )
    if not notes.strip():
        return ""
    prompt = BRIEF_SYNTHESIS_PROMPT.format(
        date_label=date_label or "today",
        count=len(captures),
        notes=notes,
    )
    try:
        resp = _chat([{"role": "user", "content": prompt}], model)
        return resp.strip()[:800]
    except Exception:
        return ""


def generate_extend(query: str, synthesis: str) -> dict:
    """LM identifies gaps and generates follow-up questions. Returns {gap, questions}."""
    model = _loaded_model()
    if not model or not synthesis:
        return {"gap": "", "questions": []}
    prompt = EXTEND_PROMPT.format(query=query, synthesis=synthesis)
    try:
        resp = _chat([{"role": "user", "content": prompt}], model)
        return _parse_extend(resp)
    except Exception:
        return {"gap": "", "questions": []}


def process_image(file_path: str, description: str = "", your_take: str = "") -> dict:
    model = _loaded_model()
    if not model:
        return {**FALLBACK, "claims": []}
    try:
        img = Image.open(file_path).convert("RGB")
        max_dim = 768
        if max(img.width, img.height) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode()
        mime = "image/jpeg"
        user_note = f'\nUser note: "{description}"' if description.strip() else ""
        take_note = f'\nUser\'s take: "{your_take.strip()}"' if your_take.strip() else ""
        resp = client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Describe what is in this image and extract key information and insights.\n"
                            "Intent options: learn (reinforce over time) | act (to do/follow-up) | reference (look up later) | ephemeral (fun/transient)\n"
                            f"{user_note}{take_note}\n"
                            "Reply ONLY with valid JSON. No markdown.\n"
                            '{"summary": "one sentence core idea", "claims": ["insight 1", "insight 2"], "tags": ["tag1", "tag2"], "intent": "learn"}'
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                ],
            }],
        )
        return _parse_rich(resp.choices[0].message.content)
    except Exception:
        return {**FALLBACK, "claims": []}
