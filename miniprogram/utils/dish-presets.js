const groups = [
  ['热菜', [
    ['番茄炒蛋', 'egg', '番茄和鸡蛋翻炒，酸甜下饭。'],
    ['酸菜鱼', 'fish', '酸菜与鱼片同煮，可选择辣度。', '微辣、不辣'],
    ['宫保鸡丁', 'pepper', '鸡丁配花生和干辣椒。', '微辣、不辣'],
    ['红烧肉', 'bowl', '五花肉用酱汁慢炖。']
  ]],
  ['凉菜', [
    ['拍黄瓜', 'leaf', '黄瓜拌蒜和醋。'],
    ['凉拌木耳', 'leaf', '木耳焯水后凉拌。'],
    ['凉拌海带丝', 'leaf', '海带丝拌蒜和酱汁。']
  ]],
  ['主食', [
    ['米饭', 'bowl', '按碗计份。'],
    ['蛋炒饭', 'egg', '米饭与鸡蛋一起翻炒。'],
    ['葱油拌面', 'utensils', '面条拌葱油和酱汁。']
  ]],
  ['汤品', [
    ['番茄蛋花汤', 'egg', '番茄煮汤后打入蛋液。'],
    ['紫菜蛋花汤', 'bowl', '紫菜与蛋花煮汤。'],
    ['玉米排骨汤', 'bowl', '玉米与排骨慢炖。']
  ]]
]

const presets = groups.map(([category, dishes]) => ({
  category,
  dishes: dishes.map(([name, icon, description, optionText = '']) => ({ name, category, icon, description, optionText }))
}))
const byName = new Map(presets.flatMap(group => group.dishes.map(dish => [dish.name, dish])))

module.exports = { presets, findPreset: name => byName.get(name) }
