# KSMeals app

Expo SDK 57 + Expo Router. Reads published menus from Supabase with the publishable key
(row level security: active schools and published meals only). No login in v1; the chosen
school is stored on the device.

## Run

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npx expo start
```

- iPhone: install **Expo Go** from the App Store, same Wi-Fi as the computer, scan the QR code
  with the Camera app. Different network: `npx expo start --tunnel`.
- Web: press `w` in the terminal.

## Structure

```
src/app/            screens (Expo Router): index = Hôm nay, week = Cả tuần, school = Trường
src/components/     meal-card, day-menu, screen, tabs
src/hooks/          use-week-meals (fetch + pull to refresh)
src/lib/            api (Supabase REST), dates, labels, school-store (AsyncStorage)
```

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

Dependencies are pinned to exact versions (`.npmrc` has `save-exact=true`); add packages with
`npx expo install <package>` so versions match the SDK.
