const pad = number => String(number).padStart(2, '0')
const day = value => {
  const date = new Date(value)
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}
const clock = value => {
  const date = new Date(value)
  return pad(date.getHours()) + ':' + pad(date.getMinutes())
}
const dateParts = value => {
  const date = new Date(value)
  return { month: (date.getMonth() + 1) + '月', dayNumber: date.getDate() }
}
function dateLabel(value, now = Date.now()) {
  if (!value) return ''
  const date = dateParts(value)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const suffix = day(value) === day(now) ? '今天' : day(value) === day(tomorrow) ? '明天' : date.month + date.dayNumber + '日'
  return suffix + ' ' + clock(value)
}
function roomDeadlineLabel(room) {
  if (room.closedAt) return '已于' + dateLabel(room.closedAt) + '收单'
  return room.autoClose ? dateLabel(room.deadline) + ' 截止' : '由发起人手动收单'
}
function countdown(value, now = Date.now()) {
  const minutes = Math.ceil((value - now) / 60000)
  if (minutes <= 0) return '已到截止时间'
  const days = Math.floor(minutes / 1440)
  if (days > 0) return '距收单还有 ' + days + ' 天'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return '距收单还有 ' + (hours ? hours + ' 小时 ' : '') + (rest || !hours ? rest + ' 分' : '')
}
function navTop() {
  const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  const capsule = wx.getMenuButtonBoundingClientRect()
  const safeTop = windowInfo.safeArea ? windowInfo.safeArea.top : 0
  return Math.max(76, (windowInfo.statusBarHeight || 20) + 16, safeTop + 12, (capsule.bottom || 58) + 8)
}
function invitePath(room) {
  if (!room || !room.inviteToken) return '/pages/home/index'
  return '/pages/join/index?id=' + encodeURIComponent(room.id) + '&token=' + encodeURIComponent(room.inviteToken)
}
function go(page, id) {
  wx.navigateTo({ url: '/pages/' + page + '/index' + (id ? '?id=' + encodeURIComponent(id) : '') })
}
function back() {
  if (getCurrentPages().length > 1) wx.navigateBack()
  else wx.switchTab({ url: '/pages/home/index' })
}
function onTab(page, index) {
  const nav = typeof page.getTabBar === 'function' && page.getTabBar()
  if (nav) nav.setData({ selected: index })
}
function toast(message) {
  wx.showToast({ title: message, icon: 'none' })
}
async function load(page, work, quiet = false) {
  if (!quiet) page.setData({ loading: true, error: '' })
  try {
    await work()
  } catch (error) {
    if (!quiet && !error.redirecting) page.setData({ error: error.message || '加载失败，请重试' })
  } finally {
    if (!quiet) page.setData({ loading: false })
  }
}
async function perform(page, work) {
  if (page.data.saving) return
  page.setData({ saving: true })
  try { await work() } catch (error) {
    if (!error.redirecting) toast(error.message || '操作失败，请重试')
  }
  finally { page.setData({ saving: false }) }
}
function poll(page, interval = 5000) {
  stop(page)
  let refreshing = false
  page.pollTimer = setInterval(async () => {
    if (refreshing || page.data.loading || page.data.saving || page.data.error) return
    refreshing = true
    try { await page.refresh(true) } finally { refreshing = false }
  }, interval)
}
function stop(page) {
  if (page.pollTimer) clearInterval(page.pollTimer)
  page.pollTimer = null
}
function confirm(title, content) {
  return new Promise(resolve => wx.showModal({ title, content, confirmColor: '#2F80FF',
    success: response => resolve(response.confirm), fail: () => resolve(false) }))
}

module.exports = { day, clock, dateParts, dateLabel, roomDeadlineLabel, countdown, navTop, invitePath, go, back, onTab, toast, load, perform, poll, stop, confirm }
