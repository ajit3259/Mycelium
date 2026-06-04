import json
import math
import base64
from openai import OpenAI
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


def find_related(embedding: list, all_embeddings: list, exclude_id: int, top_n: int = 3) -> list:
    """
    Given an embedding and a list of (id, embedding) pairs,
    return the top_n most similar capture IDs (excluding self).
    """
    if not embedding or not all_embeddings:
        return []
    scored = [
        (cid, _cosine(embedding, emb))
        for cid, emb in all_embeddings
        if cid != exclude_id
    ]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [cid for cid, _ in scored[:top_n]]


def process_image(file_path: str) -> dict:
    model = _loaded_model()
    if not model:
        return FALLBACK
    try:
        with open(file_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        ext = file_path.rsplit(".", 1)[-1].lower()
        mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
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
