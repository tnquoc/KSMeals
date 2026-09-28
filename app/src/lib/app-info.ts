/** Public facts about the app, shown in the privacy page and used in share links. */

export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://ksmeals.com').replace(/\/$/, '');

// Public contact for privacy requests and takedowns (required by the app stores).
export const CONTACT_EMAIL = process.env.EXPO_PUBLIC_CONTACT_EMAIL ?? '';

export const PRIVACY_UPDATED = '27/09/2026';

// Web Push (VAPID) public key; the private half is VAPID_PRIVATE_KEY in .env and Actions secrets.
export const VAPID_PUBLIC_KEY = 'BEipOUSVqpaVOFMtBZ6PlhhfRNy1iwwseBLCfFnN2-Bz05gQYWxqT_ssAT9PmbUQKTQu9ckVAv8IsRBAsslpGLo';
