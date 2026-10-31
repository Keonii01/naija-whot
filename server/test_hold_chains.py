"""Hold On chain rules. Run from the server folder:  python test_hold_chains.py"""
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
def ids(g, pid): return {c.id for c in g.playable_cards(g.get_player(pid))}

# ---- Hold On chains (1s then one more card, in one go) ----
g = game(2, [[('Circle',1),('Circle',7)], []]); r = play(g,"p0",[('Circle',1),('Circle',7)])
check("chain: 1 + same-shape card plays together, turn moves on", r["success"] and g.top_card.number == 7 and turn(g) == "p1" and hand(g,"p0") == B)
g = game(2, [[('Circle',1),('Triangle',1),('Triangle',9)], []]); r = play(g,"p0",[('Circle',1),('Triangle',1),('Triangle',9)])
check("chain: two Hold Ons, the LAST 1 decides the shape", r["success"] and g.top_card.shape == 'Triangle' and turn(g) == "p1")
g = game(2, [[('Circle',1),('Triangle',9)], []]); r = play(g,"p0",[('Circle',1),('Triangle',9)])
check("chain: a final card that does not fit the 1 is refused, nothing moves", not r["success"] and hand(g,"p0") == B + 2 and g.top_card.shape == 'Circle' and g.top_card.number == 9)
g = game(2, [[('Circle',1),('Triangle',1),('Circle',9)], []]); r = play(g,"p0",[('Circle',1),('Triangle',1),('Circle',9)])
check("chain: shape of the first 1 does not count if another 1 comes last", not r["success"] and hand(g,"p0") == B + 3)
g = game(2, [[('Circle',1),('Star',9)], []], rules=HOLD); r = play(g,"p0",[('Circle',1),('Star',9)])
check("chain: any-card rule lets any card follow", r["success"] and g.top_card.shape == 'Star')
g = game(2, [[('Circle',1),('Whot',20)], []]); wid = [c.id for c in g.get_player("p0").hand if c.number in (1,20)]
r = g.play_cards("p0", wid, 'Star'); check("chain: Whot can follow a 1 with a called shape", r["success"] and g.pending_shape == 'Star' and turn(g) == "p1")
g = game(2, [[('Circle',1),('Whot',20)], []]); r = g.play_cards("p0", [c.id for c in g.get_player("p0").hand if c.number in (1,20)])
check("chain: Whot without a shape is refused, nothing moves", not r["success"] and hand(g,"p0") == B + 2)
g = game(2, [[('Circle',1),('Circle',2)], []]); ok(g,"p0",[('Circle',1),('Circle',2)])
check("chain: the final card's effect fires (Pick Two)", g.pending_pick == 2 and turn(g) == "p1")
g = game(2, [[('Circle',1),('Circle',8)], []]); ok(g,"p0",[('Circle',1),('Circle',8)])
check("chain: final Suspension lets the player go again (2 players)", turn(g) == "p0")
g = game(2, [[('Circle',1),('Circle',3),('Circle',4)], []]); r = play(g,"p0",[('Circle',1),('Circle',3),('Circle',4)])
check("chain: only one final card (two non-1 cards are refused)", not r["success"])
g = game(2, [[('Circle',1),('Triangle',3)], []]); r = play(g,"p0",[('Triangle',3),('Circle',1)])
check("chain: the 1 must come first", not r["success"])
g = game(2, [[('Star',1),('Circle',3)], []], top=('Circle',9)); r = play(g,"p0",[('Star',1),('Circle',3)])
check("chain: the first 1 must itself be playable on the top card", r["success"] is False or g.top_card.number == 3)
g = game(2, [[('Circle',2),('Circle',1)], []]); g.pending_pick = 2; g.discard_pile = [W.WhotCard('Circle',2)]
r = play(g,"p0",[('Circle',1),('Circle',2)]); check("chain: no Hold On while a Pick penalty is live", not r["success"])
# winning with a chain: whole hand, no Last Card call needed
g = W.WhotGame([W.Player("p0","P1"), W.Player("p1","P2")])
g.get_player("p0").hand = [W.WhotCard('Circle',1), W.WhotCard('Circle',7)]
g.get_player("p1").hand = [W.WhotCard('Star',3)] * 2
g.discard_pile = [W.WhotCard('Circle',9)]; g.current_idx = 0; g.pending_pick = 0; g.pending_shape = None
r = play(g,"p0",[('Circle',1),('Circle',7)]); check("chain: emptying the hand wins with no Last Card call", r["success"] and g.game_over and g.winner_id == "p0")
g = W.WhotGame([W.Player("p0","P1"), W.Player("p1","P2")])
g.get_player("p0").hand = [W.WhotCard('Circle',1), W.WhotCard('Circle',8)]
g.get_player("p1").hand = [W.WhotCard('Star',3)] * 2
g.discard_pile = [W.WhotCard('Circle',9)]; g.current_idx = 0; g.pending_pick = 0; g.pending_shape = None
r = play(g,"p0",[('Circle',1),('Circle',8)]); check("chain: an action card as the final card does not win", r["success"] and not g.game_over)
# ---- extend: what can be added next, from the server ----
def nxt(g, pid, ids): return set(g.next_cards(pid, ids))
def cid(g, pid, shape, number): return next(c.id for c in g.get_player(pid).hand if c.shape == shape and c.number == number)

g = game(2, [[('Circle',1),('Circle',7),('Triangle',7),('Whot',20),('Triangle',1)], []])
ext = g.state_for("p0")["extend"]; p0 = g.get_player("p0")
c1 = cid(g, "p0", 'Circle', 1)
want = {c.id for c in p0.hand if (c.shape == 'Circle' and c.number == 7) or c.shape == 'Whot' or (c.number == 1 and c.shape == 'Triangle')}
check("extend: a Hold On lists the other 1, same-shape cards and Whot", set(ext[c1]) == want)
check("extend: only the player on turn gets it", g.state_for("p1")["extend"] == {})
g = game(2, [[('Circle',1),('Triangle',7)], []], rules=HOLD)
one = cid(g, "p0", 'Circle', 1)
check("extend: any-card rule lets any card follow a Hold On", nxt(g, "p0", [one]) == {c.id for c in g.get_player("p0").hand if c.id != one})
g = game(2, [[('Circle',4),('Star',6)], []])
check("extend: a plain card has nothing after it", g.state_for("p0")["extend"] == {})
g = game(2, [[('Circle',3),('Star',3),('Circle',6)], []])
check("extend: same-number mates can be added", cid(g, "p0", 'Star', 3) in nxt(g, "p0", [cid(g, "p0", 'Circle', 3)]))

# ---- free chains: any legal sequence of groups in one move ----
g = game(2, [[('Circle',1),('Circle',3),('Circle',3)], []]); r = play(g, "p0", [('Circle',1),('Circle',3),('Circle',3)])
check("free chain: a Hold On, then two same-number cards together", r["success"] and g.top_card.number == 3 and turn(g) == "p1" and hand(g, "p0") == B)
g = game(3, [[('Circle',1),('Circle',3),('Star',3),('Square',9)], [], []]); r = play(g, "p0", [('Circle',1),('Circle',3),('Star',3)])
check("free chain: the last card of the group sets the shape for what follows", r["success"] and g.top_card.shape == 'Star')
g = game(2, [[('Circle',1),('Triangle',1),('Triangle',4),('Triangle',4)], []]); r = play(g, "p0", [('Circle',1),('Triangle',1),('Triangle',4),('Triangle',4)])
check("free chain: two Hold Ons, then two 4s", r["success"] and g.top_card.number == 4 and turn(g) == "p1")
g = game(3, [[('Circle',14),('Circle',9)], [], []]); r = play(g, "p0", [('Circle',14),('Circle',9)]); e = g.state_for("p0")["last_event"]
check("free chain: General Market then a card, the others draw first", r["success"] and hand(g, "p1") == B + 1 and hand(g, "p2") == B + 1 and turn(g) == "p1")
check("free chain: the cue still says General Market", e["type"] == "general_market" and e["target_ids"] == ["p1", "p2"])
g = game(2, [[('Circle',1),('Circle',14),('Circle',9)], []]); r = play(g, "p0", [('Circle',1),('Circle',14),('Circle',9)])
check("free chain: Hold On, General Market, then a card", r["success"] and hand(g, "p1") == B + 1 and turn(g) == "p1")
g = game(2, [[('Circle',8),('Circle',9)], []]); r = play(g, "p0", [('Circle',8),('Circle',9)])
check("free chain: with 2 players a Suspension keeps the turn, so a card can follow it", r["success"] and turn(g) == "p1" and g.top_card.number == 9)
g = game(3, [[('Circle',8),('Circle',9)], [], []]); r = play(g, "p0", [('Circle',8),('Circle',9)])
check("free chain: with 3 players a Suspension passes the turn, nothing can follow it", not r["success"] and hand(g, "p0") == B + 2)
g = game(2, [[('Circle',3),('Circle',4)], []]); r = play(g, "p0", [('Circle',3),('Circle',4)])
check("free chain: a plain card ends the move, nothing can follow it", not r["success"] and hand(g, "p0") == B + 2)
g = game(2, [[('Circle',2),('Circle',1)], []]); r = play(g, "p0", [('Circle',2),('Circle',1)])
check("free chain: a Pick card ends the move too", not r["success"] and hand(g, "p0") == B + 2)
g = game(2, [[('Circle',1),('Circle',3),('Circle',4)], []]); r = play(g, "p0", [('Circle',1),('Circle',3),('Circle',4)])
check("free chain: Hold On, a plain card, then another card is refused and nothing moves", not r["success"] and hand(g, "p0") == B + 3 and g.top_card.number == 9)
g = game(2, [[('Circle',1),('Circle',14),('Triangle',9)], []]); r = play(g, "p0", [('Circle',1),('Circle',14),('Triangle',9)])
check("free chain: refused when the last card does not fit, and the General Market is undone", not r["success"] and hand(g, "p1") == B and hand(g, "p0") == B + 3)
g = game(2, [[('Circle',1),('Whot',20)], []]); r = g.play_cards("p0", [c.id for c in g.get_player("p0").hand if c.number in (1,20)], "Cross")
check("free chain: Hold On then Whot with a shape", r["success"] and g.pending_shape == 'Cross')
g = game(2, [[('Whot',20),('Circle',1)], []]); r = g.play_cards("p0", [c.id for c in g.get_player("p0").hand if c.number in (1,20)], "Cross")
check("free chain: Whot cannot lead a chain", not r["success"])
g = W.WhotGame([W.Player("p0","P1"), W.Player("p1","P2")])
g.get_player("p0").hand = [W.WhotCard('Circle',1), W.WhotCard('Circle',14), W.WhotCard('Circle',7), W.WhotCard('Circle',7)]
g.get_player("p1").hand = [W.WhotCard('Star',3)] * 2
g.discard_pile = [W.WhotCard('Circle',9)]; g.current_idx = 0; g.pending_pick = 0; g.pending_shape = None
r = play(g, "p0", [('Circle',1),('Circle',14),('Circle',7),('Circle',7)])
check("free chain: a whole hand played as one move wins with no Last Card call", r["success"] and g.game_over and g.winner_id == "p0")
g = game(2, [[('Circle',1),('Circle',3),('Circle',3)], []]); h = g.get_player("p0").hand
one = next(c.id for c in h if c.number == 1); threes = [c.id for c in h if c.shape == 'Circle' and c.number == 3]
check("extend after a Hold On: both Circle 3s can follow it", set(threes) <= nxt(g, "p0", [one]))
check("extend after Hold On + a 3: the other 3 can still be added", threes[1] in nxt(g, "p0", [one, threes[0]]))
check("extend after a full group: only more cards of that same number", all(c.number == 3 for c in h if c.id in nxt(g, "p0", [one] + threes)))
check("extend: a selection that is not yours or not your turn gives nothing", g.next_cards("p1", [one]) == [] and g.next_cards("p0", ["nope"]) == [])

print("ALL PASSED")
