import { useCallback, useEffect, useState } from 'react';

import { fetchMenu, type Menu } from '@/lib/api';
import { iso } from '@/lib/dates';
import { savedMenu, saveMenu } from '@/lib/menu-cache';

type Result = Menu & { key: string; failed: boolean };

type Meals = Menu & {
  loading: boolean; // nothing to show yet for this school/range
  failed: boolean; // the last request did not get through; `meals` may still hold the saved copy
  refreshing: boolean; // pull-to-refresh
  reload: () => Promise<void>;
};

const RETRY_MS = 1500;
const EMPTY: Menu = { meals: [], sources: {} };

/** One more try after a short pause: a reset or dropped connection usually works the second time. */
async function load(schoolId: number, from: Date, to: Date, key: string): Promise<Menu | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const menu = await fetchMenu(schoolId, iso(from), iso(to));
      saveMenu(key, menu);
      return menu;
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
  return null;
}

/** Meals of one school between two dates (inclusive). */
export function useMeals(schoolId: number | undefined, from: Date, to: Date): Meals {
  const key = `${schoolId}:${iso(from)}:${iso(to)}`;
  const [result, setResult] = useState<Result>({ key: '', ...EMPTY, failed: false });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    (async () => {
      // The copy saved on the device shows at once; the fresh one replaces it when it arrives.
      const saved = await savedMenu(key);
      if (saved && !cancelled) setResult({ key, ...saved, failed: false });
      const fresh = await load(schoolId, from, to, key);
      if (!cancelled) setResult({ key, ...(fresh ?? saved ?? EMPTY), failed: !fresh });
    })();
    return () => {
      cancelled = true;
    };
    // `key` already encodes schoolId, from and to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(async () => {
    if (!schoolId) return;
    setRefreshing(true);
    const fresh = await load(schoolId, from, to, key);
    // A failed refresh keeps what is on screen.
    setResult((shown) => ({ ...(fresh ?? (shown.key === key ? shown : EMPTY)), key, failed: !fresh }));
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result.key === key;
  return {
    meals: current ? result.meals : [],
    sources: current ? result.sources : {},
    failed: current && result.failed,
    loading: !!schoolId && !current,
    refreshing,
    reload,
  };
}
