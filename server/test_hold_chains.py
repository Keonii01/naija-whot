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
# hold_follow in game_state
g = game(2, [[('Circle',1),('Circle',7),('Triangle',7),('Whot',20),('Triangle',1)], []])
st = g.state_for("p0"); hf = st["hold_follow"]; p0 = g.get_player("p0")
c1 = next(c.id for c in p0.hand if c.shape == 'Circle' and c.number == 1)
want = {c.id for c in p0.hand if (c.shape == 'Circle' and c.number == 7) or c.shape == 'Whot'}
check("hold_follow: lists same-shape cards and Whot, never other 1s", set(hf[c1]) == want)
check("hold_follow: only the player on turn gets it", g.state_for("p1")["hold_follow"] == {})
g = game(2, [[('Circle',1),('Triangle',7)], []], rules=HOLD); st = g.state_for("p0")
c1 = next(c.id for c in g.get_player("p0").hand if c.number == 1)
check("hold_follow: any-card rule lists every non-1 card", set(st["hold_follow"][c1]) == {c.id for c in g.get_player("p0").hand if c.number != 1})
g = game(2, [[('Circle',1),('Triangle',1),('Triangle',7)], []])   # Triangle 1 is not playable on Circle 9, but can be the 2nd 1
hf = g.state_for("p0")["hold_follow"]; t1 = next(c.id for c in g.get_player("p0").hand if c.shape == 'Triangle' and c.number == 1)
check("hold_follow: a non-playable 1 still gets follow-ups when another 1 can lead", t1 in hf)

print("ALL PASSED")
