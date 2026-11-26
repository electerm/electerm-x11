#!/usr/bin/env node
'use strict'

const fs = require('fs')
const http = require('http')
const net = require('net')
const os = require('os')
const path = require('path')
const { randomBytes } = require('crypto')
const { once } = require('events')
const { WebSocketServer } = require('ws')
const { X11Display } = require('../src/display.cjs')

function authorityRecord (number, cookie) {
  // FamilyWild allows Xlib to match the localhost TCP display on each OS.
  const fields = [Buffer.alloc(0), Buffer.from(String(number)),
    Buffer.from('MIT-MAGIC-COOKIE-1'), Buffer.from(cookie, 'hex')]
  const parts = [Buffer.from([255, 255])]
  for (const field of fields) {
    const length = Buffer.alloc(2)
    length.writeUInt16BE(field.length)
    parts.push(length, field)
  }
  return Buffer.concat(parts)
}

async function main () {
  const args = process.argv.slice(2)
  const usage = 'Usage: electerm-x11 [--display 0-99]'
  if (args.length === 1 && args[0] === '--help') return console.log(usage)
  if (args.length && (args.length !== 2 || args[0] !== '--display' || !/^\d{1,2}$/.test(args[1]))) {
    throw new Error(usage)
  }
  const number = Number(args[1] || 0)
  const root = path.join(__dirname, '..')
  const viewer = fs.readFileSync(path.join(root, 'dist/viewer.html'))
  const page = fs.readFileSync(path.join(__dirname, 'index.html'))
  const script = fs.readFileSync(path.join(__dirname, 'host.mjs'))
  const connector = fs.readFileSync(path.join(root, 'src/connect.mjs'))
  const files = new Map([
    ['/', ['text/html', page]],
    ['/viewer.html', ['text/html', viewer]],
    ['/host.mjs', ['text/javascript', script]],
    ['/connect.mjs', ['text/javascript', connector]]
  ])
  const display = new X11Display()
  const token = randomBytes(32).toString('hex')
  const host = '127.0.0.1'
  let origin
  let controller
  const web = http.createServer((req, res) => {
    const file = files.get(req.url)
    if (!file || req.method !== 'GET' || 'http://' + req.headers.host !== origin) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': file[0] + '; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': req.url === '/viewer.html' ? 'SAMEORIGIN' : 'DENY'
    })
    res.end(file[1])
  })
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 })
  web.on('upgrade', (req, socket, head) => {
    const control = req.url === '/control'
    const match = /^\/client\/([a-f0-9]{32})$/.exec(req.url)
    if ((!control && !match) || (control && controller) || req.headers.origin !== origin ||
        'http://' + req.headers.host !== origin || req.headers['sec-websocket-protocol'] !== token) {
      socket.destroy()
      return
    }
    sockets.handleUpgrade(req, socket, head, ws => {
      ws.on('error', () => ws.terminate())
      if (!control) {
        if (!display.attach(match[1], ws)) ws.close()
        return
      }
      controller = ws
      display.onClient(id => { if (ws.readyState === 1) ws.send(id) })
      ws.once('close', () => {
        controller = null
        display.onClient(null)
      })
    })
  })
  const x = net.createServer(socket => display.accept(() => socket, () => socket.destroy()))
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-x11-'))
  const auth = path.join(dir, 'Xauthority')
  process.once('exit', () => {
    if (fs.existsSync(auth)) fs.unlinkSync(auth)
    fs.rmdirSync(dir)
  })
  try {
    fs.writeFileSync(auth, authorityRecord(number, display.cookie), { mode: 0o600, flag: 'wx' })
    x.listen(6000 + number, host)
    await once(x, 'listening')
    web.listen(0, host)
    await once(web, 'listening')
    origin = 'http://' + host + ':' + web.address().port
    console.log('Viewer: ' + origin + '/#' + token)
    console.log('DISPLAY=' + host + ':' + number)
    console.log('XAUTHORITY=' + auth)
  } catch (err) {
    display.close()
    x.close()
    web.close()
    throw err
  }
  const stop = () => {
    display.close()
    for (const ws of sockets.clients) ws.terminate()
    web.close()
    x.close()
    process.exit(0)
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

main().catch(err => {
  console.error(err.message)
  process.exitCode = 1
})
