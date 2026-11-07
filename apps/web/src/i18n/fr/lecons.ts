// The eight lessons of « Apprendre à jouer » (plan 05-03; 05-UI-SPEC « The eight lessons », D-07, D-09).
// Every line is a draft for Romain (à relire par Romain, D-06/D-09 review at UAT). Phase-1 typography:
// U+202F before ; ! ? » and after «, U+00A0 before :, typographic ’. Plain strings, no markup: a word in
// bold on the band comes from a list of words, never from HTML. Each guide line is at most 110
// characters and each « Bravo » recap at most 160 (lessons.test.ts). The guide says « tu ».

export const lecons = {
  bravo: "Bravo !",
  suivant: "Suivant",

  /** Plan 05-10 (APP-05 audit, one h1 per page): a lesson’s heading, for screen readers. */
  heading: (n: number, title: string) => `Leçon ${n} : ${title}`,

  /** Plan 05-06: the name of what the guide rings ends with these words. */
  target: (name: string) => `${name}, à toucher`,

  /**
   * Plan 05-06: the lesson pill in place of the game's info (its visible text in two parts on a
   * phone held sideways) and its accessible name.
   */
  pill: {
    lesson: (n: number) => `Leçon ${n}`,
    of: (count: number) => `sur ${count}`,
    label: (n: number, count: number, title: string) =>
      `Leçon ${n} sur ${count} : ${title}, voir les leçons`,
  },

  /** Plan 05-06: the sheet « Les leçons » opened from the pill. */
  sheet: {
    title: "Les leçons",
    restart: "Recommencer cette leçon",
    close: "Fermer",
    /** Line 2 of a lesson not done yet. */
    about: "Environ 1 minute",
    /** Line 2 of a lesson done. */
    done: "Faite",
    /** A row's accessible name: « Leçon 3, Manger, faite ». */
    // Plan 05-10 (WCAG 2.5.3 « Label in Name »): the name holds the row's visible lines in order.
    row: (n: number, title: string, done: boolean) =>
      done ? `Leçon ${n}, ${title}, faite` : `Leçon ${n}, ${title}, environ 1 minute`,
  },

  /** Plan 05-08: the sheet « Première fois ? » on a brand-new device (D-08). */
  firstTime: {
    title: "Première fois ?",
    text: "Apprends à jouer en jouant : huit petites leçons, avec un guide qui te montre quoi toucher.",
    start: "Apprendre en 10 minutes",
    note: "Tu retrouveras les leçons sur l’accueil, dans « Apprendre ».",
    later: "Plus tard",
  },

  /** Plan 05-08: the page « Apprendre à jouer » (#/apprendre). */
  page: {
    title: "Apprendre à jouer",
    home: "Accueil",
    text: "Huit petites leçons d’environ une minute. Un guide te montre quoi toucher. Si tu te trompes, il t’explique et tu réessaies.",
    /** The primary by progress: none done, some done (the first not done), all done. */
    start: "Commencer",
    next: (n: number) => `Continuer : leçon ${n}`,
    computer: "Jouer contre l’ordinateur",
    /** Only when all are done: lesson 1 again, the progress kept. */
    again: "Revoir depuis le début",
    note: "Les règles complètes sont dans « Règles », à tout moment de la partie.",
    rules: "Règles du jeu",
    /** The list's accessible name. */
    list: "Les huit leçons",
  },

  /** Plan 05-06: the « Bravo ! » plank's buttons (the last lesson has its own two). */
  plank: {
    again: "Revoir la leçon",
    next: "Leçon suivante",
    lessons: "Revoir les leçons",
    computer: "Jouer contre l’ordinateur",
  },

  /** Lesson 1. */
  sortir: {
    title: "Sortir un cheval",
    bienvenue:
      "Bienvenue ! Tu joues les chevaux bleus, en bas. Ton partenaire est en face : les rouges.",
    but: "Le but : rentrer vos huit chevaux dans vos maisons avant l’autre équipe.",
    carte:
      "Tes chevaux attendent dans l’écurie. Pour en sortir un, il faut un As ou un Roi : touche l’As.",
    jouer: "Le trajet s’affiche. Touche « Jouer » pour sortir ton cheval.",
    wrong: {
      carte: "Pas celle-là : aucun de tes chevaux n’est dehors pour avancer. Touche l’As.",
    },
    recap:
      "Ton cheval est sur son losange. Tant qu’il ne bouge pas, personne ne peut le manger ni le dépasser.",
  },

  /** Lesson 2. */
  avancer: {
    title: "Avancer",
    intro:
      "Les cartes de 2 à 10 font avancer d’autant de cases, sauf le 4 et le 7. La Dame avance de 12.",
    carte: "Touche le 8.",
    jouer:
      "Un seul cheval peut jouer le 8 : l’autre tomberait sur ton cheval, c’est interdit. Touche « Jouer ».",
    wrong: { carte: "Pas celle-là : ici, on essaie le 8." },
    recap: "Tu passes par-dessus tous les chevaux, mais tu ne t’arrêtes jamais sur un des tiens.",
  },

  /** Lesson 3. */
  manger: {
    title: "Manger",
    carte: "Un cheval jaune est 8 cases devant toi. Touche le 8 pour t’arrêter pile sur lui.",
    jouer: "La croix montre le cheval qui sera mangé. Touche « Jouer ».",
    wrong: {
      carte: "Pas celle-là : il faut tomber pile sur le cheval jaune, 8 cases devant. Touche le 8.",
    },
    recap:
      "Mangé ! Il retourne à son écurie. Attention : le cheval de ton partenaire se mange aussi.",
  },

  /** Lesson 4. */
  recule: {
    title: "Le 4 recule",
    carte: "Le 4 fait reculer de 4 cases, même un cheval qui vient de sortir. Touche le 4.",
    jouer: "En reculant, ton cheval s’arrête sur le cheval vert et le mange. Touche « Jouer ».",
    wrong: { carte: "Pas celle-là : le cheval vert est derrière toi. Touche le 4." },
    recap:
      "Bien joué ! Ton cheval est maintenant juste avant l’entrée de ta maison : il pourra rentrer sans refaire le tour.",
  },

  /** Lesson 5. */
  valet: {
    title: "Le Valet échange",
    carte: "Le Valet échange un de tes chevaux avec celui d’un autre joueur. Touche le Valet.",
    cheval: "Touche d’abord ton cheval.",
    cible: "Puis le cheval à échanger : le jaune, tout près de ta maison.",
    jouer: "Les deux chevaux vont changer de place. Touche « Jouer ».",
    wrong: {
      carte: "Pas celle-là : touche le Valet.",
      cible: "Pas celui-là : prends le jaune près de ta maison, ton cheval prendra sa place.",
    },
    recap:
      "Personne n’est mangé avec le Valet. On n’échange ni un cheval à l’écurie, ni un cheval rentré, ni celui qui vient de sortir.",
  },

  /** Lesson 6. */
  sept: {
    title: "Le 7 se partage",
    intro:
      "Le 7 se partage entre tes chevaux : 7 pas en tout. Chaque adversaire dépassé avec le 7 est mangé !",
    carte: "Touche le 7.",
    premier: "Touche ton cheval juste derrière le jaune, puis 3 : il le dépassera.",
    second: "Il reste 4 pas : touche ton autre cheval, puis 4.",
    jouer: "Les deux adversaires dépassés seront mangés. Touche « Jouer ».",
    wrong: {
      plan: "Ce partage ne mange pas les deux. Essaie 3 sur un cheval et 4 sur l’autre.",
    },
    recap:
      "Deux d’un coup ! Le 7 ne mange pas le cheval de ton partenaire qu’il dépasse, seulement s’il s’arrête dessus.",
  },

  /** Lesson 7. */
  maison: {
    title: "Rentrer à la maison",
    intro:
      "Pour rentrer, tombe pile sur une des quatre cases de ta maison. Son entrée est le carré, juste devant toi.",
    carte: "Avec le 6, ton cheval va tout au fond de sa maison. Touche le 6.",
    jouer: "Touche « Jouer ».",
    wrong: {
      neuf: "Avec le 9, tu dépasserais ta maison et tu referais un tour. Touche le 6.",
      roi: "Le Roi avancerait de 13, bien trop loin. Touche le 6.",
    },
    recap:
      "Il est rentré ! Les chevaux déjà rentrés se sautent : seule la case où tu tombes doit être vide.",
  },

  /** Lesson 8. */
  echange: {
    title: "L’échange de carte",
    intro: "Au début de chaque donne, chacun passe une carte à son partenaire, sans la montrer.",
    carte: "Ton partenaire n’a aucun cheval dehors : donne-lui ton Roi pour qu’il puisse sortir.",
    passer: "Touche « Passer cette carte ».",
    recu: "Ton partenaire t’a passé un 7 : la carte reçue a le bord de sa couleur.",
    wrong: {
      carte: "Pas celle-là : sans As ni Roi, ton partenaire ne peut pas sortir. Donne-lui le Roi.",
    },
    recap: "Tu connais l’essentiel ! Le reste est dans « Règles », à tout moment de la partie.",
  },
};
