<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { SHORTCUTS, GRID_SHORTCUTS } from '$lib/shortcuts';

  let { open = $bindable(false) }: { open: boolean } = $props();

  const steps = [
    ['Draw', 'Click or drag on the grid to place notes. Right-click (or the Erase tool) removes them. Rows are pitches, columns are time.'],
    ['Play', 'Press Play or Space. The yellow column is the playhead. Change tempo, scale, grid size and direction from the top bar.'],
    ['Layer', 'Add up to 8 tracks at the bottom. Each has its own sound, volume, pan and reverb send, plus mute and solo.'],
    ['Shape the sound', 'Seq: waveform, groove, arpeggio, chords. Sound: envelopes, filters, wavetable, FM. FX: reverb, delay, tape, vinyl and more.'],
    ['Keep and share', 'Songs autosave in your browser. Use the Song tab to save, copy a share link, load an example, or import and export MIDI.']
  ];
  const groups = ['Playback', 'Editing', 'Tracks', 'Song', 'View'] as const;
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="gap-0 p-0 sm:max-w-3xl">
    <Dialog.Header class="border-b p-5 pb-4">
      <Dialog.Title class="text-xl">About Draw<span class="text-primary">Audio</span></Dialog.Title>
      <Dialog.Description>
        A music sequencer you play with a pencil. Draw notes on a grid and hear them as a layered, synthesised song, right in your browser.
      </Dialog.Description>
    </Dialog.Header>

    <ScrollArea class="max-h-[60vh]">
      <div class="space-y-6 p-5 text-sm">
        <section>
          <h3 class="mb-2 font-semibold">How it works</h3>
          <ol class="space-y-2">
            {#each steps as [title, text], i}
              <li class="flex gap-3">
                <span class="bg-primary/15 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">{i + 1}</span>
                <p><strong>{title}.</strong> <span class="text-muted-foreground">{text}</span></p>
              </li>
            {/each}
          </ol>
        </section>

        <section>
          <h3 class="mb-2 font-semibold">Keyboard shortcuts</h3>
          <div class="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {#each groups as group}
              <div>
                <h4 class="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">{group}</h4>
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  {#each SHORTCUTS.filter((sc) => sc.group === group) as sc}
                    <dt class="font-mono text-xs whitespace-nowrap">{sc.keys}</dt>
                    <dd class="text-muted-foreground text-xs">{sc.description}</dd>
                  {/each}
                  {#if group === 'Editing'}
                    {#each GRID_SHORTCUTS as [keys, text]}
                      <dt class="font-mono text-xs whitespace-nowrap">{keys}</dt>
                      <dd class="text-muted-foreground text-xs">{text}</dd>
                    {/each}
                  {/if}
                </dl>
              </div>
            {/each}
          </div>
        </section>

        <section>
          <h3 class="mb-2 font-semibold">Good to know</h3>
          <ul class="text-muted-foreground list-disc space-y-1 pl-5">
            <li>Everything runs locally. Nothing you make is uploaded; share links carry the song inside the URL.</li>
            <li>Sound starts on your first click, because browsers block audio until you interact with the page.</li>
            <li>New here? Press the Guide button (or H) for a step-by-step tour, and click any <strong>?</strong> icon for a plain-language explanation of that control.</li>
            <li>Press R to record what you hear to a WAV file, or render a clean loop from the Song tab.</li>
            <li>The music is drawn behind the grid. Change or turn off the visualizer in the Tools tab.</li>
            <li>The grid is bigger and slower on 64×64; try 16×16 or 32×32 on older phones.</li>
          </ul>
        </section>

        <section>
          <h3 class="mb-2 font-semibold">Credits</h3>
          <p class="text-muted-foreground">
            Inspired by <a class="text-primary underline underline-offset-2" href="https://draw.audio/" target="_blank" rel="noopener noreferrer">draw.audio</a>
            and by the visualizers in
            <a class="text-primary underline underline-offset-2" href="https://github.com/flo-bit/svelte-audio-visualizations" target="_blank" rel="noopener noreferrer">svelte-audio-visualizations</a>
            (MIT). The bitcrusher and WAV recorder follow the AudioWorklet patterns from
            <a class="text-primary underline underline-offset-2" href="https://github.com/GoogleChromeLabs/web-audio-samples" target="_blank" rel="noopener noreferrer">web-audio-samples</a>
            (Apache-2.0). Built with SvelteKit, Svelte 5, Tailwind CSS, shadcn-svelte and the Web Audio API. The source is on
            <a class="text-primary underline underline-offset-2" href="https://github.com/Zxce3/drawaudio-tmp" target="_blank" rel="noopener noreferrer">GitHub</a>.
          </p>
        </section>
      </div>
    </ScrollArea>
  </Dialog.Content>
</Dialog.Root>
