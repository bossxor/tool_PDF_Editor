import { parentPort } from 'node:worker_threads'
import { EngineSession } from './engine'

const engine = new EngineSession()
let queue = Promise.resolve()
parentPort!.on('message', ({ id, method, args }) => {
  // open/save are async too: preserve IPC order across all document operations.
  queue = queue.then(async () => {
    try {
      if (method === 'constructor' || !Object.prototype.hasOwnProperty.call(EngineSession.prototype, method)) {
        throw new Error('Unknown PDF operation')
      }
      const result = await (engine as any)[method](...args)
      parentPort!.postMessage({ id, result })
    } catch (error) {
      parentPort!.postMessage({ id, error: String((error as Error)?.message ?? error) })
    }
  })
})
