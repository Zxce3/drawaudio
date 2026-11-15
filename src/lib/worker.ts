// Metronome worker: timers in workers are not throttled in background tabs.
// It only emits ticks; the audio engine does the precise scheduling.
let timer: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<{ type: string; interval?: number }>) => {
  if (e.data.type === 'start') {
    if (timer) clearInterval(timer);
    timer = setInterval(() => postMessage({ type: 'tick' }), e.data.interval ?? 25);
  } else if (e.data.type === 'stop') {
    if (timer) clearInterval(timer);
    timer = null;
  }
};

self.onerror = (error) => {
  console.error('Worker error:', error);
};
