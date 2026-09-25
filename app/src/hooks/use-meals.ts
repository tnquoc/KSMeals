import { useCallback, useEffect, useState } from 'react';

import { fetchMeals, fetchSources, type Meal, type SourcePost } from '@/lib/api';
import { iso } from '@/lib/dates';

type Result = { key: string; meals: Meal[]; sources: Record<number, SourcePost>; error: string | null };

type Meals = Omit<Result, 'key'> & {
  loading: boolean; // first load of this school/range
  refreshing: boolean; // pull-to-refresh
  reload: () => Promise<void>;
};

async function load(schoolId: number, from: Date, to: Date, key: string): Promise<Result> {
  try {
    const meals = await fetchMeals(schoolId, iso(from), iso(to));
    const ids = [...new Set(meals.map((m) => m.source_post_id).filter((id): id is number => id != null))];
    // Links and original images are a nice-to-have: the menu still shows if they fail.
    const sources = await fetchSources(ids).catch(() => ({}));
    return { key, meals, sources, error: null };
  } catch (e) {
    return { key, meals: [], sources: {}, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Meals of one school between two dates (inclusive). */
export function useMeals(schoolId: number | undefined, from: Date, to: Date): Meals {
  const key = `${schoolId}:${iso(from)}:${iso(to)}`;
  const [result, setResult] = useState<Result>({ key: '', meals: [], sources: {}, error: null });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    load(schoolId, from, to, key).then((r) => !cancelled && setResult(r));
    return () => {
      cancelled = true;
    };
    // `key` already encodes schoolId, from and to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(async () => {
    if (!schoolId) return;
    setRefreshing(true);
    setResult(await load(schoolId, from, to, key));
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result.key === key;
  return {
    meals: current ? result.meals : [],
    sources: current ? result.sources : {},
    error: current ? result.error : null,
    loading: !!schoolId && !current,
    refreshing,
    reload,
  };
}
