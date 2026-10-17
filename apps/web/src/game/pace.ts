// The pace of a computer player lives in @toc/bots so the online table paces its computers exactly like
// the local game (plan 02-03, 02-RESEARCH Pattern 8).
export {
  CHOICE_BASE_MS,
  CHOICE_CEILING_MS,
  CHOICE_SPAN_MS,
  FAST_CEILING_MS,
  FAST_FACTOR,
  FAST_HARD_CAP_MS,
  HARD_CAP_MS,
  hardCap,
  JITTER,
  type Paced,
  paceFor,
  SINGLE_BASE_MS,
  SINGLE_SPAN_MS,
  type Speed,
} from "@toc/bots";
