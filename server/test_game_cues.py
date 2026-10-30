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

# ---- last_event: the structured headline of each move ----
def ev(g, pid="p0"): return g.state_for(pid)["last_event"]
CANCEL = {"cancel_penalties": True}

g = game(2, [[('Circle',4)], []])
check("a new game has no event yet", ev(g) is None)
ok(g, "p0", [('Circle',4)]); e = ev(g)
check("plain card: type play, actor, the card, seq 1", e["type"] == "play" and e["actor_id"] == "p0" and e["card"]["number"] == 4 and e["seq"] == 1)
g.draw_card("p1"); e = ev(g)
check("normal draw: type draw, one card, seq goes up", e["type"] == "draw" and e["actor_id"] == "p1" and e["amount"] == 1 and e["seq"] == 2)

g = game(3, [[('Circle',2)], [], []]); ok(g, "p0", [('Circle',2)]); e = ev(g)
check("pick two: type pick, aimed at the next player, amount 2", e["type"] == "pick" and e["target_ids"] == ["p1"] and e["amount"] == 2 and e["actor_id"] == "p0")
g.draw_card("p1"); e = ev(g)
check("taking the penalty: type pick_taken with how many", e["type"] == "pick_taken" and e["actor_id"] == "p1" and e["amount"] == 2 and e["target_ids"] == ["p1"])

g = game(3, [[('Circle',2)], [('Triangle',2)], []]); ok(g, "p0", [('Circle',2)]); ok(g, "p1", [('Triangle',2)]); e = ev(g)
check("stacked pick: aimed at the next player with the running total", e["type"] == "pick" and e["target_ids"] == ["p2"] and e["amount"] == 4)

g = game(2, [[('Circle',2)], [('Triangle',2)]]); ok(g, "p0", [('Circle',2)]); ok(g, "p1", [('Triangle',2)]); e = ev(g)
check("two players, equal counter: type cancelled", e["type"] == "cancelled" and e["actor_id"] == "p1" and e["amount"] == 2 and g.pending_pick == 0)
g = game(2, [[('Circle',2),('Square',2)], [('Triangle',2)]]); ok(g, "p0", [('Circle',2),('Square',2)]); ok(g, "p1", [('Triangle',2)]); e = ev(g)
check("two players, smaller counter (one 2 against two): type blocked, the counterer picks the leftover 2", e["type"] == "blocked" and e["actor_id"] == "p1" and e["amount"] == 2 and e["target_ids"] == ["p1"])
g = game(2, [[('Circle',2)], [('Triangle',2),('Square',2)]]); ok(g, "p0", [('Circle',2)]); ok(g, "p1", [('Triangle',2),('Square',2)]); e = ev(g)
check("two players, bigger counter (two 2s against one): a pick aimed back at the other player", e["type"] == "pick" and e["target_ids"] == ["p0"] and e["amount"] == 2)
g = game(3, [[('Circle',2)], [('Triangle',2)], []], rules=CANCEL); ok(g, "p0", [('Circle',2)]); ok(g, "p1", [('Triangle',2)]); e = ev(g)
check("cancel rule, 3 players, equal counter: type cancelled", e["type"] == "cancelled" and e["actor_id"] == "p1" and e["amount"] == 2)

g = game(3, [[('Circle',8)], [], []]); ok(g, "p0", [('Circle',8)]); e = ev(g)
check("suspension: type suspended, names who is skipped", e["type"] == "suspended" and e["target_ids"] == ["p1"] and turn(g) == "p2")
g = game(2, [[('Circle',8)], []]); ok(g, "p0", [('Circle',8)]); e = ev(g)
check("suspension with 2 players: the other player is the one skipped", e["target_ids"] == ["p1"] and turn(g) == "p0")
g = game(4, [[('Circle',8),('Star',8)], [], [], []]); ok(g, "p0", [('Circle',8),('Star',8)]); e = ev(g)
check("two suspensions at once skip two players", e["target_ids"] == ["p1", "p2"] and e["amount"] == 2)

g = game(3, [[('Circle',14)], [], []]); ok(g, "p0", [('Circle',14)]); e = ev(g)
check("general market: type general_market, everyone else, 1 each", e["type"] == "general_market" and e["target_ids"] == ["p1", "p2"] and e["amount"] == 1)
g = game(2, [[('Circle',1),('Star',7)], []]); ok(g, "p0", [('Circle',1)]); e = ev(g)
check("hold on: type hold_on, the same player plays again", e["type"] == "hold_on" and e["actor_id"] == "p0" and e["target_ids"] == ["p0"])
g = game(2, [[('Whot',20)], []]); g.play_cards("p0", [c.id for c in g.get_player("p0").hand if c.number == 20], "Star"); e = ev(g)
check("whot: type whot with the called shape", e["type"] == "whot" and e["shape"] == "Star" and e["card"]["number"] == 20)
g = game(2, [[('Circle',1),('Circle',2)], []]); ok(g, "p0", [('Circle',1),('Circle',2)]); e = ev(g)
check("a Hold On chain is headlined by its final card (Pick Two)", e["type"] == "pick" and e["target_ids"] == ["p1"] and e["amount"] == 2)

g = game(2, [[('Circle',2)], []]); ok(g, "p0", [('Circle',2)])
g.force_timeout_draw("p1"); e = ev(g)
check("timeout: type timeout_draw with the cards drawn", e["type"] == "timeout_draw" and e["actor_id"] == "p1" and e["amount"] == 2)

g = W.WhotGame([W.Player("p0","P1"), W.Player("p1","P2")])
g.get_player("p0").hand = [W.WhotCard('Circle',7)]; g.get_player("p1").hand = [W.WhotCard('Star',3)] * 2
g.discard_pile = [W.WhotCard('Circle',9)]; g.current_idx = 0; g.pending_pick = 0; g.pending_shape = None
play(g, "p0", [('Circle',7)]); e = ev(g)
check("last card not called: type last_card, 5 cards drawn", e["type"] == "last_card" and e["actor_id"] == "p0" and e["amount"] == 5)
g = W.WhotGame([W.Player("p0","P1"), W.Player("p1","P2")])
g.get_player("p0").hand = [W.WhotCard('Circle',7)]; g.get_player("p1").hand = [W.WhotCard('Star',3)] * 2
g.discard_pile = [W.WhotCard('Circle',9)]; g.current_idx = 0; g.pending_pick = 0; g.pending_shape = None
g.call_last_card("p0"); play(g, "p0", [('Circle',7)]); e = ev(g)
check("winning move: type win", e["type"] == "win" and e["actor_id"] == "p0")

# everyone gets the same event, and it carries no hand information
g = game(3, [[('Circle',2)], [], []]); ok(g, "p0", [('Circle',2)])
a, b = g.state_for("p1")["last_event"], g.state_for("p2")["last_event"]
check("every player sees the same event", a == b == g.state_for("p0")["last_event"])
check("the event holds only public fields", set(a) == {"seq", "type", "actor_id", "target_ids", "amount", "card", "shape"} and set(a["card"]) <= {"id", "shape", "number", "name"} | set(a["card"]))
seqs = []
g = game(2, [[('Circle',4),('Circle',6)], []])
ok(g, "p0", [('Circle',4)]); seqs.append(ev(g)["seq"]); g.draw_card("p1"); seqs.append(ev(g)["seq"]); ok(g, "p0", [('Circle',6)]); seqs.append(ev(g)["seq"])
check("seq goes up with every move", seqs == sorted(set(seqs)) and len(seqs) == 3)

print("ALL PASSED")
