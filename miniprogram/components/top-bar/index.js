const { back, navTop } = require('../../utils/ui')
Component({
  options: { multipleSlots: true },
  properties: { title: String, subtitle: String, showBack: { type: Boolean, value: true }, centered: { type: Boolean, value: true } },
  data: { top: 48 },
  lifetimes: {
    attached() {
      this.setData({ top: navTop() })
    }
  },
  methods: { back }
})
