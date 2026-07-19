// Package the built extension (dist/) into a Chrome Web Store-ready zip whose
// manifest.json sits at the archive root. Cross-platform: uses the bsdtar
// shipped as System32\tar.exe on Windows and `zip` elsewhere, so no extra npm
// dependency is pulled into the supply chain (see ADR-0009).
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { platform } from 'node:os'
import { fileURLToPath } from 'node:url'

// Zip the CONTENTS of sourceDir into outFile (manifest.json at the archive
// root). Exported so the packaging can be tested without shelling out to a
// full build.
export function zipDir(sourceDir, outFile) {
  const out = resolve(outFile)
  if (existsSync(out)) rmSync(out)

  if (platform() === 'win32') {
    // PowerShell's Compress-Archive writes back-slash separators, which Chrome
    // may fail to resolve against manifest.json's forward-slash references.
    // Windows ships bsdtar at System32\tar.exe; it writes spec-compliant
    // forward-slash paths with no extra dependency. Naming the top-level entries
    // explicitly (rather than `.`) keeps them rooted with no `./` prefix.
    const tar = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\tar.exe`
    const entries = readdirSync(sourceDir)
    execFileSync(tar, ['-a', '-c', '-f', out, '-C', sourceDir, ...entries], { stdio: 'inherit' })
  } else {
    execFileSync('zip', ['-qr', out, '.'], { cwd: sourceDir, stdio: 'inherit' })
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
  const out = `no-api-llm-council-v${pkg.version}.zip`

  if (!existsSync('dist')) {
    console.error('dist/ not found — run `npm run build` first.')
    process.exit(1)
  }

  zipDir('dist', out)
  console.log(`Packaged ${out} — upload this to the Chrome Web Store.`)
}
