import type { TabBundle } from './TabContext'

// Opens `path` into `bundle`'s own doc/annot/tool stores. Deliberately NOT
// tied to any component's mount lifecycle — it's called right when a tab is
// created, so a document keeps loading even while its tab sits in the
// background (React only mounts the Workspace for the active tab).
export async function openDocumentInBundle(bundle: TabBundle, path: string): Promise<void> {
  const { api, useDocStore, useAnnotStore, useToolStore } = bundle
  const doc = useDocStore.getState()
  const annot = useAnnotStore.getState()

  doc.setLoading(true)
  doc.setError(null)
  const result = await api.openPath(path)
  useDocStore.getState().setLoading(false)
  if (!result.ok) {
    useDocStore.getState().setError(result.error ?? '파일을 열 수 없습니다.')
    return
  }
  useDocStore.getState().setOpened(path, result.needsPassword)
  annot.reset()
  useToolStore.getState().setTool('select')
  if (!result.needsPassword) {
    await loadInfoInBundle(bundle)
  }
}

export async function loadInfoInBundle(bundle: TabBundle): Promise<void> {
  const { api, useDocStore, useAnnotStore } = bundle
  const [docInfo, outline] = await Promise.all([api.getInfo(), api.getOutline()])
  useDocStore.getState().setInfo(docInfo, outline)
  useAnnotStore.getState().reset()
  await useAnnotStore.getState().refreshHistory()
}
