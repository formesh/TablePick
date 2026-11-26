# 一起点菜

微信原生小程序。首页采用 Pencil 设计稿的 Apple 深度版。

## 本地运行

在微信开发者工具中打开项目根目录。项目已配置 AppID、源码目录和关联的 CloudBase 环境。运行时通过云函数读取用户资料、菜单、饭局和消息。

打开小程序后点击「使用微信登录」。首次登录会在云端创建账户记录，随后可以在微信提供的界面选择头像和昵称并完成注册。通过分享邀请进入的用户完成注册后会继续打开原邀请。

## 启用多人协作

1. 在微信开发者工具中打开「云开发」，选择与 project.config.json 中的 AppID 关联的环境。登录时使用小程序绑定的微信公众平台账号。
2. 在文档数据库中建立 ordering_profiles 和 ordering_rooms 两个集合，选择「仅管理端可读写」。小程序经 ordering 云函数访问数据，云函数通过微信 OPENID 区分用户。
3. 在开发者工具中将 cloudfunctions/ordering 上传到该环境并选择「云端安装依赖」。如果有运行时选项，选择 Node.js 18 或更高版本。
4. 重新编译。用两个有权限体验小程序的微信账号验证「微信登录或注册 → 创建菜单和房间 → 分享邀请 → 好友加入 → 双方确认 → 收单 → 分享最终清单」。

房间每 5 秒刷新一次。到达截止时间后，云函数会拒绝新的点单，并以已经确认的订单生成最终清单。关闭「到点自动收单」的房间可继续点菜，直到发起人手动收单。通过微信分享的最终清单只包含菜品、做法、数量和人数等汇总。

## 微信服务通知

站内消息随点单、收单等操作生成。要启用微信服务通知，在公众平台选择包含两个 thing 类型关键词、且含义分别对应「饭局名称」和「点菜进度」的订阅模板，再为 ordering 云函数配置以下环境变量。

| 环境变量 | 值 |
| --- | --- |
| WECHAT_ORDER_TEMPLATE_ID | 微信公众平台的订阅模板 ID |
| WECHAT_ORDER_ROOM_FIELD | 饭局名称对应的关键词，例如 thing1 |
| WECHAT_ORDER_STATUS_FIELD | 点菜进度对应的关键词，例如 thing2 |
| WECHAT_ORDER_MINIPROGRAM_STATE | formal、trial 或 developer，默认 formal |

配置生效后，成员可在「消息 → 设置」为进行中的饭局订阅一条提醒。服务通知需要成员在微信弹窗中授权。

## 验证

运行 node --test scripts/ordering.test.js 可以验证登录注册、用户数据隔离、多人权限、菜单快照、售罄、截止收单、清单分享和订阅逻辑。测试在内存中执行。

[腾讯云 CloudBase 接入指南](https://docs.cloudbase.net/skill.md) · [微信小程序 CloudBase 云函数接入](https://docs.cloudbase.net/recipes/add-cloud-function-wechat-miniprogram)
