import { db } from './db';

/** کش حافظه‌ای سبک + کش ماندگار KV در دیتابیس */
type Entry = { t: number; data: unknown };
const mem = new Map<string, Entry>();
const MEM_MAX = 600;

function serialize(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function memGet<T>(key: string, ttlMs: number): T | null {
  const e = mem.get(key);
  if (e && Date.now() - e.t < ttlMs) return e.data as T;
  if (e) mem.delete(key);
  return null;
}

export function memSet(key: string, data: unknown) {
  if (mem.size > MEM_MAX) {
    const arr = [...mem.entries()].sort((a, b) => a[1].t - b[1].t);
    for (let i = 0; i < Math.ceil(MEM_MAX / 4); i++) mem.delete(arr[i][0]);
  }
  mem.set(key, { t: Date.now(), data });
}

/** کش ماندگار (بین ری‌استارت‌ها) با TTL — مقدار به‌صورت رشته/JSON ذخیره می‌شود */
export async function kvGet<T>(key: string, ttlMs: number): Promise<T | null> {
  const m = memGet<T>(key, ttlMs);
  if (m !== null) return m;
  try {
    const row = await db.kV.findUnique({ where: { key } });
    if (!row) return null;
    const age = Date.now() - row.updatedAt.getTime();
    if (age > ttlMs) return null;
    let parsed: unknown = row.value;
    if (typeof row.value === 'string' && row.value.length > 0) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = row.value;
      }
    }
    memSet(key, parsed);
    return parsed as T;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown) {
  memSet(key, value);
  try {
    await db.kV.upsert({
      where: { key },
      update: { value: serialize(value) },
      create: { key, value: serialize(value) },
    });
  } catch {
    /* دیتابیس در دسترس نیست — فقط حافظه */
  }
}
