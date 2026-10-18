<script lang="ts">
  import { appli } from "../i18n/fr/appli.ts";
  import Notice from "./Notice.svelte";

  // The offline page of the online features (04-UI-SPEC « Offline », plan 04-10): « Mon compte »,
  // « Mes amis » and « Retrouver mon compte » show this notice when the network is missing. Every
  // hash route is the precached index.html, so there is no separate HTML page. « Réessayer » and the
  // `online` event both call `onretry`: the page loads its data again and the notice goes.
  type Props = { onretry: () => void };

  let { onretry }: Props = $props();
</script>

<svelte:window ononline={onretry} />

<Notice
  kind="page-hors-ligne"
  heading={appli.offlinePage.heading}
  body={appli.offlinePage.body}
  primary={{ label: appli.offlinePage.retry, run: onretry }}
  secondary={{ label: appli.offlinePage.solo, run: () => (location.hash = "#/ordinateur") }}
/>
