import { dev } from '$app/environment';
import { base } from '$app/paths';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const pwa = $state({
  /** All files are cached; the app works without a connection */
  offlineReady: false,
  /** A newer version is downloaded and waiting for a reload */
  updateReady: false,
  /** The browser offers to install the app */
  canInstall: false,
  installed: false,
  online: true,
  supported: false
});

let installEvent: InstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | undefined;

/** Call once on the client */
export function initPwa() {
  pwa.online = navigator.onLine;
  window.addEventListener('online', () => (pwa.online = true));
  window.addEventListener('offline', () => (pwa.online = false));

  pwa.installed = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installEvent = event as InstallPromptEvent;
    pwa.canInstall = true;
  });
  window.addEventListener('appinstalled', () => {
    pwa.installed = true;
    pwa.canInstall = false;
    installEvent = null;
  });

  // The dev server serves unbundled modules, which a service worker would cache stale
  if (dev || !('serviceWorker' in navigator)) return;
  pwa.supported = true;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'OFFLINE_READY') pwa.offlineReady = true;
  });
  // After the user accepts an update the new worker takes over: reload onto it
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !pwa.updateReady) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker
    .register(`${base}/service-worker.js`)
    .then((reg) => {
      registration = reg;
      // Already installed from an earlier visit
      if (reg.active && navigator.serviceWorker.controller) pwa.offlineReady = true;
      if (reg.waiting && navigator.serviceWorker.controller) pwa.updateReady = true;
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) pwa.updateReady = true;
        });
      });
      // Look for a new version now and then while the app stays open
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    })
    .catch((error) => console.warn('Service worker registration failed:', error));
}

export function applyUpdate() {
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

export async function install() {
  if (!installEvent) return;
  await installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  if (outcome === 'accepted') pwa.canInstall = false;
  installEvent = null;
}
