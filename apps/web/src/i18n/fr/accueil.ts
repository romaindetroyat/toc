// Home and first-name prompt copy (02-UI-SPEC « Copywriting Contract », « First-name prompt »).
// Plan 02-04 adds the home screen strings.

export const accueil = {
  name: {
    heading: "Ton prénom",
    /** Context line when the table's creator is known. */
    invitedBy: (creator: string) => `${creator} t’invite à une partie de TOC.`,
    invited: "Tu as reçu une invitation à une partie de TOC.",
    helper: "Cet appareil s’en souviendra.",
    submit: "Continuer",
    empty: "Écris ton prénom pour continuer.",
    back: "Retour",
  },
} as const;
