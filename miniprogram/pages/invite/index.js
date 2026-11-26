const { api } = require('../../utils/api')
const { invitePath, dateLabel, load } = require('../../utils/ui')
Page({
  data: { room: null },
  onLoad(options) { this.roomId = options.id; this.refresh() },
  refresh() {
    return load(this, async () => {
      const room = await api('room', { roomId: this.roomId })
      this.setData({ room, deadline: dateLabel(room.deadline) + ' 截止' })
    })
  },
  enter() {
    const { room } = this.data
    const stack = getCurrentPages()
    const prior = stack[stack.length - 2]
    if (prior && ['pages/room/index', 'pages/progress/index'].includes(prior.route) && prior.roomId === room.id) {
      return wx.navigateBack()
    }
    wx.redirectTo({ url: '/pages/' + (room.closedAt ? 'result' : 'room') + '/index?id=' + encodeURIComponent(room.id) })
  },
  onShareAppMessage() {
    const room = this.data.room
    return { title: room ? room.host + '邀请你一起点菜 · ' + room.name : 'TablePick', path: invitePath(room) }
  }
})
