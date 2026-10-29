"""Computer players inside real rooms (simulated humans over the websocket). Run from server/:  python test_bot_rooms.py"""
import sys, time, asyncio
sys.path.insert(0, '.')
import room_manager
room_manager.BOT_DELAY = (0.02, 0.05)          # fast computers for the test
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

def play_out(ws, my_id, max_msgs=4000):
    """A simple human: calls Last Card, plays the first playable card, otherwise draws. Returns the final state."""
    called = False
    for _ in range(max_msgs):
        m = ws.receive_json()
        if m["type"] != "game_state": continue
        st = m["state"]
        if st["game_over"]: return st
        if st["current_player_id"] != my_id: continue
        me = next(p for p in st["players"] if p["id"] == my_id)
        if len(me["hand"]) == 1 and not me["last_card_called"] and not called:
            ws.send_json({"type": "last_card"}); called = True; continue
        called = False
        if st["playable_card_ids"]:
            cid = st["playable_card_ids"][0]
            card = next(c for c in me["hand"] if c["id"] == cid)
            ws.send_json({"type": "play_cards", "card_ids": [cid], "chosen_shape": "Star" if card["shape"] == "Whot" else None})
        else:
            ws.send_json({"type": "draw_card"})
    raise AssertionError("game did not finish")

# ---- 1. create a room with a computer; add and remove computers; host-only; limits ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H, c.websocket_connect(f"/ws/{tok('b')}") as G:
        hid = welcome(H); gid = welcome(G)
        H.send_json({"type": "create_room", "player_name": "Host", "bots": 1})
        ru = until(H, lambda m: m["type"] == "room_update"); code = ru["room_code"]
        bots = [p for p in ru["players"] if p["is_bot"]]
        check("1: create_room with bots=1 seats one computer, flagged is_bot", len(ru["players"]) == 2 and len(bots) == 1 and not ru["players"][0]["is_bot"])
        G.send_json({"type": "join_room", "room_code": code, "player_name": "Guest"}); until(G, lambda m: m["type"] == "room_update")
        G.send_json({"type": "add_bot"}); e = until(G, lambda m: m["type"] == "error")
        check("1: a guest cannot add a computer", "host" in e["message"].lower())
        for _ in range(5): H.send_json({"type": "add_bot"})
        H.send_json({"type": "add_bot"}); e = until(H, lambda m: m["type"] == "error")
        check("1: the 9th seat is refused (max 8 players)", "full" in e["message"].lower())
        # drain to the latest lobby state
        H.send_json({"type": "set_rules", "rules": {}})
        ru = None
        for _ in range(30):
            m = H.receive_json()
            if m["type"] == "room_update": ru = m
            if m["type"] == "room_update" and len(m["players"]) == 8 and m is ru: break
        names = [p["name"] for p in ru["players"]]
        check("1: 8 seats full, all names unique and within 16 characters", len(ru["players"]) == 8 and len(set(n.lower() for n in names)) == 8 and all(len(n) <= 16 for n in names))
        victim = next(p["id"] for p in ru["players"] if p["is_bot"])
        H.send_json({"type": "remove_bot", "bot_id": victim})
        ru = until(H, lambda m: m["type"] == "room_update" and len(m["players"]) == 7)
        check("1: remove_bot frees the seat", victim not in [p["id"] for p in ru["players"]])
        H.send_json({"type": "remove_bot", "bot_id": hid})
        H.send_json({"type": "set_rules", "rules": {"cancel_penalties": True}})
        ru = until(H, lambda m: m["type"] == "room_update" and m["rules"]["cancel_penalties"] is True)
        check("1: remove_bot cannot be used to remove a human", hid in [p["id"] for p in ru["players"]] and len(ru["players"]) == 7)

# ---- 2. a full game: human vs computer, over the real server ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H:
        hid = welcome(H)
        H.send_json({"type": "create_room", "player_name": "Host", "bots": 1})
        until(H, lambda m: m["type"] == "room_update")
        H.send_json({"type": "start_game"})
        final = play_out(H, hid)
        bot_pl = next(p for p in final["players"] if p["is_bot"])
        check("2: human vs computer plays to a finish", final["game_over"] and final["winner_id"] is not None)
        check("2: the human only ever sees the computer's card count, never its cards", "hand" not in bot_pl and isinstance(bot_pl["card_count"], int))
        check("2: the computer is flagged in the game state", bot_pl["is_bot"] is True and next(p for p in final["players"] if p["id"] == hid)["is_bot"] is False)

        # ---- 3. back to the waiting room: the computer stays seated; rematch works ----
        H.send_json({"type": "return_to_lobby"})
        ru = until(H, lambda m: m["type"] == "room_update" and not m["started"])
        check("3: after the game the computer is still seated in the waiting room", sum(p["is_bot"] for p in ru["players"]) == 1 and len(ru["players"]) == 2)
        H.send_json({"type": "start_game"})
        final = play_out(H, hid)
        check("3: a second game against the same computer finishes", final["game_over"])
        H.send_json({"type": "rematch"})
        final = play_out(H, hid)
        check("3: rematch keeps the computer and finishes", final["game_over"] and any(p["is_bot"] for p in final["players"]))

# ---- 4. 4 players (1 human + 3 computers), with house rules on: finishes ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H:
        hid = welcome(H)
        H.send_json({"type": "create_room", "player_name": "Host", "bots": 3})
        until(H, lambda m: m["type"] == "room_update")
        H.send_json({"type": "set_rules", "rules": {"cancel_penalties": True, "hold_on_any_card": True, "pick_three_action": False}})
        until(H, lambda m: m["type"] == "room_update" and m["rules"]["hold_on_any_card"] is True)
        H.send_json({"type": "start_game"})
        final = play_out(H, hid)
        check("4: 1 human + 3 computers with all house rules on finishes", final["game_over"] and len(final["players"]) == 4)

# ---- 5. leaving mid-game against a computer; no leftovers on the server ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H:
        hid = welcome(H)
        H.send_json({"type": "create_room", "player_name": "Host", "bots": 1})
        code = until(H, lambda m: m["type"] == "room_update")["room_code"]
        H.send_json({"type": "start_game"}); until(H, lambda m: m["type"] == "game_state")
        H.send_json({"type": "leave_room"})
        time.sleep(0.3)
        check("5: leaving a game against a computer removes the room (no zombie room left behind)", code not in main.manager.rooms)

# ---- 6. the host is never a computer ----
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H, c.websocket_connect(f"/ws/{tok('b')}") as G:
        hid = welcome(H); gid = welcome(G)
        H.send_json({"type": "create_room", "player_name": "Host", "bots": 2})
        code = until(H, lambda m: m["type"] == "room_update")["room_code"]
        G.send_json({"type": "join_room", "room_code": code, "player_name": "Guest"}); until(G, lambda m: m["type"] == "room_update")
        H.send_json({"type": "leave_room"})
        ru = until(G, lambda m: m["type"] == "room_update" and hid not in [p["id"] for p in m["players"]])
        check("6: when the host leaves, the next HUMAN becomes host, not a computer", ru["host_id"] == gid)

# ---- 7. a slow computer is never AFK-kicked and the game keeps moving ----
room_manager.TURN_SECONDS = 0.4
room_manager.BOT_DELAY = (1.0, 1.2)             # always later than the turn clock: the clock must move it
with TestClient(main.app) as c:
    with c.websocket_connect(f"/ws/{tok('a')}") as H:
        hid = welcome(H)
        H.send_json({"type": "create_room", "player_name": "Host", "bots": 1})
        until(H, lambda m: m["type"] == "room_update")
        H.send_json({"type": "start_game"})
        final = play_out(H, hid)
        check("7: a computer slower than the turn clock still plays on and is never kicked", final["game_over"] and len(final["players"]) == 2)
print("ALL PASSED")
