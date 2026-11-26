const CATEGORIES = ['热菜', '凉菜', '主食', '汤品']

class BusinessError extends Error {
  constructor(message, code = 'BUSINESS_ERROR') {
    super(message)
    this.code = code
  }
}
const check = (condition, message, code) => {
  if (!condition) throw new BusinessError(message, code)
}
const text = (value, size) => typeof value === 'string' ? value.trim().slice(0, size) : ''
const safeId = value => typeof value === 'string' && /^[a-z0-9_-]{1,48}$/i.test(value)
const accountView = profile => ({ registered: Boolean(profile && profile.registeredAt), nickname: profile ? profile.nickname : '' })
const profileView = profile => ({ nickname: profile.nickname, avatar: profile.avatar || '', reminders: profile.reminders })
const newProfile = now => ({ createdAt: now, nickname: '', menus: [], lastRead: 0, reminders: { confirmed: true, all: true } })
function validateAvatar(value) {
  check(typeof value === 'string' && value.length <= 180000, '头像文件过大或格式无效')
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  check(match && match[2].length % 4 === 0, '头像文件格式无效')
  const bytes = Buffer.from(match[2], 'base64')
  const valid = match[1] === 'jpeg' ? bytes.subarray(0, 3).toString('hex') === 'ffd8ff'
    : match[1] === 'png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  check(valid, '头像文件格式无效')
  return value
}
function requireAccount(profile) {
  check(profile && profile.registeredAt, '请先使用微信登录并完成注册', 'ACCOUNT_REQUIRED')
  return profile
}
const currentMember = (room, actor) => room.members.find(member => member.id === actor)
const statusOf = (room, now) => room.closedAt || (room.autoClose && now >= room.deadline ? room.deadline : 0)
const newMember = (id, name, joinedAt) => ({ id, name, joinedAt, state: 'pending', items: [] })
const requireOpen = (room, now) => check(!statusOf(room, now), '房间已收单，可查看最终清单')
const requireMember = (room, actor) => {
  const member = currentMember(room, actor)
  check(member, '请先通过邀请加入房间')
  return member
}
const requireHost = (room, actor) => check(room.owner === actor, '仅发起人可以进行这项操作')
const requireRoom = room => check(room && !room.deletedAt, '这个饭局已删除或不存在', 'ROOM_UNAVAILABLE')

function normalizeDishPhoto(photo, scope) {
  if (photo === undefined || photo === '') return ''
  const match = typeof photo === 'string' && /^cloud:\/\/[a-z0-9.-]{2,160}\/dish-photos\/([a-f0-9]{32})\/[a-f0-9]{64}\.(jpg|png|webp)$/.exec(photo)
  check(match && match[1] === scope, '菜品图片无效，请重新上传')
  return photo
}

function decodeDishPhoto(value) {
  check(typeof value === 'string' && value.length <= 437000 && value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value), '图片无效或过大，请换一张')
  const content = Buffer.from(value, 'base64')
  check(content.length <= 320 * 1024, '图片过大，请换一张')
  const signature = content.subarray(0, 8).toString('hex')
  const ext = signature.startsWith('ffd8ff') ? 'jpg' : signature === '89504e470d0a1a0a' ? 'png'
    : content.toString('ascii', 0, 4) === 'RIFF' && content.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : ''
  check(ext, '请选择 JPG、PNG 或 WebP 图片')
  return { content, ext }
}

function normalizeDishes(dishes, makeId, photoScope) {
  check(Array.isArray(dishes) && dishes.length > 0 && dishes.length <= 60, '每份菜单需要包含 1–60 道菜')
  const names = new Set()
  const ids = new Set()
  return dishes.map(dish => {
    check(dish && typeof dish === 'object', '菜品格式有误')
    const name = text(dish.name, 24)
    const category = dish.category
    check(name && CATEGORIES.includes(category), '请填写菜名并选择分类')
    check(!names.has(name), '菜名重复：' + name)
    names.add(name)
    const id = safeId(dish.id) ? dish.id : makeId()
    check(!ids.has(id), '菜品编号重复')
    ids.add(id)
    return {
      id, name, category, description: text(dish.description, 42), photo: normalizeDishPhoto(dish.photo, photoScope),
      options: Array.isArray(dish.options)
        ? [...new Set(dish.options.map(option => text(option, 14)).filter(Boolean))].slice(0, 5) : [],
      icon: ['fish', 'egg', 'leaf', 'bowl', 'pepper', 'flame', 'utensils'].includes(dish.icon) ? dish.icon :
        category === '凉菜' ? 'leaf' : 'bowl'
    }
  })
}

function orders(room) {
  const confirmed = room.members.filter(member => member.state !== 'pending')
  const dishes = room.dishes.map(dish => {
    const variants = new Map()
    for (const member of confirmed) {
      for (const item of member.items.filter(item => item.id === dish.id)) {
        if (!variants.has(item.option)) variants.set(item.option, { option: item.option, count: 0, people: [] })
        const variant = variants.get(item.option)
        variant.count += item.count
        variant.people.push({ name: member.name, count: item.count })
      }
    }
    const options = [...variants.values()]
    return {
      id: dish.id, name: dish.name, icon: dish.icon, soldOut: dish.soldOut,
      count: options.reduce((sum, item) => sum + item.count, 0), options
    }
  }).filter(dish => dish.count > 0)
  return { dishes, total: dishes.reduce((sum, dish) => sum + dish.count, 0), confirmed: confirmed.length }
}

function summary(room, actor, now) {
  const counts = orders(room)
  return {
    id: room._id, name: room.name, menuName: room.menuName, host: room.members[0].name,
    isHost: room.owner === actor, isMember: Boolean(currentMember(room, actor)),
    accepting: room.accepting, deadline: room.deadline, autoClose: room.autoClose,
    closedAt: statusOf(room, now), createdAt: room.createdAt, memberCount: room.members.length,
    confirmed: counts.confirmed, total: counts.total, dishesCount: room.dishes.length
  }
}

function roomView(room, actor, now) {
  const member = requireMember(room, actor)
  return {
    ...summary(room, actor, now),
    inviteToken: room.accepting && !statusOf(room, now) ? room.inviteToken : '',
    dishes: room.dishes, myState: member.state, myItems: member.items, totals: orders(room),
    members: room.members.map(person => ({
      key: person.joinedAt + '-' + room.members.indexOf(person), name: person.name,
      isMe: person.id === actor, isHost: person.id === room.owner, state: person.state,
      items: person.items.map(item => ({ ...item, name: room.dishes.find(dish => dish.id === item.id).name }))
    }))
  }
}

function addEvent(room, actor, now, makeId, type, title, detail) {
  room.events = [{ id: makeId(), actor, at: now, type, title, detail,
    recipients: type === 'availability' ? room.members.filter(member => member.items.some(item => item.id === detail)).map(member => member.id) :
      room.members.map(member => member.id)
  }, ...room.events].slice(0, 35)
}

function notifications(rooms, actor, profile, now) {
  return rooms.flatMap(room => {
    const entries = room.events.filter(event => event.actor !== actor && event.recipients.includes(actor)
      && (event.type !== 'confirmed' || profile.reminders.confirmed)
      && (event.type !== 'all' || profile.reminders.all))
    if (!room.closedAt && statusOf(room, now)) {
      entries.push({ id: room._id + '-auto', at: room.deadline, type: 'closed',
        title: '房间已自动收单', detail: '最终清单已生成' })
    }
    return entries.map(event => ({
      id: event.id, title: event.title, roomName: room.name, roomId: room._id,
      detail: event.type === 'availability' ? (room.dishes.find(dish => dish.id === event.detail) || {}).name : event.detail,
      type: event.type, at: event.at, unread: event.at > profile.lastRead
    }))
  }).sort((a, b) => b.at - a.at).slice(0, 60)
}

async function run(action, input, actor, store, { now, makeId, subscriptions, photoScope }) {
  if (action === 'signIn') {
    const existing = await store.read('profiles', actor)
    if (existing) return accountView(existing)
    return store.edit('profiles', actor, prior => {
      if (prior) return { result: accountView(prior) }
      const profile = newProfile(now)
      return { data: profile, result: accountView(profile) }
    })
  }
  if (action === 'register') {
    const nickname = text(input.nickname, 32)
    check(nickname, '请输入昵称')
    return store.edit('profiles', actor, prior => {
      if (prior && prior.registeredAt) return { result: accountView(prior) }
      const profile = { ...newProfile(now), ...prior, nickname, registeredAt: now }
      if (input.avatar !== undefined) profile.avatar = validateAvatar(input.avatar)
      return { data: profile, result: accountView(profile) }
    })
  }
  const me = requireAccount(await store.read('profiles', actor))
  const editProfile = change => store.edit('profiles', actor, prior => change(requireAccount(prior)))
  const rooms = async () => (await store.roomsFor(actor)).filter(room => !room.deletedAt)
  const roomId = input.roomId
  const editRoom = change => {
    check(safeId(roomId), '房间编号有误')
    return store.edit('rooms', roomId, room => {
      requireRoom(room)
      return change(room)
    })
  }

  switch (action) {
    case 'dashboard': {
      const myRooms = await rooms()
      return {
        rooms: myRooms.map(room => summary(room, actor, now)),
        nickname: me.nickname,
        companions: [...new Map(myRooms.flatMap(room => room.members)
          .filter(member => member.id !== actor).map(member => [member.id, member.name])).values()].slice(0, 3),
        unread: notifications(myRooms, actor, me, now).filter(message => message.unread).length
      }
    }
    case 'menus': {
      if (!me.menus.length) return []
      const myRooms = await rooms()
      return me.menus.map(menu => {
        const recent = myRooms.find(room => room.owner === actor && room.menuId === menu.id)
        return { ...menu, recent: recent ? { name: recent.name, at: recent.createdAt } : null }
      })
    }
    case 'profile':
      return profileView(me)
    case 'setProfile':
      return editProfile(me => {
        if (typeof input.nickname === 'string') {
          const nickname = text(input.nickname, 32)
          check(nickname, '请输入昵称')
          me.nickname = nickname
        }
        if (input.avatar !== undefined) me.avatar = validateAvatar(input.avatar)
        for (const key of ['confirmed', 'all']) {
          if (input.reminders && typeof input.reminders[key] === 'boolean') me.reminders[key] = input.reminders[key]
        }
        return { data: me, result: profileView(me) }
      })
    case 'saveMenu':
      return editProfile(me => {
        const name = text(input.name, 24)
        check(name, '请输入菜单名称')
        const dishes = normalizeDishes(input.dishes, makeId, photoScope)
        const index = input.id ? me.menus.findIndex(menu => menu.id === input.id) : -1
        check(!input.id || index >= 0, '找不到该菜单')
        const existing = me.menus[index]
        const menu = { id: existing ? existing.id : makeId(), name, dishes,
          icon: existing ? existing.icon : 'bowl', tone: existing ? existing.tone : 'amber' }
        if (existing) me.menus[index] = menu
        else {
          check(me.menus.length < 30, '最多可以保存 30 份菜单')
          me.menus.push(menu)
        }
        return { data: me, result: menu }
      })
    case 'deleteMenu':
      return editProfile(me => {
        me.menus = me.menus.filter(menu => menu.id !== input.id)
        return { data: me, result: true }
      })
    case 'uploadDishPhoto': {
      check(/^[a-f0-9]{32}$/.test(photoScope), '图片服务暂不可用')
      const { content, ext } = decodeDishPhoto(input.content)
      return store.uploadDishPhoto(photoScope, content, ext)
    }
    case 'prepareDishPhoto': {
      check(/^[a-f0-9]{32}$/.test(photoScope), '图片服务暂不可用')
      check(['jpg', 'png', 'webp'].includes(input.ext), '请选择 JPG、PNG 或 WebP 图片')
      return { cloudPath: store.newDishPhotoPath(photoScope, input.ext) }
    }
    case 'menuDishPhotos': {
      const menu = me.menus.find(item => item.id === input.menuId)
      check(menu, '找不到该菜单')
      return store.dishPhotoUrls(menu.dishes)
    }
    case 'roomDishPhotos': {
      check(safeId(roomId), '房间编号有误')
      const room = await store.read('rooms', roomId)
      requireRoom(room)
      requireMember(room, actor)
      return store.dishPhotoUrls(room.dishes)
    }
    case 'create': {
      const name = text(input.name, 24)
      const menu = me.menus.find(entry => entry.id === input.menuId)
      check(name && menu, '请填写房间名称并选择菜单')
      check(Number.isFinite(input.deadline) && input.deadline > now && input.deadline < now + 366 * 86400000, '请选择未来一年内的截止时间')
      const selected = new Set(Array.isArray(input.dishIds) ? input.dishIds : [])
      const dishes = menu.dishes.filter(dish => selected.has(dish.id)).map(dish => ({ ...dish, soldOut: false }))
      check(dishes.length > 0, '请选择至少一道供应菜品')
      const id = makeId()
      const room = {
        _id: id, owner: actor, name, menuId: menu.id, menuName: menu.name, dishes,
        inviteToken: makeId(), resultToken: makeId(), accepting: true, deadline: input.deadline, autoClose: input.autoClose !== false,
        createdAt: now, closedAt: 0, memberIds: [actor], members: [newMember(actor, me.nickname, now)], events: []
      }
      return store.edit('rooms', id, prior => {
        check(!prior, '房间创建失败，请重试')
        return { data: room, result: roomView(room, actor, now) }
      })
    }
    case 'room': {
      check(safeId(roomId), '房间编号有误')
      const room = await store.read('rooms', roomId)
      requireRoom(room)
      return roomView(room, actor, now)
    }
    case 'deleteRoom':
      check(safeId(roomId), '房间编号有误')
      return store.edit('rooms', roomId, room => {
        check(room, '这个饭局已删除或不存在', 'ROOM_UNAVAILABLE')
        requireHost(room, actor)
        if (room.deletedAt) return { result: true }
        room.deletedAt = now
        room.accepting = false
        return { data: room, result: true }
      })
    case 'result': {
      check(safeId(roomId), '清单链接有误')
      const room = await store.read('rooms', roomId)
      requireRoom(room)
      check(currentMember(room, actor) || (room.resultToken && room.resultToken === input.token),
        '清单链接无效，请向好友索取分享链接')
      check(statusOf(room, now), '房间仍在点菜，收单后才能查看最终清单')
      const { total, dishes } = orders(room)
      return {
        id: room._id, name: room.name, closedAt: statusOf(room, now),
        memberCount: room.members.length, confirmed: room.members.filter(person => person.state !== 'pending').length,
        resultToken: room.resultToken || '', isHost: room.owner === actor,
        totals: { total, dishes: dishes.map(dish => ({ id: dish.id, name: dish.name, count: dish.count,
          options: dish.options.map(({ option, count }) => ({ option, count })) })) }
      }
    }
    case 'invitation': {
      check(safeId(roomId), '邀请链接有误')
      const room = await store.read('rooms', roomId)
      requireRoom(room)
      check(currentMember(room, actor) || (room.accepting && room.inviteToken === input.token), '邀请已失效，请向发起人索取新邀请')
      return { ...summary(room, actor, now), nickname: me.nickname }
    }
    case 'join':
      return editRoom(room => {
        if (currentMember(room, actor)) return { result: roomView(room, actor, now) }
        check(room.accepting && room.inviteToken === input.token, '邀请已失效，请向发起人索取新邀请')
        requireOpen(room, now)
        check(room.members.length < 30, '此房间人数已满')
        const nickname = text(input.nickname, 32)
        check(nickname, '请输入昵称')
        room.members.push(newMember(actor, nickname, now))
        room.memberIds.push(actor)
        return { data: room, result: roomView(room, actor, now) }
      })
    case 'setInvites':
      return editRoom(room => {
        requireHost(room, actor)
        requireOpen(room, now)
        if (typeof input.accepting === 'boolean' && input.accepting !== room.accepting) {
          room.accepting = input.accepting
          room.inviteToken = makeId()
        }
        return { data: room, result: roomView(room, actor, now) }
      })
    case 'subscribe':
      return editRoom(room => {
        check(subscriptions, '微信服务通知尚未配置')
        const member = requireMember(room, actor)
        requireOpen(room, now)
        check(['confirmed', 'all'].includes(input.type), '请选择有效的提醒类型')
        check(!member.reminder, '本场已有生效的微信订阅')
        if (input.type === 'all') check(room.members.some(person => person.state === 'pending'), '成员已全部确认')
        member.reminder = input.type
        return { data: room, result: true }
      })
    case 'submit':
      return editRoom(room => {
        const member = requireMember(room, actor)
        requireOpen(room, now)
        check(['confirmed', 'skipped', 'pending'].includes(input.state), '点单状态有误')
        const previousState = member.state
        const previousItems = JSON.stringify(member.items)
        const previouslyAll = room.members.every(person => person.state !== 'pending')
        if (input.state === 'confirmed') {
          check(Array.isArray(input.items) && input.items.length > 0 && input.items.length <= 300, '请先选择要点的菜')
          const keys = new Set()
          member.items = input.items.map(item => {
            const dish = item && room.dishes.find(entry => entry.id === item.id)
            check(dish && !dish.soldOut, '有菜品已售罄，请调整后再确认')
            const option = item.option
            check((dish.options.length ? dish.options : ['默认做法']).includes(option), '请选择有效的做法')
            check(Number.isInteger(item.count) && item.count >= 1 && item.count <= 20, '每种做法最多点 20 份')
            const key = dish.id + ':' + option
            check(!keys.has(key), '点单中包含重复菜品')
            keys.add(key)
            return { id: dish.id, option, count: item.count }
          })
        } else if (input.state === 'skipped') member.items = []
        member.state = input.state
        if (previousState === member.state && previousItems === JSON.stringify(member.items)) {
          return { result: roomView(room, actor, now) }
        }
        const deliveries = []
        if (member.state === 'pending') {
          addEvent(room, actor, now, makeId, 'edited', member.name + '修改了点单', '状态已回到待确认')
        } else {
          const done = orders(room).confirmed
          addEvent(room, actor, now, makeId, 'confirmed', member.name + (member.state === 'skipped' ? '选择这次不点' : '已点好'),
            room.members.length + ' 人中已有 ' + done + ' 人确认')
          const allConfirmed = !previouslyAll && done === room.members.length && room.members.length > 1
          if (allConfirmed) {
            addEvent(room, '', now, makeId, 'all', '所有成员都已确认', '可以收单并生成最终清单')
          }
          if (subscriptions) {
            for (const person of room.members) {
              const all = person.reminder === 'all' && allConfirmed
              const someone = person.reminder === 'confirmed' && person.id !== actor
              if (!all && !someone) continue
              deliveries.push({ to: person.id, roomId: room._id, roomName: room.name,
                title: all ? '所有成员都已确认' : member.name + '已确认点单' })
              delete person.reminder
            }
          }
        }
        return { data: room, result: { ...roomView(room, actor, now), ...(deliveries.length ? { deliveries } : {}) } }
      })
    case 'close':
      return editRoom(room => {
        requireHost(room, actor)
        if (statusOf(room, now)) return { result: roomView(room, actor, now) }
        room.closedAt = now
        addEvent(room, actor, now, makeId, 'closed', '房间已收单', '最终清单已生成')
        return { data: room, result: roomView(room, actor, now) }
      })
    case 'addDish':
      return editRoom(room => {
        requireHost(room, actor)
        requireOpen(room, now)
        check(room.dishes.length < 60, '本场饭局最多供应 60 道菜')
        const [dish] = normalizeDishes([{ ...input.dish, id: makeId() }], makeId, photoScope)
        check(!room.dishes.some(item => item.name === dish.name), '本场已有同名菜品')
        room.dishes.push({ ...dish, soldOut: false })
        return { data: room, result: roomView(room, actor, now) }
      })
    case 'availability':
      return editRoom(room => {
        requireHost(room, actor)
        requireOpen(room, now)
        const dish = room.dishes.find(item => item.id === input.dishId)
        check(dish, '找不到该菜品')
        const soldOut = input.soldOut === true
        if (dish.soldOut === soldOut) return { result: roomView(room, actor, now) }
        dish.soldOut = soldOut
        if (soldOut) {
          addEvent(room, actor, now, makeId, 'availability', '有菜品临时售罄', dish.id)
          for (const member of room.members) {
            if (!member.items.some(item => item.id === dish.id)) continue
            member.items = member.items.filter(item => item.id !== dish.id)
            member.state = 'pending'
          }
        }
        return { data: room, result: roomView(room, actor, now) }
      })
    case 'messages': {
      const myRooms = await rooms()
      return {
        messages: notifications(myRooms, actor, me, now), reminders: me.reminders,
        rooms: subscriptions ? myRooms.filter(room => !statusOf(room, now)).map(room => ({
          id: room._id, name: room.name, myReminder: currentMember(room, actor).reminder || ''
        })) : []
      }
    }
    case 'readMessages':
      return editProfile(me => {
        me.lastRead = Math.max(me.lastRead, now)
        return { data: me, result: true }
      })
    default:
      throw new BusinessError('不支持的操作')
  }
}

module.exports = { run, BusinessError }
