/**
 * The last menus seen, kept on the device: shown at once while the fresh copy loads, and when
 * the network fails. Under the 'ksmeals.' prefix, so "Xóa dữ liệu trên máy này" removes it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Menu } from '@/lib/api';

const KEY = 'ksmeals.menus';
const SIZE = 6; // school/range pairs

let cache: Record<string, Menu> | null = null;

async function all(): Promise<Record<string, Menu>> {
  if (!cache) {
    const raw = await AsyncStorage.getItem(KEY).catch(() => null);
    try {
      cache = raw ? JSON.parse(raw) : {};
    } catch {
      cache = {};
    }
  }
  return cache!;
}

export async function savedMenu(key: string): Promise<Menu | undefined> {
  return (await all())[key];
}

export async function saveMenu(key: string, menu: Menu) {
  const menus = await all();
  delete menus[key]; // re-inserted last: the oldest entries are the first keys
  menus[key] = menu;
  for (const old of Object.keys(menus).slice(0, -SIZE)) delete menus[old];
  AsyncStorage.setItem(KEY, JSON.stringify(menus)).catch(() => {});
}

/** The stored copy is removed with the other 'ksmeals.' keys; this drops the one in memory. */
export function forgetMenus() {
  cache = {};
}
