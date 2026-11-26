Component({
  data: { selected: 0, tabs: [
    { page: '/pages/home/index', label: '首页', icon: 'home' },
    { page: '/pages/menus/index', label: '菜单', icon: 'book' },
    { page: '/pages/profile/index', label: '我的', icon: 'user' }
  ] },
  methods: {
    select(event) {
      const index = event.currentTarget.dataset.index
      if (index !== this.data.selected) wx.switchTab({ url: this.data.tabs[index].page })
    }
  }
})
