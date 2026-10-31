"""One-off: lets one move be any legal sequence of cards (Hold On, General Market, ... then a final group).
Run from the server folder:  py patch_free_chains.py
It checks every spot first and changes nothing unless all of them are found."""
import sys

NEW_PLAY = '''    def play_cards(self, player_id, card_ids, chosen_shape=None):
        """Play the selected cards as one move. The cards are split into groups of equal numbers and played
        in the order selected, exactly as if you played one group at a time: every group before the last must
        leave the turn with the same player (Hold On, General Market, or a Suspension that skips everyone else).
        The move is checked on a throwaway copy first, so an illegal move changes nothing."""
        trial = copy.deepcopy(self)
        result = trial._play_cards(player_id, card_ids, chosen_shape)
        if not result["success"]:
            return result
        return self._play_cards(player_id, card_ids, chosen_shape)

    def next_cards(self, player_id, card_ids):
        """Ids of the cards in this player's hand that could legally be added after the selected cards."""
        player = self.get_player(player_id)
        if player is None or self.game_over or self.current_player().id != player_id:
            return []
        have = {c.id for c in player.hand}
        if len(set(card_ids)) != len(card_ids) or any(i not in have for i in card_ids):
            return []
        more = []
        for c in player.hand:
            if c.id in card_ids:
                continue
            trial = copy.deepcopy(self)
            if trial._play_cards(player_id, list(card_ids) + [c.id], "Star")["success"]:
                more.append(c.id)
        return more

    def _play_cards(self, player_id, card_ids, chosen_shape=None):
        player = self.get_player(player_id)
        if player is None or self.current_player().id != player_id:
            return {"success": False, "error": "Not your turn"}
        if not card_ids or len(set(card_ids)) != len(card_ids):
            return {"success": False, "error": "Invalid selection"}

        cards = []
        for cid in card_ids:
            card = next((c for c in player.hand if c.id == cid), None)
            if card is None:
                return {"success": False, "error": "Card not in hand"}
            cards.append(card)

        groups = []                       # runs of equal numbers, in the order selected
        for c in cards:
            if groups and groups[-1][0].number == c.number:
                groups[-1].append(c)
            else:
                groups.append([c])

        was_last_card = len(player.hand) == 1     # a longer move never needs the call
        played = " + ".join(repr(c) for c in cards)
        messages, headline = [], None
        for i, group in enumerate(groups):
            is_last = i == len(groups) - 1
            if not self._is_playable(group[0]):
                return {"success": False, "error": "Illegal move"}
            if group[0].shape == 'Whot' and chosen_shape not in [s for s in SHAPES if s != 'Whot']:
                return {"success": False, "error": "Choose a shape for Whot"}
            for card in group:
                player.hand.remove(card)
                self.discard_pile.append(card)
            self.free_play = False
            self.pending_shape = None

            if is_last:
                would_win = len(player.hand) == 0 and not self.is_action(group[-1].number)
                if would_win and was_last_card and not player.last_card_called:
                    return self._last_card_penalty(player, played)
                if would_win:
                    self._finish("win", player)
                    self._event("win", player.id, card=group[-1])
                    self.last_action = f"{player.name} played {played} and WINS! \\U0001F389"
                    return {"success": True, "game_over": True, "winner": player.name}

            msg = self._apply_combo(group, player, chosen_shape if is_last else None)
            if msg:
                messages.append(msg)
            if not is_last:
                if self.game_over or self.current_player().id != player.id:
                    return {"success": False, "error": "Nothing can be played after that card"}
                if self.last_event and self.last_event["type"] in ("general_market", "suspended"):
                    headline = dict(self.last_event)      # keep the loud part of the move for the cue banner

        if headline and self.last_event["type"] == "play":
            headline["seq"] = self.last_event["seq"]
            self.last_event = headline
        self.last_action = f"{player.name} played {played}. {' '.join(messages)}"
        self._check_market_end()
        return {"success": True, "message": self.last_action}

'''

NEW_EXTEND = '''        extend = {}
        if my_turn:
            # for each card that can start a move: the cards that could legally be added to it
            for c in self.playable_cards(me):
                more = self.next_cards(player_id, [c.id])
                if more:
                    extend[c.id] = more
'''

NEW_HANDLER = '''        elif mtype == "preview_play":
            # which cards could legally be added to the cards the player has selected (a hint, never a move)
            room = self._get_room(client_id)
            if not room or not room.game:
                return
            ids = msg.get("card_ids")
            if not isinstance(ids, list) or len(ids) > 20 or not all(isinstance(i, str) for i in ids):
                return
            await self.send(client_id, {"type": "play_preview", "card_ids": ids,
                                        "next": room.game.next_cards(client_id, ids)})

'''

def replace_method(src, name, new):
    head = f"    def {name}("
    if src.count(head) != 1:
        return None
    a = src.index(head)
    b = src.find("\n    def ", a + 1)
    if b == -1:
        return None
    return src[:a] + new + src[b + 1:]

def edit(path, fn):
    raw = open(path, newline="", encoding="utf-8").read()
    crlf = "\r\n" in raw
    s = raw.replace("\r\n", "\n")
    s = fn(s)
    return s.replace("\n", "\r\n") if crlf else s

def engine(s):
    if "def next_cards(" in s:
        sys.exit("whot_engine.py already has next_cards: nothing to do.")
    if s.count("import random\nimport uuid\n") != 1:
        sys.exit("whot_engine.py: could not find the import lines. Nothing was changed.")
    s = s.replace("import random\nimport uuid\n", "import copy\nimport random\nimport uuid\n")
    t = replace_method(s, "play_cards", NEW_PLAY)
    if t is None:
        sys.exit("whot_engine.py: could not find play_cards. Nothing was changed.")
    s = t
    if "    def _chain_error(" in s:
        t = replace_method(s, "_chain_error", "")
        if t is None:
            sys.exit("whot_engine.py: could not remove _chain_error. Nothing was changed.")
        s = t
    start = "        combos = {}\n        hold_follow = {}\n"
    end = '        return {\n            "combos": combos,\n            "hold_follow": hold_follow,\n'
    if s.count(start) != 1 or s.count(end) != 1 or s.index(start) > s.index(end):
        sys.exit("whot_engine.py: could not find the combos block in state_for. Nothing was changed.")
    a, b = s.index(start), s.index(end)
    s = s[:a] + NEW_EXTEND + '        return {\n            "extend": extend,\n' + s[b + len(end):]
    return s

def manager(s):
    if '"preview_play"' in s:
        sys.exit("room_manager.py already has preview_play: nothing to do.")
    anchor = '        elif mtype == "draw_card":\n'
    if s.count(anchor) != 1:
        sys.exit("room_manager.py: could not find the draw_card handler. Nothing was changed.")
    return s.replace(anchor, NEW_HANDLER + anchor)

def main():
    new_engine = edit("whot_engine.py", engine)       # both are prepared before either is written
    new_manager = edit("room_manager.py", manager)
    open("whot_engine.py", "w", newline="", encoding="utf-8").write(new_engine)
    open("room_manager.py", "w", newline="", encoding="utf-8").write(new_manager)
    print("OK: whot_engine.py and room_manager.py updated")

if __name__ == "__main__":
    main()
