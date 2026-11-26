const { api } = require('../../utils/api')
const CATEGORIES = require('../../utils/categories')
const { day, clock, go, load, perform } = require('../../utils/ui')

Page({
  data: { name: '', menus: [], menuIndex: 0, groups: [], selectedIds: [], expanded: '', date: '', time: '', minDate: '', autoClose: true },
  onLoad(options) {
    this.initialMenu = options.id
    const now = Date.now()
    const suggested = new Date(now)
    suggested.setHours(20, 0, 0, 0)
    if (suggested.getTime() <= now + 30 * 60000) suggested.setDate(suggested.getDate() + 1)
    this.setData({ minDate: day(now), date: day(suggested), time: clock(suggested) })
  },
  onShow() { this.refresh() },
  refresh() {
    return load(this, async () => {
      const menus = await api('menus')
      const index = Math.max(0, menus.findIndex(menu => menu.id === (this.data.menu && this.data.menu.id || this.initialMenu)))
      const menu = menus[index]
      const label = menus.map(item => item.name + ' · ' + item.dishes.length + ' 道菜')
      const selected = menu && this.data.menu && menu.id === this.data.menu.id ?
        this.data.selectedIds.filter(id => menu.dishes.some(dish => dish.id === id)) :
        menu ? menu.dishes.map(dish => dish.id) : []
      this.setData({ menus, label, menuIndex: index, menu: menu || null })
      this.setSelection(selected)
    })
  },
  setSelection(selectedIds) {
    const groups = CATEGORIES.map(category => {
      const dishes = (this.data.menu ? this.data.menu.dishes : []).filter(dish => dish.category === category)
        .map(dish => ({ ...dish, selected: selectedIds.includes(dish.id) }))
      return { category, dishes, count: dishes.filter(dish => dish.selected).length }
    })
    this.setData({ groups, selectedIds })
  },
  menuChange(event) {
    const menuIndex = Number(event.detail.value)
    const menu = this.data.menus[menuIndex]
    this.setData({ menuIndex, menu, expanded: '' })
    this.setSelection(menu.dishes.map(dish => dish.id))
  },
  toggleGroup(event) {
    const category = event.currentTarget.dataset.category
    this.setData({ expanded: this.data.expanded === category ? '' : category })
  },
  toggleDish(event) {
    const id = event.currentTarget.dataset.id
    const selected = this.data.selectedIds
    this.setSelection(selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id])
  },
  toggleAll(event) {
    const group = this.data.groups.find(item => item.category === event.currentTarget.dataset.category)
    if (!group.dishes.length) return
    const ids = new Set(group.dishes.map(dish => dish.id))
    const selected = this.data.selectedIds.filter(id => !ids.has(id))
    this.setSelection(group.count === group.dishes.length ? selected : [...selected, ...ids])
  },
  inputName(event) { this.setData({ name: event.detail.value }) },
  setDate(event) { this.setData({ date: event.detail.value }) },
  setTime(event) { this.setData({ time: event.detail.value }) },
  setAuto(event) { this.setData({ autoClose: event.detail.value }) },
  newMenu() { go('menu-edit') },
  create() {
    return perform(this, async () => {
      const { name, menu, selectedIds, date, time, autoClose } = this.data
      const [year, month, dateNumber] = date.split('-').map(Number)
      const [hours, minutes] = time.split(':').map(Number)
      const deadline = new Date(year, month - 1, dateNumber, hours, minutes).getTime()
      const room = await api('create', { name, menuId: menu && menu.id, dishIds: selectedIds, deadline, autoClose })
      wx.redirectTo({ url: '/pages/invite/index?id=' + encodeURIComponent(room.id) })
    })
  }
})
