import { useSyncExternalStore } from 'react';
export type ThemePref = 'auto' | 'light' | 'dark';
let pref: ThemePref = 'light';
const listeners = new Set<() => void>();
export function computeIsDark() { return pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); }
export function setThemePref(value: ThemePref) { pref = value; listeners.forEach(listener => listener()); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useIsDark() { return useSyncExternalStore(subscribe, computeIsDark); }
export function useThemePref(): ThemePref { return useSyncExternalStore(subscribe, () => pref); }
