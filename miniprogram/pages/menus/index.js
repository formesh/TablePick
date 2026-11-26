const { api } = require('../../utils/api')
const { go, onTab, load, dateParts } = require('../../utils/ui')
Page({
  data: { menus: [] },
  onShow() { onTab(this, 1); this.refresh() },
  async onPullDownRefresh() { try { await this.refresh() } finally { wx.stopPullDownRefresh() } },
  refresh() {
    return load(this, async () => {
      const menus = await api('menus')
      this.setData({ menus: menus.map(menu => {
        const recent = menu.recent
        const date = recent ? dateParts(recent.at) : null
        return { ...menu, detail: recent ? date.month + date.dayNumber + '日 · ' + recent.name : '' }
      }) })
    })
  },
  newMenu() { go('menu-edit') },
  edit(event) { go('menu-edit', event.currentTarget.dataset.id) },
  create(event) { go('create', event.currentTarget.dataset.id) }
})
