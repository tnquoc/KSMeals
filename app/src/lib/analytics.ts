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
  | 'share';

export function track(name: EventName, schoolCode?: string | null, props: Record<string, string | number | boolean> = {}) {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) return;
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
