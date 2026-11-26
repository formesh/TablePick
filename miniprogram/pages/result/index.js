const { api } = require('../../utils/api')
const { dateLabel, load, toast } = require('../../utils/ui')
Page({
  data: { room: null },
  onLoad(options) {
    this.roomId = options.id
    this.token = options.token
    if (wx.hideShareMenu) wx.hideShareMenu({ menus: ['shareAppMessage'] })
    this.refresh()
  },
  async onPullDownRefresh() { try { await this.refresh() } finally { wx.stopPullDownRefresh() } },
  refresh() {
    return load(this, async () => {
      const room = await api('result', { roomId: this.roomId, token: this.token })
      this.setData({ room, closed: dateLabel(room.closedAt) })
      if (room.resultToken && wx.showShareMenu) wx.showShareMenu({ menus: ['shareAppMessage'] })
    })
  },
  copy() {
    const room = this.data.room
    const lines = [room.name + '｜最终清单', room.totals.dishes.length + ' 道菜 · ' + room.totals.total + ' 份']
    for (const dish of room.totals.dishes) {
      lines.push(dish.name + ' ' + dish.count + ' 份')
      for (const choice of dish.options) lines.push('  · ' + choice.option + ' ' + choice.count + ' 份')
    }
    wx.setClipboardData({ data: lines.join('\n'), fail: () => toast('暂时无法复制，请重试') })
  },
  onShareAppMessage() {
    const room = this.data.room
    if (!room || !room.resultToken) return { title: 'TablePick', path: '/pages/home/index' }
    return { title: room.name + ' · 最终清单',
      path: '/pages/result/index?id=' + encodeURIComponent(room.id) + '&token=' + encodeURIComponent(room.resultToken) }
  }
})
