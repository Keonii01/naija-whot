"""Computer player.

The strategy only ever sees a BotView: its own hand, the top card, the called shape, any pending
penalty, and HOW MANY cards each opponent holds. It never sees another hand or the market.
It only decides what to do; the server then carries the move out through the normal engine calls,
so every rule (and every house rule) is enforced by the engine, never here.
"""
import random
from collections import Counter
from itertools import permutations

SHAPES = ["Circle", "Triangle", "Cross", "Square", "Star"]


class BotView:
    """Everything a human at the table could know, and nothing more."""
    __slots__ = ("hand", "last_card_called", "playable", "top", "pending_pick", "pending_shape",
                 "free_play", "rules", "opponent_counts", "can_draw", "is_action")


def make_view(game, player_id):
    me = game.get_player(player_id)
    v = BotView()
    v.hand = list(me.hand)
    v.last_card_called = me.last_card_called
    v.playable = game.playable_cards(me)
    v.top = game.top_card
    v.pending_pick = game.pending_pick
    v.pending_shape = game.pending_shape
    v.free_play = game.free_play
    v.rules = dict(game.rules)
    v.opponent_counts = [len(p.hand) for p in game.players if p.id != player_id]   # counts only
    v.can_draw = game._can_draw()
    v.is_action = game.is_action
    return v


def _best_shape(cards, rng):
    """The shape this hand holds most of (ignoring Whot cards)."""
    counts = Counter(c.shape for c in cards if c.shape != "Whot")
    if not counts:
        return rng.choice(SHAPES)
    top = max(counts.values())
    return rng.choice([s for s, n in counts.items() if n == top])


def _order(v, group, rest, rng):
    """Order a same-number combo: the first card must be playable; the last one becomes the top card,
    so end on the shape we hold most of in the rest of the hand."""
    playable_ids = {c.id for c in v.playable}
    best, best_val = None, -1.0
    for perm in permutations(group):
        if perm[0].id not in playable_ids:
            continue
        val = sum(1 for c in rest if c.shape == perm[-1].shape) + rng.random() * 0.1
        if val > best_val:
            best, best_val = list(perm), val
    return best


def _score(v, group, rest, rng):
    n = group[0].number
    if n == 20:                                    # Whot: strongest when the hand is nearly empty
        score = 1.0 + (4.0 if len(v.hand) <= 3 else -4.0)
        if not rest:
            score -= 6.0                           # an action card as the final card does not win
        return score + rng.random() * 0.1
    score = len(group) * 2.0                       # shedding more cards is better
    if v.is_action(n):
        if not rest:
            score -= 6.0                           # would finish on an action card: no win
        elif len(rest) == 1 and v.is_action(rest[0].number):
            score -= 3.0                           # would be stuck with an action card as the last one
        tight = min(v.opponent_counts) <= 3 if v.opponent_counts else False
        if n in (2, 5, 14):
            score += 2.0 if tight else 0.8         # penalties hurt most when someone is close to winning
        elif n == 8:
            score += 0.6
        elif n == 1:
            score += 1.5                           # plays again
    return score + rng.random() * 0.1


def choose_action(v, rng=random):
    """Returns {'action': 'last_card'} | {'action': 'draw'} | {'action': 'play', 'card_ids': [...], 'shape': str|None}"""
    if len(v.hand) == 1 and not v.last_card_called:
        return {"action": "last_card"}
    if not v.playable:
        return {"action": "draw"}

    # a live penalty: answer it with every matching card we hold (they are all the same number)
    if v.pending_pick > 0:
        group = list(v.playable)
        rest = [c for c in v.hand if c.id not in {g.id for g in group}]
        cards = _order(v, group, rest, rng)
        return {"action": "play", "card_ids": [c.id for c in cards], "shape": None}

    by_number = {}
    for c in v.hand:
        by_number.setdefault(c.number, []).append(c)
    options = []
    for n in {c.number for c in v.playable}:
        if n == 20:
            options += [([c], c) for c in v.playable if c.number == 20]
        else:
            options.append((by_number[n], None))

    best, best_score = None, None
    for group, _ in options:
        ids = {g.id for g in group}
        rest = [c for c in v.hand if c.id not in ids]
        s = _score(v, group, rest, rng)
        if best_score is None or s > best_score:
            best, best_score = (group, rest), s

    group, rest = best
    if group[0].number == 20:
        return {"action": "play", "card_ids": [group[0].id], "shape": _best_shape(rest, rng)}
    cards = _order(v, group, rest, rng)
    return {"action": "play", "card_ids": [c.id for c in cards], "shape": None}


# ---------------- names ----------------
_TITLES = ["Chief", "Odogwu", "Oga", "Baba", "Mama", "Aunty", "Uncle", "Alhaji", "Sir", "Madam",
           "Prof", "Kabiyesi", "General", "Captain", "Boss", "Elder"]
_WORDS = ["Jollof", "Suya", "Egusi", "Agege", "Danfo", "Whot", "Ace", "Zaza", "Pepper", "Ankara",
          "Lagos", "Eko", "Naija", "Gala", "Akara", "Plantain", "Okada", "Garri", "Sharp", "Wahala",
          "Shaku", "Kpomo", "Bole", "Zobo"]


def random_bot_name(taken=(), rng=random):
    """A fresh name that isn't in `taken`: a bare title like 'Chief' or 'Odogwu', or a combination such
    as 'Chief Jollof'. 16 titles x 24 words gives hundreds of names, so a room never runs out."""
    used = {t.lower() for t in taken}
    for _ in range(200):
        name = rng.choice(_TITLES) if rng.random() < 0.35 else f"{rng.choice(_TITLES)} {rng.choice(_WORDS)}"
        if len(name) <= 16 and name.lower() not in used:
            return name
    n = 1
    while f"Player {n}".lower() in used:
        n += 1
    return f"Player {n}"
