import type { NoteKey, Rating } from "../../audio/soundNotes.ts";

// Sound test page (#/sons, D-22). French typography is written out in the strings: U+202F before
// ? ! ; » and after «, U+00A0 before « : », typographic apostrophe.
export const sons = {
  title: "Test des sons",
  back: "Retour",
  intro: "Écoute chaque son et note-le. Tes notes restent sur cet appareil.",
  stateReady: "Son prêt",
  statePending: "Son en attente : touche l’écran",
  stateFailed: "Le son n’a pas pu démarrer. Touche l’écran pour réessayer.",
  silentSwitchHint:
    "Pas de son sur iPhone ? Vérifie que l’interrupteur de sonnerie, sur le côté, n’est pas en mode silencieux.",

  sections: {
    sabots: "Sabots",
    hennissements: "Hennissements",
    cartes: "Cartes",
    ambiance: "Ambiance",
  },

  /** Row names, in page order. */
  rows: {
    "sabot-1": "1 case",
    "sabot-4": "4 cases",
    "sabot-7": "7 cases",
    "sabot-13": "13 cases",
    "hennissement-sortie": "Sortie de l’écurie",
    "hennissement-ruade": "Prise : ruade",
    "hennissement-plainte": "Prise : plainte",
    "hennissement-joyeux": "Entrée dans la maison",
    "hennissement-fete": "4e cheval rentré (joyeux)",
    "hennissement-surpris": "Échange au Valet (surpris)",
    "carte-donne": "Donne",
    "carte-pose": "Poser une carte",
    "carte-echange": "Échange de carte",
    ambiance: "Ambiance (boucle)",
  } satisfies Record<NoteKey, string>,

  /** Names used in the copied notes: the hoof rows say which sound they are. */
  noteNames: {
    "sabot-1": "Sabots, 1 case",
    "sabot-4": "Sabots, 4 cases",
    "sabot-7": "Sabots, 7 cases",
    "sabot-13": "Sabots, 13 cases",
    "hennissement-sortie": "Sortie de l’écurie",
    "hennissement-ruade": "Prise : ruade",
    "hennissement-plainte": "Prise : plainte",
    "hennissement-joyeux": "Entrée dans la maison",
    "hennissement-fete": "4e cheval rentré (joyeux)",
    "hennissement-surpris": "Échange au Valet (surpris)",
    "carte-donne": "Donne",
    "carte-pose": "Poser une carte",
    "carte-echange": "Échange de carte",
    ambiance: "Ambiance (boucle)",
  } satisfies Record<NoteKey, string>,

  ratingGroup: (name: string) => `Note pour ${name}`,
  ratings: {
    "a-ecouter": "À écouter",
    bon: "Bon",
    "a-changer": "À changer",
  } satisfies Record<Rating, string>,

  play: (name: string) => `Écouter ${name}`,
  stop: (name: string) => `Arrêter ${name}`,
  playFile: (name: string) => `Écouter ${name}, version fichier`,
  playGenerated: (name: string) => `Écouter ${name}, version générée`,
  fileButton: "Fichier",
  generatedButton: "Généré",
  sourceGenerated: "Généré par le code",
  sourceFile: "Fichier libre (CC0)",
  decoding: "Préparation du son…",
  unavailable: "Son indisponible",

  distanceLabel: "Distance",
  distanceSlider: "Distance en cases",
  distancePlay: "Écouter la distance choisie",
  distanceValue: (cells: number) => (cells === 1 ? "1 case" : `${cells} cases`),

  ambienceVolume: "Volume de l’ambiance",
  percent: (value: number) => `${value} %`,

  copy: "Copier mes notes",
  copied: "Notes copiées.",
  copyFailed: "Impossible de copier. Sélectionne le texte ci-dessous.",
  notesText: "Tes notes",
} as const;
