const { test } = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('events')
const { Duplex, PassThrough } = require('stream')
const WebSocket = require('ws')
const { X11Display } = require('../src/display.cjs')

// SSH channels are duplex streams with independent incoming/outgoing data.
function channel () {
  const inbound = new PassThrough()
  const outbound = new PassThrough()
  return { stream: Duplex.from({ readable: inbound, writable: outbound }), inbound, outbound }
}

function setup (cookie) {
  const packet = Buffer.alloc(48)
  packet[0] = 108
  packet.writeUInt16LE(11, 2)
  packet.writeUInt16LE(18, 6)
  packet.writeUInt16LE(16, 8)
  packet.write('MIT-MAGIC-COOKIE-1', 12)
  Buffer.from(cookie, 'hex').copy(packet, 32)
  return packet
}

test('built-in X11 authenticates fragmented setup and preserves pipelined bytes', async t => {
  const display = new X11Display()
  t.after(() => display.close())
  const { stream, inbound, outbound } = channel()
  display.accept(() => stream, assert.fail)
  const request = Buffer.from([43, 0, 1, 0])
  const packet = setup(display.cookie)
  inbound.write(packet.subarray(0, 13))
  inbound.write(Buffer.concat([packet.subarray(13), request]))
  // A remote startup command may run before the terminal websocket opens.
  await new Promise(resolve => setImmediate(resolve))
  let id
  display.onClient(clientId => { id = clientId })
  assert.ok(id)
  assert.equal(display.attach('unknown', {}), false)
  const server = new WebSocket.Server({ host: '127.0.0.1', port: 0 })
  t.after(() => server.close())
  await once(server, 'listening')
  server.on('connection', ws => {
    assert.ok(display.attach(id, ws))
    assert.equal(display.attach(id, ws), false)
  })
  const ws = new WebSocket('ws://127.0.0.1:' + server.address().port)
  t.after(() => ws.terminate())
  const frames = []
  await new Promise((resolve, reject) => {
    ws.on('error', reject)
    ws.on('message', frame => {
      frames.push(frame)
      if (Buffer.concat(frames).length >= 16) resolve()
    })
  })
  assert.deepEqual(Buffer.concat(frames), Buffer.concat([setup(display.cookie).subarray(0, 6), Buffer.alloc(6), request]))
  const response = once(outbound, 'data')
  ws.send(Buffer.from([1, 2, 3]))
  assert.deepEqual((await response)[0], Buffer.from([1, 2, 3]))
})

test('a cookie from another display cannot open a viewer', async () => {
  const display = new X11Display()
  const other = new X11Display()
  const { stream, inbound } = channel()
  display.onClient(assert.fail)
  display.accept(() => stream, assert.fail)
  const closed = new Promise(resolve => stream.once('close', resolve))
  inbound.write(setup(other.cookie))
  await closed
  assert.equal(display.clients.size, 0)
  other.close()
  display.close()
})
