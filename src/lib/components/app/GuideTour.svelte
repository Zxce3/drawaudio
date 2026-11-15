<script lang="ts">
  import { tick, onMount, untrack } from 'svelte';
  import { X, ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { ui } from '$lib/song.svelte';
  import { TOUR } from '$lib/tour';

  const SEEN_KEY = 'drawaudio:toured';

  let step = $state(0);
  let rect = $state<DOMRect | null>(null);
  let cardHeight = $state(200);
  let viewport = $state({ w: 1200, h: 800 });
  let card = $state<HTMLDivElement>();
  let previousTab = 'sequencer';

  const current = $derived(TOUR[step]);
  const last = $derived(step === TOUR.length - 1);
  const CARD_W = 360;
  const MARGIN = 12;

  function markSeen() {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* best effort */
    }
    ui.tourPrompt = false;
  }

  onMount(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) ui.tourPrompt = true;
    } catch {
      /* ignore */
    }
  });

  function start() {
    markSeen();
    ui.tourOpen = true;
  }

  function close() {
    ui.tourOpen = false;
    ui.panelTab = previousTab;
    markSeen();
  }

  // The header Guide button and the H shortcut set ui.tourOpen directly,
  // so (re)start from the first step whenever it opens
  let wasOpen = false;
  $effect(() => {
    const open = ui.tourOpen;
    if (open && !wasOpen) {
      untrack(() => {
        previousTab = ui.panelTab;
        step = 0;
      });
    }
    wasOpen = open;
  });

  async function locate() {
    viewport = { w: window.innerWidth, h: window.innerHeight };
    const s = TOUR[step];
    if (s.tab) ui.panelTab = s.tab;
    await tick();
    // Let a freshly selected tab finish rendering before measuring
    await new Promise((r) => setTimeout(r, s.tab ? 120 : 0));
    const el = s.target ? document.querySelector<HTMLElement>(`[data-guide="${s.target}"]`) : null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    rect = el ? el.getBoundingClientRect() : null;
    await tick();
    card?.querySelector<HTMLElement>('[data-next]')?.focus();
  }

  $effect(() => {
    if (!ui.tourOpen) {
      rect = null;
      return;
    }
    void step;
    locate();
    const onResize = () => {
      const el = TOUR[step].target ? document.querySelector<HTMLElement>(`[data-guide="${TOUR[step].target}"]`) : null;
      viewport = { w: window.innerWidth, h: window.innerHeight };
      rect = el ? el.getBoundingClientRect() : null;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  const pos = $derived.by(() => {
    const w = Math.min(CARD_W, viewport.w - MARGIN * 2);
    if (!rect) return { left: (viewport.w - w) / 2, top: Math.max(MARGIN, (viewport.h - cardHeight) / 2), width: w };
    const clampX = (x: number) => Math.min(Math.max(MARGIN, x), viewport.w - w - MARGIN);
    const below = viewport.h - rect.bottom;
    let top: number;
    if (below >= cardHeight + MARGIN * 2) top = rect.bottom + MARGIN;
    else if (rect.top >= cardHeight + MARGIN * 2) top = rect.top - cardHeight - MARGIN;
    else top = Math.max(MARGIN, Math.min(viewport.h - cardHeight - MARGIN, rect.bottom - cardHeight - MARGIN));
    // A tall target such as the side panel: put the card beside it when there is room
    if (rect.height > viewport.h * 0.5 && rect.left > w + MARGIN * 2) return { left: rect.left - w - MARGIN, top: Math.max(MARGIN, rect.top + MARGIN), width: w };
    return { left: clampX(rect.left), top, width: w };
  });

  function onkeydown(event: KeyboardEvent) {
    if (!ui.tourOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prev();
    } else if (event.key === 'Tab' && card) {
      // Keep keyboard focus inside the guide while it is open
      const items = [...card.querySelectorAll<HTMLElement>('button')];
      const first = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        first.focus();
      } else if (!card.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function next() {
    if (last) close();
    else step++;
  }
  function prev() {
    if (step > 0) step--;
  }
</script>

<svelte:window {onkeydown} />

{#if ui.tourPrompt && !ui.tourOpen}
  <div class="bg-popover text-popover-foreground fixed bottom-4 left-4 z-40 max-w-xs rounded-lg border p-4 shadow-lg" role="region" aria-label="Welcome">
    <p class="text-sm font-medium">New here?</p>
    <p class="text-muted-foreground mt-1 text-xs">Take a one-minute guided tour of every feature.</p>
    <div class="mt-3 flex gap-2">
      <Button size="sm" onclick={start}>Start the tour</Button>
      <Button size="sm" variant="ghost" onclick={markSeen}>Maybe later</Button>
    </div>
  </div>
{/if}

{#if ui.tourOpen}
  <!-- Blocks clicks on the page while the tour runs -->
  <div class="fixed inset-0 z-50" aria-hidden="true"></div>
  {#if rect}
    <div
      class="outline-primary pointer-events-none fixed z-50 rounded-lg outline-2 transition-all duration-200"
      style="left:{rect.left - 4}px; top:{rect.top - 4}px; width:{rect.width + 8}px; height:{rect.height + 8}px; box-shadow: 0 0 0 9999px rgb(0 0 0 / 0.6);"
      aria-hidden="true"
    ></div>
  {:else}
    <div class="pointer-events-none fixed inset-0 z-50 bg-black/60" aria-hidden="true"></div>
  {/if}

  <div
    bind:this={card}
    bind:clientHeight={cardHeight}
    role="dialog"
    aria-modal="true"
    aria-labelledby="tour-title"
    aria-describedby="tour-text"
    class="bg-popover text-popover-foreground fixed z-50 rounded-lg border p-4 shadow-xl"
    style="left:{pos.left}px; top:{pos.top}px; width:{pos.width}px;"
  >
    <div class="flex items-start justify-between gap-2">
      <h2 id="tour-title" class="text-base font-semibold">{current.title}</h2>
      <button type="button" class="text-muted-foreground hover:text-foreground -mt-1 -mr-1 rounded p-1" onclick={close} aria-label="Close the guide">
        <X class="size-4" />
      </button>
    </div>
    <p id="tour-text" class="text-muted-foreground mt-2 text-sm leading-relaxed">{current.text}</p>
    <div class="mt-4 flex items-center justify-between gap-2">
      <span class="text-muted-foreground text-xs tabular-nums" aria-live="polite">Step {step + 1} of {TOUR.length}</span>
      <div class="flex gap-2">
        {#if step > 0}
          <Button size="sm" variant="outline" onclick={prev} class="gap-1"><ChevronLeft class="size-4" /> Back</Button>
        {:else}
          <Button size="sm" variant="ghost" onclick={close}>Skip</Button>
        {/if}
        <Button size="sm" onclick={next} class="gap-1" data-next>
          {last ? 'Finish' : 'Next'}{#if !last}<ChevronRight class="size-4" />{/if}
        </Button>
      </div>
    </div>
    <div class="bg-muted mt-3 h-1 overflow-hidden rounded-full" aria-hidden="true">
      <div class="bg-primary h-full transition-all" style="width: {((step + 1) / TOUR.length) * 100}%"></div>
    </div>
  </div>
{/if}
