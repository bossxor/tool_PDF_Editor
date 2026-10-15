const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..')
const { version } = require(path.join(root, 'package.json'))
const artifacts = [
  [`PDF.Editor.Setup.${version}.exe`, 'PDF Editor Setup.exe'],
  [`PDF.Editor.Portable.${version}.exe`, 'PDF Editor.exe']
]
for (const [source] of artifacts) {
  if (!fs.existsSync(path.join(root, 'dist', source))) throw new Error(`Missing distribution: ${source}`)
}
for (const [source, target] of artifacts) {
  fs.copyFileSync(path.join(root, 'dist', source), path.join(root, target))
  console.log(`Updated ${target} (${version})`)
}
const checksums = artifacts.map(([source]) => {
  const hash = createHash('sha256').update(fs.readFileSync(path.join(root, 'dist', source))).digest('hex')
  return `${hash}  ${source}`
}).join('\n') + '\n'
fs.writeFileSync(path.join(root, 'dist', 'SHA256SUMS.txt'), checksums)
console.log('Wrote SHA256SUMS.txt')
