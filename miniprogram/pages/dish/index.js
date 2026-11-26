const { api } = require('../../utils/api')
const { load } = require('../../utils/ui')
const { refreshDishPhotos } = require('../../utils/dish-photos')

Page({
  data: { room: null, dish: null, photoUrls: {} },
  onLoad({ id, dishId }) {
    this.roomId = id
    this.dishId = dishId
  },
  onShow() { this.refresh() },
  async onPullDownRefresh() {
    try { await this.refresh() } finally { wx.stopPullDownRefresh() }
  },
  refresh() {
    return load(this, async () => {
      if (!this.roomId || !this.dishId) throw new Error('菜品链接不完整，请从点菜页进入')
      const room = await api('room', { roomId: this.roomId })
      const dish = room.dishes.find(item => item.id === this.dishId)
      if (!dish) throw new Error('这道菜不在本场供应清单里')
      const status = room.closedAt ? '已收单' : dish.soldOut ? '已售罄' : '本场供应'
      const methods = dish.options.length ? dish.options : ['默认做法']
      this.setData({ room: { id: room.id, name: room.name, closedAt: room.closedAt }, dish, status, methods })
      refreshDishPhotos(this, 'room', room.id, [dish])
    })
  },
  returnToRoom() {
    const stack = getCurrentPages()
    const prior = stack[stack.length - 2]
    if (prior && prior.route === 'pages/room/index' && prior.roomId === this.roomId) return wx.navigateBack()
    const page = this.data.room.closedAt ? 'result' : 'room'
    wx.redirectTo({ url: '/pages/' + page + '/index?id=' + encodeURIComponent(this.roomId) })
  }
})
