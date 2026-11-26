const { api } = require('../../utils/api')
const CATEGORIES = require('../../utils/categories')
const { back, load, perform, confirm } = require('../../utils/ui')

Page({
  data: { name: '', dishes: [], categories: CATEGORIES, editing: -1 },
  onLoad(options) { this.menuId = options.id || ''; this.refresh() },
  refresh() {
    return load(this, async () => {
      if (!this.menuId) return api('profile')
      const menu = (await api('menus')).find(item => item.id === this.menuId)
      if (!menu) throw new Error('找不到该菜单')
      this.setData({ name: menu.name, existing: true,
        dishes: menu.dishes.map(dish => ({ ...dish, optionText: dish.options.join('、') })) })
    })
  },
  inputName(event) { this.setData({ name: event.detail.value }) },
  add() {
    const dishes = this.data.dishes
    if (dishes.length >= 60) return
    this.setData({ dishes: [...dishes, { name: '', category: CATEGORIES[0], description: '', optionText: '' }], editing: dishes.length })
  },
  change(event) {
    const { index, field } = event.currentTarget.dataset
    this.setData({ ['dishes[' + index + '].' + field]: event.detail.value })
  },
  category(event) {
    const index = event.currentTarget.dataset.index
    this.setData({ ['dishes[' + index + '].category']: CATEGORIES[Number(event.detail.value)] })
  },
  edit(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ editing: this.data.editing === index ? -1 : index })
  },
  remove(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ dishes: this.data.dishes.filter((_, i) => i !== index), editing: -1 })
  },
  save() {
    return perform(this, async () => {
      const dishes = this.data.dishes.map(({ optionText, ...dish }) => ({
        ...dish, options: optionText.split(/[、，,]/).map(value => value.trim()).filter(Boolean)
      }))
      await api('saveMenu', { id: this.menuId, name: this.data.name, dishes })
      back()
    })
  },
  async deleteMenu() {
    if (!await confirm('删除菜单', '已创建房间的菜品将继续使用开场时的菜单。')) return
    return perform(this, async () => {
      await api('deleteMenu', { id: this.menuId })
      back()
    })
  }
})
