const crypto = require('crypto')
const cloud = require('wx-server-sdk')
const { run, BusinessError } = require('./domain')
const { subscription, deliver } = require('./subscription')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database({ throwOnNotFound: false })
const collections = { rooms: 'ordering_rooms', profiles: 'ordering_profiles' }
const digest = value => crypto.createHash('sha256').update(value).digest('hex')

function ref(database, kind, id) {
  return database.collection(collections[kind]).doc(id)
}

async function read(database, kind, id) {
  try {
    const response = await ref(database, kind, id).get()
    return response.data && response.data._id ? response.data : null
  } catch (error) {
    if (/document (not found|does not exist|not exist)/i.test(error.errMsg || error.message || '')) return null
    throw error
  }
}

const store = {
  read: (kind, id) => read(db, kind, id),
  newDishPhotoPath(scope, ext) {
    return 'dish-photos/' + scope + '/' + crypto.randomBytes(32).toString('hex') + '.' + ext
  },
  async uploadDishPhoto(scope, content, ext) {
    const cloudPath = 'dish-photos/' + scope + '/' + digest(content) + '.' + ext
    const { fileID } = await cloud.uploadFile({ cloudPath, fileContent: content })
    return { photo: fileID }
  },
  async dishPhotoUrls(dishes) {
    const photos = [...new Set(dishes.map(dish => dish.photo).filter(Boolean))]
    const urls = {}
    for (let start = 0; start < photos.length; start += 30) {
      const fileList = photos.slice(start, start + 30).map(fileID => ({ fileID, maxAge: 3600 }))
      const response = await cloud.getTempFileURL({ fileList })
      for (const file of response.fileList || []) {
        if (file.status === 0 && file.tempFileURL) urls[file.fileID] = file.tempFileURL
      }
    }
    return urls
  },
  edit(kind, id, change) {
    return db.runTransaction(async transaction => {
      const prior = await read(transaction, kind, id)
      const { data, result } = change(prior)
      if (data) {
        const { _id, ...fields } = data
        await ref(transaction, kind, id).set({ data: fields })
      }
      return result
    })
  },
  async roomsFor(actor) {
    const rooms = []
    const query = db.collection(collections.rooms).where({ memberIds: db.command.all([actor]) })
      .orderBy('createdAt', 'desc')
    for (let offset = 0; ; offset += 100) {
      const { data } = await query.skip(offset).limit(100).get()
      rooms.push(...data)
      if (data.length < 100) return rooms
    }
  }
}

exports.main = async (event = {}) => {
  const { OPENID, APPID } = cloud.getWXContext()
  if (!OPENID || APPID !== 'wxfc680f6cc3c547a0') return { ok: false, message: '请从当前小程序访问' }
  try {
    let data = await run(event.action, event.input || {}, OPENID, store, {
      now: Date.now(), makeId: () => crypto.randomBytes(16).toString('hex'), subscriptions: Boolean(subscription),
      photoScope: digest(OPENID).slice(0, 32)
    })
    if (event.action === 'submit' && data.deliveries) {
      const { deliveries, ...room } = data
      data = room
      await deliver(cloud, deliveries)
    }
    if (event.action === 'messages' && subscription) data.templateId = subscription.id
    return { ok: true, data }
  } catch (error) {
    if (error instanceof BusinessError) return { ok: false, code: error.code, message: error.message }
    console.error('ordering request failed', event.action, error)
    return { ok: false, message: '云端服务暂不可用，请稍后重试' }
  }
}
