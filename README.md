# electerm-x11

A JavaScript X11 display with a browser viewer. Run it as a standalone companion, or embed the same viewer in an SSH client. The Node runtime supports 16.0.0 and later. The X11 engine ships inside a self-contained HTML asset and runs in the viewer.

## Standalone display

After installing the npm package, run:

```sh
electerm-x11 --display 0
```

Open the full **Viewer** URL printed in the terminal. Set the printed `DISPLAY` and `XAUTHORITY` environment variables in the shell that starts your X client. On a Unix system, for example:

```sh
export DISPLAY=127.0.0.1:0
export XAUTHORITY=/path/printed/by/electerm-x11/Xauthority
xeyes -fg red -bg white
```

For OpenSSH forwarding, set the variables on the local machine before running `ssh -X user@host`. The SSH server must allow X11 forwarding and have the necessary X authority tooling. The companion binds IPv4 loopback only. Choose another display number if TCP port 6000 is occupied. Keep the viewer URL and authority file private. Ctrl+C stops the display.

## Embed in an SSH client

Create one display per SSH session when the user enables the feature. Supply its cookie to the SSH library and hand incoming X11 channels to the display:

```js
const { X11Display } = require('electerm-x11')
const display = new X11Display()
const shellOptions = { x11: { cookie: display.cookie } }
ssh.on('x11', (_info, accept, reject) => display.accept(accept, reject))
display.onClient(id => notifySessionViewer(id))
```

`ssh` is an ssh2-compatible client. Pass `shellOptions` when requesting its shell. Implement `notifySessionViewer` using the host application's authenticated session transport. Each ID selects one verified channel. When its browser WebSocket connects, verify session ownership and origin, then call `display.attach(id, ws)`. Close the WebSocket if it returns false. Call `display.onClient(null)` to detach the notification callback and `display.close()` when the SSH session ends.

Serve or copy the file at `require.resolve('electerm-x11/viewer.html')` as an independent static asset. Open it in an iframe with `sandbox="allow-scripts"` on the first client notification. Once the iframe has loaded, call the browser helper once per channel:

```js
import { connectViewer } from 'electerm-x11/connect.mjs'
const socket = connectViewer(iframe, authenticatedChannelUrl)
```

The host owns WebSocket authentication. The sandboxed frame receives a MessagePort and X11 traffic. Multiple X clients in one session share the frame. For mobile builds that inline dynamic imports, copy the HTML as a file and set the iframe URL on demand. Desktop Electron, hosted web and mobile integrations belong to their respective host apps.

## Compatibility

The experimental viewer uses a 1024 × 768 canvas and supports little-endian X11 clients. The upstream engine implements a subset of X extensions. Xlib drawing and keyboard/pointer events have been exercised in Chromium. Some applications require explicit colors or additional extensions. Electron 22, iOS, Android and HarmonyOS device compatibility still needs testing.

## Development and releases

Use Node 24 to build and test:

```sh
npm ci
npm test
npm pack
```

Packing builds the viewer and includes its third-party licenses. Consumers install the prebuilt asset.

The maintainer publishes version 0.1.0 manually with `npm publish --access public`. On npm, configure a GitHub Actions trusted publisher for organization **electerm**, repository **electerm-x11**, workflow **npm-publish.yml**. After the first release, a new package version pushed to `main` is tested, packed, checked on Node 16, and published with provenance. The workflow also supports manual dispatch.
