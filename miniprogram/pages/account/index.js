const { api } = require('../../utils/api')
const { enterAccount } = require('../../utils/account')
const { navTop, perform } = require('../../utils/ui')
const { prepareAvatar } = require('../../utils/avatar')

Page({
  data: { top: 76, registering: false, nickname: '', avatar: '' },
  onLoad() {
    this.setData({ top: navTop() })
  },
  signIn() {
    return perform(this, async () => {
      const account = await api('signIn')
      if (account.registered) await enterAccount()
      else this.setData({ registering: true, nickname: account.nickname || '' })
    })
  },
  inputName(event) { this.setData({ nickname: event.detail.value }) },
  chooseAvatar(event) {
    if (event.detail.avatarUrl) this.setData({ avatar: event.detail.avatarUrl })
  },
  register() {
    return perform(this, async () => {
      const { nickname, avatar } = this.data
      await api('register', { nickname, ...(avatar ? { avatar: await prepareAvatar(avatar) } : {}) })
      await enterAccount()
    })
  }
})
