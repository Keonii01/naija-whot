"""One-off: adds the structured last_event to whot_engine.py.
Run from the server folder:  py patch_events.py
It checks every spot first and changes nothing unless all of them match."""
import sys

PAIRS = [
('''        self.last_action = "Game started!"
        self._deal()

    def _deal(self):''','''        self.last_action = "Game started!"
        self.event_seq = 0
        self.last_event = None          # the headline of the latest move, for the table's cue banner
        self._deal()

    def _event(self, type, actor_id, target_ids=(), amount=0, card=None, shape=None):
        """Record what just happened as data (public information only, never anyone's hand)."""
        self.event_seq += 1
        self.last_event = {"seq": self.event_seq, "type": type, "actor_id": actor_id,
                           "target_ids": list(target_ids), "amount": amount,
                           "card": card.to_dict() if card else None, "shape": shape}

    def _deal(self):'''),
('''        drawn = self.draw_from_deck(player, LAST_CARD_PENALTY)
        self._advance()
        self.last_action = (f"{player.name} played {played} without calling Last Card! "''','''        drawn = self.draw_from_deck(player, LAST_CARD_PENALTY)
        self._advance()
        self._event("last_card", player.id, [player.id], len(drawn))
        self.last_action = (f"{player.name} played {played} without calling Last Card! "'''),
('''            self._finish("win", player)
            self.last_action = f"{player.name} played {played} and WINS! 🎉"''','''            self._finish("win", player)
            self._event("win", player.id, card=cards[-1])
            self.last_action = f"{player.name} played {played} and WINS! 🎉"'''),
('''        if number == 20:
            self.pending_shape = chosen_shape
            self._advance()
            return f"Whot! Shape locked to {self.pending_shape}."

        if number == 1:
            self.free_play = self.rules["hold_on_any_card"]
            return''','''        if number == 20:
            self.pending_shape = chosen_shape
            self._advance()
            self._event("whot", player.id, card=cards[-1], shape=self.pending_shape)
            return f"Whot! Shape locked to {self.pending_shape}."

        if number == 1:
            self.free_play = self.rules["hold_on_any_card"]
            self._event("hold_on", player.id, [player.id], n, cards[-1])
            return'''),
('''            self.pending_pick += amount
            self._advance()
            return f"{label}! Pending pick now {self.pending_pick}."''','''            self.pending_pick += amount
            self._advance()
            self._event("pick", player.id, [self.current_player().id], self.pending_pick, cards[-1])
            return f"{label}! Pending pick now {self.pending_pick}."'''),
('''            # skip one player per card, but never more than everyone else
            self._advance(1 + min(n, len(self.players) - 1))''','''            # skip one player per card, but never more than everyone else
            skipped = [self.players[(self.current_idx + 1 + i) % len(self.players)].id
                       for i in range(min(n, len(self.players) - 1))]
            self._advance(1 + min(n, len(self.players) - 1))
            self._event("suspended", player.id, skipped, len(skipped), cards[-1])'''),
('''                if p.id != player.id:
                    self.draw_from_deck(p, n)
            return''','''                if p.id != player.id:
                    self.draw_from_deck(p, n)
            self._event("general_market", player.id, [p.id for p in self.players if p.id != player.id], n, cards[-1])
            return'''),
('''        self._advance()
        return ""

    def _counter_two_player''','''        self._advance()
        self._event("play", player.id, card=cards[-1])
        return ""

    def _counter_two_player'''),
('''        if net == 0:
            self.pending_pick = 0
            self._advance()
            return f"{label} cancelled out. Nobody picks."
        if net > 0:
            drawn = self.draw_from_deck(player, net)
            self.pending_pick = 0
            self._advance()
            return f"{player.name} blocks part of it and picks {len(drawn)}."
        self.pending_pick = -net
        self._advance()
        return f"Countered!''','''        if net == 0:
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
        return f"Countered!'''),
('''                    return self._counter_cancel(amount, label)''','''                    return self._counter_cancel(player, amount, label)'''),
('''    def _counter_cancel(self, amount, label):''','''    def _counter_cancel(self, player, amount, label):'''),
('''        net = abs(self.pending_pick - amount)
        self.pending_pick = net
        self._advance()
        if net == 0:
            return f"{label} cancelled out. Nobody picks."
        return f"Countered!''','''        net = abs(self.pending_pick - amount)
        self.pending_pick = net
        self._advance()
        if net == 0:
            self._event("cancelled", player.id, [], amount)
            return f"{label} cancelled out. Nobody picks."
        self._event("pick", player.id, [self.current_player().id], net)
        return f"Countered!'''),
('''            msg = f"{player.name} picks {len(drawn)} cards!"
            self.pending_pick = 0
            self._advance()''','''            msg = f"{player.name} picks {len(drawn)} cards!"
            self.pending_pick = 0
            self._advance()
            self._event("pick_taken", player.id, [player.id], len(drawn))'''),
('''        drawn = self.draw_from_deck(player, 1)
        self._advance()
        self.last_action = f"{player.name} draws a card."''','''        drawn = self.draw_from_deck(player, 1)
        self._advance()
        self._event("draw", player.id, [player.id], len(drawn))
        self.last_action = f"{player.name} draws a card."'''),
('''        if self.pending_pick > 0:
            self.draw_from_deck(player, self.pending_pick)
            self.pending_pick = 0
        else:
            self.draw_from_deck(player, 1)
        self._advance()
        self.last_action = f"⏱️''','''        if self.pending_pick > 0:
            drawn = self.draw_from_deck(player, self.pending_pick)
            self.pending_pick = 0
        else:
            drawn = self.draw_from_deck(player, 1)
        self._advance()
        self._event("timeout_draw", player.id, [player.id], len(drawn))
        self.last_action = f"⏱️'''),
('''            "free_play": self.free_play,''','''            "free_play": self.free_play,
            "last_event": self.last_event,'''),
]

def main(path="whot_engine.py"):
    raw = open(path, newline="", encoding="utf-8").read()
    crlf = "\r\n" in raw
    s = raw.replace("\r\n", "\n")
    if "def _event(" in s:
        sys.exit("whot_engine.py already has _event: nothing to do.")
    for i, (old, new) in enumerate(PAIRS, 1):
        n = s.count(old)
        if n != 1:
            sys.exit(f"Edit {i} of {len(PAIRS)}: expected 1 match, found {n}. Nothing was changed. Starts with: {old.strip().splitlines()[0][:70]}")
        s = s.replace(old, new)
    open(path, "w", newline="", encoding="utf-8").write(s.replace("\n", "\r\n") if crlf else s)
    print(f"OK: {len(PAIRS)} edits applied to {path}")

if __name__ == "__main__":
    main(*sys.argv[1:])
