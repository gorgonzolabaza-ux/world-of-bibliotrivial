import { get, set, del } from 'idb-keyval';

export interface BestRun { difficulty: string; durationMs: number; date: number; score: number; }
export interface AchievementRecord { id: string; unlockedAt: number; }

const KEY_BEST = 'bestRuns';
const KEY_ACH = 'achievements';
const KEY_SETTINGS = 'settings';

export async function loadBestRuns(): Promise<BestRun[]> {
  return (await get<BestRun[]>(KEY_BEST)) || [];
}
export async function saveBestRun(run: BestRun) {
  const runs = await loadBestRuns();
  runs.push(run);
  await set(KEY_BEST, runs);
}
export async function loadAchievements(): Promise<AchievementRecord[]> {
  return (await get<AchievementRecord[]>(KEY_ACH)) || [];
}
export async function unlockAchievement(id: string) {
  const list = await loadAchievements();
  if (list.some((a) => a.id === id)) return;
  list.push({ id, unlockedAt: Date.now() });
  await set(KEY_ACH, list);
}
export async function loadSettings(): Promise<any> {
  return (await get(KEY_SETTINGS)) || {};
}
export async function saveSettings(s: any) {
  await set(KEY_SETTINGS, s);
}
export async function clearAll() {
  await del(KEY_BEST);
  await del(KEY_ACH);
  await del(KEY_SETTINGS);
}
