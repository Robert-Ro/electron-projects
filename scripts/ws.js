const WebSocket = require('ws')

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ port: 18080 })

// 保存连接的客户端
/**
 * @type {Set<WebSocket.WebSocket>}
 */
const clients = new Set()

// 监听连接事件
wss.on('connection', (ws, req) => {
  // 将新连接的客户端添加到集合中
  clients.add(ws)
  // console.log(req.socket.remoteAddress) // IPv6 地址 ::1 是一个特殊的地址，它表示 IPv6 环回地址（Loopback Address）。类似于 IPv4 中的 127.0.0.1 地址，IPv6 中的 ::1 地址用于在本地主机内部进行网络通信。
  //https://github.com/faeldt/base64id/blob/master/lib/base64id.js
  // 监听消息事件
  ws.on('message', (message) => {
    // console.log(`客户端数量: ${clients.size}`)
    clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString())
      }
    })
  })

  // 监听关闭事件
  ws.on('close', () => {
    // 从集合中移除关闭的客户端
    clients.delete(ws)
  })
})
