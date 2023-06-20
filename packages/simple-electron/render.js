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

/**
 * @type {RTCPeerConnection}
 */
let pc
let sendChannel
let receiveChannel

const ws = new WebSocket('ws://localhost:18080')
ws.addEventListener('close', () => {
  console.log('ws close')
})
ws.addEventListener('open', () => {
  console.log('ws open')
  ws.send(JSON.stringify({ type: 'ready' }))
  createConnection()
})
ws.addEventListener('message', (e) => {
  const data = JSON.parse(e.data)
  console.log(data.type)
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
async function createConnection() {
  // 建立连接
  await createPeerConnection()
  // 建立数据通道
  sendChannel = pc.createDataChannel('sendDataChannel')
  sendChannel.onopen = onSendChannelStateChange
  sendChannel.onmessage = onSendChannelMessageCallback
  sendChannel.onclose = onSendChannelStateChange
  // 创建offer
  const offer = await pc.createOffer()
  ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }))
  // 更新本地localDescription
  await pc.setLocalDescription(offer)
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
  sendChannel = null
  receiveChannel = null
  console.log('Closed peer connections')
}
/**
 * 建立连接
 */
function createPeerConnection() {
  pc = new RTCPeerConnection()
  pc.onicecandidate = (e) => {
    const message = {
      type: 'candidate',
      candidate: null,
    }
    if (e.candidate) {
      console.log(e.candidate, 'candidateString')
      message.candidate = e.candidate.candidate
      message.sdpMid = e.candidate.sdpMid
      message.sdpMLineIndex = e.candidate.sdpMLineIndex
    }
    ws.send(JSON.stringify(message))
  }
}
/**
 * 处理offer
 * @param {*} offer
 * @returns
 */
async function handleOffer(offer) {
  if (pc) {
    console.error('existing peerconnection')
    return
  }
  await createPeerConnection()
  pc.ondatachannel = receiveChannelCallback
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
  if (!pc) {
    console.error('no peerconnection')
    return
  }
  if (!candidate.candidate) await pc.addIceCandidate(null)
  else await pc.addIceCandidate(candidate)
}
/**
 * 发送数据
 */
function sendMsg() {
  const data = document.getElementById('input').value
  if (sendChannel) sendChannel.send(data)
  else receiveChannel.send(data)

  console.log(`Sent Data: ${data}`)
}
/**
 * 接收通道信息
 * @param {*} event
 */
function receiveChannelCallback(event) {
  console.log('Receive Channel Callback')
  receiveChannel = event.channel
  receiveChannel.onmessage = onReceiveChannelMessageCallback
  receiveChannel.onopen = onReceiveChannelStateChange
  receiveChannel.onclose = onReceiveChannelStateChange
}
/**
 * 接收通道信息回调
 * @param {*} event
 */
function onReceiveChannelMessageCallback(event) {
  console.log('Received Message', event.data)
}
/**
 * 发送通道信息回调
 * @param {*} event
 */
function onSendChannelMessageCallback(event) {
  console.log('Received Message', event.data)
}
/**
 * 发送通道信息状态变化
 * @param {*} event
 */
function onSendChannelStateChange() {
  const readyState = sendChannel.readyState
  console.log(`Send channel state is: ${readyState}`)
}
/**
 * 接收通道信息状态变化
 * @param {*} event
 */
function onReceiveChannelStateChange() {
  const readyState = receiveChannel.readyState
  console.log(`Receive channel state is: ${readyState}`)
}
