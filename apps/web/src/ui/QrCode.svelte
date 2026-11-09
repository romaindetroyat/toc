<script lang="ts">
  import { table as copy } from "../i18n/fr/table.ts";

  // The table link's QR code (02-UI-SPEC « Invite sheet », D-02). uqr (0.1.3, approved by Romain) is
  // loaded only here, when the sheet opens, as its own chunk. Error correction L, no border from uqr:
  // the 4-module quiet zone is drawn here, so the viewBox is the module count + 8. The matrix is one
  // <path> of 1 x 1 squares built from booleans (never markup from a string, T-02-22), walnut modules on
  // cream, crisp edges, whole-pixel modules of at least 4 px in a box of at most 196 px when it can.
  // While the chunk loads the box is the cream square with its caption; if it fails, the caption says
  // so and the link buttons beside it still work.
  // Plan 04-10: `label` names the code for another link (« Code QR du lien d’invitation »).
  type Props = { url: string; label?: string };

  let { url, label = copy.invite.qrLabel }: Props = $props();

  const QUIET = 4;
  const MAX_BOX = 196;
  const MIN_MODULE = 4;

  let status = $state<"loading" | "ready" | "failed">("loading");
  let modules = $state(0);
  let path = $state("");

  $effect(() => {
    const text = url;
    let live = true;
    status = "loading";
    import("uqr")
      .then(({ encode }) => {
        if (!live) return;
        const qr = encode(text, { ecc: "L", border: 0 });
        const parts: string[] = [];
        qr.data.forEach((row, y) => {
          row.forEach((dark, x) => {
            if (dark) parts.push(`M${x + QUIET} ${y + QUIET}h1v1h-1z`);
          });
        });
        path = parts.join("");
        modules = qr.size;
        status = "ready";
      })
      .catch(() => {
        if (live) status = "failed";
      });
    return () => {
      live = false;
    };
  });

  const side = $derived(modules + 2 * QUIET);
  /** Whole pixels per module: as many as fit in 196 px, never fewer than 4. */
  const pixel = $derived(modules === 0 ? MIN_MODULE : Math.max(MIN_MODULE, Math.floor(MAX_BOX / side)));
  /** 164 px for the usual link (33 modules + 8), before the code is known as well. */
  const box = $derived(modules === 0 ? 164 : pixel * side);
</script>

<figure class="qr" data-qr={status} data-modules={modules}>
  <div class="box" style:width={`${box}px`} style:height={`${box}px`}>
    {#if status === "ready"}
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${side} ${side}`}
        width={box}
        height={box}
        shape-rendering="crispEdges"
      >
        <path d={path} />
      </svg>
    {/if}
  </div>
  <figcaption class="t-label caption">
    {status === "failed" ? copy.invite.qrFailed : copy.invite.qrCaption}
  </figcaption>
</figure>

<style>
  .qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    margin: 0;
  }

  .box {
    flex: none;
    overflow: hidden;
    border-radius: var(--radius-card);
    background: var(--creme);
  }

  svg {
    display: block;
  }

  path {
    fill: var(--noyer);
  }

  /* One line (it may be a little wider than the box): two lines would make the sheet scroll at
     844 x 390. The failure sentence wraps in the box's width. */
  .caption {
    color: var(--creme-attenuee);
    text-align: center;
    white-space: nowrap;
  }

  .qr[data-qr="failed"] .caption {
    max-width: 164px;
    white-space: normal;
  }
</style>
