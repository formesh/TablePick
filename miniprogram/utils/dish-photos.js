const { api } = require('./api')
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function chooseImage() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sizeType: ['compressed'],
      success: ({ tempFiles }) => resolve(tempFiles[0]?.tempFilePath || ''),
      fail(error) {
        if (/cancel/i.test(error.errMsg || '')) resolve('')
        else reject(new Error('无法选择图片，请重试'))
      }
    })
  })
}

async function selectDishPhoto() {
  const original = await chooseImage()
  if (!original) return null
  const preview = await new Promise(resolve => {
    wx.compressImage({ src: original, quality: 74, compressedWidth: 720,
      success: result => resolve(result.tempFilePath), fail: () => resolve(original) })
  })
  const [image, file] = await Promise.all([
    new Promise((resolve, reject) => wx.getImageInfo({ src: preview,
      success: resolve, fail: () => reject(new Error('无法识别图片，请重新选择')) })),
    new Promise((resolve, reject) => wx.getFileSystemManager().getFileInfo({ filePath: preview,
      success: resolve, fail: () => reject(new Error('无法读取图片，请重新选择')) }))
  ])
  if (file.size > MAX_IMAGE_SIZE) throw new Error('图片超过 5 MB，请选一张较小的图片')
  const ext = image.type === 'jpeg' ? 'jpg' : image.type
  if (!['jpg', 'png', 'webp'].includes(ext)) throw new Error('请选择 JPG、PNG 或 WebP 图片')
  const { cloudPath } = await api('prepareDishPhoto', { ext })
  if (!cloudPath) throw new Error('图片上传地址暂不可用，请重试')
  try {
    const { fileID } = await wx.cloud.uploadFile({ cloudPath, filePath: preview })
    if (fileID) return { photo: fileID, preview }
  } catch (error) {
    const details = error && (error.errMsg || error.message) || ''
    const code = Number(error && error.errCode)
    console.warn('Dish photo upload failed', { code, details, bytes: file.size })
    if (/permission|unauthor|forbidden|access.?denied|权限/i.test(details)) {
      throw new Error('云存储拒绝上传，请联系小程序管理员')
    }
    if (/timeout|timed out|超时/i.test(details)) throw new Error('图片上传超时，请重试')
    if (/network|connect|网络/i.test(details)) throw new Error('图片上传时网络中断，请重试')
    if (/too large|size limit|413|过大/i.test(details)) throw new Error('图片过大，请换一张')
  }
  throw new Error('图片上传失败，请重试')
}

function refreshDishPhotos(page, scope, id, dishes) {
  const references = [...new Set(dishes.map(dish => dish.photo).filter(Boolean))].sort()
  const key = [scope, id, ...references].join('|')
  const previous = page.dishPhotoRequest
  if (previous && previous.key === key && previous.until > Date.now()) return
  const request = { key, until: Date.now() + 30000 }
  page.dishPhotoRequest = request
  if (!references.length) {
    page.setData({ photoUrls: {} })
    return
  }
  const action = scope === 'room' ? 'roomDishPhotos' : 'menuDishPhotos'
  api(action, { [scope + 'Id']: id }).then(urls => {
    if (page.dishPhotoRequest !== request) return
    request.until = Date.now() + (references.every(fileID => urls[fileID]) ? 45 * 60000 : 30000)
    page.setData({ photoUrls: urls })
  }).catch(error => {
    if (!error.redirecting) console.warn('Unable to load dish photos', error.message)
  })
}

module.exports = { selectDishPhoto, refreshDishPhotos }
