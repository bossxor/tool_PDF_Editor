const KEY = 'pdf-editor:recent'
const MAX = 6

export function getRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function addRecent(path: string): void {
  try {
    const next = [path, ...getRecent().filter((p) => p !== path)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable: recent list just stays empty */
  }
}
