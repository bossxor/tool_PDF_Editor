const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const { version } = require(path.join(root, 'package.json'))
const artifacts = [
  [`PDF Editor ${version}.exe`, 'PDF Editor.exe'],
  [`PDF Editor Setup ${version}.exe`, 'PDF Editor Setup.exe']
]
for (const [source] of artifacts) {
  if (!fs.existsSync(path.join(root, 'dist', source))) throw new Error(`Missing distribution: ${source}`)
}
for (const [source, target] of artifacts) {
  fs.copyFileSync(path.join(root, 'dist', source), path.join(root, target))
  console.log(`Updated ${target} (${version})`)
}
