const { api } = require('./api')
const { load } = require('./ui')
const initials = name => name.length > 1 && name[0] === '小' ? name[1] : name[0]
const stateText = { pending: '待确认', confirmed: '已确认', skipped: '这次不点' }

function decorate(room) {
  const members = room.members.map((member, i) => ({
    ...member, avatar: initials(member.name), tone: ['', 'orange', 'purple'][i % 3],
    stateText: stateText[member.state],
    itemsLabel: member.items.map(item => item.name + ' ' + item.count).join('、') ||
      (member.state === 'skipped' ? '这次不点' : '还未提交点单')
  }))
  return { ...room, members, percent: Math.round(room.confirmed / Math.max(room.memberCount, 1) * 100) }
}

function refreshRoom(page, quiet, ready) {
  const ticket = page.roomTicket = (page.roomTicket || 0) + 1
  return load(page, async () => {
    const room = await api('room', { roomId: page.roomId })
    if (ticket === page.roomTicket) ready(decorate(room))
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
module.exports = { refreshRoom, changeRoom, showResult }
