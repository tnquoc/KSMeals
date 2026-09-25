/** The chosen school, kept on the device (no login in v1). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { School } from '@/lib/api';

const KEY = 'ksmeals.school';

type SchoolState = {
  school: School | null;
  loaded: boolean;
  setSchool: (s: School) => void;
};

const SchoolContext = createContext<SchoolState>({ school: null, loaded: false, setSchool: () => {} });

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [school, setSchoolState] = useState<School | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSchoolState(JSON.parse(raw)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setSchool = (s: School) => {
    setSchoolState(s);
    AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  };

  return <SchoolContext.Provider value={{ school, loaded, setSchool }}>{children}</SchoolContext.Provider>;
}

export const useSchool = () => useContext(SchoolContext);
