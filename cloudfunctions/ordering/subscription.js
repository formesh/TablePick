const id = process.env.WECHAT_ORDER_TEMPLATE_ID
const roomField = process.env.WECHAT_ORDER_ROOM_FIELD
const statusField = process.env.WECHAT_ORDER_STATUS_FIELD
const state = process.env.WECHAT_ORDER_MINIPROGRAM_STATE
const thing = /^thing[0-9]+$/
const subscription = id && thing.test(roomField) && thing.test(statusField) && roomField !== statusField ?
  { id, roomField, statusField, state: ['developer', 'trial', 'formal'].includes(state) ? state : 'formal' } : null

async function deliver(cloud, deliveries) {
  const results = await Promise.allSettled(deliveries.map(async message => {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: message.to, templateId: subscription.id, miniprogramState: subscription.state,
      page: 'pages/room/index?id=' + encodeURIComponent(message.roomId),
      data: {
        [subscription.roomField]: { value: Array.from(message.roomName).slice(0, 20).join('') },
        [subscription.statusField]: { value: Array.from(message.title).slice(0, 20).join('') }
      }
    })
    if (result && Number(result.errCode)) throw new Error('WeChat rejected notification: ' + result.errCode)
  }))
  for (const result of results) {
    if (result.status === 'rejected') {
      const error = result.reason
      console.warn('WeChat subscription delivery failed', error.errCode || error.message)
    }
  }
}

module.exports = { subscription, deliver }
