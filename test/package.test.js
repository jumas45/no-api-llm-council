import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipDir } from '../scripts/package.mjs'

// The Chrome Web Store / Chrome resolve extension files by the forward-slash
// paths in manifest.json. A zip whose entries use back-slash separators (what
// PowerShell's Compress-Archive emits) can leave those references unresolved,
// so the packaged zip must always use forward slashes with manifest.json at the
// archive root.
describe('zipDir', () => {
  let dir
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('writes forward-slash entry paths with manifest.json at the archive root', () => {
    dir = mkdtempSync(join(tmpdir(), 'pkgtest-'))
    const src = join(dir, 'dist')
    mkdirSync(join(src, 'assets'), { recursive: true })
    writeFileSync(join(src, 'manifest.json'), '{}')
    writeFileSync(join(src, 'assets', 'app.js'), 'x')
    const out = join(dir, 'out.zip')

    zipDir(src, out)

    // Entry names are stored verbatim in the zip; scan the raw bytes.
    const bytes = readFileSync(out).toString('latin1')
    expect(bytes).toContain('manifest.json')
    expect(bytes).toContain('assets/app.js')
    expect(bytes).not.toContain('assets\\app.js')
  })
})
