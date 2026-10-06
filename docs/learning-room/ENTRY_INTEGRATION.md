# Learning Room 入口接入定位（P0）

## 2026-10-06 用户修订（当前实现，优先于下方历史）

- 独立「学堂 / Learn」底部 Tab，位于 Fridge 与 Achievements 之间；Home 按钮及 Profile 学习行已移除。
- App.tsx 在 activeTab=learn 时嵌入懒加载 LearningRoomEntry，入口与错误状态不再覆盖底部导航。
- 内容区预留 APP_TAB_DOCK_HEIGHT，学习页底部安全区交给 dock；五页内部布局／配色沿用批准版本。
- 根页不显示 Home／Profile 返回按钮。课程／Quiz 保留内部返回；根页系统返回回到之前的主 Tab。
- 切离卸载本人 gateway，再进入从服务器恢复；视频仍全屏显示。
- 运行与验证记录见 [NAVIGATION_UPDATE.md](verification/2026-10-06/NAVIGATION_UPDATE.md)。下方保留 P0／P4 历史定位，不能作为当前入口要求。

核对日期：2026-10-05。这里只登记接入点；P0 不展示未接真实状态的学习入口。

## Home 主入口

- `App.tsx` 的 chromeLayer 已渲染 `HomeAmbientOverlay`；这是现有原生 UI 覆盖层。
- `src/components/HomeAmbientOverlay.tsx` 有顶部 freshness、右上 mailbox 和底部 interactionHint。后续在该组件增加明确的 Learning Room 教育按钮，使用书本图标与双语文字；避开 freshness、mailbox、reset camera、3D 热点和底部五 Tab。
- 用安全区定位底部按钮，并把已有 interactionHint 移到按钮上方；动态字体时允许按钮变高，真机核对遮挡。不要直接照搬固定像素 top 值。
- `Kitchen3DPrototype.onOpenStory` 继续打开原动画；现有 3D 公告板和读屏 watchStory 操作继续保留。

## Profile 副入口

- `src/components/ProfileScreen.tsx` 的 collectionTitle 列表目前只有 medal wall。后续在此增加独立学习行，位于 medal wall 后，`book-outline` 图标、Learning Room／学习室标题与课程说明。
- medal wall 行去掉 isLast，学习行设 isLast；沿用 ProfileRow 与双语系统。
- 新增明确的 `onOpenLearningRoom` 回调，不在 Profile 内复制学习状态或成绩。

## Root 生命周期与返回

- 在 `App.tsx` 建立 `learningOrigin: 'home' | 'profile' | null`，非空时懒加载 `LearningRoomFlow` 全屏 Modal；关闭清空 origin，保留当前主 Tab。
- Kitchen 的 active 条件增加 `learningOrigin === null`；学习室打开时关闭／暂停 assistant，并隐藏 SpooniePetEntry 与可抢输入的 root chrome。
- 学习室内部采用明确 route 与统一返回处理；顶部返回文案来自 origin，不能从 Profile 打开却显示 Home。
- 开始加载失败仍需可关闭；学习容器恢复后台时重新读取本人状态。

这些代码在 P2 建立功能容器、P4 真实数据整合时落实。正常入口不可指向固定 1/3 或假通过 fixture。

## P2 实际实现补记

`LearningRoomFlow.tsx` 已建立局部容器，必须传入 `LearningRoomGateway`，没有默认 fixture；全屏 Modal 的 `onRequestClose`、顶部返回、Android BackHandler 与 iOS 左边缘返回共用处理逻辑。原生手势仍待设备验证。

Home／Profile 回调和 App.tsx root 生命周期尚未接入，留待 P4。`index.ts` 只在明确设置 `EXPO_PUBLIC_LEARNING_PREVIEW=1` 的开发进程进入独立 Preview App；正常入口及生产 bundle 仍为真实 App。预览不启动身份服务，也不持久化学习或语言偏好。运行命令、截图与待验收事项见 [P2_VERIFICATION.md](verification/2026-10-05/P2_VERIFICATION.md)。

## P4 实际接入补记

HomeAmbientOverlay 已增加底部教育按钮，Profile medal wall 后已增加学习行。App.tsx 用 learningOrigin 与 LearningLazyModal 按需打开 LearningRoomEntry；打开时关闭助手、暂停 Home GL 并隐藏 chrome，关闭保持主 Tab，通知导航会关闭学习室。本人 gateway 每次打开重建，后台回前台刷新服务器状态。动画与独立 practice 已接入，普通服务不会加载 draft／fixture。真机安全区、字体、热点遮挡、返回与 GL／视频生命周期待 P5 实测；见 P4_VERIFICATION.md。
