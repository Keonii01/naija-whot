"""One-off: adds tournament mode to room_manager.py (server side).
Run from the server folder:  py patch_tournament.py
It checks every spot first and changes nothing unless all of them are found."""
import re
import sys

NEW_START_GAME = '''    def start_game(self, ids=None):
        # fresh Player objects every time, so a rematch never inherits old hands.
        # ids (tournament): only these players sit at the table, everyone else keeps their seat in the room.
        seat_ids = [pid for pid in self.order if ids is None or pid in ids]
        fresh = [Player(pid, self.players[pid].name) for pid in seat_ids]
        for p in fresh:
            p.is_bot = p.id in self.bots
        self.players.update({p.id: p for p in fresh})
        self.game = WhotGame(fresh, self.rules)
        self.started = True
        self.afk = {}
        self.last_result = None

'''

NEW_RESET = '''    async def _reset_to_lobby(self, room):
        """Game finished: everyone goes back to the waiting room of the same room."""
        game = room.game
        if room.t is not None:
            # a tournament: everyone still connected stays, including the players who were knocked out
            room.last_result = {"winner": room.t.get("champion_name"), "reason": "tournament"}
            staying = [pid for pid in room.order if pid in room.bots or pid in self.connections]
            room.t = None
        else:
            winner = game.get_player(game.winner_id) if game.winner_id else None
            room.last_result = {"winner": winner.name if winner else None, "reason": game.end_reason}
            staying = [p.id for p in game.players
                       if p.id in room.players and (p.id in room.bots or (p.connected and p.id in self.connections))]
        for pid in list(room.order):
            if pid not in staying:
                room.remove_player(pid)                  # gone players don't carry over
        self._stop_timer(room)
        room.game = None
        room.started = False
        room.afk = {}
        self._pick_new_host(room)
        everyone = list(room.order) + list(room.spectators)
        for pid in everyone:
            await self.send(pid, {"type": "back_to_lobby"})
        await self.broadcast_lobby(room)

'''

NEW_AFTER_ACTION = '''    async def _after_action(self, room):
        """After any move/draw/leave: stop the clock if the game ended, else start the next turn."""
        if room.game.game_over:
            self._stop_timer(room)
            await self.broadcast_game_state(room)
            if room.t is not None and room.t["stage"] == "match":
                await self._t_match_over(room)
        else:
            await self.start_turn_timer(room)

'''

TOURNAMENT_METHODS = '''    # ---------------- Tournament ----------------
    # A tournament is a series of normal games in one room. After each match the player with the highest card
    # total is out (a tie for the highest total is settled by a play-off between just those players). Before
    # every next game each player who is still in taps Ready; the host can remove anyone who is not. The last
    # player left is the champion. room.t holds the state; it is public information and is sent to everyone.

    def _t_out(self, room, pid, reason):
        t = room.t
        if t is None or pid not in t["alive"]:
            return
        t["alive"].remove(pid)
        if pid in t["players"]:
            t["players"].remove(pid)
        if pid in t["ready"]:
            t["ready"].remove(pid)
        t["out"].append({"id": pid, "name": t["names"].get(pid, "Player"), "reason": reason})

    async def _t_begin(self, room):
        ids = list(room.order)
        room.t = {
            "round": 1, "stage": "match", "kind": "match",
            "alive": list(ids), "players": list(ids), "ready": [], "out": [],
            "champion": None, "champion_name": None,
            "names": {pid: room.players[pid].name for pid in ids},
        }
        room.start_game(ids)
        await self.start_turn_timer(room)
        await self.broadcast_lobby(room)

    async def _t_match_over(self, room):
        t, game = room.t, room.game
        seated = [p.id for p in game.players]       # who was still at the table when the match ended
        if len(seated) > 1:
            worst = tournament_worst(game.ranking)
            if len(worst) == 1:
                self._t_out(room, worst[0], "play-off" if t["kind"] == "playoff" else "highest total")
            else:
                t["kind"], t["players"] = "playoff", list(worst)   # a tie: just these players play off
                await self._t_begin_ready(room)
                return
        await self._t_after_elimination(room)

    async def _t_after_elimination(self, room):
        t = room.t
        if len(t["alive"]) <= 1:
            await self._t_finish(room, t["alive"][0] if t["alive"] else None)
            return
        t["kind"], t["players"] = "match", list(t["alive"])        # everyone still in plays the next match
        t["round"] += 1
        await self._t_begin_ready(room)

    async def _t_begin_ready(self, room):
        t = room.t
        t["stage"] = "ready"
        t["ready"] = [pid for pid in t["players"] if pid in room.bots]   # computers are always ready
        await self._t_check_ready(room)

    async def _t_check_ready(self, room):
        t = room.t
        if t is None or t["stage"] != "ready":
            return
        if len(t["players"]) >= 2 and all(pid in t["ready"] for pid in t["players"]):
            t["stage"], t["ready"] = "match", []
            room.start_game(t["players"])
            await self.start_turn_timer(room)
        else:
            await self.broadcast_game_state(room)

    async def _t_finish(self, room, champion_id):
        t = room.t
        t["stage"], t["players"], t["ready"] = "done", [], []
        t["champion"] = champion_id
        t["champion_name"] = t["names"].get(champion_id) if champion_id else None
        await self.broadcast_game_state(room)
        await self.broadcast_lobby(room)

    async def _t_after_drop(self, room):
        """Someone left or was removed. Between matches that may change who plays next."""
        t = room.t
        if t is None or t["stage"] != "ready":
            return                  # a running match carries on; if it ends by forfeit _t_match_over deals with it
        if len(t["players"]) < 2:
            await self._t_after_elimination(room)    # nobody to play against (or no play-off needed)
        else:
            await self._t_check_ready(room)

'''

HANDLERS = '''        elif mtype == "set_tournament":
            room = self._get_room(client_id)
            if not room or room.host_id != client_id or room.started or room.solo:
                await self.send(client_id, {"type": "error", "message": "Only the host can change this, before the game starts"})
                return
            room.tournament = msg.get("on") is True
            self._touch(room)
            await self.broadcast_lobby(room)

        elif mtype == "tournament_ready":
            room = self._get_room(client_id)
            if not room or room.t is None or room.t["stage"] != "ready" or client_id not in room.t["players"]:
                return
            if client_id not in room.t["ready"]:
                room.t["ready"].append(client_id)
            await self._t_check_ready(room)

        elif mtype == "tournament_remove":
            room = self._get_room(client_id)
            pid = msg.get("player_id")
            if not room or room.t is None or room.host_id != client_id or room.t["stage"] != "ready":
                return
            if pid == client_id or pid in room.bots or pid not in room.t["players"]:
                return
            if pid in room.t["ready"]:
                return                                   # only someone who is not Ready can be removed
            self._t_out(room, pid, "removed by host")
            await self._t_after_drop(room)

'''

def replace_method(src, name, new):
    """Replace one method of a class by name. The method ends at the next line indented 4 spaces or less
    (the next method, a comment, or the next class), so nothing around it is touched."""
    lines = src.split("\n")
    starts = [i for i, ln in enumerate(lines) if ln.startswith(f"    def {name}(") or ln.startswith(f"    async def {name}(")]
    if len(starts) != 1:
        return None
    i = starts[0] + 1
    while i < len(lines) and (lines[i].strip() == "" or len(lines[i]) - len(lines[i].lstrip()) > 4):
        i += 1
    body = lines[starts[0]:i]
    while body and body[-1].strip() == "":
        body.pop()                       # keep the blank lines that separated this method from the next thing
    tail = lines[starts[0] + len(body):i]
    return "\n".join(lines[:starts[0]] + new.rstrip("\n").split("\n") + tail + lines[i:])

PROBLEMS = []

def must(s, old, new, label):
    if s.count(old) != 1:
        PROBLEMS.append(f"{label}: expected 1 match, found {s.count(old)}")
        return s
    return s.replace(old, new)

def manager(s):
    if "def tournament_worst(" in s:
        sys.exit("room_manager.py already has the tournament code: nothing to do.")
    s = must(s, "SOLO_MAX_BOTS = 3", "T_MIN_PLAYERS = 3          # a tournament needs at least this many players\nSOLO_MAX_BOTS = 3", "constants")
    s = must(s, "class Room:\n    def __init__(self, code, host_id, solo=False):",
             '''def tournament_worst(ranking):
    """Who is out after a match: the player(s) with the highest card total.
    One player means they are out; several means those players play off."""
    if not ranking:
        return []
    worst = max(r["points"] for r in ranking)
    return [r["id"] for r in ranking if r["points"] == worst]


class Room:
    def __init__(self, code, host_id, solo=False):''', "tournament_worst")
    s = must(s, "        self.rules = dict(DEFAULT_RULES)   # house rules, set by the host before the game starts\n",
             "        self.rules = dict(DEFAULT_RULES)   # house rules, set by the host before the game starts\n        self.tournament = False    # host option: play a knock-out tournament instead of a single game\n        self.t = None              # tournament state while one is running (public information)\n", "Room.__init__")
    s = must(s, '            "solo": self.solo,\n            "started": self.started,',
             '            "solo": self.solo,\n            "tournament": self.tournament,\n            "t": self.t,\n            "started": self.started,', "lobby_state")
    t = replace_method(s, "start_game", NEW_START_GAME)
    if t is None:
        PROBLEMS.append("Room.start_game not found")
    else:
        s = t
    # send the tournament state with every game_state
    s, n = re.subn(r'^([ \t]+)state\["host_id"\] = room\.host_id[^\n]*\n', lambda m: m.group(0) + m.group(1) + 'state["t"] = room.t\n', s, flags=re.M)
    if n != 3:
        PROBLEMS.append(f"game_state sending (the three state[\"host_id\"] = room.host_id lines): expected 3, found {n}")
    t = replace_method(s, "_reset_to_lobby", NEW_RESET)
    if t is None:
        PROBLEMS.append("_reset_to_lobby not found")
    else:
        s = t
    t = replace_method(s, "_after_action", NEW_AFTER_ACTION)
    if t is None:
        PROBLEMS.append("_after_action not found")
    else:
        s = t
    s = must(s, '        room.afk.pop(pid, None)\n        self.player_rooms.pop(pid, None)\n        await self.send(pid, {"type": "kicked"',
             '        room.afk.pop(pid, None)\n        if room.t is not None:\n            self._t_out(room, pid, "inactive")\n        self.player_rooms.pop(pid, None)\n        await self.send(pid, {"type": "kicked"', "_kick_afk")
    s = must(s, "    # ---------------- Turn Timer ----------------", TOURNAMENT_METHODS + "    # ---------------- Turn Timer ----------------", "tournament methods")
    s = must(s, '        elif mtype == "start_game":\n', HANDLERS + '        elif mtype == "start_game":\n', "new handlers")
    s = must(s, '''            if len(room.players) < 2:
                await self.send(client_id, {"type": "error", "message": "Need at least 2 players"})
                return
            room.start_game()
            await self.start_turn_timer(room)''', '''            if len(room.players) < 2:
                await self.send(client_id, {"type": "error", "message": "Need at least 2 players"})
                return
            if room.tournament:
                if len(room.players) < T_MIN_PLAYERS:
                    await self.send(client_id, {"type": "error", "message": f"A tournament needs at least {T_MIN_PLAYERS} players"})
                    return
                await self._t_begin(room)
                return
            room.start_game()
            await self.start_turn_timer(room)''', "start_game handler")
    s = must(s, '''            if client_id not in room.players:
                return                                   # spectators can't reset the room
            await self._reset_to_lobby(room)''', '''            if client_id not in room.players:
                return                                   # spectators can't reset the room
            if room.t is not None and room.t["stage"] != "done":
                await self.send(client_id, {"type": "error", "message": "The tournament is still running"})
                return
            await self._reset_to_lobby(room)''', "return_to_lobby")
    s = must(s, '''            if not (room.started and room.game and room.game.game_over):
                return
            staying = [p.id for p in room.game.players''', '''            if not (room.started and room.game and room.game.game_over):
                return
            if room.t is not None:
                if room.t["stage"] == "done":
                    await self._reset_to_lobby(room)     # after a tournament, "play again" goes back to the waiting room
                return
            staying = [p.id for p in room.game.players''', "rematch")
    s = must(s, '''            room = self._get_room(client_id)
            self.player_rooms.pop(client_id, None)
            if not room:
                return
            player_left_game = False''', '''            room = self._get_room(client_id)
            self.player_rooms.pop(client_id, None)
            if not room:
                return
            if room.t is not None:
                self._t_out(room, client_id, "left")
            player_left_game = False''', "leave_room start")
    s = must(s, '''                if player_left_game:
                    await self._after_action(room)
                else:
                    await self.broadcast_game_state(room)
            else:
                await self.broadcast_lobby(room)
''', '''                if player_left_game:
                    await self._after_action(room)
                else:
                    await self.broadcast_game_state(room)
            else:
                await self.broadcast_lobby(room)
            if room.t is not None:
                await self._t_after_drop(room)
''', "leave_room end")
    s = must(s, '''                    p.connected = True
                    await self.broadcast_game_state(room)
                else:
''', '''                    p.connected = True
                    await self.broadcast_game_state(room)
                elif client_id in room.players:
                    # a tournament player who is waiting (or knocked out) and watching: keep their seat
                    await self.send(client_id, room.lobby_state())
                    await self.send_game_state_to(room, client_id)
                else:
''', "rejoin")
    return s

def main():
    raw = open("room_manager.py", newline="", encoding="utf-8").read()
    crlf = "\r\n" in raw
    out = manager(raw.replace("\r\n", "\n"))
    if PROBLEMS:
        print("Nothing was changed. These spots in room_manager.py did not match:")
        for p in PROBLEMS:
            print("  - " + p)
        sys.exit(1)
    open("room_manager.py", "w", newline="", encoding="utf-8").write(out.replace("\n", "\r\n") if crlf else out)
    print("OK: room_manager.py updated")

if __name__ == "__main__":
    main()
