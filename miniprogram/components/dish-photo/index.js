const defaultPhoto = '/assets/images/dish-default.jpg'

Component({
  properties: {
    src: {
      type: String,
      observer(src) { this.setData({ imageSource: src || defaultPhoto }) }
    },
    label: String
  },
  data: { imageSource: defaultPhoto },
  methods: {
    fallback() {
      if (this.data.imageSource !== defaultPhoto) this.setData({ imageSource: defaultPhoto })
    }
  }
})
