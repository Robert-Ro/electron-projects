function capture() {
  navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: {
        width: { min: 1024, ideal: 1280, max: 1920 },
        height: { min: 576, ideal: 720, max: 1080 },
        frameRate: { max: 30 },
      },
    })
    .then((stream) => {
      const localVideo = document.getElementById('local')
      localVideo.srcObject = stream
      localVideo.onloadedmetadata = function () {
        localVideo.play()
      }
    })
}
function noop() {}
let msgWrapEl

const messages = new Set()
/**
 * @type {RTCPeerConnection}
 */
let pc
let textChannel

const ws = new WebSocket('ws://localhost:18080')
ws.addEventListener('close', () => {
  console.log('ws close')
})
ws.addEventListener('open', () => {
  console.log('ws open')
  ws.send(JSON.stringify({ type: 'ready' }))
  if (!msgWrapEl) msgWrapEl = document.getElementById('items')

  createConnection()
})
ws.addEventListener('message', (e) => {
  const data = JSON.parse(e.data)
  console.log({ type: data.type })
  switch (data.type) {
    case 'offer':
      handleOffer(data)
      break
    case 'answer':
      handleAnswer(data)
      break
    case 'candidate':
      handleCandidate(data)
      break
    case 'ready':
      // A second tab joined. This tab will enable the start button unless in a call already.
      if (pc) console.log('already in call, ignoring')

      break
    case 'bye':
      if (pc) hangup()

      break
    default:
      console.log('unhandled', e)
      break
  }
})
async function sendOffer() {
  // 创建offer
  const offer = await pc.createOffer()
  ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }))
  // 更新本地localDescription
  await pc.setLocalDescription(offer)
}

async function createConnection() {
  // 建立连接
  await createPeerConnection()
  // 建立数据通道
  textChannel = pc.createDataChannel('textChannel')
  textChannel.onopen = onChannelStateChange
  textChannel.onmessage = onChannelMessage
  textChannel.onclose = onChannelStateChange
  // 创建offer
  sendOffer()
}

async function closeRTC() {
  await hangup()
  ws.close()
}

/**
 * 挂断
 */
async function hangup() {
  if (pc) {
    pc.close()
    pc = null
  }
  textChannel = null
  console.log('Closed peer connections')
}
const receivedChannels = []
/**
 * 建立连接
 */
function createPeerConnection() {
  pc = new RTCPeerConnection()
  console.count('pc')
  pc.onicecandidate = (e) => {
    const message = {
      type: 'candidate',
      candidate: null,
    }
    if (e.candidate) {
      message.candidate = e.candidate.candidate
      message.sdpMid = e.candidate.sdpMid
      message.sdpMLineIndex = e.candidate.sdpMLineIndex
      message.usernameFragment = e.candidate.usernameFragment
    }
    ws.send(JSON.stringify(message))
  }
  pc.oniceconnectionstatechange = () => {
    console.log('ICE connection state:', pc.iceConnectionState)
  }
  pc.ondatachannel = (e) => {
    const channel = e.channel
    receivedChannels.push(channel)
    channel.onmessage = (e) => {
      console.log('收到消息：', e.data)
    }
    channel.onopen = () => {
      console.log('channel onopen')
    }
  }
  //   pc.onconnectionstatechange = (e) => {
  //     console.log(e)
  //   }
  //   pc.onicecandidate = (e) => {
  //     console.log(e)
  //   }
  //   pc.onicecandidateerror = (e) => {
  //     console.log(e)
  //   }
  //   pc.onicegatheringstatechange = (e) => {
  //     console.log(e)
  //   }
  //   pc.onnegotiationneeded = (e) => {
  //     console.log(e)
  //   }
  //   pc.onsignalingstatechange = (e) => {
  //     console.log(e)
  //   }
}
/**
 * 处理offer
 * @param {*} offer
 * @returns
 */
async function handleOffer(offer) {
  await pc.setRemoteDescription(offer)
  const answer = await pc.createAnswer()
  ws.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }))
  await pc.setLocalDescription(answer)
}
/**
 * 处理答复
 * @param {*} answer
 * @returns
 */
async function handleAnswer(answer) {
  if (!pc) {
    console.error('no peerconnection')
    return
  }
  await pc.setRemoteDescription(answer)
}
/**
 * 处理候选者
 * @param {*} candidate
 * @returns
 */
async function handleCandidate(candidate) {
  //   console.log(candidate)
  if (!candidate.candidate) await pc.addIceCandidate(null)
  else await pc.addIceCandidate(candidate)
}
/**
 * 发送数据
 */
function sendMsg() {
  const data = document.getElementById('input').value
  if (textChannel) textChannel.send(data)
  console.log(`Sent Data: ${data}`)
}

/**
 * 发送通道信息回调
 * @param {*} event
 */
function onChannelMessage(event) {
  console.log('Received Message', event.data)
  messages.add(event.data)

  messages.forEach((msg) => {
    const el = document.createElement('li')
    el.innerText = msg
    msgWrapEl.appendChild(el)
  })
}
/**
 * 发送通道信息状态变化
 * @param {*} event
 */
function onChannelStateChange() {
  const readyState = textChannel.readyState
  console.log(`Send channel state is: ${readyState}`)
}
