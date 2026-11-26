# electerm-x11

[English](./README.md) | **简体中文**

electerm-x11 是用 JavaScript 实现的 X11 显示服务器，在浏览器中显示 X11 应用窗口。你可以独立运行它，也可以将同一个查看器嵌入 SSH 客户端。服务端支持 Node.js 16.0.0 及以上版本。X11 引擎打包在一个独立的 HTML 文件中，由查看器加载并运行。

## 独立运行

安装 npm 包后，在终端中启动显示服务器：

```sh
electerm-x11 --display 0
```

在浏览器中打开终端输出的完整 **Viewer** 地址。在用于启动 X11 客户端的 shell 中，按输出结果设置 `DISPLAY` 和 `XAUTHORITY`。例如，在 Unix 系统上可以这样运行 `xeyes`（请替换为实际的授权文件路径）：

```sh
export DISPLAY=127.0.0.1:0
export XAUTHORITY=/path/printed/by/electerm-x11/Xauthority
xeyes -fg red -bg white
```

使用 OpenSSH 转发时，先在本机设置这两个环境变量，再运行 `ssh -X user@host`。远程 SSH 服务器需要启用 X11 转发，并安装相应的 X11 授权工具。electerm-x11 仅监听本机 IPv4 回环地址。如果 TCP 端口 6000 已被占用，请改用其他显示编号。查看器地址和授权文件均应保密。按 Ctrl+C 停止服务。

## 嵌入 SSH 客户端

用户启用 X11 转发时，为每个 SSH 会话创建一个独立的显示实例。将实例的认证 cookie 传给 SSH 库，并将收到的 X11 通道交给该实例：

```js
const { X11Display } = require('electerm-x11')
const display = new X11Display()
const shellOptions = { x11: { cookie: display.cookie } }
ssh.on('x11', (_info, accept, reject) => display.accept(accept, reject))
display.onClient(id => notifySessionViewer(id))
```

示例中的 `ssh` 是兼容 ssh2 的客户端。请求打开远程 shell 时传入 `shellOptions`。通过宿主应用已认证的会话连接实现 `notifySessionViewer`，把通道 ID 发给该会话的查看器。每个 ID 对应一个已通过认证的 X11 通道。浏览器建立 WebSocket 连接时，先核验会话归属和请求来源，再调用 `display.attach(id, ws)`。如果返回 `false`，请关闭该 WebSocket。调用 `display.onClient(null)` 可移除通知回调。SSH 会话结束时调用 `display.close()` 释放资源。

使用 `require.resolve('electerm-x11/viewer.html')` 找到查看器文件，将它作为独立静态资源提供。收到第一个客户端通知时，用带有 `sandbox="allow-scripts"` 的 iframe 打开该文件。等待 iframe 加载完成后，为每个通道调用一次浏览器端的连接函数：

```js
import { connectViewer } from 'electerm-x11/connect.mjs'
const socket = connectViewer(iframe, authenticatedChannelUrl)
```

宿主应用负责 WebSocket 认证，沙箱中的 iframe 通过 MessagePort 收发 X11 数据。同一会话中的多个 X11 客户端共用一个 iframe。如果移动端构建会内联动态导入，请将 HTML 作为独立文件复制到应用中，按需设置 iframe 的 URL。Electron 桌面端、Web 部署和各移动端分别在自己的宿主应用中接入。

## 兼容性

实验性查看器使用 1024 × 768 的画布，支持小端字节序的 X11 客户端。上游引擎实现了部分 X11 扩展。Xlib 绘图以及键盘、指针事件已在 Chromium 中验证。部分应用可能需要显式指定颜色，或依赖额外的 X11 扩展。Electron 22 以及 iOS、Android、HarmonyOS 真机兼容性仍有待验证。

## 开发与发布

使用 Node.js 24 构建和测试：

```sh
npm ci
npm test
npm pack
```

打包时会构建查看器，并附带第三方许可证。使用者安装 npm 包即可获得构建好的查看器。

维护者使用 `npm publish --access public` 手动发布首个版本 0.1.0。在 npm 上配置 GitHub Actions 可信发布者时，组织填写 **electerm**，仓库填写 **electerm-x11**，工作流文件名填写 **npm-publish.yml**。首次发布后，将新版本推送到 `main` 分支会触发测试、打包和 Node.js 16 兼容性检查，随后发布带有来源证明（provenance）的 npm 包。该工作流也支持手动触发。
