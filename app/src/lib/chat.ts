/** Chat with the KSMeals assistant (Supabase Edge Function `chat`). */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const DEVICE_KEY = 'ksmeals.device';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

// Anonymous per-install id, only used for the daily question limit.
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let deviceId: string | null = null;
async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  deviceId = (await AsyncStorage.getItem(DEVICE_KEY).catch(() => null)) ?? uuid();
  AsyncStorage.setItem(DEVICE_KEY, deviceId).catch(() => {});
  return deviceId;
}

export async function askAssistant(
  schoolId: number,
  messages: ChatMessage[],
): Promise<{ reply: string; remaining?: number }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: await getDeviceId(), school_id: schoolId, messages }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.reply) return { reply: data.reply, remaining: data.remaining };
  throw new Error(data.error ?? `HTTP ${res.status}`);
}
