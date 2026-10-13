// The whole French copy of the game screen (UI-SPEC « Copywriting Contract »), in one catalogue. Later
// plans read it without modifying it. French typography throughout: thin no-break space before ? ! ;
// and » and after «, no-break space before a colon, typographic apostrophe.

import { type CardId, type Color, type GameEvent, pawnColor, type Reason } from "@toc/engine";
import { cardWithArticle } from "./cards.ts";
import { seats } from "./seats.ts";

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
const cases = (n: number): string => `${n} ${plural(n, "case", "cases")}`;
/** « bleu », « jaune », « rouge », « vert »: the colour as an adjective. */
const colourWord = (color: Color): string => seats[color].name.toLowerCase();

/** « de Marengo », « d’Ourasi »: the preposition elides before a vowel. */
const de = (name: string): string =>
  /^[aeiouyhàâäéèêëîïôöùûüœ]/i.test(name) ? `d’${name}` : `de ${name}`;

export const game = {
  info: {
    ownTurn: "À toi de jouer",
    botTurn: (name: string) => `Tour ${de(name)}`,
    /** The words before the bot's name; hidden visually below 360 px wide, kept for screen readers. */
    turnPrefix: (name: string) => (de(name).startsWith("d’") ? "Tour d’" : "Tour de "),
    /** Row 1 while the cards are being exchanged and once the game is over. */
    exchanging: "Échange des cartes",
    over: "Partie terminée",
    teamAriaThem: (n: number) => `Équipe adverse : ${n} chevaux rentrés sur 8`,
    dealer: (name: string) => `Donneur : ${name}`,
    deal: (k: number) => `Donne ${k} sur 3`,
    teamUs: (n: number) => `Nous ${n}/8`,
    teamThem: (n: number) => `Eux ${n}/8`,
    teamAria: (n: number) => `Ton équipe : ${n} chevaux rentrés sur 8`,
  },

  banner: {
    deal: (k: number, cards: number) => `Donne ${k} sur 3 · ${cards} cartes`,
    reshuffle: (dealer: string) => `On rebat les cartes. Donneur : ${dealer}`,
  },

  exchange: {
    choose: (partner: string) => `Choisis la carte à passer à ${partner}.`,
    pass: "Passer cette carte",
    waiting: (names: readonly string[]) => `En attente de ${names.join(", ")}…`,
    done: (card: string, partner: string) => `Échange fait. Tu as reçu ${card} ${de(partner)}.`,
    receivedTag: "Reçue",
  },

  turn: {
    ownTurn: "À toi de jouer. Choisis une carte.",
    chooseHorse: "Choisis un cheval.",
    singleHorse: "Un seul cheval peut jouer cette carte : touche-le.",
    chooseLit: "Choisis un des chevaux éclairés.",
    modeQuestion: "Que veux-tu faire ?",
    exitButton: "Sortir un cheval",
    advanceButton: (n: number) => `Avancer de ${n}`,
    jackFirst: "Valet : touche ton cheval, puis celui à échanger.",
    jackSecond: "Maintenant, touche le cheval à échanger.",
  },

  preview: {
    advance: (card: string, n: number) => `${card} : avance de ${cases(n)}.`,
    back: "4 : recule de 4 cases.",
    exit: "Sort de l’écurie.",
    home: "Entre dans la maison.",
    swap: (color: Color) => `Échange avec un cheval ${colourWord(color)}.`,
    captureOne: (color: Color) => `Tu manges un cheval ${colourWord(color)}.`,
    captureMany: (n: number) => `Tu manges ${n} chevaux.`,
    partnerCapture: "Attention : tu vas manger un cheval de ton équipe.",
    /** Label of the destination badge on the board. */
    plus: (n: number) => `+${n}`,
    minus: (n: number) => `−${n}`,
  },

  buttons: {
    play: "Jouer",
    playAnyway: "Jouer quand même",
    cancel: "Annuler ce coup",
    changeCard: "Changer de carte",
    otherHorse: "Choisir un autre cheval",
  },

  /** The chips that tell apart knights too close to tap (letters A to D, as over the knights). */
  tray: {
    chip: (letter: string, color: Color) => `Cheval ${letter}, ${colourWord(color)}`,
  },

  bot: {
    thinking: (name: string) => `${name} réfléchit…`,
    played: (name: string, card: CardId, description: string) =>
      `${name} a joué ${cardWithArticle(card)} : ${description}.`,
    posed: (name: string) => `${name} pose ses cartes : aucune n’est jouable.`,
  },

  finished: (partner: string) =>
    `Tes quatre chevaux sont rentrés. Tu joues avec ceux ${de(partner)}.`,

  fast: "Avance rapide",
  illegal: "Ce coup n’est pas permis. Choisis-en un autre.",

  reasons: {
    "no-pawn-can-move": "Aucun de tes chevaux ne peut jouer cette carte.",
    "no-pawn-to-exit": "Aucun cheval à sortir avec cette carte.",
    "jack-no-target": "Le Valet n’a pas de cible : aucun cheval à échanger.",
    "seven-incomplete": "Ce 7 ne peut pas être joué en entier.",
    "blocked-protected": "Un cheval protégé sur sa case de sortie bloque le passage.",
  } satisfies Record<Reason, string>,

  seven: {
    title: "Le 7 : répartis tes pas",
    remaining: (n: number) => `Reste ${n}`,
    allSpread: "Tout est réparti.",
    plan: (letter: string, n: number) => `Cheval ${letter} : ${n} pas`,
    /** When the plan holds knights of two colours (the partner's after the fourth home), the colour is named. */
    planColour: (letter: string, color: Color, n: number) =>
      `Cheval ${letter} ${colourWord(color)} : ${n} pas`,
    chooseSteps: "Combien de pas pour ce cheval ?",
    /** The played card, named for screen readers (the panel replaces the hand). */
    card: (card: string) => `Carte jouée : ${card}`,
    chipAria: (n: number) => `${n} pas`,
    chipDisabled: "Ce nombre de pas t’empêcherait de finir le 7.",
    undo: "Retirer le dernier pas",
    reset: "Tout annuler",
    play: "Jouer",
    remainingHint: (n: number) => `Il reste ${n} pas à jouer.`,
  },

  dead: {
    message: "Aucune carte ne peut être jouée.",
    body: "Pose ta main face visible sur le tapis, puis attends la prochaine donne.",
    pose: "Poser mes cartes",
    after: "Tu attends la prochaine donne.",
  },

  empty: {
    heading: "Plus de cartes",
    body: "Attends la prochaine donne : les autres joueurs finissent leur tour.",
  },

  tapis: {
    title: "Sur le tapis",
    row: (name: string, card: string | null) => `${name} : ${card ?? "—"}`,
    talon: (n: number) => `Talon : ${n} cartes`,
    discard: (n: number) => `Défausse : ${n} cartes`,
  },

  end: {
    win: "Victoire !",
    winText: "Ton équipe a rentré ses 8 chevaux.",
    loss: "Défaite",
    lossText: "L’équipe adverse a rentré ses 8 chevaux.",
    deals: (n: number) => `Donnes jouées : ${n}`,
    captures: (us: number, them: number) => `Chevaux mangés : nous ${us}, eux ${them}`,
    replay: "Rejouer",
    changeColour: "Changer de couleur",
  },

  failures: {
    audio: "Le son n’a pas pu démarrer. La partie reste jouable sans son.",
    audioRetry: "Réessayer",
  },

  error: {
    heading: "Oups, le jeu a rencontré un problème.",
    body: "Recharge la page pour repartir. La partie en cours sera perdue.",
    reload: "Recharger la page",
  },

  abandon: {
    title: "Abandonner la partie ?",
    body: "La partie en cours sera perdue. Tu ne pourras pas la reprendre.",
    keepPlaying: "Continuer à jouer",
    confirm: "Abandonner la partie",
  },

  hand: {
    label: "Ta main",
    playable: (card: string) => `${card}, jouable`,
    unplayable: (card: string) => `${card}, pas jouable`,
    neutral: (card: string) => card,
    pawn: (color: Color) => `Cheval ${colourWord(color)}, jouable`,
  },
} as const;

/** The pawns an event list moves, for the bot result line: « avance de 12 cases », « mange un cheval bleu ». */
export function describeAction(events: readonly GameEvent[]): string {
  const parts: string[] = [];
  let swapped: Color | null = null;
  let moves = 0;
  let steps = 0;
  let backwards = false;
  let exited = false;
  let home = false;
  const eaten: Color[] = [];

  for (const event of events) {
    switch (event.t) {
      case "pawnExited":
        exited = true;
        break;
      case "pawnMoved":
        moves += 1;
        steps += event.path.length;
        backwards = event.dir === -1;
        break;
      case "pawnEnteredHome":
        moves += 1;
        steps += event.path.length;
        home = true;
        break;
      case "pawnCaptured":
        eaten.push(pawnColor(event.victim));
        break;
      case "pawnsSwapped":
        swapped = pawnColor(event.b);
        break;
      default:
        break;
    }
  }

  if (exited) parts.push("sort de l’écurie");
  else if (swapped !== null) parts.push(`échange avec un cheval ${colourWord(swapped)}`);
  else if (moves > 1) parts.push("répartit son 7");
  else if (moves === 1) parts.push(`${backwards ? "recule" : "avance"} de ${cases(steps)}`);
  if (home && moves === 1) parts.push("entre dans la maison");
  if (eaten.length === 1) parts.push(`mange un cheval ${colourWord(eaten[0] as Color)}`);
  else if (eaten.length > 1) parts.push(`mange ${eaten.length} chevaux`);

  return parts.join(", ");
}

/** A bot's turn as the action zone shows it, from the events its play produced. */
export function botLine(name: string, events: readonly GameEvent[]): string {
  const played = events.find((event) => event.t === "cardPlayed");
  if (played?.t === "cardPlayed") {
    return game.bot.played(name, played.card, describeAction(events));
  }
  if (events.some((event) => event.t === "handDiscarded")) return game.bot.posed(name);
  return "";
}
