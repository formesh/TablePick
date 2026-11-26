const accountPath = '/pages/account/index'
const homePath = '/pages/home/index'
const tabs = [homePath, '/pages/menus/index', '/pages/profile/index']
let destination = ''
let openingAccount = false

function requestAccount() {
  const stack = getCurrentPages()
  const page = stack[stack.length - 1]
  if (!page || !page.route || '/' + page.route === accountPath) return false
  if (openingAccount) return true

  const query = ['id', 'token'].flatMap(key => {
    const value = page.options && page.options[key]
    return typeof value === 'string' && value ? [key + '=' + encodeURIComponent(value)] : []
  }).join('&')
  destination = '/' + page.route + (query ? '?' + query : '')
  openingAccount = true
  wx.reLaunch({
    url: accountPath,
    fail: () => { openingAccount = false }
  })
  return true
}

function enterAccount() {
  const url = destination || homePath
  return new Promise((resolve, reject) => {
    const navigation = {
      url,
      success() {
        openingAccount = false
        destination = ''
        resolve()
      },
      fail() { reject(new Error('暂时无法打开页面，请重试')) }
    }
    if (tabs.includes(url)) wx.switchTab(navigation)
    else wx.reLaunch(navigation)
  })
}

module.exports = { requestAccount, enterAccount }
