// RED stub (plan 02-05 Task 1): the waiting room's toasts, written in the GREEN step.
import type { Color } from "@toc/engine";
import type { TablePublic } from "@toc/protocol";

export type Me = {
  name: string;
  was: Color | null;
  seat: Color | null;
  host: boolean;
  asked: boolean;
};

export function tableNotices(_prev: TablePublic | null, _next: TablePublic, _me: Me): string[] {
  return [];
}
