"""When the market is empty: the game ends when the player to move has nothing to play, or when a whole round
has gone by with nobody playing. Run from server/:  python test_market_end.py"""
import sys
sys.path.insert(0, '.')
import whot_engine as W

def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name); assert cond, name

def table(n, hand, deck=None, top=('Circle', 9)):
    g = W.WhotGame([W.Player(f"p{i+1}", f"P{i+1}") for i in range(n)])
    for p in g.players:
        p.hand = [W.WhotCard(s, k) for s, k in hand]
    g.discard_pile = [W.WhotCard(*top)]
    g.deck = [W.WhotCard(*c) for c in (deck or [])]
    g.current_idx = 0; g.pending_pick = 0; g.pending_shape = None; g.free_play = False
    g.market_passes = 0
    return g

def timeout(g):
    g.force_timeout_draw(g.current_player().id)

PLAYABLE = [('Circle', 5), ('Circle', 6), ('Circle', 7)]     # every player can play any of these on the Circle 9

# ---- the case you described: the market finishes on player 3, then nobody plays for a whole round ----
g = table(3, PLAYABLE, deck=[('Star', 4)])
timeout(g); timeout(g)                      # p1, p2 run out of time and draw (the last card goes to p2)
check("setup: the market is now empty and the game is still on", not g.deck and not g.game_over)
g.current_idx = 2                           # it is player 3's turn when the market finishes on him
g.deck = [W.WhotCard('Star', 4)]
res = g.draw_card("p3")
check("market finishes on player 3 (he draws the last card)", res["success"] and not g.deck and not g.game_over and g.current_player().id == "p1")
timeout(g); check("player 1 has something to play but runs out of time: still going", not g.game_over)
timeout(g); check("player 2 runs out of time too: still going", not g.game_over)
timeout(g)
check("player 3 runs out of time: a whole round with nobody playing ends the game", g.game_over and g.end_reason == "market")
check("the cards are counted: there is a ranking and a result", len(g.ranking) == 3 and "market is finished" in g.last_action.lower())

# ---- a card played inside the round starts the count again ----
g = table(3, PLAYABLE)
timeout(g)                                  # p1 passes
ok = g.play_cards("p2", [next(c.id for c in g.get_player("p2").hand if c.number == 5)])
check("a card is played by player 2", ok["success"] and not g.game_over)
timeout(g); timeout(g)                      # p3, p1 pass
check("two passes after a play: not over yet", not g.game_over)
timeout(g)                                  # p2 passes: three in a row
check("three passes in a row after that: over", g.game_over)

# ---- the count is a full round, whatever the table size ----
for n in (3, 4, 5, 8):
    g = table(n, PLAYABLE)
    for i in range(n - 1):
        timeout(g)
    still = not g.game_over
    timeout(g)
    check(f"{n} players: not over after {n - 1} passes, over after {n}", still and g.game_over)

# ---- the older rule still applies ----
g = table(3, [('Star', 3)])                 # nobody can play on the Circle 9
timeout(g)
check("the player to move has nothing playable: ends straight away", g.game_over and g.end_reason == "market")

# ---- while the market still has cards, timeouts just draw and nothing ends ----
g = table(3, PLAYABLE, deck=[('Star', 4)] * 12)
for _ in range(9):
    timeout(g)
check("market with cards: nine timeouts only draw cards", not g.game_over and len(g.deck) == 3 and g.market_passes == 0)

# ---- a player who leaves puts their cards back in the market, so drawing starts again ----
g = table(4, PLAYABLE)
timeout(g)
g.remove_player("p2", note="was removed")
check("a player leaving refills the market with their cards", len(g.deck) == 3 and not g.game_over)
timeout(g); timeout(g)
check("so the next turns draw cards and the pass count starts again", g.market_passes == 0 and not g.game_over)

# ---- 2 players keep the discard-pile reshuffle ----
g = W.WhotGame([W.Player("p1", "P1"), W.Player("p2", "P2")])
for p in g.players:
    p.hand = [W.WhotCard('Circle', 5)]
g.deck = []; g.discard_pile = [W.WhotCard('Star', 1), W.WhotCard('Star', 2), W.WhotCard('Circle', 9)]; g.current_idx = 0
timeout(g)
check("2 players: the discard pile is reshuffled, nothing ends", not g.game_over and g.market_passes == 0)

print("ALL PASSED")
