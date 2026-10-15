import type { SoundId, VariantKey } from "../../audio/sounds.ts";

// Sound test page « à choix » (#/sons, D-22, recette 3 de Romain). French typography is written out in the strings: U+202F before
// ? ! ; » and after «, U+00A0 before « : », typographic apostrophe.
export const sons = {
  title: "Test des sons",
  back: "Retour",
  intro:
    "Écoute les versions de chaque son et choisis ta préférée. Ton choix compte tout de suite dans tes parties, sur cet appareil. Pour qu’il compte pour tout le monde, touche « Copier mes choix » et envoie-les.",
  stateReady: "Son prêt",
  statePending: "Son en attente : touche l’écran",
  stateFailed: "Le son n’a pas pu démarrer. Touche l’écran pour réessayer.",
  silentSwitchHint:
    "Le son joue aussi quand l’iPhone est en mode silencieux. Pas de son ? Monte le volume avec les boutons sur le côté.",

  sections: {
    sabots: "Sabots",
    hennissements: "Hennissements",
    cartes: "Cartes",
  },

  /** The sounds' names, in page order; also the names of the copied choices (« Sabots : B »). */
  names: {
    sabot: "Sabots",
    "hennissement-sortie": "Sortie de l’écurie",
    "hennissement-ruade": "Prise : ruade",
    "hennissement-plainte": "Prise : plainte",
    "hennissement-joyeux": "Entrée dans la maison",
    "hennissement-fete": "4e cheval rentré (joyeux)",
    "hennissement-surpris": "Échange au Valet (surpris)",
    "carte-donne": "Donne",
    "carte-pose": "Poser une carte",
    "carte-echange": "Échange de carte",
  } satisfies Record<SoundId, string>,

  /** What a version is, under its button, when it has a name (« A » is always today's sound). */
  versionNames: {
    sabot: { a: "actuel", b: "sur la terre", c: "sur les pavés", d: "sur le bois" },
  } satisfies Partial<Record<SoundId, Partial<Record<VariantKey, string>>>> as Partial<
    Record<SoundId, Partial<Record<VariantKey, string>>>
  >,
  versionLetter: (key: VariantKey) => key.toUpperCase(),
  playVersion: (name: string, letter: string) => `Écouter ${name}, version ${letter}`,
  choiceLabel: "Mon choix",
  choiceGroup: (name: string) => `Mon choix pour ${name}`,

  /** The hoof cadence of a move, in the chosen version. */
  cadenceLabel: "Cadence de ton choix",
  casesButton: (cells: number) => String(cells),

  play: (name: string) => `Écouter ${name}`,
  sourceGenerated: "Généré par le code",
  sourceFile: "Fichier libre (CC0)",
  sourceSilence: "Silence",
  /** Under the source tag: author and licence of the sound, from assets/audio/LICENSES.md. */
  licenceLine: (author: string, licence: string) => `${author} · ${licence}`,
  licenceMissing: "Licence non renseignée",
  decoding: "Préparation du son…",
  unavailable: "Son indisponible",

  distanceLabel: "Distance",
  distanceSlider: "Distance en cases",
  distancePlay: "Écouter la distance choisie",
  distanceValue: (cells: number) => (cells === 1 ? "1 case" : `${cells} cases`),

  copy: "Copier mes choix",
  copied: "Choix copiés.",
  copyFailed: "Impossible de copier. Sélectionne le texte ci-dessous.",
  choicesText: "Mes choix",
} as const;
