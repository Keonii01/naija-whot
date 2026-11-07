"""Whole tournaments played through the real websocket server: one human who plays automatically, plus computers.
Run from server/:  python test_tournament_full.py"""
import sys
sys.path.insert(0, '.')
import room_manager
room_manager.BOT_DELAY = (0.01, 0.03)
room_manager.T_BOT_READY = (0.02, 0.05)     # in the real game computers tap Ready after 2 to 2.5 seconds
room_manager.T_RESULT_PAUSE = 0.05
import main
from fastapi.testclient import TestClient

def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name); assert cond, name

def play_tournament(client, token, bots):
    with client.websocket_connect(f"/ws/{token}") as ws:
        me = next(m for m in iter(ws.receive_json, None) if m["type"] == "welcome")["player_id"]
        ws.send_json({"type": "create_room", "player_name": "Me", "bots": bots})
        ws.send_json({"type": "set_tournament", "on": True})
        ws.send_json({"type": "start_game"})
        seen_rounds, matches, last_t, called = set(), 0, None, False
        for _ in range(60000):
            m = ws.receive_json()
            if m["type"] != "game_state":
                continue
            st = m["state"]; t = st["t"]; last_t = t
            seen_rounds.add(t["round"])
            if t["stage"] == "done":
                break
            if t["stage"] == "ready":
                if me in t["players"] and me not in t["ready"]:
                    ws.send_json({"type": "tournament_ready"})
                continue
            if st["game_over"] or st["is_spectator"] or st["current_player_id"] != me:
                continue
            mine = next(p for p in st["players"] if p["id"] == me)
            if len(mine["hand"]) == 1 and not mine["last_card_called"] and not called:
                ws.send_json({"type": "last_card"}); called = True; continue
            called = False
            if st["playable_card_ids"]:
                cid = st["playable_card_ids"][0]; card = next(c for c in mine["hand"] if c["id"] == cid)
                ws.send_json({"type": "play_cards", "card_ids": [cid], "chosen_shape": "Star" if card["shape"] == "Whot" else None})
            else:
                ws.send_json({"type": "draw_card"})
        return me, last_t, seen_rounds

with TestClient(main.app) as c:
    for run, bots in enumerate((2, 3, 4), start=1):
        me, t, rounds = play_tournament(c, (f"t{run}" * 10)[:20], bots)
        players = bots + 1
        check(f"run {run} ({players} players): the tournament finishes with a champion", t["stage"] == "done" and t["champion"] is not None)
        check(f"run {run}: every player but the champion is out exactly once", len(t["out"]) == players - 1 and len({o['id'] for o in t["out"]}) == players - 1 and t["champion"] not in {o["id"] for o in t["out"]})
        check(f"run {run}: nobody left is still alive", t["alive"] == [t["champion"]])
        check(f"run {run}: every knock-out has a reason", all(o["reason"] in ("highest total", "play-off") for o in t["out"]))
        check(f"run {run}: it took at least {players - 1} rounds", len(rounds) >= players - 1 and min(rounds) == 1)
print("ALL PASSED")
