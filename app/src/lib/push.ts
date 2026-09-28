/**
 * Morning menu reminders through Web Push (web app only; the store apps will use native
 * notifications later). The subscription is kept on Supabase by RPC (migration 0010) with the
 * chosen school and allergy groups; pipeline/push.py sends at 06:30 on school days.
 */
import { Platform } from 'react-native';

import { VAPID_PUBLIC_KEY } from '@/lib/app-info';
import { getDeviceId } from '@/lib/device';
import { isCustomAllergy } from '@/lib/labels';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export type PushState =
  | 'unsupported' // native app, old browser, or in-app browser (Zalo, Facebook)
  | 'needs-install' // iPhone: only works once added to the Home Screen
  | 'blocked' // the parent refused notifications for this site
  | 'off'
  | 'on';

const isIOS = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

function supported() {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // Relative to the manifest, so it also works when the app is hosted under a sub-path.
  const base = (document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null)?.href ?? location.href;
  await navigator.serviceWorker.register(new URL('sw.js', base).href);
  return navigator.serviceWorker.ready;
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return isIOS() && !isStandalone() && Platform.OS === 'web' ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

async function rpc(name: string, body: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}

function keyBytes(base64url: string) {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function save(sub: PushSubscription, schoolId: number, allergies: string[]) {
  const json = sub.toJSON();
  await rpc('subscribe_push', {
    p_device: await getDeviceId(),
    p_school: schoolId,
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    // Only the 10 groups: terms the parent typed are matched in the app, not by the sender.
    p_allergies: allergies.filter((a) => !isCustomAllergy(a)),
  });
}

/** Asks for permission (must run from a tap) and subscribes. Returns the resulting state. */
export async function enablePush(schoolId: number, allergies: string[]): Promise<PushState> {
  if (!supported()) return pushState();
  if ((await Notification.requestPermission()) !== 'granted') return pushState();
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  await save(sub, schoolId, allergies);
  return 'on';
}

export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (!sub) return;
  await rpc('unsubscribe_push', { p_endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Keeps the server copy in step when the parent changes school or allergies (no prompt). */
export async function syncPush(schoolId: number, allergies: string[]): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (sub) await save(sub, schoolId, allergies).catch(() => {});
}
