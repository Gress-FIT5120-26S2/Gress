# 商店截屏采集与排版清单

负责人已选择首版仅 iPhone，设备为 iPhone 16 Pro。正式构建将从 build 12 更新为包含该配置的 build 13；截屏应来自最新版原生构建。此清单是商店素材准备，不另行要求设备验收。

## 采集方法

通过 TestFlight 安装 Apple 已处理的 build 13。选一个只用于展示的冰箱，手动添加公开示例食品，例如 Milk、Tomatoes、Bananas，不放真实姓名、家庭记录、邀请码、恢复码或凭证。截图时避免通知横幅、键盘、错误或加载状态。

在个人页设置语言为 English 后，按下表依次截图；切换简体中文后重复。保留原始 PNG，不通过聊天软件压缩，不改造按钮或数据，不用网页截图冒充原生 App。

| 顺序／文件名 | 实际界面 | English 标题 | 简体中文标题 |
| --- | --- | --- | --- |
| 01-inventory.png | 冰箱列表，有公开样例食品、数量和包装日期 | Know what is in your kitchen | 家里还有什么，一眼看清 |
| 02-shopping.png | 购物清单，已录入公开样例项目 | Shop with a clearer list | 购物之前，先看清单 |
| 03-learning.png | 已发布的学堂课程／活动页 | Build habits that waste less | 用小习惯，减少食物浪费 |
| 04-assistant.png | 授权后与厨房 AI 的真实示例对话 | Optional help for your kitchen | 厨房建议，按需开启 |
| 05-progress.png | 成就／个人学习进度页，数值为真实示例活动结果 | See your everyday progress | 看见日常行动的进展 |

如不希望授权 AI，可以改用个人页隐私弹窗：English “Your data, your choice”；中文“你的数据，由你掌控”。不要编造 AI 结果或成就数值。

## 尺寸与设备

| 必需设备组 | 接受的竖屏尺寸 | 处理规则 |
| --- | --- | --- |
| 带灵动岛的 iPhone 中等显示屏 | 1206×2622（iPhone 16 Pro）或 1179×2556 | Apple 本次校验明确要求此组。使用 iPhone 16 Pro 原始 PNG 即可，不必调整尺寸 |
| iPhone 其他尺寸 | 大屏 1320×2868、1290×2796、1260×2736 等 | 可选，按 Apple 当前规格及自动缩放规则处理 |
| iPad 13 英寸 | 2064×2752 或 2048×2732 | 首版已获授权取消 iPad 支持，选入对应新构建后再确认此组不再必需；未来恢复 iPad 支持时须提供真实平板截图 |

Windows 当前没有可用的 iOS Simulator 或直接读取用户 iPhone 屏幕的连接。用户提供的 iPhone 16 Pro 可以完成本次所需手机素材。最少一张真实截图，建议每种语言五张。原图可以直接上传，不需要额外装饰文案。

PNG/JPEG 必须无透明通道；截图与对应语言一致。App 预览视频与新产品页横向标题素材是可选项，不代替必须的实际 App 截屏。

原图建议放入 `deliverables/app-store/screenshots/raw/<en-AU或zh-Hans>/<iphone或ipad>/`。收到原图后按上表排序、核对像素及可读性，再上传 App Store Connect。

规格依据：[Apple 当前截屏规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)（2026-10-12 核对）。
