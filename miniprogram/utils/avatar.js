function readAvatar(path) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: path, encoding: 'base64',
      success({ data }) {
        const type = data.startsWith('/9j/') ? 'jpeg' : data.startsWith('iVBORw0KGgo') ? 'png'
          : data.startsWith('UklGR') ? 'webp' : ''
        if (!type) return reject(new Error('请选择 JPG、PNG 或 WebP 头像'))
        if (data.length > 179900) return reject(new Error('头像图片过大，请换一张'))
        resolve('data:image/' + type + ';base64,' + data)
      },
      fail() { reject(new Error('头像读取失败，请重新选择')) }
    })
  })
}

async function prepareAvatar(path) {
  const compressed = await new Promise(resolve => {
    wx.compressImage({ src: path, quality: 75, compressedWidth: 160, compressedHeight: 160,
      success: result => resolve(result.tempFilePath), fail: () => resolve(path) })
  })
  return readAvatar(compressed)
}

module.exports = { prepareAvatar }
