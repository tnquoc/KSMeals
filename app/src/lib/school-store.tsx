/** The chosen school and the child's allergies, kept on the device (no login in v1). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { track } from '@/lib/analytics';
import type { School } from '@/lib/api';

const SCHOOL_KEY = 'ksmeals.school';
const ALLERGIES_KEY = 'ksmeals.allergies';

type ProfileState = {
  school: School | null;
  allergies: string[]; // allergen ids, same as pipeline/allergens.py
  loaded: boolean;
  setSchool: (s: School) => void;
  toggleAllergy: (id: string) => void;
};

const ProfileContext = createContext<ProfileState>({
  school: null,
  allergies: [],
  loaded: false,
  setSchool: () => {},
  toggleAllergy: () => {},
});

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [school, setSchoolState] = useState<School | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([SCHOOL_KEY, ALLERGIES_KEY])
      .then(([[, rawSchool], [, rawAllergies]]) => {
        if (rawSchool) setSchoolState(JSON.parse(rawSchool));
        if (rawAllergies) setAllergies(JSON.parse(rawAllergies));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setSchool = (s: School) => {
    setSchoolState(s);
    AsyncStorage.setItem(SCHOOL_KEY, JSON.stringify(s)).catch(() => {});
  };

  const toggleAllergy = (id: string) => {
    const next = allergies.includes(id) ? allergies.filter((a) => a !== id) : [...allergies, id];
    setAllergies(next);
    AsyncStorage.setItem(ALLERGIES_KEY, JSON.stringify(next)).catch(() => {});
    track('allergies_set', school?.code, { count: next.length });
  };

  return (
    <ProfileContext.Provider value={{ school, allergies, loaded, setSchool, toggleAllergy }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useSchool = () => useContext(ProfileContext);
