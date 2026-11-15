<script lang="ts">
  import { Save, Share2, Download, Upload, Trash2, FolderOpen } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { onMount } from 'svelte';
  import { song, replaceSong, commit } from '$lib/song.svelte';
  import { saveSong, listSongs, deleteSong, encodeShare, sanitizeSong, type SavedSong } from '$lib/storage';
  import { exportMidi, parseMidi, midiToSong } from '$lib/midi';
  import { EXAMPLE_SONGS, type ExampleSong } from '$lib/songs';

  let songs = $state<SavedSong[]>([]);
  let currentId = $state<string | undefined>();
  let message = $state('');
  let fileInput: HTMLInputElement;

  onMount(() => (songs = listSongs()));

  function say(text: string) {
    message = text;
  }

  function save() {
    try {
      currentId = saveSong($state.snapshot(song) as typeof song, currentId);
      songs = listSongs();
      say(`Saved “${song.name}”.`);
    } catch {
      say('Could not save: browser storage is unavailable or full.');
    }
  }

  function loadExample(example: ExampleSong) {
    replaceSong(example.create(), true); // undoable, so nothing is lost
    currentId = undefined;
    say(`Loaded “${example.name}”. Press Ctrl+Z to go back to your previous song.`);
  }

  function open(saved: SavedSong) {
    replaceSong(sanitizeSong(saved.data));
    currentId = saved.id;
    say(`Opened “${saved.name}”.`);
  }

  function remove(saved: SavedSong) {
    deleteSong(saved.id);
    if (currentId === saved.id) currentId = undefined;
    songs = listSongs();
  }

  async function share() {
    const url = `${location.origin}${location.pathname}#s=${await encodeShare($state.snapshot(song) as typeof song)}`;
    try {
      await navigator.clipboard.writeText(url);
      say('Share link copied to the clipboard.');
    } catch {
      say(url);
    }
    history.replaceState(null, '', url);
  }

  function download() {
    const blob = new Blob([exportMidi($state.snapshot(song) as typeof song) as BlobPart], { type: 'audio/midi' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${song.name.replace(/[^\w-]+/g, '_') || 'song'}.mid`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const imported = midiToSong(parseMidi(new Uint8Array(await file.arrayBuffer())), $state.snapshot(song) as typeof song, file.name);
      replaceSong(imported);
      currentId = undefined;
      say(`Imported ${imported.tracks.length} track(s) from “${file.name}”.`);
    } catch (error) {
      say(error instanceof Error ? error.message : 'Could not read that file.');
    }
  }
</script>

<div class="space-y-6">
  <section class="space-y-2">
    <Label for="song-name" class="text-sm font-medium">Song name</Label>
    <Input id="song-name" bind:value={song.name} onchange={commit} maxlength={60} />
    <div class="grid grid-cols-2 gap-2">
      <Button onclick={save} class="gap-2"><Save class="size-4" /> Save</Button>
      <Button onclick={share} variant="secondary" class="gap-2"><Share2 class="size-4" /> Share link</Button>
    </div>
  </section>

  <section class="space-y-2">
    <h3 class="text-sm font-medium">MIDI</h3>
    <div class="grid grid-cols-2 gap-2">
      <Button variant="outline" onclick={download} class="gap-2"><Download class="size-4" /> Export</Button>
      <Button variant="outline" onclick={() => fileInput.click()} class="gap-2"><Upload class="size-4" /> Import</Button>
    </div>
    <input bind:this={fileInput} type="file" accept=".mid,.midi,audio/midi" class="hidden" onchange={importFile} />
    <p class="text-muted-foreground text-xs">Import replaces the current song (up to 8 tracks, notes snap to sixteenths).</p>
  </section>

  <section class="space-y-2">
    <h3 class="text-sm font-medium">Example songs</h3>
    {#each [16, 32, 64] as size}
      <h4 class="text-muted-foreground pt-1 text-xs font-medium tracking-wide uppercase">
        {size}×{size} · {size / 16} {size === 16 ? 'bar' : 'bars'}
      </h4>
      <ul class="space-y-1">
        {#each EXAMPLE_SONGS.filter((e) => e.size === size) as example (example.id)}
          <li>
            <button
              type="button"
              onclick={() => loadExample(example)}
              class="bg-card hover:bg-accent focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
            >
              <span class="block text-sm">{example.name}</span>
              <span class="text-muted-foreground block text-xs">{example.description}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/each}
  </section>

  <section class="space-y-2">
    <h3 class="text-sm font-medium">My songs</h3>
    {#if songs.length === 0}
      <p class="text-muted-foreground text-sm">Nothing saved yet. Songs are stored in this browser.</p>
    {:else}
      <ul class="space-y-1">
        {#each songs as saved (saved.id)}
          <li class="bg-card flex items-center gap-1 rounded-md border p-1.5 pl-3 {saved.id === currentId ? 'border-primary' : ''}">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm">{saved.name}</p>
              <p class="text-muted-foreground text-xs">{new Date(saved.updatedAt).toLocaleString()}</p>
            </div>
            <Button variant="ghost" size="icon" class="size-8" onclick={() => open(saved)} aria-label="Open {saved.name}"><FolderOpen class="size-4" /></Button>
            <Button variant="ghost" size="icon" class="size-8" onclick={() => remove(saved)} aria-label="Delete {saved.name}"><Trash2 class="size-4" /></Button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <p role="status" aria-live="polite" class="text-muted-foreground min-h-5 text-xs break-all">{message}</p>
</div>
