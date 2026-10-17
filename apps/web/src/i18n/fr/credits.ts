// « Crédits et licences » sheet (UI-SPEC screen 7). The rows themselves come from
// assets/audio/LICENSES.md; only the labels around them are written here.
export const credits = {
  open: "Crédits et licences",
  title: "Crédits et licences",
  close: "Fermer",
  intro:
    "Les sons, les polices, les icônes et les images du jeu, avec leur auteur et leur licence.",
  empty: "Aucun crédit à afficher.",
  /** Label before the file names; U+00A0 before the colon. */
  file: "Fichier\u00A0:",

  /** Group headings, in display order, by the `type` column of the manifest. */
  groups: [
    { type: "son", title: "Sons" },
    { type: "police", title: "Polices" },
    { type: "icônes", title: "Icônes" },
    { type: "plateau", title: "Plateau" },
    { type: "cavaliers", title: "Cavaliers" },
    { type: "cartes", title: "Cartes" },
    { type: "logo", title: "Logo" },
  ],
  /** Rows of a type the list above does not know still appear, under this heading. */
  otherGroup: "Autres",

  /** Readable names for the manifest ids; an id with no entry here is shown as it is written. */
  names: {
    sabot: "Sabots",
    "hennissement-sortie": "Hennissement, sortie de l’écurie",
    "hennissement-ruade": "Hennissement, ruade",
    "hennissement-plainte": "Hennissement, plainte",
    "hennissement-joyeux": "Hennissement, entrée dans la maison",
    "hennissement-fete": "Hennissement, quatrième cheval rentré",
    "hennissement-surpris": "Hennissement, échange au Valet",
    "carte-donne": "Carte, donne",
    "carte-pose": "Carte, pose",
    "carte-echange": "Carte, échange",
    nunito: "Nunito",
    caveat: "Caveat",
    lucide: "Lucide",
    plateau: "Plateau de jeu",
    "plateau-cavaliers": "Cavaliers du plateau",
    cavaliers: "Cavaliers",
    cartes: "Figures des cartes (Valet, Dame, Roi)",
    logo: "Logo et icônes de l’application",
  } as Record<string, string>,
} as const;
