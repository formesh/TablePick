const CATEGORIES = require('../../utils/categories')
const { countdown, invitePath, go, perform, poll, stop } = require('../../utils/ui')
const { refreshRoom, changeRoom, showResult } = require('../../utils/room')

const itemKey = (id, option) => id + ':' + option
const dishItems = dish => dish.options.length ? dish.options : ['默认做法']
const toneOf = dish => ({ fish: 'amber', egg: 'rose', leaf: 'lilac' }[dish.icon] || 'blue')

Page({
  data: { room: null, categories: [], category: '全部', tab: 'order', visibleDishes: [], total: 0 },
  onLoad(options) {
    this.roomId = options.id
    this.draft = []
    this.variants = Object.create(null)
    this.dirty = false
  },
  onShow() { this.visible = true; this.refresh(); poll(this) },
  onHide() { this.visible = false; stop(this) },
  onUnload() { this.visible = false; stop(this) },
  async onPullDownRefresh() { try { await this.refresh() } finally { wx.stopPullDownRefresh() } },
  refresh(quiet) { return refreshRoom(this, quiet, room => this.updateRoom(room)) },
  updateRoom(room) {
    if (room.closedAt && this.visible) {
      this.visible = false
      stop(this)
      showResult(room)
      return
    }
    if (!this.dirty) this.draft = room.myItems
    const available = new Map(room.dishes.filter(dish => !dish.soldOut).map(dish => [dish.id, dishItems(dish)]))
    this.draft = this.draft.filter(item => available.has(item.id) && available.get(item.id).includes(item.option))
    const categories = ['全部', ...CATEGORIES.filter(category => room.dishes.some(dish => dish.category === category))]
    const category = categories.includes(this.data.category) ? this.data.category : '全部'
    this.setData({ room, categories, category, deadlineText: room.autoClose ? countdown(room.deadline) : '由发起人手动收单' })
    this.updateDishes()
  },
  updateDishes() {
    const { room, category } = this.data
    if (!room) return
    const counts = new Map(this.draft.map(item => [itemKey(item.id, item.option), item.count]))
    const visibleDishes = room.dishes.filter(dish => category === '全部' || dish.category === category).map(dish => {
      const choices = dishItems(dish)
      const option = this.variants[dish.id] || choices.find(value => counts.has(itemKey(dish.id, value))) || choices[0]
      return { ...dish, tone: toneOf(dish), choices, option, optionIndex: choices.indexOf(option),
        count: counts.get(itemKey(dish.id, option)) || 0,
        total: choices.reduce((sum, value) => sum + (counts.get(itemKey(dish.id, value)) || 0), 0)
      }
    })
    this.setData({ visibleDishes, total: this.draft.reduce((sum, item) => sum + item.count, 0) })
  },
  selectTab(event) {
    const tab = event.currentTarget.dataset.tab
    if (tab === 'progress') return go('progress', this.roomId)
    this.setData({ tab })
  },
  selectCategory(event) {
    this.setData({ category: event.currentTarget.dataset.name })
    this.updateDishes()
  },
  chooseOption(event) {
    const dish = this.data.visibleDishes.find(item => item.id === event.currentTarget.dataset.id)
    const option = dish && dish.choices[Number(event.detail.value)]
    if (!option || dish.soldOut) return
    this.variants[dish.id] = option
    this.updateDishes()
  },
  showDish(event) {
    const { id } = event.currentTarget.dataset
    if (!this.data.visibleDishes.some(dish => dish.id === id)) return
    wx.navigateTo({ url: '/pages/dish/index?id=' + encodeURIComponent(this.roomId) + '&dishId=' + encodeURIComponent(id) })
  },
  changeCount(event) {
    const { id, step } = event.currentTarget.dataset
    if (this.data.saving || this.data.room.myState !== 'pending') return
    const dish = this.data.visibleDishes.find(item => item.id === id)
    if (!dish || dish.soldOut) return
    const count = Math.max(0, Math.min(20, dish.count + Number(step)))
    this.draft = this.draft.filter(item => item.id !== id || item.option !== dish.option)
    if (count) this.draft.push({ id, option: dish.option, count })
    this.dirty = true
    this.updateDishes()
  },
  submit(event) {
    const state = event.currentTarget.dataset.state
    return perform(this, async () => {
      const room = await changeRoom(this, 'submit', { state, items: this.draft })
      this.dirty = false
      this.updateRoom(room)
    })
  },
  invite() { go('invite', this.roomId) },
  onShareAppMessage() {
    const room = this.data.room
    return { title: room ? room.host + '邀请你一起点菜 · ' + room.name : 'TablePick', path: invitePath(room) }
  }
})
