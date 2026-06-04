import random
from datetime import datetime


# How many days before each intent type is ready to resurface
RESURFACE_AFTER = {
    "act": 1,       # comes back every day until done
    "learn": 3,     # spaced — starts at 3 days, grows naturally
    "reference": 7,
}

INTENT_WEIGHT = {
    "act": 100,
    "learn": 70,
    "reference": 40,
}


def _days_since(dt_str):
    if not dt_str:
        return 999
    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        return (datetime.now() - dt).days
    except Exception:
        return 999


def score(capture):
    intent = capture.get("intent", "reference")
    weight = INTENT_WEIGHT.get(intent, 40)

    days_since_surfaced = _days_since(capture.get("last_surfaced_at"))
    days_since_created = _days_since(capture.get("created_at"))
    threshold = RESURFACE_AFTER.get(intent, 3)

    # not yet ready to resurface
    if days_since_surfaced < threshold:
        return -1

    # never surfaced gets a big bonus
    novelty = 80 if capture.get("last_surfaced_at") is None else 0

    # age bonus — older unsurfaced items slowly rise
    age_bonus = min(days_since_created * 2, 60)

    # small jitter so the order isn't identical every time
    jitter = random.randint(0, 15)

    return weight + novelty + age_bonus + jitter


def pick(captures, n=3, mode=None):
    """
    Score and pick top-n captures to surface.
    mode: None | 'learn' | 'act' | 'reference' — filters by intent when set.
    Always returns something if the pool is non-empty.
    """
    pool = captures
    if mode in ("learn", "act", "reference"):
        pool = [c for c in captures if c.get("intent") == mode]
        if len(pool) < n:
            pool = captures

    scored = [(score(c), c) for c in pool]
    scored.sort(key=lambda x: x[0], reverse=True)

    eligible = [(s, c) for s, c in scored if s >= 0]
    if eligible:
        return [c for _, c in eligible[:n]]

    # everything recently surfaced — return top-n anyway, ignoring threshold
    return [c for _, c in scored[:n]]
