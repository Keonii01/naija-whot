"""Game event cues: the data the table needs. Run from the server folder:  python test_game_cues.py"""
import sys; sys.path.insert(0, '.')
import whot_engine as W

PAD = [('Star', 3)] * 3          # filler cards so nobody wins by emptying their hand

def game(n, hands, top=('Circle', 9), rules=None):
    g = W.WhotGame([W.Player(f"p{i}", f"P{i+1}") for i in range(n)], rules)
    for p, h in zip(g.players, hands):
        p.hand = [W.WhotCard(s, k) for s, k in h] + [W.WhotCard(*c) for c in PAD]
    g.discard_pile = [W.WhotCard(*top)]
    g.current_idx = 0
    g.pending_pick = 0
    g.pending_shape = None
    return g

def play(g, pid, picks):
    p, pool, ids = g.get_player(pid), None, []
    pool = list(p.hand)
    for s, k in picks:
        c = next(c for c in pool if c.shape == s and c.number == k); pool.remove(c); ids.append(c.id)
    return g.play_cards(pid, ids)

def ok(g, pid, picks):
    r = play(g, pid, picks); assert r["success"], r; return r

def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name); assert cond, name

def turn(g): return g.current_player().id
def hand(g, pid): return len(g.get_player(pid).hand)
B = len(PAD)

HOLD = {"hold_on_any_card": True}

# ---- free_play and pending_pick in game_state ----
g = game(2, [[('Circle',1),('Star',7)], []])
check("free_play is false at the start of a turn", g.state_for("p0")["free_play"] is False)
g = game(2, [[('Circle',1),('Star',7)], []], rules=HOLD); ok(g, "p0", [('Circle',1)])
check("any-card rule: after a Hold On, free_play is true for the player still on turn", turn(g) == "p0" and g.state_for("p0")["free_play"] is True and g.state_for("p1")["free_play"] is True)
ok(g, "p0", [('Star',7)])
check("free_play clears once the extra card is played", g.state_for("p1")["free_play"] is False and turn(g) == "p1")
g = game(2, [[('Circle',1),('Star',7)], []]); ok(g, "p0", [('Circle',1)])
check("standard rules: after a Hold On there is no free play", g.state_for("p0")["free_play"] is False)
g = game(2, [[('Circle',2)], []]); ok(g, "p0", [('Circle',2)])
st = g.state_for("p1")
check("pick two played: pending_pick is 2, aimed at the next player, top card is a 2", st["pending_pick"] == 2 and st["current_player_id"] == "p1" and st["top_card"]["number"] == 2)
r = g.draw_card("p1")
st = g.state_for("p0")
check("after the penalty is taken pending_pick is back to 0 and the turn moves on", r["success"] and st["pending_pick"] == 0 and st["current_player_id"] == "p0")

print("ALL PASSED")
