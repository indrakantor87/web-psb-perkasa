type CacheEntry<T> = { value: T; expires: number }

class TinyTTLCache {
  private store = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): T | null {
    const e = this.store.get(key)
    if (!e) return null
    if (Date.now() > e.expires) {
      this.store.delete(key)
      return null
    }
    return e.value as T
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.store.set(key, { value, expires: Date.now() + ttlMs })
  }

  invalidate(key: string) {
    this.store.delete(key)
  }

  invalidateByPrefix(prefix: string) {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k)
    }
  }
}

export const cache = new TinyTTLCache()
