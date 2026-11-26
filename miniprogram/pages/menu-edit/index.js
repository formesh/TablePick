const { api } = require('../../utils/api')
const CATEGORIES = require('../../utils/categories')
const { presets, findPreset } = require('../../utils/dish-presets')
const { back, load, perform, confirm, toast } = require('../../utils/ui')
const { selectDishPhoto, refreshDishPhotos } = require('../../utils/dish-photos')
const categoryIndices = Object.fromEntries(CATEGORIES.map((category, index) => [category, index]))

Page({
  data: { name: '', nameReady: false, dishes: [], categories: CATEGORIES, categoryIndices, editing: -1, presets, showPresets: false, photoUrls: {} },
  onLoad(options) { this.menuId = options.id || ''; this.nextDish = 0; this.refresh() },
  refresh() {
    return load(this, async () => {
      if (!this.menuId) return api('profile')
      const menu = (await api('menus')).find(item => item.id === this.menuId)
      if (!menu) throw new Error('找不到该菜单')
      this.setData({ name: menu.name, nameReady: Boolean(menu.name.trim()), existing: true,
        dishes: menu.dishes.map(dish => ({ ...dish, renderKey: 'saved-' + dish.id, optionText: dish.options.join('、') })) })
      refreshDishPhotos(this, 'menu', menu.id, menu.dishes)
    })
  },
  inputName(event) {
    const name = event.detail.value
    this.setData({ name, nameReady: Boolean(name.trim()) })
  },
  add() {
    const dishes = this.data.dishes
    if (dishes.length >= 60) return
    const draft = { renderKey: 'draft-' + ++this.nextDish, name: '', category: CATEGORIES[0], description: '', optionText: '' }
    this.setData({ dishes: [...dishes, draft], editing: dishes.length })
  },
  togglePresets() { this.setData({ showPresets: !this.data.showPresets }) },
  addPreset(event) {
    if (this.data.loading || this.data.saving) return
    const preset = findPreset(event.currentTarget.dataset.name)
    const dishes = this.data.dishes
    if (!preset || dishes.length >= 60) return
    if (dishes.some(dish => dish.name.trim() === preset.name)) return toast('已添加这道菜')
    this.setData({ dishes: [...dishes, { ...preset, renderKey: 'draft-' + ++this.nextDish }] })
    toast('已添加' + preset.name)
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
  choosePhoto(event) {
    const key = event.currentTarget.dataset.key
    return perform(this, async () => {
      const picked = await selectDishPhoto()
      const index = this.data.dishes.findIndex(dish => dish.renderKey === key)
      if (!picked || index < 0) return
      this.setData({ ['dishes[' + index + '].photo']: picked.photo, ['dishes[' + index + '].previewPhoto']: picked.preview })
    })
  },
  useDefaultPhoto(event) {
    const index = event.currentTarget.dataset.index
    this.setData({ ['dishes[' + index + '].photo']: '', ['dishes[' + index + '].previewPhoto']: '' })
  },
  save() {
    return perform(this, async () => {
      const dishes = this.data.dishes.map(({ optionText, renderKey, previewPhoto, ...dish }) => ({
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
