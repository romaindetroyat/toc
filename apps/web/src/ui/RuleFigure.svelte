<script lang="ts">
  import { KNIGHT, knightScale, SCENE, SEAT_MARKS } from "@toc/board";
  import { type PawnId, pawnColor } from "@toc/engine";
  import BoardArt from "../board/BoardArt.svelte";
  import { anchorOf, placeKey } from "../board/geometry.ts";
  import { figurePlaces, type RuleFigureSpec } from "../game/ruleFigures.ts";
  import { regles } from "../i18n/fr/regles.ts";
  import { settings } from "../settings/store.svelte.ts";

  // One rule figure of « Règles du TOC » (plan 05-04, D-15, 05-UI-SPEC « Figures »), drawn live: two
  // halves of the galet stacked into a square, each its own BoardArt (k 0: always from Bleu's seat)
  // with its own def ids (05-RESEARCH Pitfall 10), and the game's knights standing still on them
  // (their marks follow « Formes sur les chevaux »). « Avant » above « Après », or « Le coup » with
  // the knights concerned ringed for the five scenarios without an after. The tags are HTML pills,
  // hidden from screen readers; the drawing is one image named by its alt sentence; the caption
  // follows. No picture file: nothing to load, nothing that can fail.
  type Props = { spec: RuleFigureSpec };

  let { spec }: Props = $props();

  const K = 0;
  const WALNUT = "#2B1D12";
  const CREAM = "#FFF8E1";
  /** The ring at a concerned knight's feet (the overlay's ghost ring), in sprite units. */
  const RING = { rx: 70, ry: 26 } as const;

  const caption = $derived(regles.figure.captions[spec.id]);
  const alt = $derived(
    spec.after === undefined ? regles.figure.altMove(caption) : regles.figure.altAfter(caption),
  );

  type Knight = { id: PawnId; x: number; y: number; size: number; place: string };

  /** The sixteen knights of a position, the lower on screen drawn last (in front). */
  function knightsOf(position: RuleFigureSpec["before"]): Knight[] {
    const places = figurePlaces(position);
    return (Object.keys(places) as PawnId[])
      .map((id) => {
        const place = places[id];
        const [x, y] = anchorOf(place, K);
        return { id, x, y, size: knightScale(place), place: placeKey(place) };
      })
      .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  }

  type Half = {
    kind: "before" | "after" | "move";
    tag: string;
    knights: Knight[];
    rings: readonly PawnId[];
  };

  const halves = $derived.by((): Half[] => {
    const before = knightsOf(spec.before);
    const lower: Half =
      spec.after === undefined
        ? { kind: "move", tag: regles.figure.move, knights: before, rings: spec.concerned ?? [] }
        : { kind: "after", tag: regles.figure.after, knights: knightsOf(spec.after), rings: [] };
    return [{ kind: "before", tag: regles.figure.before, knights: before, rings: [] }, lower];
  });

  /** The def ids of each half's drawing: unique on the page (one rules sheet at a time). */
  const prefix = (kind: Half["kind"]) =>
    `regle-${spec.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${kind}-`;
</script>

<figure class="figure" data-rule-figure={spec.id}>
  <div class="drawing" role="img" aria-label={alt}>
    {#each halves as half (half.kind)}
      <div class="half" data-figure-half={half.kind}>
        <svg
          viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <BoardArt k={K} ids={prefix(half.kind)} />
          {#each half.knights as knight (knight.id)}
            {#if half.rings.includes(knight.id)}
              <g
                transform={`translate(${knight.x} ${knight.y + KNIGHT.feet * knight.size})`}
                data-figure-ring={knight.id}
              >
                {#each [{ stroke: CREAM, width: 28 }, { stroke: WALNUT, width: 12 }] as ring (ring.stroke)}
                  <ellipse
                    cx="0"
                    cy={-2 * knight.size}
                    rx={RING.rx * knight.size}
                    ry={RING.ry * knight.size}
                    fill="none"
                    stroke={ring.stroke}
                    stroke-width={ring.width}
                  />
                {/each}
              </g>
            {/if}
          {/each}
          {#each half.knights as knight (knight.id)}
            {@const color = pawnColor(knight.id)}
            <g
              transform={`translate(${knight.x} ${knight.y})`}
              data-figure-knight={knight.id}
              data-place={knight.place}
            >
              <g transform={`translate(0 ${KNIGHT.feet * knight.size}) scale(${knight.size})`}>
                <use href="#knight-shadow" />
                <use href={`#knight-${color}`} x="-55" y="-186" width="110" height="190" />
                {#if settings.knightMarks}
                  <use
                    href={`#knight-mark-${color}`}
                    x="-55"
                    y="-186"
                    width="110"
                    height="190"
                    data-knight-mark={SEAT_MARKS[color]}
                  />
                {/if}
              </g>
            </g>
          {/each}
        </svg>
        <span class="tag" aria-hidden="true" data-figure-tag>{half.tag}</span>
      </div>
    {/each}
  </div>
  <figcaption class="t-label">{caption}</figcaption>
</figure>

<style>
  /* min(480, the panel's width), square: two 2:1 halves of the galet. */
  .figure {
    width: 100%;
    max-width: 480px;
    margin: 0 0 var(--space-lg);
  }

  .drawing {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-card);
    overflow: hidden;
  }

  .half {
    position: relative;
    aspect-ratio: 2 / 1;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* « Avant », « Après », « Le coup »: Label 700 walnut on a cream pill, 8 from the corner. */
  .tag {
    position: absolute;
    top: var(--space-sm);
    left: var(--space-sm);
    padding: 0 var(--space-sm);
    border-radius: var(--radius-card);
    background: var(--creme);
    color: var(--noyer);
    font-size: var(--label-size);
    font-weight: 700;
    line-height: var(--label-line);
    pointer-events: none;
  }

  figcaption {
    margin-top: var(--space-sm);
    color: var(--creme-attenuee);
  }
</style>
