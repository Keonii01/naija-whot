import copy
import random
import uuid

SHAPES = ['Circle', 'Triangle', 'Cross', 'Square', 'Star', 'Whot']

LAST_CARD_PENALTY = 5   # cards drawn for winning without calling Last Card

SPECIAL_NAMES = {
    1: "Hold On",
    2: "Pick Two",
    5: "Pick Three",
    8: "Suspension",
    14: "General Market",
    20: "Whot",
}


# House rules a host can switch per room. The server enforces them; the client only shows them.
DEFAULT_RULES = {
    "pick_three_action": True,    # False: a 5 is an ordinary card (only Pick Two is a penalty)
    "cancel_penalties": False,    # True: with 3+ players matching Pick cards cancel instead of redirecting
    "hold_on_any_card": False,    # True: after you play a 1, your extra play can be any card
}


def clean_rules(raw):
    out = dict(DEFAULT_RULES)
    if isinstance(raw, dict):
        for key in DEFAULT_RULES:
            if isinstance(raw.get(key), bool):
                out[key] = raw[key]
    return out


class WhotCard:
    def __init__(self, shape, number):
        self.id = str(uuid.uuid4())
        self.shape = shape
        self.number = number

    def to_dict(self):
        return {
            "id": self.id,
            "shape": self.shape,
            "number": self.number,
            "special": SPECIAL_NAMES.get(self.number),
        }

    def __repr__(self):
        return f"{self.shape}{self.number}"


def build_deck():
    cards = []
    for n in [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14]:
        cards.append(WhotCard('Circle', n))
        cards.append(WhotCard('Triangle', n))
    for n in [1, 2, 3, 5, 7, 10, 11, 13, 14]:
        cards.append(WhotCard('Cross', n))
        cards.append(WhotCard('Square', n))
    for n in [1, 2, 3, 4, 5, 7, 8]:
        cards.append(WhotCard('Star', n))
    for _ in range(5):
        cards.append(WhotCard('Whot', 20))
    return cards


class Player:
    def __init__(self, player_id, name):
        self.id = player_id
        self.name = name
        self.hand = []
        self.connected = True
        self.last_card_called = False
        self.is_bot = False

    def to_public_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "card_count": len(self.hand),
            "connected": self.connected,
            "last_card_called": self.last_card_called,
            "is_bot": self.is_bot,
        }

    def to_private_dict(self):
        d = self.to_public_dict()
        d["hand"] = [c.to_dict() for c in self.hand]
        return d


class WhotGame:
    MIN_PLAYERS = 2
    MAX_PLAYERS = 8

    def __init__(self, players, rules=None):
        assert self.MIN_PLAYERS <= len(players) <= self.MAX_PLAYERS, "2-8 players required"
        self.players = players
        self.rules = clean_rules(rules)
        self.free_play = False          # True right after a Hold On when the 'any card' rule is on
        # 2-4 players start with 5 cards, 5-8 with 3
        self.hand_size = 5 if len(players) <= 4 else 3
        # 2-player games reshuffle when the market runs out; 3-8 player games end and count points
        self.reshuffle_when_empty = len(players) == 2
        self.deck = build_deck()
        random.shuffle(self.deck)
        self.discard_pile = []
        self.pending_pick = 0
        self.pending_shape = None
        self.current_idx = 0
        self.game_over = False
        self.winner_id = None
        self.ranking = []
        self.end_reason = None
        self.last_action = "Game started!"
        self.event_seq = 0
        self.last_event = None          # the headline of the latest move, for the table's cue banner
        self._deal()

    def _event(self, type, actor_id, target_ids=(), amount=0, card=None, shape=None):
        """Record what just happened as data (public information only, never anyone's hand)."""
        self.event_seq += 1
        self.last_event = {"seq": self.event_seq, "type": type, "actor_id": actor_id,
                           "target_ids": list(target_ids), "amount": amount,
                           "card": card.to_dict() if card else None, "shape": shape}

    def _deal(self):
        for _ in range(self.hand_size):
            for p in self.players:
                p.hand.append(self.deck.pop())
        # the card that starts the table is never an action card (1, 2, 5, 8, 14, 20)
        first = self.deck.pop()
        while self.is_action(first.number):
            self.deck.insert(0, first)
            random.shuffle(self.deck)
            first = self.deck.pop()
        self.discard_pile.append(first)

    def is_action(self, number):
        """Action cards follow the room's rules: with Pick Three switched off, a 5 is an ordinary card."""
        if number == 5 and not self.rules["pick_three_action"]:
            return False
        return number in SPECIAL_NAMES

    @property
    def top_card(self):
        return self.discard_pile[-1]

    def current_player(self):
        return self.players[self.current_idx]

    def get_player(self, player_id):
        return next((p for p in self.players if p.id == player_id), None)

    def _advance(self, steps=1):
        self.free_play = False
        self.current_idx = (self.current_idx + steps) % len(self.players)

    def _reshuffle(self):
        if not self.reshuffle_when_empty or len(self.discard_pile) <= 1:
            return
        top = self.discard_pile.pop()
        self.deck = self.discard_pile
        self.discard_pile = [top]
        random.shuffle(self.deck)

    def draw_from_deck(self, player, count=1):
        drawn = []
        for _ in range(count):
            if not self.deck:
                self._reshuffle()
            if not self.deck:
                break
            card = self.deck.pop()
            player.hand.append(card)
            drawn.append(card)
        return drawn

    def _can_draw(self):
        return bool(self.deck) or (self.reshuffle_when_empty and len(self.discard_pile) > 1)

    def _finish(self, reason, winner=None):
        """End the game and build the ranking: lowest card total first, then fewest cards."""
        def key(p):
            return (sum(c.number for c in p.hand), len(p.hand))   # (points, cards)

        ordered = sorted(self.players, key=lambda p: (key(p), p is not winner))
        rows, prev_key, prev_was_winner, rank = [], None, False, 0
        for i, p in enumerate(ordered):
            k = key(p)
            if p is winner:
                rank = 1
            elif k == prev_key and not prev_was_winner:
                pass  # tied with the player above: share the rank
            else:
                rank = i + 1
            rows.append({"id": p.id, "name": p.name, "points": k[0], "cards": k[1], "rank": rank})
            prev_key, prev_was_winner = k, p is winner

        self.game_over = True
        self.end_reason = reason
        self.ranking = rows
        if winner is not None:
            self.winner_id = winner.id
        else:
            top = [r for r in rows if r["rank"] == 1]
            self.winner_id = top[0]["id"] if len(top) == 1 else None  # None = tie

    def _check_market_end(self):
        """Runs after every action: tidy Last Card calls, then see if the market has finished."""
        self._sync_last_card()
        if self.game_over or self._can_draw():
            return
        if self.playable_cards(self.current_player()):
            return
        self._finish("market")
        if self.winner_id:
            winner = self.get_player(self.winner_id)
            self.last_action = f"The market is finished! {winner.name} wins with the lowest card total."
        else:
            self.last_action = "The market is finished! It's a tie."

    def remove_player(self, player_id, note="left the game"):
        """A player leaves mid-game: their cards go back to the market."""
        player = self.get_player(player_id)
        if player is None or self.game_over:
            return
        idx = self.players.index(player)
        was_current = idx == self.current_idx
        self.deck = player.hand + self.deck          # bottom of the market
        self.players.pop(idx)
        self.free_play = False
        if len(self.players) == 1:
            self.current_idx = 0                     # only one seat is left: keep the index valid
            self._finish("forfeit", self.players[0])
            self.last_action = f"{player.name} {note}. {self.players[0].name} wins by default!"
            return
        if idx < self.current_idx:
            self.current_idx -= 1
        elif was_current:
            self.pending_pick = 0                    # the penalty leaves with them
        self.current_idx %= len(self.players)
        self.last_action = f"{player.name} {note}."
        self._check_market_end()

    def call_last_card(self, player_id):
        player = self.get_player(player_id)
        if player is None or self.game_over:
            return {"success": False, "error": "You're not in a running game"}
        if len(player.hand) != 1:
            return {"success": False, "error": "You can only call Last Card when you have one card left"}
        player.last_card_called = True
        return {"success": True}

    def _sync_last_card(self):
        """A Last Card call only counts while the player still holds exactly one card."""
        for p in self.players:
            if len(p.hand) != 1:
                p.last_card_called = False

    def _last_card_penalty(self, player, played):
        """Played the final card without calling Last Card: no win, draw penalty cards."""
        drawn = self.draw_from_deck(player, LAST_CARD_PENALTY)
        self._advance()
        self._event("last_card", player.id, [player.id], len(drawn))
        self.last_action = (f"{player.name} played {played} without calling Last Card! "
                            f"No win - draws {len(drawn)} cards.")
        self._check_market_end()
        return {"success": True, "penalty": "last_card", "drawn": len(drawn), "message": self.last_action}

    def _is_playable(self, card):
        if self.free_play:
            return True
        if self.pending_pick > 0:
            return card.number == self.top_card.number
        if card.shape == 'Whot':
            return True
        if self.pending_shape:
            return card.shape == self.pending_shape
        return card.shape == self.top_card.shape or card.number == self.top_card.number

    def playable_cards(self, player):
        return [c for c in player.hand if self._is_playable(c)]

    def play_card(self, player_id, card_id, chosen_shape=None):
        return self.play_cards(player_id, [card_id], chosen_shape)

    def play_cards(self, player_id, card_ids, chosen_shape=None):
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
                    self.last_action = f"{player.name} played {played} and WINS! \U0001F389"
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

    def _apply_combo(self, cards, player, chosen_shape):
        n = len(cards)
        number = cards[0].number

        if number == 20:
            self.pending_shape = chosen_shape
            self._advance()
            self._event("whot", player.id, card=cards[-1], shape=self.pending_shape)
            return f"Whot! Shape locked to {self.pending_shape}."

        if number == 1:
            self.free_play = self.rules["hold_on_any_card"]
            self._event("hold_on", player.id, [player.id], n, cards[-1])
            return "Hold On: plays again, any card!" if self.free_play else "Hold On: plays again."

        if number == 2 or (number == 5 and self.rules["pick_three_action"]):
            label = "Pick Two" if number == 2 else "Pick Three"
            amount = (2 if number == 2 else 3) * n
            if self.pending_pick > 0:
                if len(self.players) == 2:
                    return self._counter_two_player(player, amount, label)
                if self.rules["cancel_penalties"]:
                    return self._counter_cancel(player, amount, label)
            self.pending_pick += amount
            self._advance()
            self._event("pick", player.id, [self.current_player().id], self.pending_pick, cards[-1])
            return f"{label}! Pending pick now {self.pending_pick}."

        if number == 8:
            # skip one player per card, but never more than everyone else
            skipped = [self.players[(self.current_idx + 1 + i) % len(self.players)].id
                       for i in range(min(n, len(self.players) - 1))]
            self._advance(1 + min(n, len(self.players) - 1))
            self._event("suspended", player.id, skipped, len(skipped), cards[-1])
            return "Suspension! Next player skipped." if n == 1 else f"Suspension x{n}! Players skipped."

        if number == 14:
            for p in self.players:
                if p.id != player.id:
                    self.draw_from_deck(p, n)
            self._event("general_market", player.id, [p.id for p in self.players if p.id != player.id], n, cards[-1])
            return f"General Market! Everyone else draws {n}. Play again."

        self._advance()
        self._event("play", player.id, card=cards[-1])
        return ""

    def _counter_two_player(self, player, amount, label):
        """Two players: a counter cancels penalty cards one for one. Equal = nobody picks.
        If the counter is smaller, the counterer picks the leftover now. If it is bigger, the leftover
        comes back to the other player as a live penalty (they can counter it again or pick)."""
        net = self.pending_pick - amount
        if net == 0:
            self.pending_pick = 0
            self._advance()
            self._event("cancelled", player.id, [], amount)
            return f"{label} cancelled out. Nobody picks."
        if net > 0:
            drawn = self.draw_from_deck(player, net)
            self.pending_pick = 0
            self._advance()
            self._event("blocked", player.id, [player.id], len(drawn))
            return f"{player.name} blocks part of it and picks {len(drawn)}."
        self.pending_pick = -net
        self._advance()
        self._event("pick", player.id, [self.current_player().id], self.pending_pick)
        return f"Countered! Pending pick now {self.pending_pick}, back to the other player."

    def _counter_cancel(self, player, amount, label):
        """3+ players, cancel variant: a counter cancels the same number of penalty cards; whatever is
        left, from either side, goes live against the next player (who can counter it or pick)."""
        net = abs(self.pending_pick - amount)
        self.pending_pick = net
        self._advance()
        if net == 0:
            self._event("cancelled", player.id, [], amount)
            return f"{label} cancelled out. Nobody picks."
        self._event("pick", player.id, [self.current_player().id], net)
        return f"Countered! Pending pick now {net}."

    def draw_card(self, player_id):
        player = self.get_player(player_id)
        if player is None or self.current_player().id != player_id:
            return {"success": False, "error": "Not your turn"}

        if not self._can_draw():
            return {"success": False, "error": "The market is finished - play a card"}

        if self.pending_pick > 0:
            drawn = self.draw_from_deck(player, self.pending_pick)
            msg = f"{player.name} picks {len(drawn)} cards!"
            self.pending_pick = 0
            self._advance()
            self._event("pick_taken", player.id, [player.id], len(drawn))
            self.last_action = msg
            self._check_market_end()
            return {"success": True, "message": msg}

        drawn = self.draw_from_deck(player, 1)
        self._advance()
        self._event("draw", player.id, [player.id], len(drawn))
        self.last_action = f"{player.name} draws a card."
        self._check_market_end()
        return {"success": True, "message": self.last_action}

    def force_timeout_draw(self, player_id):
        """Called by the server when a player's turn timer expires."""
        player = self.get_player(player_id)
        if not player:
            return
        if self.pending_pick > 0:
            drawn = self.draw_from_deck(player, self.pending_pick)
            self.pending_pick = 0
        else:
            drawn = self.draw_from_deck(player, 1)
        self._advance()
        self._event("timeout_draw", player.id, [player.id], len(drawn))
        self.last_action = f"⏱️ {player.name} ran out of time and drew a card."
        self._check_market_end()

    def state_for(self, player_id):
        me = self.get_player(player_id)
        is_player = me is not None
        my_turn = is_player and not self.game_over and self.current_player().id == player_id
        extend = {}
        if my_turn:
            # for each card that can start a move: the cards that could legally be added to it
            for c in self.playable_cards(me):
                more = self.next_cards(player_id, [c.id])
                if more:
                    extend[c.id] = more
        return {
            "extend": extend,
            "playable_card_ids": [c.id for c in self.playable_cards(me)] if my_turn else [],
            "top_card": self.top_card.to_dict(),
            "pending_shape": self.pending_shape,
            "pending_pick": self.pending_pick,
            "free_play": self.free_play,
            "last_event": self.last_event,
            "rules": self.rules,
            "deck_count": len(self.deck),
            "current_player_id": self.current_player().id,
            "game_over": self.game_over,
            "winner_id": self.winner_id,
            "ranking": self.ranking,
            "end_reason": self.end_reason,
            "last_action": self.last_action,
            "is_spectator": not is_player,
            "players": [
                p.to_private_dict() if p.id == player_id else p.to_public_dict()
                for p in self.players
            ],
        }