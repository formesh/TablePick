const { api } = require('./api')
const { load, confirm, perform, stop, toast } = require('./ui')
const stateText = { pending: '待确认', confirmed: '已确认', skipped: '这次不点' }

function decorate(room) {
  const members = room.members.map(member => ({
    ...member,
    stateText: stateText[member.state],
    itemsLabel: member.items.map(item => item.name + ' ' + item.count).join('、') ||
      (member.state === 'skipped' ? '这次不点' : '还未提交点单')
  }))
  return { ...room, members, memberPreview: members.slice(0, 3), percent: Math.round(room.confirmed / Math.max(room.memberCount, 1) * 100) }
}

function refreshRoom(page, quiet, ready) {
  const ticket = page.roomTicket = (page.roomTicket || 0) + 1
  return load(page, async () => {
    try {
      const room = await api('room', { roomId: page.roomId })
      if (ticket === page.roomTicket) ready(decorate(room))
    } catch (error) {
      if (error.code !== 'ROOM_UNAVAILABLE') throw error
      if (ticket === page.roomTicket) {
        stop(page)
        page.setData({ error: error.message, room: null })
      }
    }
  }, quiet === true)
}

async function changeRoom(page, action, input = {}) {
  const room = await api(action, { ...input, roomId: page.roomId })
  page.roomTicket = (page.roomTicket || 0) + 1
  return decorate(room)
}

function showResult(room) {
  const redirect = () => wx.redirectTo({ url: '/pages/result/index?id=' + encodeURIComponent(room.id) })
  const stack = getCurrentPages()
  const prior = stack[stack.length - 2]
  if (prior && prior.route === 'pages/room/index' && prior.roomId === room.id) {
    wx.navigateBack({ delta: 1, fail: redirect })
  } else redirect()
}
async function deleteRoom() {
  if (!this.data.room?.isHost || this.data.saving) return
  const button = { confirmText: '删除饭局', confirmColor: '#A43E4A' }
  if (!await confirm('删除饭局？', '删除后，所有成员将无法查看该饭局，邀请和清单链接也会失效。', button)) return
  return perform(this, async () => {
    await api('deleteRoom', { roomId: this.roomId })
    stop(this)
    wx.switchTab({ url: '/pages/home/index' })
    toast('饭局已删除')
  })
}
module.exports = { refreshRoom, changeRoom, showResult, deleteRoom }
