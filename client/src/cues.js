// Turns the server's last_event into the short sentence the table banner shows.
// Pure and UI-free: the server says what happened, this only words it from the viewer's side.
// Returns { text, tone } or null when the move needs no banner (a plain card, a plain draw, a win).

const CARD_NAMES = { 1: 'Hold On', 2: 'Pick Two', 5: 'Pick Three', 8: 'Suspension', 14: 'General Market', 20: 'Whot' };

export function describeEvent(event, clientId, players) {
  if (!event) return null;
  const isYou = (id) => id === clientId;
  const nameOf = (id) => (isYou(id) ? 'You' : players.find((p) => p.id === id)?.name ?? 'Someone');
  const pick = (id) => (isYou(id) ? 'pick' : 'picks');
  const actor = nameOf(event.actor_id);
  const target = event.target_ids?.[0];
  const aimedAtYou = event.target_ids?.includes(clientId);
  const n = event.amount;

  switch (event.type) {
    case 'pick': {
      const head = event.card ? `${actor} played ${CARD_NAMES[event.card.number] ?? 'a card'}` : `${actor} countered`;
      const tail = isYou(target) ? `you pick ${n} or answer` : `${nameOf(target)} ${pick(target)} ${n} or answers`;
      return { text: `${head}: ${tail}`, tone: isYou(target) ? 'danger' : 'info' };
    }
    case 'pick_taken':
      return { text: `${actor} picked ${n}`, tone: isYou(event.actor_id) ? 'danger' : 'info' };
    case 'cancelled':
      return { text: `Blocked! ${actor} cancelled the penalty`, tone: 'good' };
    case 'blocked':
      return { text: `${actor} blocked part of it and ${pick(event.actor_id)} ${n}`, tone: isYou(event.actor_id) ? 'danger' : 'info' };
    case 'suspended': {
      if (aimedAtYou) return { text: 'You are suspended!', tone: 'danger' };
      const names = event.target_ids.map(nameOf);
      return { text: `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} suspended`, tone: 'info' };
    }
    case 'hold_on':
      return { text: `Hold On! ${actor} ${isYou(event.actor_id) ? 'play' : 'plays'} again`, tone: 'good' };
    case 'general_market':
      if (isYou(event.actor_id)) return { text: `General Market! Everyone else picks ${n}`, tone: 'good' };
      return aimedAtYou
        ? { text: `General Market by ${actor}: you pick ${n}`, tone: 'danger' }
        : { text: `General Market by ${actor}: everyone else picks ${n}`, tone: 'info' };
    case 'whot':
      return { text: `Whot! ${actor} called ${event.shape}`, tone: 'info' };
    case 'last_card':
      return { text: `${actor} didn't call Last Card and ${pick(event.actor_id)} ${n}`, tone: isYou(event.actor_id) ? 'danger' : 'info' };
    case 'timeout_draw':
      return { text: `${actor} ran out of time and picked ${n}`, tone: isYou(event.actor_id) ? 'danger' : 'info' };
    default:
      return null; // play, draw, win
  }
}
