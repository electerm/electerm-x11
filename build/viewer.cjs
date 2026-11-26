const fs = require('fs')
const path = require('path')
const { buildSync } = require('esbuild')

const root = path.resolve(__dirname, '..')
const licenses = ['x11', 'events', 'buffer', 'ieee754', 'base64-js'].map(name => {
  const from = path.dirname(require.resolve('buffer/'))
  return fs.readFileSync(require.resolve(name + '/LICENSE', { paths: [from, root] }), 'utf8')
})
const result = buildSync({
  entryPoints: [path.join(root, 'src/viewer.cjs')],
  write: false,
  platform: 'browser',
  bundle: true,
  minify: true,
  target: 'es2020',
  alias: { events: require.resolve('events/'), buffer: require.resolve('buffer/') },
  external: ['net', 'fs'], // native listeners and file descriptors are unused in the viewer
  banner: { js: '/*!\n' + licenses.join('\n') + '\n*/' }
})
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<title>Electerm X11 display</title>
<style>html,body{margin:0;height:100%;background:black}canvas{display:block;width:100%;height:100%}</style>
<canvas aria-label="X11 display"></canvas><script>${script}</script>`
fs.mkdirSync(path.join(root, 'dist'), { recursive: true })
fs.writeFileSync(path.join(root, 'dist/viewer.html'), html)
