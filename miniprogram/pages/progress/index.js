const { countdown, confirm, go, perform, poll, stop, toast } = require('../../utils/ui')
const { refreshRoom, changeRoom, showResult, deleteRoom } = require('../../utils/room')
const categories = require('../../utils/categories')
const { presets, findPreset } = require('../../utils/dish-presets')
const { selectDishPhoto } = require('../../utils/dish-photos')
const blankDish = () => ({ name: '', categoryIndex: 0, description: '', optionText: '' })

Page({
  data: { room: null, management: false, stock: false, addingDish: false, categories, presets, showPresets: false, draftDish: blankDish(), dishNameReady: false },
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
  toggleAddDish() { this.setData({ addingDish: !this.data.addingDish }) },
  togglePresets() { this.setData({ showPresets: !this.data.showPresets }) },
  addPreset(event) {
    if (this.data.saving || !this.data.room?.isHost) return
    const preset = findPreset(event.currentTarget.dataset.name)
    if (!preset) return
    if (this.data.room.dishes.some(dish => dish.name === preset.name)) return toast('本场已供应这道菜')
    const { category, ...draft } = preset
    this.setData({ draftDish: { ...draft, categoryIndex: categories.indexOf(category) },
      dishNameReady: true, showPresets: false })
  },
  editDish(event) {
    const { field } = event.currentTarget.dataset
    const value = event.detail.value
    const patch = { ['draftDish.' + field]: value }
    if (field === 'name') patch.dishNameReady = Boolean(value.trim())
    this.setData(patch)
  },
  setDishCategory(event) { this.setData({ 'draftDish.categoryIndex': Number(event.detail.value) }) },
  choosePhoto() {
    return perform(this, async () => {
      const picked = await selectDishPhoto()
      if (picked) this.setData({ 'draftDish.photo': picked.photo, 'draftDish.previewPhoto': picked.preview })
    })
  },
  useDefaultPhoto() { this.setData({ 'draftDish.photo': '', 'draftDish.previewPhoto': '' }) },
  addDish() {
    if (!this.data.room?.isHost || !this.data.dishNameReady) return
    return perform(this, async () => {
      const { name, categoryIndex, description, optionText, icon, photo } = this.data.draftDish
      const options = optionText.split(/[、，,]/).map(value => value.trim()).filter(Boolean)
      this.updateRoom(await changeRoom(this, 'addDish', { dish: {
        name, category: categories[categoryIndex], description, options, icon, photo
      } }))
      this.setData({ draftDish: blankDish(), dishNameReady: false, addingDish: false, showPresets: false })
      toast('已加入本场菜单')
    })
  },
  deleteRoom,
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
