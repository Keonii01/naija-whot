"""Private solo games (Play vs Computer). Run from server/:  python test_solo_rooms.py"""
import sys, time
sys.path.insert(0, '.')
import room_manager
room_manager.BOT_DELAY = (0.02, 0.05)
import main
from fastapi.testclient import TestClient

tok = lambda n: (n * 20)[:20]
def until(ws, pred, tries=400):
    for _ in range(tries):
        m = ws.receive_json()
        if pred(m): return m
    raise AssertionError("expected message never came")
def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name); assert cond, name
def welcome(ws): return until(ws, lambda m: m["type"] == "welcome")["player_id"]
def is_type(t): return lambda m: m["type"] == t
def latest_room(ws, tries=30):
    """send a harmless set_rules and return the newest room_update"""
    ws.send_json({"type": "set_rules", "rules": {}})
    ru = None
    for _ in range(tries):
        m = ws.receive_json()
        if m["type"] == "room_update": ru = m
        if ru is not None and m is ru: break
    return ru

def solo(ws, **extra):
    ws.send_json({"type": "create_room", "player_name": "Owner", "solo": True, **extra})
    return until(ws, is_type("room_update"))

# ---- 1. creating a solo room ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H:
        welcome(H)
        ru = solo(H, bots=2)
        check("1: a solo room says so in room_update", ru["solo"] is True)
        check("1: bots=2 seats two computers", sum(p["is_bot"] for p in ru["players"]) == 2 and len(ru["players"]) == 3)
    with c.websocket_connect(f"/ws/{tok('b')}") as H:
        welcome(H); ru = solo(H, bots=0)
        check("1: bots=0 still gets 1 computer (a solo game needs an opponent)", sum(p["is_bot"] for p in ru["players"]) == 1)
    with c.websocket_connect(f"/ws/{tok('c')}") as H:
        welcome(H); ru = solo(H, bots=9)
        check("1: bots=9 is capped at 3 computers", sum(p["is_bot"] for p in ru["players"]) == 3)
    with c.websocket_connect(f"/ws/{tok('d')}") as H:
        welcome(H); ru = solo(H)
        check("1: no bots field gives 1 computer", sum(p["is_bot"] for p in ru["players"]) == 1)
    with c.websocket_connect(f"/ws/{tok('e')}") as H:
        welcome(H)
        H.send_json({"type": "create_room", "player_name": "Host", "solo": "yes", "bots": 1})
        ru = until(H, is_type("room_update"))
        check("1: solo must be exactly true (a junk value makes a normal room)", ru["solo"] is False)

# ---- 2. nobody else can get in ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H, c.websocket_connect(f"/ws/{tok('b')}") as G:
        hid = welcome(H); gid = welcome(G)
        code = solo(H, bots=1)["room_code"]
        G.send_json({"type": "join_room", "room_code": code, "player_name": "Intruder"})
        e = until(G, is_type("error"))
        check("2: joining a solo room says 'Room not found'", e["message"] == "Room not found")
        G.send_json({"type": "join_room", "room_code": code, "player_name": "Peeker", "spectate": True})
        e = until(G, is_type("error"))
        check("2: watching a solo room is refused the same way", e["message"] == "Room not found")
        G.send_json({"type": "rejoin", "room_code": code, "player_name": "Intruder"})
        until(G, is_type("rejoin_failed")); check("2: rejoining someone else's solo room fails", True)
        ru = latest_room(H)
        check("2: the room is untouched: still just the owner + 1 computer, nobody watching", len(ru["players"]) == 2 and ru["spectators"] == 0 and hid in [p["id"] for p in ru["players"]])
        check("2: the intruder is not in the room on the server", gid not in main.manager.rooms[code].players and gid not in main.manager.rooms[code].spectators)
        # while a game is running, a stranger still can't watch
        H.send_json({"type": "start_game"}); until(H, is_type("game_state"))
        G.send_json({"type": "join_room", "room_code": code, "player_name": "Peeker", "spectate": True})
        e = until(G, is_type("error"))
        check("2: watching a running solo game is refused", e["message"] == "Room not found" and gid not in main.manager.rooms[code].spectators)
        G.send_json({"type": "rejoin", "room_code": code, "spectate": True})
        until(G, is_type("rejoin_failed")); check("2: rejoin-as-spectator on a running solo game fails", True)

# ---- 3. the owner can come back ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H:
        hid = welcome(H); code = solo(H, bots=2)["room_code"]
    time.sleep(0.3)
    with c.websocket_connect(f"/ws/{tok('a')}") as H2:
        check("3: same token, same player id", welcome(H2) == hid)
        H2.send_json({"type": "rejoin", "room_code": code, "player_name": "Owner"})
        ru = until(H2, is_type("room_update"))
        check("3: owner rejoins their solo room (still solo, computers still seated)", ru["solo"] is True and hid in [p["id"] for p in ru["players"]] and sum(p["is_bot"] for p in ru["players"]) == 2)

# ---- 4. computer limits ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H:
        welcome(H); ru = solo(H, bots=3)
        H.send_json({"type": "add_bot"}); e = until(H, is_type("error"))
        check("4: a 4th computer is refused", "up to 3" in e["message"])
        ru = latest_room(H)
        check("4: still 3 computers", sum(p["is_bot"] for p in ru["players"]) == 3)
        for b in [p["id"] for p in ru["players"] if p["is_bot"]][:2]:
            H.send_json({"type": "remove_bot", "bot_id": b}); until(H, is_type("room_update"))
        last = next(p["id"] for p in latest_room(H)["players"] if p["is_bot"])
        H.send_json({"type": "remove_bot", "bot_id": last}); e = until(H, is_type("error"))
        check("4: the last computer cannot be removed", "at least 1" in e["message"])
        H.send_json({"type": "add_bot"}); ru = until(H, is_type("room_update"))
        check("4: add_bot still works below the cap", sum(p["is_bot"] for p in ru["players"]) == 2)

# ---- 5. a normal room is unchanged ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H, c.websocket_connect(f"/ws/{tok('b')}") as G:
        welcome(H); welcome(G)
        H.send_json({"type": "create_room", "player_name": "Host", "bots": 1})
        ru = until(H, is_type("room_update")); code = ru["room_code"]
        check("5: a normal room is not solo", ru["solo"] is False)
        G.send_json({"type": "join_room", "room_code": code, "player_name": "Guest"})
        ru = until(G, is_type("room_update"))
        check("5: a normal room still takes guests", len(ru["players"]) == 3)

# ---- 6. a solo game plays out, returns to the setup, and stays solo ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H:
        hid = welcome(H); solo(H, bots=1)
        H.send_json({"type": "start_game"})
        called = False
        for _ in range(4000):
            m = H.receive_json()
            if m["type"] != "game_state": continue
            st = m["state"]
            if st["game_over"]: break
            if st["current_player_id"] != hid: continue
            me = next(p for p in st["players"] if p["id"] == hid)
            if len(me["hand"]) == 1 and not me["last_card_called"] and not called:
                H.send_json({"type": "last_card"}); called = True; continue
            called = False
            if st["playable_card_ids"]:
                cid = st["playable_card_ids"][0]; card = next(x for x in me["hand"] if x["id"] == cid)
                H.send_json({"type": "play_cards", "card_ids": [cid], "chosen_shape": "Star" if card["shape"] == "Whot" else None})
            else:
                H.send_json({"type": "draw_card"})
        check("6: a solo game finishes", st["game_over"])
        H.send_json({"type": "return_to_lobby"})
        ru = until(H, lambda m: m["type"] == "room_update" and not m["started"])
        check("6: back at the setup, still solo, computer still seated", ru["solo"] is True and sum(p["is_bot"] for p in ru["players"]) == 1)

print("ALL PASSED")
