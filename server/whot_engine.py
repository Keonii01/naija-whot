import random
import uuid

SHAPES = ['Circle', 'Triangle', 'Cross', 'Square', 'Star', 'Whot']

SPECIAL_NAMES = {
    1: "Hold On",
    2: "Pick Two",
    5: "Pick Three",
    8: "Suspension",
    14: "General Market",
    20: "Whot",
}


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

    def to_public_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "card_count": len(self.hand),
            "connected": self.connected,
        }

    def to_private_dict(self):
        d = self.to_public_dict()
        d["hand"] = [c.to_dict() for c in self.hand]
        return d


class WhotGame:
    MIN_PLAYERS = 2
    MAX_PLAYERS = 8

    def __init__(self, players):
        assert self.MIN_PLAYERS <= len(players) <= self.MAX_PLAYERS, "2-8 players required"
        self.players = players
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
        self._deal()

    def _deal(self):
        for _ in range(self.hand_size):
            for p in self.players:
                p.hand.append(self.deck.pop())
        first = self.deck.pop()
        while first.shape == 'Whot':
            self.deck.insert(0, first)
            random.shuffle(self.deck)
            first = self.deck.pop()
        self.discard_pile.append(first)

    @property
    def top_card(self):
        return self.discard_pile[-1]

    def current_player(self):
        return self.players[self.current_idx]

    def get_player(self, player_id):
        return next((p for p in self.players if p.id == player_id), None)

    def _advance(self, steps=1):
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
        """Market is finished and the player on turn has nothing to play: count the cards."""
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

    def remove_player(self, player_id):
        """A player leaves mid-game: their cards go back to the market."""
        player = self.get_player(player_id)
        if player is None or self.game_over:
            return
        idx = self.players.index(player)
        was_current = idx == self.current_idx
        self.deck = player.hand + self.deck          # bottom of the market
        self.players.pop(idx)
        if len(self.players) == 1:
            self._finish("forfeit", self.players[0])
            self.last_action = f"{player.name} left. {self.players[0].name} wins by default!"
            return
        if idx < self.current_idx:
            self.current_idx -= 1
        elif was_current:
            self.pending_pick = 0                    # the penalty leaves with them
        self.current_idx %= len(self.players)
        self.last_action = f"{player.name} left the game."
        self._check_market_end()

    def _is_playable(self, card):
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

        if not self._is_playable(cards[0]):
            return {"success": False, "error": "Illegal move"}
        if any(c.number != cards[0].number for c in cards):
            return {"success": False, "error": "Combined cards must share the same number"}
        if cards[0].shape == 'Whot' and chosen_shape not in [s for s in SHAPES if s != 'Whot']:
            return {"success": False, "error": "Choose a shape for Whot"}

        for card in cards:
            player.hand.remove(card)
            self.discard_pile.append(card)
        self.pending_shape = None

        played = " + ".join(repr(c) for c in cards)
        if len(player.hand) == 0 and cards[-1].number not in SPECIAL_NAMES:
            self._finish("win", player)
            self.last_action = f"{player.name} played {played} and WINS! 🎉"
            return {"success": True, "game_over": True, "winner": player.name}

        msg = self._apply_combo(cards, player, chosen_shape)
        self.last_action = f"{player.name} played {played}. {msg}"
        self._check_market_end()
        return {"success": True, "message": self.last_action}

    def _apply_combo(self, cards, player, chosen_shape):
        n = len(cards)
        number = cards[0].number

        if number == 20:
            self.pending_shape = chosen_shape
            self._advance()
            return f"Whot! Shape locked to {self.pending_shape}."

        if number == 1:
            return "Hold On — plays again."

        if number == 2:
            self.pending_pick += 2 * n
            self._advance()
            return f"Pick Two! Pending pick now {self.pending_pick}."

        if number == 5:
            self.pending_pick += 3 * n
            self._advance()
            return f"Pick Three! Pending pick now {self.pending_pick}."

        if number == 8:
            # skip one player per card, but never more than everyone else
            self._advance(1 + min(n, len(self.players) - 1))
            return "Suspension! Next player skipped." if n == 1 else f"Suspension x{n}! Players skipped."

        if number == 14:
            for p in self.players:
                if p.id != player.id:
                    self.draw_from_deck(p, n)
            return f"General Market! Everyone else draws {n}. Play again."

        self._advance()
        return ""

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
            self.last_action = msg
            self._check_market_end()
            return {"success": True, "message": msg}

        drawn = self.draw_from_deck(player, 1)
        self._advance()
        self.last_action = f"{player.name} draws a card."
        self._check_market_end()
        return {"success": True, "message": self.last_action}

    def force_timeout_draw(self, player_id):
        """Called by the server when a player's turn timer expires."""
        player = self.get_player(player_id)
        if not player:
            return
        if self.pending_pick > 0:
            self.draw_from_deck(player, self.pending_pick)
            self.pending_pick = 0
        else:
            self.draw_from_deck(player, 1)
        self._advance()
        self.last_action = f"⏱️ {player.name} ran out of time and drew a card."
        self._check_market_end()

    def state_for(self, player_id):
        me = self.get_player(player_id)
        is_player = me is not None
        my_turn = is_player and not self.game_over and self.current_player().id == player_id
        combos = {}
        if my_turn:
            for c in self.playable_cards(me):
                if c.number == 20:
                    continue  # Whot cards can't be combined
                mates = [o.id for o in me.hand if o.number == c.number and o.id != c.id]
                if mates:
                    combos[c.id] = mates
        return {
            "combos": combos,
            "playable_card_ids": [c.id for c in self.playable_cards(me)] if my_turn else [],
            "top_card": self.top_card.to_dict(),
            "pending_shape": self.pending_shape,
            "pending_pick": self.pending_pick,
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