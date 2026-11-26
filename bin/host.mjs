import { connectViewer } from './connect.mjs'

const token = location.hash.slice(1)
const frame = document.querySelector('iframe')
const status = document.querySelector('#status')
const endpoint = 'ws://' + location.host
frame.addEventListener('load', () => {
  if (!/^[a-f0-9]{64}$/.test(token)) {
    status.textContent = 'Open the viewer URL printed by electerm-x11.'
    return
  }
  const control = new WebSocket(endpoint + '/control', token)
  control.onopen = () => { status.hidden = true }
  control.onmessage = ({ data: id }) => {
    if (/^[a-f0-9]{32}$/.test(id)) connectViewer(frame, endpoint + '/client/' + id, token)
  }
  control.onclose = () => {
    status.hidden = false
    status.textContent = 'Viewer disconnected. Close any other viewer and reload.'
  }
}, { once: true })
frame.src = '/viewer.html'
