// Package the built extension (dist/) into a Chrome Web Store-ready zip whose
// manifest.json sits at the archive root. Cross-platform: uses PowerShell's
// Compress-Archive on Windows and `zip` elsewhere, so no extra npm dependency is
// pulled into the supply chain (see ADR-0009).
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, rmSync } from 'node:fs'
import { platform } from 'node:os'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const out = `llm-council-v${pkg.version}.zip`

if (!existsSync('dist')) {
  console.error('dist/ not found — run `npm run build` first.')
  process.exit(1)
}
if (existsSync(out)) rmSync(out)

if (platform() === 'win32') {
  execFileSync(
    'powershell',
    ['-NoProfile', '-Command', `Compress-Archive -Path 'dist/*' -DestinationPath '${out}'`],
    { stdio: 'inherit' },
  )
} else {
  execFileSync('bash', ['-c', `cd dist && zip -qr "../${out}" .`], { stdio: 'inherit' })
}

console.log(`Packaged ${out} — upload this to the Chrome Web Store.`)
