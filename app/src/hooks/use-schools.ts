import { useCallback, useEffect, useState } from 'react';

import { fetchSchools, type School } from '@/lib/api';

/** The whole school directory (covered or not), for the school picker. */
export function useSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      fetchSchools()
        .then((rows) => {
          setSchools(rows);
          setError(null);
        })
        .catch((e) => setError(String(e?.message ?? e))),
    [],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return { schools, error, reload };
}
