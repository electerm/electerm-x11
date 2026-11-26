/** Connect one authenticated X client to a loaded, sandboxed viewer iframe. */
export function connectViewer (frame, url, protocols) {
  const socket = new WebSocket(url, protocols)
  socket.binaryType = 'arraybuffer'
  const { port1, port2 } = new MessageChannel()
  frame.contentWindow.postMessage(null, '*', [port2])
  port1.onmessage = ({ data }) => {
    if (data.type === 'x11-end') socket.close()
    else if (data.type === 'x11-data' && socket.readyState === WebSocket.OPEN) socket.send(data.data)
  }
  socket.onmessage = ({ data }) => port1.postMessage({ type: 'x11-data', data }, [data])
  socket.addEventListener('close', () => {
    port1.postMessage({ type: 'x11-end' })
    port1.close()
  })
  return socket
}
