/** Chat with the KSMeals assistant (Supabase Edge Function `chat`). */
import { getDeviceId } from '@/lib/device';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function askAssistant(
  schoolId: number,
  messages: ChatMessage[],
  allergies: string[] = [],
): Promise<{ reply: string; remaining?: number }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: await getDeviceId(), school_id: schoolId, messages, allergies }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.reply) return { reply: data.reply, remaining: data.remaining };
  throw new Error(data.error ?? `HTTP ${res.status}`);
}
