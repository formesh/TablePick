const { api } = require('../../utils/api')
const { load, go, day, clock, dateParts, perform, toast } = require('../../utils/ui')

const reminderTypes = [
  { id: 'confirmed', label: '有人点好时提醒' },
  { id: 'all', label: '全部确认后提醒' }
]
const iconOf = type => ({
  confirmed: 'check-circle', edited: 'edit', all: 'users', closed: 'lock', availability: 'info'
}[type] || 'bell')

function groupMessages(messages) {
  const groups = new Map()
  const today = day(Date.now())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  for (const item of messages) {
    const date = day(item.at)
    const parts = dateParts(item.at)
    const title = date === today ? '今天' : date === day(yesterday) ? '昨天' : parts.month + parts.dayNumber + '日'
    if (!groups.has(date)) groups.set(date, { date, title, rows: [] })
    groups.get(date).rows.push({ ...item, icon: iconOf(item.type), time: clock(item.at) })
  }
  return [...groups.values()]
}

Page({
  data: { groups: [], reminders: {}, reminderTypes, showSettings: false, rooms: [], templateId: '' },
  onShow() { this.refresh() },
  async onPullDownRefresh() { try { await this.refresh() } finally { wx.stopPullDownRefresh() } },
  refresh() {
    return load(this, async () => {
      const data = await api('messages')
      this.setData({
        groups: groupMessages(data.messages), unread: data.messages.some(item => item.unread),
        reminders: data.reminders, rooms: data.rooms || [], templateId: data.templateId || ''
      })
    })
  },
  read() {
    return perform(this, async () => { await api('readMessages'); await this.refresh() })
  },
  settings() { this.setData({ showSettings: !this.data.showSettings }) },
  toggle(event) {
    const id = event.currentTarget.dataset.id
    return perform(this, async () => {
      const profile = await api('setProfile', { reminders: { [id]: !this.data.reminders[id] } })
      this.setData({ reminders: profile.reminders })
      await this.refresh()
    })
  },
  open(event) { go('room', event.currentTarget.dataset.id) },
  subscribe(event) {
    if (this.data.saving) return
    const { id, type } = event.currentTarget.dataset
    const { templateId } = this.data
    if (!templateId || !wx.requestSubscribeMessage) { toast('当前微信版本不支持订阅'); return }
    return perform(this, async () => {
      const result = await new Promise((resolve, reject) => wx.requestSubscribeMessage({
        tmplIds: [templateId], success: resolve, fail: () => reject(new Error('无法打开微信订阅窗口'))
      }))
      if (result[templateId] !== 'accept') { toast('未开启微信订阅'); return }
      await api('subscribe', { roomId: id, type })
      toast('本场微信提醒已订阅')
      await this.refresh()
    })
  }
})
