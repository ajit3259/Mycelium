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


EXTRACT_PROMPT = (
    "Extract the single most important insight from the content below "
    "and suggest 3-5 short tags. "
    "Also classify the intent as one of: learn, act, reference, ephemeral.\n"
    "  learn = knowledge worth reinforcing over time\n"
    "  act = something to do, buy, watch, or follow up on\n"
    "  reference = useful to look up later but not critical to remember\n"
    "  ephemeral = fun or transient, no need to resurface\n"
    'Reply ONLY with valid JSON: {"summary": "...", "tags": ["..."], "intent": "learn"}.\n\n'
)


def process_text(content: str) -> dict:
    model = _loaded_model()
    if not model:
        return FALLBACK
    try:
        raw = _chat(
            [{"role": "user", "content": EXTRACT_PROMPT + content}], model
        )
        return _parse(raw)
    except Exception:
        return FALLBACK


def process_link(url: str, page_text: str) -> dict:
    model = _loaded_model()
    if not model:
        return FALLBACK
    try:
        prompt = (
            EXTRACT_PROMPT
            + f"URL: {url}\n\nContent:\n{page_text[:3000]}"
        )
        raw = _chat([{"role": "user", "content": prompt}], model)
        return _parse(raw)
    except Exception:
        return FALLBACK


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


RECALL_QUESTION_PROMPT = (
    "Given this summary, write a single short question (max 12 words) that would prompt someone "
    "to recall this specific insight from memory. The question should be specific to the content, "
    "not generic. Reply with ONLY the question, no quotes, no punctuation at the end.\n\nSummary: "
)

def generate_recall_question(summary: str, intent: str) -> str:
    """Generate a recall question for a capture. Falls back to intent-based template."""
    FALLBACKS = {
        "learn":     "What's the key insight here?",
        "act":       "What were you going to do?",
        "reference": "When would you reach for this?",
        "ephemeral": "Why did this catch your attention?",
    }
    model = _loaded_model()
    if not model or not summary:
        return FALLBACKS.get(intent, "What do you remember about this?")
    try:
        q = _chat([{"role": "user", "content": RECALL_QUESTION_PROMPT + summary}], model)
        q = q.strip().strip('"').strip("'")
        if q and len(q) < 120:
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


def process_image(file_path: str, description: str = "") -> dict:
    model = _loaded_model()
    if not model:
        return FALLBACK
    try:
        img = Image.open(file_path).convert("RGB")
        max_dim = 768
        if max(img.width, img.height) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode()
        mime = "image/jpeg"
        user_note = f'\nThe user added this note: "{description}"' if description.strip() else ""
        resp = client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Describe what is in this image. Extract any visible text or key information. "
                            "Suggest 3-5 short tags. "
                            "Classify intent as one of: learn, act, reference, ephemeral.\n"
                            "  learn = knowledge worth reinforcing | act = something to do/follow-up "
                            "| reference = useful to look up | ephemeral = fun/transient\n"
                            f"{user_note}\n"
                            'Reply ONLY with valid JSON: {"summary": "...", "tags": ["..."], "intent": "learn"}.'
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                ],
            }],
        )
        return _parse(resp.choices[0].message.content)
    except Exception:
        return FALLBACK
