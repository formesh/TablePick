const { api } = require('../../utils/api')
const { onTab, load, perform, toast, go } = require('../../utils/ui')
const { prepareAvatar } = require('../../utils/avatar')
Page({
  data: { nickname: '', current: '', avatar: '', selectedAvatar: '' },
  onShow() { onTab(this, 2); this.refresh() },
  async onPullDownRefresh() { try { await this.refresh() } finally { wx.stopPullDownRefresh() } },
  refresh() {
    return load(this, async () => {
      const { nickname, avatar } = await api('profile')
      this.setData({ nickname, current: nickname || '我', avatar: avatar || '', selectedAvatar: '' })
    })
  },
  inputName(event) { this.setData({ nickname: event.detail.value }) },
  chooseAvatar(event) {
    if (event.detail.avatarUrl) this.setData({ selectedAvatar: event.detail.avatarUrl })
  },
  save() {
    return perform(this, async () => {
      const { nickname, selectedAvatar } = this.data
      const profile = await api('setProfile', { nickname,
        ...(selectedAvatar ? { avatar: await prepareAvatar(selectedAvatar) } : {}) })
      this.setData({ nickname: profile.nickname, current: profile.nickname, avatar: profile.avatar, selectedAvatar: '' })
      toast('资料已保存')
    })
  },
  messages() { go('messages') }
})
