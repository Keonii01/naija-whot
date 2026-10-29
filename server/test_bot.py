"""Bot checks. Run from the server folder:  python test_bot.py"""
import sys, random, itertools
sys.path.insert(0, '.')
import whot_engine as W
import bot

def random_action(v, rng=random):
    """Baseline opponent: any legal single card, calls Last Card, otherwise draws."""
    if len(v.hand) == 1 and not v.last_card_called: return {"action": "last_card"}
    if not v.playable: return {"action": "draw"}
    c = rng.choice(v.playable)
    return {"action": "play", "card_ids": [c.id], "shape": rng.choice(bot.SHAPES) if c.number == 20 else None}

def run_game(n, rules, strategies, cap=4000):
    g = W.WhotGame([W.Player(f"p{i}", f"P{i}") for i in range(n)], rules)
    steps = 0
    while not g.game_over and steps < cap:
        steps += 1
        cur = g.current_player()
        act = strategies[int(cur.id[1:])](bot.make_view(g, cur.id))
        if act["action"] == "last_card": r = g.call_last_card(cur.id)
        elif act["action"] == "draw": r = g.draw_card(cur.id)
        else: r = g.play_cards(cur.id, act["card_ids"], act["shape"])
        if not r.get("success"):
            return g, steps, f"illegal/failed action {act['action']}: {r}"
    return g, steps, None if g.game_over else "game never ended"

def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name); assert cond, name

# 1. the view never contains another player's cards
g = W.WhotGame([W.Player("p0","A"), W.Player("p1","B"), W.Player("p2","C")])
v = bot.make_view(g, "p0")
check("view: opponents are only card counts", v.opponent_counts == [len(g.players[1].hand), len(g.players[2].hand)]
      and all(isinstance(x, int) for x in v.opponent_counts))
check("view: the view has no field that exposes the market or other hands", set(bot.BotView.__slots__) == {"hand","last_card_called","playable","top","pending_pick","pending_shape","free_play","rules","opponent_counts","can_draw","is_action"})

# 2. bots play complete games under every player count and house-rule combination
random.seed(7)
games = fails = 0
ended_by = {}
for n in range(2, 9):
    for p3, can, hold in itertools.product([True, False], repeat=3):
        rules = {"pick_three_action": p3, "cancel_penalties": can, "hold_on_any_card": hold}
        for _ in range(12):
            g, steps, err = run_game(n, rules, [bot.choose_action] * n)
            games += 1
            if err:
                fails += 1; print("  PROBLEM:", n, rules, err)
            else:
                ended_by[g.end_reason] = ended_by.get(g.end_reason, 0) + 1
check(f"sim: {games} bot-vs-bot games (2-8 players x 8 rule sets) all finished with no illegal move", fails == 0)
print("     how the games ended:", ended_by)

# 3. the bot is actually better than a random player (2 players, standard rules, alternating seats)
wins = 0; total = 600
for i in range(total):
    seat = i % 2
    strat = [random_action, random_action]; strat[seat] = bot.choose_action
    g, steps, err = run_game(2, None, strat)
    assert not err, err
    wins += g.winner_id == f"p{seat}"
print(f"     bot beats a random player {wins}/{total} = {100*wins//total}%")
check("strength: bot wins clearly more than half against random play", wins / total > 0.6)

# 4. names: never run out, unique, fit the 16-character limit
random.seed(1)
taken = []
for _ in range(7): taken.append(bot.random_bot_name(taken))
check("names: 7 unique names, each within 16 characters", len(set(taken)) == 7 and all(len(t) <= 16 for t in taken))
many = set()
t = []
for _ in range(300): many.add(bot.random_bot_name([], random))
check(f"names: plenty of variety ({len(many)} different names from 300 draws)", len(many) > 150)
check("names: falls back safely if everything is taken", bot.random_bot_name([f"{a} {b}" for a in bot._TITLES for b in bot._WORDS] + bot._TITLES).startswith("Player "))
print("ALL PASSED")
