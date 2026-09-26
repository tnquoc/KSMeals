/** Public facts about the app, shown in the privacy page and used in share links. */

export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://tnquoc.github.io/KSMeals').replace(/\/$/, '');

// Public contact for privacy requests and takedowns (required by the app stores).
export const CONTACT_EMAIL = process.env.EXPO_PUBLIC_CONTACT_EMAIL ?? '';

export const PRIVACY_UPDATED = '26/09/2026';
