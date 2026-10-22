// The wording a mode shows for a card. A card may carry `titleFamily` / `textFamily` (children's wording, no adult terms);
// a family game uses them in place of title / text, a full game never does. Pure; numbers are never touched.
export const hasFamilyWording = (card) => !!(card.titleFamily || card.textFamily);
export const cardView = (card, mode) => (mode === 'family' && card && hasFamilyWording(card)
  ? { ...card, title: card.titleFamily || card.title, text: card.textFamily || card.text } : card);
