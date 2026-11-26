'use strict'

// Invoked explicitly against a tarball installed by a clean Node 16 consumer.
const { createRequire } = require('module')
const path = require('path')
const fs = require('fs')
const assert = require('assert')
const { execFileSync } = require('child_process')

if (process.argv[2]) {
  const req = createRequire(path.resolve(process.argv[2], 'package.json'))
  const { X11Display } = req('electerm-x11')
  const display = new X11Display()
  assert.match(display.cookie, /^[0-9a-f]{32}$/)
  display.close()
  const viewer = req.resolve('electerm-x11/viewer.html')
  assert.ok(fs.readFileSync(viewer, 'utf8').includes('<canvas'))
  assert.ok(fs.existsSync(req.resolve('electerm-x11/connect.mjs')))
  const cli = path.resolve(path.dirname(viewer), '../bin/electerm-x11.cjs')
  assert.match(execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }), /--display/)
}
