const { api } = require('../../utils/api')
const { roomDeadlineLabel, dateParts, navTop, go, onTab, load, poll, stop } = require('../../utils/ui')

function card(room) {
  return {
    ...room, ...dateParts(room.closedAt || room.deadline),
    percent: room.memberCount ? Math.round(room.confirmed / room.memberCount * 100) : 0,
    deadlineLabel: roomDeadlineLabel(room),
    stage: room.confirmed === room.memberCount ? '全部已确认' : '正在确认'
  }
}
Page({
  data: { selected: 0, rooms: [], cards: [], hosted: 0, unread: 0, date: '', companions: [], top: 48 },
  onLoad() { this.setData({ top: navTop() }) },
  onShow() { onTab(this, 0); this.refresh(); poll(this, 15000) },
  onHide() { stop(this) },
  onUnload() { stop(this) },
  async onPullDownRefresh() { try { await this.refresh() } finally { wx.stopPullDownRefresh() } },
  refresh(quiet) {
    return load(this, async () => {
      const { rooms, unread, companions } = await api('dashboard')
      const now = new Date()
      const weekday = '日一二三四五六'[now.getDay()]
      const date = '周' + weekday + ' · ' + (now.getMonth() + 1) + '月' + now.getDate() + '日'
      this.setData({ date, rooms, unread, companions: companions.map((name, key) => ({ key, glyph: Array.from(name).slice(-1)[0] })),
        hosted: rooms.filter(room => room.isHost).length })
      this.filter(this.data.selected)
    }, quiet === true)
  },
  filter(selected) {
    const cards = this.data.rooms.filter(room => selected === (room.isHost ? 0 : 1)).map(card)
    this.setData({ selected, cards })
  },
  switchMode(event) { this.filter(Number(event.currentTarget.dataset.index)) },
  create() { go('create') },
  messages() { go('messages') },
  openRoom(event) {
    const room = this.data.cards.find(item => item.id === event.currentTarget.dataset.id)
    if (room) go(room.closedAt ? 'result' : 'room', room.id)
  }
})
