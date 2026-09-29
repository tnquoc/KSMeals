/**
 * Anonymous usage events (Supabase RPC `track`, migration 0008). Fire-and-forget: a failed
 * event never blocks or breaks the app. Never send names, messages or free text here.
 */
import { Platform } from 'react-native';

import { getDeviceId } from '@/lib/device';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export type EventName =
  | 'app_open'
  | 'view_day'
  | 'view_week'
  | 'chat_sent'
  | 'allergies_set'
  | 'school_selected'
  | 'school_requested'
  | 'share'
  | 'push_on'
  | 'push_off';

export function track(name: EventName, schoolCode?: string | null, props: Record<string, string | number | boolean> = {}) {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) return;
  // Only real parents count: not the dev server, Expo Go or automated browsers (screenshots, crawlers).
  if (__DEV__ || (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver)) return;
  getDeviceId()
    .then((device) =>
      fetch(`${SUPABASE_URL}/rest/v1/rpc/track`, {
        method: 'POST',
        headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_device: device, p_name: name, p_school: schoolCode ?? null, p_platform: Platform.OS, p_props: props }),
      }),
    )
    .catch(() => {});
}

// Search engines, link previews and site checkers that run JavaScript: kept, but flagged so stats can drop them.
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|inspectiontool|preview|externalhit|phantom|puppeteer|playwright|selenium/i;

// Referrer host (or Android app id) -> short source name.
const SOURCES: [RegExp, string][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$|^com\.google\.android\.youtube/, 'youtube'],
  [/(^|\.)google\.[a-z.]+$|^com\.google\.android\.(googlequicksearchbox|gm)/, 'google'],
  [/(^|\.)(facebook\.com|fb\.com|messenger\.com)$|^com\.facebook\./, 'facebook'],
  [/(^|\.)(zalo\.me|zaloapp\.com)$|^com\.zing\.zalo/, 'zalo'],
  [/(^|\.)tiktok\.com$|^com\.(zhiliaoapp|ss\.android)\./, 'tiktok'],
  [/(^|\.)coccoc\.com$/, 'coccoc'],
  [/(^|\.)bing\.com$/, 'bing'],
];

/**
 * Where this visit came from, for `app_open` on the web: the referrer's host only (never its path),
 * `?src=` / `?utm_source=` if a link was tagged, and a flag for crawlers. Empty on native.
 */
export function visitSource(): Record<string, string | boolean> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return {};
  const out: Record<string, string | boolean> = {};
  const ua = navigator.userAgent ?? '';
  if (BOT_UA.test(ua) || navigator.languages?.length === 0) out.bot = true;

  let ref = 'direct';
  try {
    const r = document.referrer ? new URL(document.referrer) : null;
    const host = r ? (r.protocol === 'android-app:' ? r.hostname || r.pathname.replace(/^\/+/, '').split('/')[0] : r.hostname) : '';
    if (host === location.hostname || host === 'tnquoc.github.io') ref = r!.pathname.includes('/truong/') ? 'school_page' : 'internal';
    else if (host) ref = SOURCES.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, '').slice(0, 40);
  } catch {}
  // In-app browsers often send no referrer; their user agent still names the app.
  if (ref === 'direct') {
    if (/FBAN|FBAV|FB_IAB/.test(ua)) ref = 'facebook';
    else if (/Zalo/i.test(ua)) ref = 'zalo';
    else if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) ref = 'tiktok';
    else if (window.matchMedia?.('(display-mode: standalone)').matches) ref = 'home_screen';
  }
  out.ref = ref;

  const params = new URLSearchParams(location.search);
  const src = (params.get('src') ?? params.get('utm_source') ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
  if (src) out.src = src;
  return out;
}
