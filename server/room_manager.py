import asyncio
import json
import random
## import string
import time
import uuid

from whot_engine import WhotGame, Player

TURN_SECONDS = 30

HOST_GRACE = 15      # seconds before a disconnected host hands over
LOBBY_GRACE = 60     # empty waiting room is deleted after this
GAME_GRACE = 300     # empty game room is deleted after this
AFK_LIMIT = 3        # consecutive missed turns before a player is removed

# no 0/O/1/I so codes are never misread when typed or read aloud
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

def gen_room_code():
    return ''.join(random.choices(CODE_CHARS, k=5))


class Room:
    def __init__(self, code, host_id):
        self.code = code
        self.host_id = host_id
        self.players = {}
        self.order = []
        self.spectators = {}
        self.game = None
        self.started = False
        self.turn_task = None
        self.turn_deadline = None
        self.cleanup_task = None
        self.host_task = None
        self.afk = {}              # player id -> consecutive missed turns
        self.last_result = None    # shown in the waiting room after a game

    def add_player(self, player_id, name):
        if player_id in self.players:
            return
        self.players[player_id] = Player(player_id, name)
        self.order.append(player_id)

    def remove_player(self, player_id):
        if player_id in self.players:
            del self.players[player_id]
            self.order.remove(player_id)

    def add_spectator(self, spectator_id, name):
        self.spectators[spectator_id] = name or "Spectator"

    def remove_spectator(self, spectator_id):
        self.spectators.pop(spectator_id, None)

    def lobby_state(self):
        return {
            "type": "room_update",
            "room_code": self.code,
            "host_id": self.host_id,
            "started": self.started,
            "players": [{"id": pid, "name": p.name} for pid, p in self.players.items()],
            "last_result": self.last_result,
        }

    def start_game(self):
        # fresh Player objects every time, so a rematch never inherits old hands
        fresh = [Player(pid, self.players[pid].name) for pid in self.order]
        self.players = {p.id: p for p in fresh}
        self.game = WhotGame(fresh)
        self.started = True
        self.afk = {}
        self.last_result = None


class RoomManager:
    def __init__(self):
        self.connections = {}
        self.rooms = {}
        self.player_rooms = {}
        self.token_to_pid = {}   # secret session token -> public player id

    def register(self, token, ws):
        pid = self.token_to_pid.get(token)
        if pid is None:
            pid = uuid.uuid4().hex[:12]
            self.token_to_pid[token] = pid
        self.connections[pid] = ws
        return pid

    async def disconnect(self, client_id, ws=None):
        if ws is not None and self.connections.get(client_id) is not ws:
            return  # a newer connection has already replaced this one
        self.connections.pop(client_id, None)
        room = self._get_room(client_id)
        if not room:
            return
        if room.started and room.game:
            p = room.game.get_player(client_id)
            if p:
                p.connected = False
                await self.broadcast_game_state(room)
            else:
                room.remove_spectator(client_id)
        elif client_id in room.players:
            room.remove_player(client_id)
            await self.broadcast_lobby(room)
        if client_id == room.host_id:
            self._schedule_host_check(room)
        if self._room_is_empty(room):
            self._schedule_cleanup(room)

    async def send(self, client_id, payload):
        ws = self.connections.get(client_id)
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                pass

    async def broadcast_lobby(self, room):
        payload = room.lobby_state()
        for pid in room.order:
            await self.send(pid, payload)
        for sid in room.spectators:
            await self.send(sid, payload)

    async def send_game_state_to(self, room, client_id):
        state = room.game.state_for(client_id)
        state["turn_deadline"] = room.turn_deadline
        await self.send(client_id, {"type": "game_state", "state": state})

    async def broadcast_game_state(self, room):
        for pid in room.order:
            state = room.game.state_for(pid)
            state["turn_deadline"] = room.turn_deadline
            await self.send(pid, {"type": "game_state", "state": state})
        for sid in list(room.spectators.keys()):
            state = room.game.state_for(sid)
            state["turn_deadline"] = room.turn_deadline
            await self.send(sid, {"type": "game_state", "state": state})

    async def broadcast(self, room, payload):
        for pid in room.order:
            await self.send(pid, payload)
        for sid in room.spectators:
            await self.send(sid, payload)

    def _get_room(self, client_id):
        code = self.player_rooms.get(client_id)
        return self.rooms.get(code)

    # ---------------- Room housekeeping ----------------

    def _member_ids(self, room):
        ids = set(room.order) | set(room.spectators)
        if room.game:
            ids |= {p.id for p in room.game.players}
        return ids

    def _room_is_empty(self, room):
        return not any(
            pid in self.connections and self.player_rooms.get(pid) == room.code
            for pid in self._member_ids(room)
        )

    def _delete_room(self, room):
        self._stop_timer(room)
        for t in (room.cleanup_task, room.host_task):
            if t and t is not asyncio.current_task():
                t.cancel()
        for pid in self._member_ids(room):
            if self.player_rooms.get(pid) == room.code:
                self.player_rooms.pop(pid, None)
        self.rooms.pop(room.code, None)

    def _touch(self, room):
        """Someone (re)joined: cancel any pending cleanup."""
        if room.cleanup_task:
            room.cleanup_task.cancel()
            room.cleanup_task = None

    def _schedule_cleanup(self, room):
        if room.cleanup_task:
            room.cleanup_task.cancel()
        delay = GAME_GRACE if room.started else LOBBY_GRACE
        room.cleanup_task = asyncio.create_task(self._cleanup_later(room, delay))

    async def _cleanup_later(self, room, delay):
        try:
            await asyncio.sleep(delay)
        except asyncio.CancelledError:
            return
        if self.rooms.get(room.code) is room and self._room_is_empty(room):
            self._delete_room(room)

    def _pick_new_host(self, room):
        if room.started and room.game:
            candidates = [p.id for p in room.game.players
                          if p.connected and p.id in self.connections and p.id in room.players]
        else:
            candidates = list(room.order)
        if candidates and room.host_id not in candidates:
            room.host_id = candidates[0]
            return True
        return False

    def _schedule_host_check(self, room):
        if room.host_task:
            room.host_task.cancel()
        room.host_task = asyncio.create_task(self._host_check_later(room))

    async def _host_check_later(self, room):
        try:
            await asyncio.sleep(HOST_GRACE)
        except asyncio.CancelledError:
            return
        if self.rooms.get(room.code) is not room:
            return
        if self._pick_new_host(room):
            if room.started and room.game:
                await self.broadcast_game_state(room)
            else:
                await self.broadcast_lobby(room)

    async def _reset_to_lobby(self, room):
        """Game finished: everyone goes back to the waiting room of the same room."""
        game = room.game
        winner = game.get_player(game.winner_id) if game.winner_id else None
        room.last_result = {"winner": winner.name if winner else None, "reason": game.end_reason}
        staying = [p.id for p in game.players
                   if p.connected and p.id in self.connections and p.id in room.players]
        for pid in list(room.order):
            if pid not in staying:
                room.remove_player(pid)                  # gone players don't carry over
        for sid, name in list(room.spectators.items()):  # spectators join the next game if there is room
            if len(room.order) >= 8:
                break
            if sid in self.connections:
                room.add_player(sid, name)
                room.remove_spectator(sid)
        self._stop_timer(room)
        room.game = None
        room.started = False
        room.afk = {}
        self._pick_new_host(room)
        everyone = list(room.order) + list(room.spectators)
        for pid in everyone:
            await self.send(pid, {"type": "back_to_lobby"})
        await self.broadcast_lobby(room)

    async def _kick_afk(self, room, player):
        pid = player.id
        room.game.remove_player(pid, "was removed for being inactive")
        room.remove_player(pid)
        room.afk.pop(pid, None)
        self.player_rooms.pop(pid, None)
        await self.send(pid, {"type": "kicked", "message": "You were removed from the game for being inactive."})
        if pid == room.host_id:
            self._pick_new_host(room)
        if self._room_is_empty(room):
            self._delete_room(room)
            return
        await self._after_action(room)

    async def _after_action(self, room):
        """After any move/draw/leave: stop the clock if the game ended, else start the next turn."""
        if room.game.game_over:
            self._stop_timer(room)
            await self.broadcast_game_state(room)
        else:
            await self.start_turn_timer(room)

    # ---------------- Turn Timer ----------------

    async def start_turn_timer(self, room):
        if room.turn_task:
            room.turn_task.cancel()
        deadline = time.time() + TURN_SECONDS
        room.turn_deadline = deadline
        room.turn_task = asyncio.create_task(self._turn_timeout_watcher(room, deadline))
        await self.broadcast_game_state(room)

    async def _turn_timeout_watcher(self, room, deadline):
        try:
            await asyncio.sleep(TURN_SECONDS)
        except asyncio.CancelledError:
            return

        if not room.game or room.game.game_over:
            return
        if room.turn_deadline != deadline:
            return  # a newer timer superseded this one

        current = room.game.current_player()
        pid = current.id
        room.afk[pid] = room.afk.get(pid, 0) + 1
        if room.afk[pid] >= AFK_LIMIT:
            await self._kick_afk(room, current)
            return
        if room.afk[pid] == AFK_LIMIT - 1:
            await self.send(pid, {"type": "notice", "message":
                "You've missed 2 turns in a row. Miss one more and you'll be removed from the game."})
        room.game.force_timeout_draw(pid)
        await self._after_action(room)

    def _stop_timer(self, room):
        if room.turn_task:
            room.turn_task.cancel()
            room.turn_task = None
        room.turn_deadline = None

    # ---------------- Message Handling ----------------

    async def handle_message(self, client_id, msg):
        mtype = msg.get("type")

        if mtype == "create_room":
            code = gen_room_code()
            while code in self.rooms:
                code = gen_room_code()
            room = Room(code, client_id)
            room.add_player(client_id, msg.get("player_name", "Player"))
            self.rooms[code] = room
            self.player_rooms[client_id] = code
            await self.broadcast_lobby(room)

        elif mtype == "join_room":
            code = msg.get("room_code", "").upper()
            room = self.rooms.get(code)
            if not room:
                await self.send(client_id, {"type": "error", "message": "Room not found"})
                return
            self._touch(room)        

            if room.started:
                room.add_spectator(client_id, msg.get("player_name", "Spectator"))
                self.player_rooms[client_id] = code
                await self.send_game_state_to(room, client_id)
                await self.broadcast(room, {
                    "type": "info",
                    "message": f"{msg.get('player_name', 'Someone')} joined as spectator"
                })
                return

            if len(room.players) >= 8:
                await self.send(client_id, {"type": "error", "message": "Room full (max 8 players)"})
                return

            room.add_player(client_id, msg.get("player_name", "Player"))
            self.player_rooms[client_id] = code
            await self.broadcast_lobby(room)

        elif mtype == "rejoin":
            code = msg.get("room_code", "").upper()
            room = self.rooms.get(code)
            if not room:
                await self.send(client_id, {"type": "rejoin_failed"})
                return

            self.player_rooms[client_id] = code
            self._touch(room)

            if room.started and room.game:
                p = room.game.get_player(client_id)
                if p:
                    p.connected = True
                    await self.broadcast_game_state(room)
                else:
                    room.add_spectator(client_id, msg.get("player_name", "Spectator"))
                    await self.send_game_state_to(room, client_id)
            else:
                if client_id not in room.players:
                    if len(room.players) >= 8:
                        await self.send(client_id, {"type": "rejoin_failed"})
                        return
                    room.add_player(client_id, msg.get("player_name", "Player"))
                await self.broadcast_lobby(room)

        elif mtype == "start_game":
            room = self._get_room(client_id)
            if not room or room.host_id != client_id:
                await self.send(client_id, {"type": "error", "message": "Only host can start"})
                return
            if room.started:
                return
            if len(room.players) < 2:
                await self.send(client_id, {"type": "error", "message": "Need at least 2 players"})
                return
            room.start_game()
            await self.start_turn_timer(room)

        elif mtype in ("play_card", "play_cards"):
            room = self._get_room(client_id)
            if not room or not room.game:
                return
            ids = msg.get("card_ids")
            if ids is None:
                ids = [msg.get("card_id")]
            if not isinstance(ids, list):
                return
            result = room.game.play_cards(client_id, ids, msg.get("chosen_shape"))
            if not result.get("success"):
                await self.send(client_id, {"type": "error", "message": result.get("error")})
                return
            room.afk[client_id] = 0
            if result.get("penalty") == "last_card":
                await self.send(client_id, {"type": "notice", "message":
                    f"You didn't call Last Card before playing your final card, so you don't win. "
                    f"You draw {result['drawn']} cards."})
            await self._after_action(room)

        elif mtype == "draw_card":
            room = self._get_room(client_id)
            if not room or not room.game:
                return
            result = room.game.draw_card(client_id)
            if not result.get("success"):
                await self.send(client_id, {"type": "error", "message": result.get("error")})
                return
            room.afk[client_id] = 0
            await self._after_action(room)

        elif mtype == "last_card":
            room = self._get_room(client_id)
            if not room or not room.game:
                return
            result = room.game.call_last_card(client_id)
            if not result.get("success"):
                await self.send(client_id, {"type": "error", "message": result.get("error")})
                return
            await self.broadcast_game_state(room)

        elif mtype == "return_to_lobby":
            room = self._get_room(client_id)
            if not room or not (room.started and room.game and room.game.game_over):
                return
            if client_id not in room.players:
                return                                   # spectators can't reset the room
            await self._reset_to_lobby(room)

        elif mtype == "leave_room":
            room = self._get_room(client_id)
            self.player_rooms.pop(client_id, None)
            if not room:
                return
            player_left_game = False
            if room.started and room.game:
                if room.game.get_player(client_id):
                    room.game.remove_player(client_id)   # no-op once the game is over
                    room.remove_player(client_id)
                    player_left_game = True
                else:
                    room.remove_spectator(client_id)
            else:
                room.remove_player(client_id)
            if client_id == room.host_id:
                self._pick_new_host(room)                # chose to leave: hand over at once
            if self._room_is_empty(room):
                self._delete_room(room)
                return
            if room.started and room.game:
                if player_left_game:
                    await self._after_action(room)
                else:
                    await self.broadcast_game_state(room)
            else:
                await self.broadcast_lobby(room)

        elif mtype == "rematch":
            room = self._get_room(client_id)
            if not room or room.host_id != client_id:
                await self.send(client_id, {"type": "error", "message": "Only the host can start a rematch"})
                return
            if not (room.started and room.game and room.game.game_over):
                return
            staying = [p.id for p in room.game.players
                       if p.connected and p.id in self.connections and p.id in room.players]
            if len(staying) < 2:
                await self.send(client_id, {"type": "error", "message": "Need at least 2 players for a rematch"})
                return
            for pid in list(room.order):
                if pid not in staying:
                    room.remove_player(pid)              # gone players don't carry over
            room.start_game()
            await self.start_turn_timer(room)