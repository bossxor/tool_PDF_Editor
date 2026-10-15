import { Worker } from 'node:worker_threads'
import type { EngineSession } from './engine'

type AsyncEngine = {
  [K in keyof EngineSession]: EngineSession[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>> : never
}

// One owner for each document and its journal. All operations, including print,
// use the same worker, so edits cannot race a separate rendering copy.
export function createEngineClient(workerUrl = new URL('./engine-worker.js', import.meta.url)): AsyncEngine {
  const worker = new Worker(workerUrl)
  let nextId = 0
  let stopped: Error | null = null
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>()
  const fail = (error: Error): void => {
    stopped = error
    for (const request of pending.values()) request.reject(error)
    pending.clear()
  }
  worker.on('error', fail)
  worker.on('exit', code => fail(new Error(`PDF worker stopped (${code})`)))
  worker.on('message', ({ id, result, error }) => {
    const request = pending.get(id)
    if (!request) return
    pending.delete(id)
    if (error) request.reject(new Error(error))
    else {
      if (result?.png) result.png = Buffer.from(result.png)
      request.resolve(result)
    }
  })
  return new Proxy({} as AsyncEngine, {
    get: (_target, method: string) => (...args: unknown[]) => {
      if (method === 'close') {
        fail(new Error('PDF document closed'))
        return worker.terminate().then(() => undefined)
      }
      if (stopped) return Promise.reject(stopped)
      return new Promise((resolve, reject) => {
        const id = ++nextId
        pending.set(id, { resolve, reject })
        try { worker.postMessage({ id, method, args }) }
        catch (error) { pending.delete(id); reject(error) }
      })
    }
  })
}

export type EngineClient = ReturnType<typeof createEngineClient>
