import random
from datetime import datetime


RESURFACE_AFTER = {
    "act": 1,
    "learn": 3,
    "reference": 7,
}

INTENT_WEIGHT = {
    "act": 100,
    "learn": 70,
    "reference": 40,
    "ephemeral": 30,
}

# Mood adjusts intent weights. Missing keys = use default above.
MOOD_OVERRIDES = {
    "focused":  {"act": 150, "learn": 60,  "reference": 30,  "ephemeral": -1},   # task mode, no distractions
    "curious":  {"act": 40,  "learn": 150, "reference": 80,  "ephemeral": 30},   # deep learning mode
    "restless": {"act": 30,  "learn": 60,  "reference": 80,  "ephemeral": 150},  # variety/browse, suppress tasks
    "tired":    {"act": -1,  "learn": 30,  "reference": 80,  "ephemeral": 120},  # no tasks, light content only
    "inspired": {"act": 100, "learn": 120, "reference": 40,  "ephemeral": 60},   # creative energy, learn + act
}


def _days_since(dt_str):
    if not dt_str:
        return 999
    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        return (datetime.now() - dt).days
    except Exception:
        return 999


def score(capture, mood=None):
    intent = capture.get("intent", "reference")

    weights = MOOD_OVERRIDES.get(mood, INTENT_WEIGHT) if mood else INTENT_WEIGHT
    weight = weights.get(intent, INTENT_WEIGHT.get(intent, 40))

    if weight < 0:
        return -1

    days_since_surfaced = _days_since(capture.get("last_surfaced_at"))
    days_since_created = _days_since(capture.get("created_at"))
    threshold = RESURFACE_AFTER.get(intent, 3)

    if days_since_surfaced < threshold:
        return -1

    novelty = 80 if capture.get("last_surfaced_at") is None else 0
    age_bonus = min(days_since_created * 2, 60)
    jitter = random.randint(0, 15)

    return weight + novelty + age_bonus + jitter


def pick(captures, n=3, mode=None, mood=None):
    """
    Score and pick top-n captures to surface.
    mode:  None | 'learn' | 'act' | 'reference' — hard intent filter
    mood:  None | 'focused' | 'learning' | 'browsing' | 'bored' — adjusts weights
    """
    pool = captures
    if mode in ("learn", "act", "reference"):
        pool = [c for c in captures if c.get("intent") == mode]
        if len(pool) < n:
            pool = captures

    scored = [(score(c, mood=mood), c) for c in pool]
    scored.sort(key=lambda x: x[0], reverse=True)

    eligible = [(s, c) for s, c in scored if s >= 0]
    if eligible:
        return [c for _, c in eligible[:n]]

    return [c for _, c in scored[:n]]
