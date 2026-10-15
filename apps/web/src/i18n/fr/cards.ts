import { type CardId, rankOf, suitOf } from "@toc/engine";

const RANK_NAME: Record<number, string> = { 1: "As", 11: "Valet", 12: "Dame", 13: "Roi" };
const SUIT_NAME = { S: "pique", H: "cœur", D: "carreau", C: "trèfle" } as const;

/** « As de cœur », « 10 de trèfle », « Valet de pique », « Dame de carreau », « Roi de cœur ». */
export function cardName(card: CardId): string {
  const rank = rankOf(card);
  return `${RANK_NAME[rank] ?? String(rank)} de ${SUIT_NAME[suitOf(card)]}`;
}

/**
 * The card inside a sentence: « l’As de cœur », « la Dame de carreau », « le 10 de trèfle ».
 * Used for « Jappeloup a joué la Dame de cœur ».
 */
export function cardWithArticle(card: CardId): string {
  const rank = rankOf(card);
  const article = rank === 1 ? "l’" : rank === 12 ? "la " : "le ";
  return `${article}${cardName(card)}`;
}
