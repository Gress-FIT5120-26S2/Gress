# Library 横向主题栏与主导航手势隔离

日期：2026-10-06（Australia/Sydney）。用户反馈：在学堂 Library 滑动 All topics 栏时，底部主导航也会移动／切到其他页。

## 代码定位

Library 的 topic 按钮只调用 setTopic，没有主 Tab 回调。底部 FloatingTabBar 的 PanResponder 挂在导航胶囊上，两者是兄弟视图。发现会导致本现象的实际错误位于 LearningRoomFlow 的 iOS 返回 capture：用 gesture.x0 <= 24 判断是否从左边缘起滑。

安装的 RN 0.86.3 PanResponder.js 在 onStartShouldSetResponderCapture 初始化 x0=0，直到 onResponderGrant 才赋予坐标。旧判断在 capture 时将页面中部的右滑也认为是左边缘滑动；父级抢走主题 ScrollView 的响应后触发 back，学堂根页的 onClose 又把 activeTab 设置为之前的主页面，底栏因此跳动。不是把两个筛选状态复用了。

参考：已读取 Expo v57 确切版本文档、安装的 PanResponder 实现和官方 [PanResponder 文档](https://reactnative.dev/docs/panresponder)；官方 x0 定义为 responder grant 时的坐标。

## 修复

- 学堂作为独立主 Tab 时，Learn／My path／Library 根页不启用 iOS 滑动返回。Android Back 与底栏明确点击仍保留。
- 课程／文章／测验子页及独立 Modal 用 learningBackGesture.ts 记录触摸开始时的实际 nativeEvent.touches[0].pageX，不读取尚未初始化的 x0。
- 只接管从左边缘 0–24px 开始的单指右滑；短滑／竖滑／左滑不返回。需取得 responder 所有权并超过释放距离才调用 back。
- 多指、拒绝、终止会清空手势；释放前再次检查当前页面是否允许返回，视频打开或路由变化后不执行旧返回。
- Flow 使用稳定的 PanResponder 实例，回调通过 ref 读取最新 enabled／back，筛选与页面重渲染不会重建正在进行的手势。
- 没有修改底部导航的点击／滑动功能或 Library 主题筛选，没有改 API、数据库和内容。

## 已验证与边界

- 全项目 TypeScript --noEmit PASS。
- scripts/test-learning-room.mjs 14/14：6 项新回归 + 8 项原导航／预览测试。
- 新回归覆盖：根页边缘／中部右滑不切主 Tab、capture 前 x0=0 的中部拖动不被误捕获、真边缘单指返回一次、方向／短滑拒绝、取消／多指清空、页面／视频状态变化阻止旧返回。
- scripts/test-learning-gateway.mjs 16/16；首答、游标、重试、个人状态恢复保持通过。
- iOS 正常 bundle 导出 PASS：.codex-build/learning-room-gesture-fix/ios，2040 modules、59 assets，index-4fda1f7db8bc92d37b881caa5fc9eb8c.hbc。导出不等于手机手势验收。

本轮没有可操作的手机界面，不能把回调回归当成 Expo Go 实测。用户 Reload 后应在 Library 左右滚动主题、点击分类，确认底栏持续选中 Learn；再进入课程／资料，确认左边缘返回只回 Library／上一层，页面中部横滑不返回。无须重启 API。
