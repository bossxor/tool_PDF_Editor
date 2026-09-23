// Regenerates build/icon.png and build/icon.ico from build/icon.svg.
// Run with: node scripts/gen-icon.mjs
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const svgPath = path.join(root, 'build/icon.svg')
const svg = fs.readFileSync(svgPath)

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const icoPngPaths = []

for (const size of sizes) {
  const out = path.join(root, `build/icon-${size}.png`)
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out)
  if (size <= 256) icoPngPaths.push(out)
}

fs.copyFileSync(path.join(root, 'build/icon-1024.png'), path.join(root, 'build/icon.png'))

const icoBuf = await pngToIco(icoPngPaths)
fs.writeFileSync(path.join(root, 'build/icon.ico'), icoBuf)

for (const size of sizes) {
  fs.unlinkSync(path.join(root, `build/icon-${size}.png`))
}

console.log('Wrote build/icon.png and build/icon.ico')
