"""Pick-penalty and suspension rules. Run from the server folder:  python test_pick_rules.py"""
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

# ---- 2 players: cancel ----
g = game(2, [[('Circle',5)], [('Triangle',5)]])
ok(g,"p0",[('Circle',5)]); check("2P: one 5 faces the other player (3 pending)", g.pending_pick == 3 and turn(g) == "p1")
ok(g,"p1",[('Triangle',5)]); check("2P: 5 vs 5 cancels, nobody picks, turn back to attacker", g.pending_pick == 0 and turn(g) == "p0" and hand(g,"p1") == B and hand(g,"p0") == B)

g = game(2, [[('Circle',2)], [('Triangle',2)]])
ok(g,"p0",[('Circle',2)]); ok(g,"p1",[('Triangle',2)]); check("2P: 2 vs 2 cancels", g.pending_pick == 0 and turn(g) == "p0")

# ---- 2 players: counter has fewer -> counterer picks leftover now ----
g = game(2, [[('Circle',5),('Square',5)], [('Triangle',5)]])
ok(g,"p0",[('Circle',5),('Square',5)]); check("2P: two 5s = 6 pending", g.pending_pick == 6)
ok(g,"p1",[('Triangle',5)]); check("2P: two 5s vs one 5: counterer picks 3, turn to attacker", g.pending_pick == 0 and hand(g,"p1") == B + 3 and turn(g) == "p0")

# ---- 2 players: counter has more -> leftover back on the attacker, live ----
g = game(2, [[('Circle',5),('Square',5)], [('Triangle',5),('Star',5),('Cross',5)]])
ok(g,"p0",[('Circle',5),('Square',5)]); ok(g,"p1",[('Triangle',5),('Star',5),('Cross',5)])
check("2P: two 5s vs three 5s: one unit (3) comes back to the attacker", g.pending_pick == 3 and turn(g) == "p0" and hand(g,"p1") == B)
r = g.draw_card("p0"); check("2P: attacker with no 5 picks the 3, turn to the other player", r["success"] and hand(g,"p0") == B + 3 and g.pending_pick == 0 and turn(g) == "p1")

# ---- ...and the attacker CAN counter again ----
g = game(2, [[('Circle',5),('Square',5),('Triangle',5)], [('Star',5),('Cross',5),('Circle',5)]])
ok(g,"p0",[('Circle',5),('Square',5)]); ok(g,"p1",[('Star',5),('Cross',5),('Circle',5)])
check("2P: leftover is live against the attacker", g.pending_pick == 3 and turn(g) == "p0")
ok(g,"p0",[('Triangle',5)]); check("2P: attacker counters the leftover with another 5: cancelled", g.pending_pick == 0 and turn(g) == "p1")

# ---- no mixing 2 and 5 ----
g = game(2, [[('Circle',5)], [('Triangle',2)]])
ok(g,"p0",[('Circle',5)]); r = play(g,"p1",[('Triangle',2)])
check("2P: a 2 cannot be played on a 5 penalty", not r["success"] and g.pending_pick == 3)

# ---- 3 players: redirection unchanged ----
g = game(3, [[('Circle',5)], [('Triangle',5)], []])
ok(g,"p0",[('Circle',5)]); ok(g,"p1",[('Triangle',5)]); check("3P: 5 then 5 -> third player faces 6", g.pending_pick == 6 and turn(g) == "p2")
g = game(3, [[('Circle',2)], [('Triangle',2)], []])
ok(g,"p0",[('Circle',2)]); ok(g,"p1",[('Triangle',2)]); check("3P: 2 then 2 -> third player faces 4", g.pending_pick == 4 and turn(g) == "p2")

# ---- suspension ----
g = game(3, [[('Circle',8)], [], []]); ok(g,"p0",[('Circle',8)]); check("3P: one 8 -> third player", turn(g) == "p2")
g = game(3, [[('Circle',8),('Triangle',8)], [], []]); ok(g,"p0",[('Circle',8),('Triangle',8)]); check("3P: two 8s -> back to the suspender", turn(g) == "p0")
g = game(2, [[('Circle',8)], []]); ok(g,"p0",[('Circle',8)]); check("2P: one 8 -> suspender plays again", turn(g) == "p0")
g = game(2, [[('Circle',8),('Triangle',8)], []]); ok(g,"p0",[('Circle',8),('Triangle',8)]); check("2P: two 8s -> suspender plays again", turn(g) == "p0")
# ---- rule option: Pick Three is NOT an action card ----
OFF = {"pick_three_action": False}
g = game(2, [[('Circle',5)], []], rules=OFF); ok(g,"p0",[('Circle',5)])
check("opt: with Pick Three off, a 5 is an ordinary card (no penalty, normal turn)", g.pending_pick == 0 and turn(g) == "p1")
g = game(2, [[('Circle',2)], []], rules=OFF); ok(g,"p0",[('Circle',2)])
check("opt: Pick Two still works with Pick Three off", g.pending_pick == 2 and turn(g) == "p1")
g = game(2, [[], []], rules=OFF); a = g.get_player("p0"); a.hand = [W.WhotCard('Circle',5)]; a.last_card_called = True
r = play(g,"p0",[('Circle',5)]); check("opt: with Pick Three off, a 5 can be your winning last card", r.get("game_over") and g.winner_id == "p0")
g = game(2, [[], []]); a = g.get_player("p0"); a.hand = [W.WhotCard('Circle',5)]; a.last_card_called = True
r = play(g,"p0",[('Circle',5)]); check("opt: with Pick Three on (default), a 5 as last card does not win", not r.get("game_over"))
for _ in range(30):   # the start card is never an action card, per the room's rules
    g = game(2, [[], []], rules=OFF)
    g2 = W.WhotGame([W.Player("a","A"), W.Player("b","B")], OFF); assert not g2.is_action(g2.top_card.number)
check("opt: start card is never an action card (30 deals)", True)

# ---- rule option: penalties cancel with 3+ players ----
CAN = {"cancel_penalties": True}
g = game(3, [[('Circle',5)], [('Triangle',5)], []], rules=CAN); ok(g,"p0",[('Circle',5)]); ok(g,"p1",[('Triangle',5)])
check("opt: cancel variant, 3P: 5 vs 5 cancels, third player plays on", g.pending_pick == 0 and turn(g) == "p2")
g = game(3, [[('Circle',5),('Square',5)], [('Triangle',5)], []], rules=CAN); ok(g,"p0",[('Circle',5),('Square',5)]); ok(g,"p1",[('Triangle',5)])
check("opt: cancel variant, 3P: two 5s vs one 5 -> third player faces 3", g.pending_pick == 3 and turn(g) == "p2")
g = game(3, [[('Circle',5)], [('Triangle',5),('Star',5)], []], rules=CAN); ok(g,"p0",[('Circle',5)]); ok(g,"p1",[('Triangle',5),('Star',5)])
check("opt: cancel variant, 3P: one 5 vs two 5s -> third player faces 3", g.pending_pick == 3 and turn(g) == "p2")
g = game(3, [[('Circle',2)], [('Triangle',2)], []], rules=CAN); ok(g,"p0",[('Circle',2)]); ok(g,"p1",[('Triangle',2)])
check("opt: cancel variant, 3P: 2 vs 2 cancels", g.pending_pick == 0 and turn(g) == "p2")
g = game(3, [[('Circle',5)], [], []], rules=CAN); ok(g,"p0",[('Circle',5)])
check("opt: cancel variant: a first penalty still goes to the next player", g.pending_pick == 3 and turn(g) == "p1")

# ---- junk rules are ignored ----
check("opt: junk rules fall back to defaults", W.clean_rules({"pick_three_action": "no", "evil": True}) == W.DEFAULT_RULES and W.clean_rules("x") == W.DEFAULT_RULES)
print("ALL PASSED")
