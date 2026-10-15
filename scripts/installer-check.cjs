// Compile/run only our process-check macro; no registry writes or app removal.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const cache = path.join(process.env.LOCALAPPDATA, 'electron-builder/Cache')
function find(dir, name, depth = 4) {
  if (!fs.existsSync(dir) || depth === 0) return null
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isFile() && entry.name === name) return file
    if (entry.isDirectory()) { const result = find(file, name, depth - 1); if (result) return result }
  }
  return null
}
const compiler = find(path.join(cache, 'nsis-3.0.4.1'), 'makensis.exe')
const plugin = find(path.join(cache, 'nsis-resources-3.4.1'), 'nsProcess.dll')
assert(compiler && plugin, 'Run npm run dist first to populate the NSIS tool cache')
const unicodePlugin = path.join(path.dirname(path.dirname(plugin)), 'x86-unicode')
const output = path.join(root, '.verification/nsis-check')
fs.mkdirSync(output, { recursive: true })
function run(exe, args, expected) {
  const r = spawnSync(exe, args, { windowsHide: true, encoding: 'utf8', timeout: 20000 })
  assert.equal(r.error, undefined, String(r.error))
  assert.equal(r.status, expected, `${exe}: ${r.stdout}\n${r.stderr}`)
}
for (const [kind, executable, expected] of [
  ['idle', 'PDF-Editor-Regression-Not-Running-238f.exe', 0],
  ['running', path.basename(process.execPath), 2]
]) {
  const exe = path.join(output, `${kind}.exe`)
  const uninstaller = path.join(output, `uninstall-${kind}.exe`)
  const source = path.join(output, `${kind}.nsi`)
  fs.writeFileSync(source, `Unicode true
!include "LogicLib.nsh"
!addplugindir /x86-unicode "${unicodePlugin}"
!define APP_EXECUTABLE_FILENAME "${executable}"
!include "${path.join(root, 'build/installer.nsh')}"
Name "PDF Editor check regression"
OutFile "${exe}"
RequestExecutionLevel user
SilentInstall silent
SilentUnInstall silent
Section
  WriteUninstaller "${uninstaller}"
  !insertmacro customCheckAppRunning
  SetErrorLevel 0
SectionEnd
Section "Uninstall"
  !insertmacro customCheckAppRunning
  SetErrorLevel 0
SectionEnd
`)
  run(compiler, ['/V2', source], 0)
  run(exe, ['/S'], expected)
  run(uninstaller, ['/S', `_?=${output}`], expected)
}
console.log('PASS: installer/uninstaller process check, idle succeeds, running app aborts silently with code 2; no forced termination or registry changes')
