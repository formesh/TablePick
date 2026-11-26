const { api } = require('../../utils/api')
const { dateLabel, load, perform, back } = require('../../utils/ui')
Page({
  data: { nickname: '' },
  onLoad(options) {
    this.roomId = options.id
    this.token = options.token
    this.refresh()
  },
  refresh() {
    return load(this, async () => {
      const room = await api('invitation', { roomId: this.roomId, token: this.token })
      this.setData({ room, nickname: room.nickname, deadline: dateLabel(room.deadline) + ' 截止' })
    })
  },
  inputName(event) { this.setData({ nickname: event.detail.value }) },
  home: back,
  enter() {
    return perform(this, async () => {
      const room = this.data.room.isMember ? this.data.room : await api('join', {
        roomId: this.roomId, token: this.token, nickname: this.data.nickname
      })
      wx.redirectTo({ url: '/pages/' + (room.closedAt ? 'result' : 'room') + '/index?id=' + encodeURIComponent(room.id) })
    })
  },
  onShareAppMessage() {
    return { title: (this.data.room ? this.data.room.host : '好友') + '邀请你一起点菜',
      path: '/pages/join/index?id=' + encodeURIComponent(this.roomId || '') + '&token=' + encodeURIComponent(this.token || '') }
  }
})
