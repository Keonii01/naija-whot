"""Tournament mode on the server. Run from server/:  python test_tournament.py"""
import asyncio, json, sys
sys.path.insert(0, '.')
import room_manager as RM
RM.BOT_DELAY = (0.01, 0.03)
RM.T_BOT_READY = (0.05, 0.08)     # computers tap Ready after this long (2 to 2.5 seconds in the real game)
RM.T_RESULT_PAUSE = 0.30          # a game with only computers waits at least this long (6 seconds in the real game)
import whot_engine as W

def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name); assert cond, name

class FakeWS:
    def __init__(self): self.msgs = []
    async def send_text(self, s): self.msgs.append(json.loads(s))
    def last(self, t): return next((m for m in reversed(self.msgs) if m["type"] == t), None)

async def table(n, tournament=True, bots=0):
    """n humans in one room (the first is the host). Returns manager, room, [ids], {id: ws}"""
    mgr = RM.RoomManager()
    wss, ids = {}, []
    for i in range(n):
        ws = FakeWS(); pid = mgr.register(f"tok{i}", ws); wss[pid] = ws; ids.append(pid)
    await mgr.handle_message(ids[0], {"type": "create_room", "player_name": "A", "bots": bots})
    room = mgr._get_room(ids[0])
    for i in range(1, n):
        await mgr.handle_message(ids[i], {"type": "join_room", "room_code": room.code, "player_name": "ABCDEFGH"[i]})
    if tournament:
        await mgr.handle_message(ids[0], {"type": "set_tournament", "on": True})
    return mgr, room, ids, wss

async def end_match(mgr, room, points):
    """finish the running match as if the market ran out, with these card totals {id: points}"""
    g = room.game
    for p in g.players:
        p.hand = [W.WhotCard('Circle', points[p.id])] if points.get(p.id) else []
    g._finish("market")
    await mgr._after_action(room)

def names(room, ids): return [room.t["names"][i] for i in ids]

async def main():
    # ---- the pure rule ----
    rows = lambda *pts: [{"id": f"p{i}", "points": p} for i, p in enumerate(pts)]
    check("worst: one highest total", RM.tournament_worst(rows(3, 9, 5)) == ["p1"])
    check("worst: a tie for the highest", RM.tournament_worst(rows(9, 2, 9)) == ["p0", "p2"])
    check("worst: everyone tied", RM.tournament_worst(rows(4, 4, 4)) == ["p0", "p1", "p2"])
    check("worst: an emptied hand is never the worst", RM.tournament_worst(rows(0, 6, 3)) == ["p1"])
    check("worst: nothing to rank", RM.tournament_worst([]) == [])

    # ---- starting ----
    mgr, room, (A, B), w = await table(2)
    await mgr.handle_message(A, {"type": "start_game"})
    check("start: a tournament needs 3 players", "at least 3" in w[A].last("error")["message"] and room.t is None)
    mgr, room, (A, B, C), w = await table(3)
    await mgr.handle_message(B, {"type": "set_tournament", "on": False})
    check("start: only the host can switch it", room.tournament is True and w[B].last("error") is not None)
    await mgr.handle_message(A, {"type": "start_game"})
    t = room.t
    check("start: round 1, a normal match, everyone in", t["stage"] == "match" and t["kind"] == "match" and t["round"] == 1 and set(t["alive"]) == {A, B, C})
    check("start: everyone is dealt in", {p.id for p in room.game.players} == {A, B, C} and room.started)
    check("start: every game_state carries the tournament", w[B].last("game_state")["state"]["t"]["round"] == 1)
    check("start: the room update says it is a tournament", w[A].last("room_update")["tournament"] is True)

    # ---- a match with one clear loser ----
    first_game = room.game
    await end_match(mgr, room, {A: 3, B: 9, C: 5})
    t = room.t
    check("match 1: the highest total is out", [o["id"] for o in t["out"]] == [B] and t["out"][0]["reason"] == "highest total")
    check("match 1: each knock-out remembers its round", t["out"][0]["round"] == 1)
    check("match 1: the rest get ready for round 2", t["stage"] == "ready" and t["kind"] == "match" and t["round"] == 2 and t["players"] == [A, C] and t["alive"] == [A, C])
    check("match 1: the result stays on screen until the next game starts", room.game is first_game and room.game.game_over)
    await mgr.handle_message(A, {"type": "tournament_ready"})
    check("ready: one tap is not enough", room.game is first_game and A in room.t["ready"])
    await mgr.handle_message(B, {"type": "tournament_ready"})
    check("ready: someone who is out cannot tap Ready", B not in room.t["ready"])
    await mgr.handle_message(C, {"type": "tournament_ready"})
    check("ready: everyone in is Ready, the next match starts with just them", room.game is not first_game and not room.game.game_over and {p.id for p in room.game.players} == {A, C} and room.t["stage"] == "match")
    check("ready: the knocked-out player keeps a seat and watches", B in room.players and w[B].last("game_state")["state"]["is_spectator"] is True)
    check("ready: the new game has fresh hands and the room's rules", all(len(p.hand) == 5 for p in room.game.players) and room.game.rules == room.rules)

    # ---- the final ----
    await end_match(mgr, room, {A: 4, C: 8})
    t = room.t
    check("final: the last player in is the champion", t["stage"] == "done" and t["champion"] == A and t["champion_name"] == "A")
    check("final: the order they went out is kept", [o["id"] for o in t["out"]] == [B, C])
    await mgr.handle_message(A, {"type": "return_to_lobby"})
    check("after: back to the waiting room, everyone still connected stays", room.started is False and room.t is None and set(room.players) == {A, B, C})
    check("after: the waiting room remembers the champion", room.last_result == {"winner": "A", "reason": "tournament"})
    check("after: it is still a tournament room", room.tournament is True)

    # ---- a tie for the highest total: play-off ----
    mgr, room, (A, B, C, D), w = await table(4)
    await mgr.handle_message(A, {"type": "start_game"})
    await end_match(mgr, room, {A: 2, B: 9, C: 9, D: 5})
    t = room.t
    check("tie: nobody is out yet", t["out"] == [] and len(t["alive"]) == 4)
    check("tie: only the tied players play off", t["stage"] == "ready" and t["kind"] == "playoff" and t["players"] == [B, C])
    await mgr.handle_message(A, {"type": "tournament_ready"})
    check("tie: a player who is not in the play-off cannot tap Ready", A not in room.t["ready"])
    await mgr.handle_message(B, {"type": "tournament_ready"}); await mgr.handle_message(C, {"type": "tournament_ready"})
    check("tie: the play-off is a game for just the two of them", {p.id for p in room.game.players} == {B, C} and room.t["kind"] == "playoff" and room.t["stage"] == "match")
    check("tie: the others watch it", w[A].last("game_state")["state"]["is_spectator"] and w[D].last("game_state")["state"]["is_spectator"])
    await end_match(mgr, room, {B: 7, C: 7})
    check("tie: a drawn play-off is played again", room.t["kind"] == "playoff" and room.t["stage"] == "ready" and room.t["players"] == [B, C] and room.t["out"] == [])
    await mgr.handle_message(B, {"type": "tournament_ready"}); await mgr.handle_message(C, {"type": "tournament_ready"})
    await end_match(mgr, room, {B: 5, C: 12})
    t = room.t
    check("play-off: the loser is out", [o["id"] for o in t["out"]] == [C] and t["out"][0]["reason"] == "play-off")
    check("play-off: the winner rejoins everyone for the next match", t["kind"] == "match" and t["stage"] == "ready" and t["players"] == [A, B, D] and t["round"] == 2)

    # ---- everyone tied ----
    mgr, room, (A, B, C), w = await table(3)
    await mgr.handle_message(A, {"type": "start_game"})
    await end_match(mgr, room, {A: 6, B: 6, C: 6})
    check("all tied: everyone plays off", room.t["kind"] == "playoff" and room.t["players"] == [A, B, C] and room.t["out"] == [])

    # ---- the host removes someone who is not Ready ----
    mgr, room, (A, B, C, D), w = await table(4)
    await mgr.handle_message(A, {"type": "start_game"})
    await end_match(mgr, room, {A: 1, B: 9, C: 2, D: 3})          # B is out; A, C, D get ready
    await mgr.handle_message(A, {"type": "tournament_ready"}); await mgr.handle_message(C, {"type": "tournament_ready"})
    await mgr.handle_message(C, {"type": "tournament_remove", "player_id": D})
    check("remove: only the host can remove", D in room.t["players"])
    await mgr.handle_message(A, {"type": "tournament_remove", "player_id": C})
    check("remove: someone who is already Ready cannot be removed", C in room.t["players"])
    await mgr.handle_message(A, {"type": "tournament_remove", "player_id": A})
    check("remove: the host cannot remove themselves", A in room.t["players"])
    await mgr.handle_message(A, {"type": "tournament_remove", "player_id": D})
    o = room.t["out"][-1]
    check("remove: the host removes a player who is not Ready", o["id"] == D and o["reason"] == "removed by host" and D not in room.t["alive"])
    check("remove: with everyone left Ready, the match starts without them", room.t["stage"] == "match" and {p.id for p in room.game.players} == {A, C})
    check("remove: the removed player keeps watching", D in room.players and w[D].last("game_state")["state"]["is_spectator"])

    # ---- someone leaves between matches ----
    mgr, room, (A, B, C, D), w = await table(4)
    await mgr.handle_message(A, {"type": "start_game"})
    await end_match(mgr, room, {A: 1, B: 9, C: 2, D: 3})
    await mgr.handle_message(A, {"type": "tournament_ready"}); await mgr.handle_message(C, {"type": "tournament_ready"})
    await mgr.handle_message(D, {"type": "leave_room"})
    check("leave: leaving between matches puts you out", room.t["out"][-1]["id"] == D and room.t["out"][-1]["reason"] == "left" and D not in room.players)
    check("leave: the others are all Ready so the match starts", room.t["stage"] == "match" and {p.id for p in room.game.players} == {A, C})
    await mgr.handle_message(B, {"type": "leave_room"})
    check("leave: a knocked-out player leaving changes nothing", [o["id"] for o in room.t["out"]].count(B) == 1 and room.t["stage"] == "match")

    # ---- someone leaves in the middle of a match ----
    mgr, room, (A, B, C), w = await table(3)
    await mgr.handle_message(A, {"type": "start_game"})
    await mgr.handle_message(C, {"type": "leave_room"})
    check("mid-match leave: they are out and the match carries on", room.t["out"][-1]["reason"] == "left" and room.t["stage"] == "match" and not room.game.game_over)
    await end_match(mgr, room, {A: 8, B: 2})
    check("mid-match leave: the loser is out and the other wins the tournament", room.t["stage"] == "done" and room.t["champion"] == B)

    # ---- everyone else leaves: the last player wins by default ----
    mgr, room, (A, B, C), w = await table(3)
    await mgr.handle_message(A, {"type": "start_game"})
    await mgr.handle_message(B, {"type": "leave_room"}); await mgr.handle_message(C, {"type": "leave_room"})
    check("forfeit: the last player at the table is the champion", room.t["stage"] == "done" and room.t["champion"] == A)

    # ---- guards ----
    mgr, room, (A, B, C), w = await table(3)
    await mgr.handle_message(A, {"type": "start_game"})
    await end_match(mgr, room, {A: 1, B: 9, C: 2})
    await mgr.handle_message(A, {"type": "return_to_lobby"})
    check("guard: nobody can go back to the waiting room mid-tournament", room.started and w[A].last("error")["message"] == "The tournament is still running")
    await mgr.handle_message(A, {"type": "rematch"})
    check("guard: a rematch is not possible mid-tournament", room.t is not None and room.t["stage"] == "ready")
    await mgr.handle_message(A, {"type": "set_tournament", "on": False})
    check("guard: the option cannot be changed once it has started", room.tournament is True)

    # ---- a normal game is untouched ----
    mgr, room, (A, B, C), w = await table(3, tournament=False)
    await mgr.handle_message(A, {"type": "start_game"})
    check("normal: no tournament state", room.t is None and w[B].last("game_state")["state"]["t"] is None)
    await end_match(mgr, room, {A: 1, B: 9, C: 2})
    check("normal: a finished game ends as before, no Ready step", room.t is None and room.game.game_over)
    await mgr.handle_message(A, {"type": "rematch"})
    check("normal: rematch still works", not room.game.game_over and len(room.game.players) == 3)

    # ---- computers tap Ready by themselves, after a pause ----
    mgr, room, (A,), w = await table(1, bots=2)
    await mgr.handle_message(A, {"type": "start_game"})
    first = room.game
    bot_ids = list(room.bots)
    await end_match(mgr, room, {A: 1, bot_ids[0]: 9, bot_ids[1]: 3})
    check("bots: not Ready at once, so the result can be read", room.t["ready"] == [] and room.game is first)
    check("bots: the result stays up while they wait", room.t["stage"] == "ready" and set(room.t["players"]) == {A, bot_ids[1]})
    check("bots: with a human playing there is no countdown (the game waits for the human)", room.t["next_at"] is None)
    await asyncio.sleep(0.2)
    check("bots: the computer taps Ready by itself after a moment", room.t["ready"] == [bot_ids[1]])
    check("bots: but the game waits for the human", room.game is first)
    await mgr.handle_message(A, {"type": "tournament_ready"})
    check("bots: the next match starts once the human is Ready too", room.game is not first and not room.game.game_over)
    for t_ in (room.turn_task, room.bot_task):
        if t_: t_.cancel()

    # ---- only computers left to play: a longer pause, so a knocked-out player can read why ----
    mgr, room, (A,), w = await table(1, bots=2)
    await mgr.handle_message(A, {"type": "start_game"})
    first = room.game
    bot_ids = list(room.bots)
    await end_match(mgr, room, {A: 9, bot_ids[0]: 1, bot_ids[1]: 3})
    check("only computers: the human is out", [o["id"] for o in room.t["out"]] == [A] and set(room.t["players"]) == set(bot_ids))
    import time as _time
    check("only computers: the table publishes when the next game starts", room.t["next_at"] is not None and 0 < room.t["next_at"] - _time.time() <= RM.T_RESULT_PAUSE + 0.05)
    await asyncio.sleep(0.15)
    check("only computers: they have not started yet after the normal wait", room.game is first and room.t["stage"] == "ready")
    await asyncio.sleep(0.4)
    check("only computers: after the longer pause they play on, and the human can watch", room.game is not first and not room.game.game_over and A in room.players)
    check("only computers: the countdown is cleared once the game starts", room.t["next_at"] is None)
    check("only computers: the human watching sees the new game as a spectator", w[A].last("game_state")["state"]["is_spectator"] is True)
    for t_ in (room.turn_task, room.bot_task):
        if t_: t_.cancel()

    # ---- the last human leaves: nothing keeps running ----
    mgr, room, (A,), w = await table(1, bots=2)
    await mgr.handle_message(A, {"type": "start_game"})
    bot_ids = list(room.bots)
    await end_match(mgr, room, {A: 9, bot_ids[0]: 1, bot_ids[1]: 3})
    pending = list(room.t_tasks)
    check("last human leaves: computers are waiting to tap Ready", len(pending) == 2)
    await mgr.handle_message(A, {"type": "leave_room"})
    await asyncio.sleep(0.1)
    check("last human leaves: the room is gone", room.code not in mgr.rooms)
    check("last human leaves: the computers' timers were cancelled", all(p.cancelled() or p.done() for p in pending) and room.t_tasks == [])

asyncio.run(main())
print("ALL PASSED")
