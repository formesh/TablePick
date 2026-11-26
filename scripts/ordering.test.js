const assert = require('node:assert/strict')
const test = require('node:test')
const { run } = require('../cloudfunctions/ordering/domain')

function fixture() {
  const data = { profiles: new Map(), rooms: new Map() }
  const clone = value => value === undefined ? undefined : structuredClone(value)
  let sequence = 0
  let now = 1800000000000
  const store = {
    read: async (kind, id) => clone(data[kind].get(id)),
    newDishPhotoPath: (scope, ext) => 'dish-photos/' + scope + '/' + 'd'.repeat(64) + '.' + ext,
    uploadDishPhoto: async (scope, content, ext) => ({
      photo: 'cloud://unit-env.unit-bucket/dish-photos/' + scope + '/' + 'c'.repeat(64) + '.' + ext
    }),
    dishPhotoUrls: async dishes => Object.fromEntries(dishes.filter(dish => dish.photo)
      .map(dish => [dish.photo, 'https://storage.example.test/dish'])),
    roomsFor: async actor => clone([...data.rooms.values()].filter(room => room.memberIds.includes(actor))),
    async edit(kind, id, change) {
      const { data: update, result } = change(clone(data[kind].get(id)))
      if (update) data[kind].set(id, clone(update))
      return clone(result)
    }
  }
  const call = (action, input = {}, actor = 'host') => run(action, input, actor, store, {
    now: now++, makeId: () => 'new-' + ++sequence, subscriptions: true,
    photoScope: (actor === 'host' ? 'a' : 'b').repeat(32)
  })
  const advance = elapsed => { now += elapsed }
  const register = (actor, nickname) => call('register', { nickname }, actor)
  const create = async values => {
    await register('host', '发起人')
    const menu = await call('saveMenu', { name: '家常菜', dishes: [
      { id: 'fish', name: '酸菜鱼', category: '热菜', options: ['不辣', '微辣'] },
      { id: 'greens', name: '清炒时蔬', category: '热菜', options: ['少盐'] },
      { id: 'rice', name: '米饭', category: '主食' }
    ] })
    return call('create', {
      name: '周六晚餐', menuId: menu.id, dishIds: menu.dishes.map(dish => dish.id),
      deadline: now + 3600000, autoClose: true, ...values
    })
  }
  const join = (room, nickname, actor) => call('join', { roomId: room.id, token: room.inviteToken, nickname }, actor)
  const submit = (room, actor, state, items = []) => call('submit', { roomId: room.id, state, items }, actor)
  return { call, advance, create, join, submit, register, storedProfile: actor => clone(data.profiles.get(actor)) }
}

test('多人确认按菜品和做法合并，分享凭证只开放已收单的汇总', async () => {
  const { call, create, join, submit, register } = fixture()
  const room = await create()
  await register('guest', '小周')
  await register('third', '小陈')
  await register('external', '新成员')
  await assert.rejects(call('room', { roomId: room.id }, 'guest'), /加入/)
  await assert.rejects(call('join', { roomId: room.id, token: 'bad', nickname: '小周' }, 'guest'), /邀请已失效/)
  await join(room, '小周', 'guest')
  await join(room, '小陈', 'third')
  await join(room, '不同昵称', 'guest')
  const roomId = room.id
  await assert.rejects(call('close', { roomId }, 'guest'), /仅发起人/)
  await assert.rejects(call('result', { roomId }), /仍在点菜/)
  await Promise.all([
    submit(room, 'host', 'confirmed', [{ id: 'fish', option: '微辣', count: 2 }, { id: 'fish', option: '不辣', count: 1 }]),
    submit(room, 'guest', 'confirmed', [{ id: 'fish', option: '微辣', count: 3 }]),
    submit(room, 'third', 'skipped')
  ])
  const closer = await call('close', { roomId })
  assert.equal(closer.memberCount, 3)
  assert.equal(closer.confirmed, 3)
  assert.equal(closer.totals.total, 6)
  await assert.rejects(submit(room, 'guest', 'pending'), /已收单/)
  const result = await call('result', { roomId })
  assert.equal(result.totals.dishes[0].options.find(option => option.option === '微辣').count, 5)
  await assert.rejects(call('result', { roomId }, 'external'), /清单链接无效/)
  const shared = await call('result', { roomId, token: result.resultToken }, 'external')
  assert.equal(shared.totals.total, 6)
  assert.equal(shared.totals.dishes[0].options[0].people, undefined)
  assert.equal(shared.members, undefined)
  assert.equal(shared.inviteToken, undefined)
})

test('保留开场时的菜单，暂停邀请使旧链接失效', async () => {
  const { call, create, join, register } = fixture()
  const room = await create()
  await register('guest', '小周')
  const roomId = room.id
  const [menu] = await call('menus')
  await call('saveMenu', { ...menu, name: '调整后的菜单', dishes: [menu.dishes[0]] })
  const snapshot = await call('room', { roomId })
  assert.equal(snapshot.menuName, '家常菜')
  assert.equal(snapshot.dishes.length, 3)
  await call('setInvites', { roomId, accepting: false })
  const reopened = await call('setInvites', { roomId, accepting: true })
  await assert.rejects(join(room, '小周', 'guest'), /邀请已失效/)
  assert.equal((await join(reopened, '小周', 'guest')).memberCount, 2)
})

test('售罄调整、已读状态和自动收单一致', async () => {
  const { call, create, join, submit, advance, register } = fixture()
  const room = await create()
  await register('guest', '小周')
  await register('late', '小王')
  const roomId = room.id
  await join(room, '小周', 'guest')
  await submit(room, 'guest', 'confirmed', [{ id: 'fish', option: '不辣', count: 2 }])
  await call('availability', { roomId, dishId: 'fish', soldOut: true })
  const guest = await call('room', { roomId }, 'guest')
  assert.equal(guest.myState, 'pending')
  assert.equal(guest.myItems.length, 0)
  const before = await call('messages', {}, 'guest')
  assert.equal(before.messages[0].type, 'availability')
  assert.equal(before.messages[0].unread, true)
  await call('readMessages', {}, 'guest')
  const after = await call('messages', {}, 'guest')
  assert.equal(after.messages[0].unread, false)
  await assert.rejects(submit(room, 'guest', 'confirmed', [{ id: 'fish', option: '不辣', count: 1 }]), /已售罄/)
  advance(3600000)
  const result = await call('result', { roomId }, 'guest')
  assert.equal(result.closedAt, room.deadline)
  assert.equal(result.totals.total, 0)
  const messages = await call('messages', {}, 'guest')
  assert.equal(messages.messages[0].title, '房间已自动收单')
  await assert.rejects(join(room, '小王', 'late'), /已收单/)
})

test('订阅仅本房间成员可设置，每场只消费一次授权', async () => {
  const { call, create, join, submit, register } = fixture()
  const room = await create()
  await register('guest', '小周')
  await register('external', '新成员')
  const roomId = room.id
  await join(room, '小周', 'guest')
  await assert.rejects(call('subscribe', { roomId, type: 'all' }, 'external'), /加入/)
  await call('subscribe', { roomId, type: 'confirmed' })
  await assert.rejects(call('subscribe', { roomId, type: 'all' }), /已有/)
  const confirmed = await submit(room, 'guest', 'confirmed', [{ id: 'rice', option: '默认做法', count: 1 }])
  assert.equal(confirmed.deliveries.length, 1)
  assert.equal(confirmed.deliveries[0].to, 'host')
  const repeated = await submit(room, 'guest', 'confirmed', [{ id: 'rice', option: '默认做法', count: 1 }])
  assert.equal(repeated.deliveries, undefined)
  assert.equal((await call('messages')).rooms[0].myReminder, '')
})

test('首次登录需要注册，注册后从空账户开始并按微信身份隔离数据', async () => {
  const { call, create, register, storedProfile } = fixture()
  const accountRequired = { code: 'ACCOUNT_REQUIRED' }
  assert.equal(storedProfile('host'), undefined)
  assert.deepEqual(await call('signIn'), { registered: false, nickname: '' })
  const firstLogin = storedProfile('host').createdAt
  assert.ok(firstLogin)
  await call('signIn')
  assert.equal(storedProfile('host').createdAt, firstLogin)
  await assert.rejects(call('dashboard'), accountRequired)
  await assert.rejects(call('invitation', { roomId: 'unknown' }), accountRequired)
  await assert.rejects(register('host', ''), /昵称/)

  await register('host', '我的昵称')
  await register('host', '重复提交')
  assert.deepEqual(await call('signIn'), { registered: true, nickname: '我的昵称' })
  assert.deepEqual(await call('menus'), [])
  assert.deepEqual(await call('dashboard'), { rooms: [], nickname: '我的昵称', companions: [], unread: 0 })
  const room = await create()
  assert.equal(room.host, '我的昵称')

  await assert.rejects(call('invitation', { roomId: room.id, token: room.inviteToken }, 'guest'), accountRequired)
  await register('guest', '好友昵称')
  assert.equal((await call('invitation', { roomId: room.id, token: room.inviteToken }, 'guest')).nickname, '好友昵称')
  assert.deepEqual(await call('menus', {}, 'guest'), [])
  assert.deepEqual((await call('dashboard', {}, 'guest')).rooms, [])
  assert.equal((await call('profile', { openid: 'host' }, 'guest')).nickname, '好友昵称')
})

test('用户资料保存并返回本人选择的头像', async () => {
  const { call } = fixture()
  const avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aIxkAAAAASUVORK5CYII='
  await call('signIn')
  await call('register', { nickname: '微信昵称', avatar })
  assert.equal((await call('profile')).avatar, avatar)
  await assert.rejects(call('setProfile', { avatar: 'https://example.com/avatar.png' }), /头像/)
  await call('setProfile', { nickname: '新昵称' })
  assert.equal((await call('profile')).avatar, avatar)
})

test('发起人可以删除进行中和已收单的饭局，成员和分享链接随即失效', async () => {
  for (const closed of [false, true]) {
    const { call, create, join, register } = fixture()
    const room = await create()
    const roomId = room.id
    await register('guest', '小周')
    await join(room, '小周', 'guest')
    let token
    if (closed) {
      await call('close', { roomId })
      token = (await call('result', { roomId })).resultToken
    }
    await assert.rejects(call('deleteRoom', { roomId }, 'guest'), /仅发起人/)
    await call('deleteRoom', { roomId })
    assert.equal(await call('deleteRoom', { roomId }), true)
    assert.deepEqual((await call('dashboard')).rooms, [])
    assert.deepEqual((await call('dashboard', {}, 'guest')).rooms, [])
    await assert.rejects(call('invitation', { roomId, token: room.inviteToken }, 'guest'), { code: 'ROOM_UNAVAILABLE' })
    await assert.rejects(call('result', { roomId, token }, 'guest'), { code: 'ROOM_UNAVAILABLE' })
    await assert.rejects(call('room', { roomId }, 'guest'), { code: 'ROOM_UNAVAILABLE' })
  }
})

test('发起人临时加菜后成员可点单，原菜单和已收单饭局保持原样', async () => {
  const { call, create, join, register, submit } = fixture()
  const room = await create()
  const roomId = room.id
  await register('guest', '小周')
  await join(room, '小周', 'guest')
  const dish = { name: '番茄汤', category: '汤品', description: '当日供应', options: ['少盐'], id: 'fish' }
  await assert.rejects(call('addDish', { roomId, dish }, 'guest'), /仅发起人/)
  const updated = await call('addDish', { roomId, dish })
  const added = updated.dishes.find(entry => entry.name === dish.name)
  assert.ok(added)
  assert.notEqual(added.id, dish.id)
  assert.equal(added.soldOut, false)
  await assert.rejects(call('addDish', { roomId, dish }), /已有同名/)
  assert.ok((await call('room', { roomId }, 'guest')).dishes.some(entry => entry.id === added.id))
  const [menu] = await call('menus')
  assert.equal(menu.dishes.some(entry => entry.name === dish.name), false)
  await submit(room, 'guest', 'confirmed', [{ id: added.id, option: '少盐', count: 2 }])
  await call('close', { roomId })
  await assert.rejects(call('addDish', { roomId, dish: { ...dish, name: '紫菜汤' } }), /已收单/)
  const result = await call('result', { roomId })
  assert.equal(result.totals.dishes.find(entry => entry.id === added.id).count, 2)
})

test('菜品图片随菜单快照共享，只有房间成员可以读取图片地址', async () => {
  const { call, create, join, register } = fixture()
  const existing = await create()
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aIxkAAAAASUVORK5CYII='
  const { photo } = await call('uploadDishPhoto', { content: png })
  await assert.rejects(call('uploadDishPhoto', { content: 'YWJj' }), /图片/)
  const [menu] = await call('menus')
  const updated = await call('saveMenu', { ...menu, dishes: [{ ...menu.dishes[0], photo }, menu.dishes[1]] })
  const room = await call('create', { name: '有图的饭局', menuId: updated.id, dishIds: updated.dishes.map(item => item.id),
    deadline: 1800003600000 })
  assert.equal(room.dishes[0].photo, photo)
  assert.equal(room.dishes[1].photo, '')
  assert.equal((await call('room', { roomId: existing.id })).dishes[0].photo, '')
  await register('guest', '小周')
  await assert.rejects(call('roomDishPhotos', { roomId: room.id }, 'guest'), /加入/)
  await assert.rejects(call('saveMenu', { name: '其他菜单', dishes: [{ ...updated.dishes[0], photo }] }, 'guest'), /图片无效/)
  await join(room, '小周', 'guest')
  assert.ok((await call('roomDishPhotos', { roomId: room.id }, 'guest'))[photo])
  assert.ok((await call('menuDishPhotos', { menuId: updated.id }))[photo])
  const temporary = await call('addDish', { roomId: room.id, dish: { name: '紫菜汤', category: '汤品', photo } })
  assert.equal(temporary.dishes.at(-1).photo, photo)
})

test('图片直传路径仅为已注册用户生成，并使用该用户的照片目录', async () => {
  const { call, register } = fixture()
  await assert.rejects(call('prepareDishPhoto', { ext: 'jpg' }), { code: 'ACCOUNT_REQUIRED' })
  await register('host', '发起人')
  await assert.rejects(call('prepareDishPhoto', { ext: '../jpg' }), /图片/)
  const { cloudPath } = await call('prepareDishPhoto', { ext: 'png' })
  assert.equal(cloudPath, 'dish-photos/' + 'a'.repeat(32) + '/' + 'd'.repeat(64) + '.png')
  const fileId = 'cloud://unit-env.unit-bucket/' + cloudPath
  const menu = await call('saveMenu', { name: '菜单', dishes: [{ name: '鱼', category: '热菜', photo: fileId }] })
  assert.equal(menu.dishes[0].photo, fileId)
})
