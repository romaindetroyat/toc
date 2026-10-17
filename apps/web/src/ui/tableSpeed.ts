// The table-wide « Avance rapide » as « Réglages » shows it (plan 02-10b): its state, whether this
// device may switch it (the chef de table), the chef de table's name for the others, and the switch.

export type TableSpeed = {
  /** The table is in « Avance rapide » (TablePublic.fast). */
  fast: boolean;
  /** This device is the chef de table: the switch works; else it is shown disabled. */
  canSet: boolean;
  /** The chef de table's first name, for « Seul le chef de table, {Nom}, peut la changer. ». */
  hostName: string;
  /** Sends the chef de table's choice (a speed frame). */
  onset: (fast: boolean) => void;
};
