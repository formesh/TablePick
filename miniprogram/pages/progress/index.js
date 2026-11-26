const { countdown, confirm, go, perform, poll, stop, toast } = require('../../utils/ui')
const { refreshRoom, changeRoom, showResult } = require('../../utils/room')

Page({
  data: { room: null, management: false, stock: false },
  onLoad(options) { this.roomId = options.id },
  onShow() { this.visible = true; this.refresh(); poll(this) },
  onHide() { this.visible = false; stop(this) },
  onUnload() { this.visible = false; stop(this) },
  async onPullDownRefresh() { try { await this.refresh() } finally { wx.stopPullDownRefresh() } },
  refresh(quiet) { return refreshRoom(this, quiet, room => this.updateRoom(room)) },
  updateRoom(room) {
    if (room.closedAt && this.visible) {
      this.visible = false
      stop(this)
      return showResult(room)
    }
    const totals = room.totals.dishes.map(dish => ({
      ...dish, detail: dish.options.map(option => option.option + ' ' + option.count + ' 份 · ' +
        option.people.map(person => person.name).join('、')).join('；')
    }))
    this.setData({ room, totals, countdown: countdown(room.deadline) })
  },
  async close() {
    const room = this.data.room
    const waiting = room.memberCount - room.confirmed
    const content = waiting ? '还有 ' + waiting + ' 人未确认。收单后，最终清单将仅包含已确认的点单。' : '收单后将生成最终清单，成员无法再改动点单。'
    if (!await confirm('现在收单？', content)) return
    return perform(this, async () => this.updateRoom(await changeRoom(this, 'close')))
  },
  manage() { this.setData({ management: !this.data.management }) },
  showStock() { this.setData({ stock: !this.data.stock }) },
  invite() { go('invite', this.roomId) },
  toggleInvite(event) {
    const accepting = event.detail.value
    return perform(this, async () => {
      try { this.updateRoom(await changeRoom(this, 'setInvites', { accepting })) }
      catch (error) {
        this.setData({ 'room.accepting': accepting })
        this.setData({ 'room.accepting': !accepting })
        throw error
      }
    })
  },
  async stockChange(event) {
    const dishId = event.currentTarget.dataset.id
    const dish = this.data.room.dishes.find(item => item.id === dishId)
    if (!dish) return
    if (!dish.soldOut && !await confirm('标记为售罄？', '相关成员会收到站内提醒，受影响的点单将回到待确认。')) return
    return perform(this, async () => {
      this.updateRoom(await changeRoom(this, 'availability', { dishId, soldOut: !dish.soldOut }))
      toast(dish.soldOut ? '已恢复供应' : '已标记售罄')
    })
  }
})
