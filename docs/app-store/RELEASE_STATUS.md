# App Store 发布状态

更新日期：2026-10-13（Australia/Sydney）。发行方：Haoxuan Sun，公开邮箱：nariyirm@gmail.com。审核电话只保存于 App Store Connect 和本机忽略目录。

## 2026-10-13 安全区域修复构建

- 本次两端来源提交均为 `dea1a8e`，包含 Learn AI 问答原生弹窗独立安全区域容器修复；`.easignore` 额外排除非运行时交接资料 `handover/`。
- iOS production 1.0.0（14）构建 `9bf04aa6-7cdb-4aa6-9302-a71213c0ce31` 为 FINISHED；[构建页](https://expo.dev/accounts/gress-fit5120-26s2/projects/kitchmemo/builds/9bf04aa6-7cdb-4aa6-9302-a71213c0ce31)。自动提交 `25166ef7-e5a6-4a87-bf79-998496b48aff` 为 FINISHED、error 为 null；[提交页](https://expo.dev/accounts/gress-fit5120-26s2/projects/kitchmemo/submissions/25166ef7-e5a6-4a87-bf79-998496b48aff)。已完成向 Apple 上传；本次只读 TestFlight 查询仍仅显示旧 build 13，尚未确认 build 14 已处理并可安装。
- Android preview 1.0.0／versionCode 3 构建 `fec5c662-1a61-46b2-84d6-8629152484b6` 为 FINISHED；[构建页](https://expo.dev/accounts/gress-fit5120-26s2/projects/kitchmemo/builds/fec5c662-1a61-46b2-84d6-8629152484b6)，[APK 下载](https://expo.dev/artifacts/eas/qD_JezA5Yxt8AVtx07SpsnREXbweU3Mo19xuRnYSRcg.apk)。
- 本次仅创建构建与 TestFlight 上传，没有改动既有 App Store 正式审核单或替换其 build 13。

## 数据库与隐私

- 追加迁移 `20261012100000_app_store_privacy_and_erasure.sql` 已提交 Git（c7bdab3），先开发后生产，两库已应用，共 58 份迁移。
- 两库 lint 无 schema 错误。`verify-privacy-erasure.sql` 在两库均通过并完整回滚：凭证隔离、私人资料删除、其他成员数据保留、旧身份禁止重建、图片清理队列、今后的恢复链。
- TypeScript 检查通过；客户端学习测试 30 项及服务端测试 45 项通过。
- 新隐私／支持页面、AI 授权、身份删除与每日图片重试服务已推广到正式域名 `https://kitchmemo-api.vercel.app`，部署 ID：`dpl_6U6SySnCErJWZoVgicd4gLTuAJS8`。
- 正式域名的中英隐私／支持页均 HTTP 200，公开管理员清理端点 HTTP 401；数据库健康通过。随机新建的隔离 HTTP 测试身份验证默认拒绝 AI、明确授权持久化、撤回、删除及旧身份禁止重建，测试身份已删除。
- 开发／生产最终 dry-run 均无待执行迁移；两份迁移文件 SHA-256 均为 `756b1a151b02c945f0a174d10e6f71f51f348bf05b0e9f0781e9977946e9bb5c`。
- 最终只读结构计数两端完全相同：54 张表、509 字段、375 约束、82 非扩展函数、132 索引、34 触发器、7 枚举。54 表全部启用 RLS；anon/authenticated 表授权及 security-definer 执行权限均为 0。

## 商店与构建

- App Store Connect App ID：6805763159；Bundle ID：com.gressfit5120.kitchmemo；版本：1.0.0。
- 英语（澳大利亚）与简体中文的描述、推广文案、关键词、支持 URL 已保存；审核联系人和说明已保存，应用无需登录。
- 中英副标题、主要美食佳饮／次要生活分类已保存。负责人确认隐私法律声明后，9 类数据的隐私标签已发布，不用于追踪。年龄分级为 iOS 26+ 全球 13+（旧系统全球 12+，区域例外以 Apple 为准）；内容版权声明依负责人确认已保存。
- 免费定价，基准国家为澳大利亚（AUD）；只有澳大利亚设置为发布时供应，中国大陆未供应。发布方式为审核通过后自动发布。
- iOS production build 13：`cf0f5559-c8df-4691-8e90-31a58f712ba0`，构建 FINISHED，来源提交 `d08a8f8`。EAS 上传 `8b8af189-ac70-4487-9766-07eab20d24d9` 为 FINISHED，Apple 已处理并将 build 13 选入、保存为 1.0.0 的正式审核构建。此前 build 12 的草稿关联已替换，未删除旧安装包。
- [iOS 构建页](https://expo.dev/accounts/gress-fit5120-26s2/projects/kitchmemo/builds/cf0f5559-c8df-4691-8e90-31a58f712ba0)；[IPA](https://expo.dev/artifacts/eas/-4Tas3-p1vzWmloSPFK49gtTwgZNW7fXLsXs0z682W8.ipa)。实际 IPA 的 Info.plist 已读取：版本 1.0.0（13）、UIDeviceFamily `[1]`（仅 iPhone）、最低 iOS 16.4、非豁免加密 false；包内包含 12 份 SDK 隐私 manifest。
- TestFlight 已显示 build 13，继承原有内部测试组 KitchMemo Dev 与 Team (Expo)。没有新增测试员、创建邀请或改动群组；截图可使用 TestFlight 的 1.0.0（13）。
- Android preview 已完成：`bf42979c-bda5-4cc9-8302-ef308c5960bf`，版本 1.0.0／versionCode 3，来源提交 `22ecd7b`。APK：[下载](https://expo.dev/artifacts/eas/H9e3TQYE6Cjz9r1KkI35og0WOUDiJmd7-m4QlGXMWjQ.apk)。本次 iOS 专用支持设备配置不影响此 Android 包。
- 2026-10-12 下午 3:03（Australia/Sydney）创建审核草稿，3:04 正式执行“提交以供审核”。Apple 版本页及审核记录均显示“等待审核”，审核构建为 1.0.0（13）。审核单 ID：`63e28f82-185a-4610-b566-4955c6a240e1`；Apple 尚未批准发布。凭据：`proofs/review-submitted.jpg`。
- 澳大利亚为本次发行目标。中国大陆暂不开放：负责人确认未取得本 App 的备案号，且境外 AI 服务需完成地区方案核对。
- Apple 在选入 build 12 后校验列出手机和平板两类截屏缺失（历史截图：proofs/review-blockers.jpg）。随后负责人明确选择首版仅 iPhone；`supportsTablet:false` 已提交并经 Expo 配置及实际 IPA 核对，Mac/Vision Pro 额外分发已关闭。
- 选入 build 13 后，Apple 的历史校验仅报告手机截屏缺失，iPad 要求已取消（`proofs/iphone-screenshot-only.jpg`）。本次负责人提供五张 iPhone 16 Pro 真实 JPEG，均为 1206×2622、无透明通道，已按首页、库存、学堂、助手、成就排序上传并保存。重新载入版本页确认五张持久化、旧缺图提示消失；随后添加审核并正式提交成功。此前旧提示导致一次自动审批拦截，持久化核对后已解决。
- 主要截图语言为英语（澳大利亚）。Apple 确认未自定义的其他 iPhone 尺寸与本地化版本使用此组素材；简体中文文字保留，尚无中文专属截图。原文件及校验清单保存于 `deliverables/app-store/screenshots/raw/en-AU/iphone/`，详见 `SCREENSHOTS.md`。
- 公开中英页面通过正式 HTTP 检查；中文隐私／支持页另经 402px 手机宽度核对，无横向溢出，视觉截图保存在 proofs/。

## 审核资料

- `metadata.json`：中英商店元数据。
- `APP_PRIVACY.md`：基于实际数据流的隐私问卷映射。
- `REVIEW_NOTES.md`：审核使用步骤与功能边界。
- `CHINA_MAINLAND.md`：备案、服务供应商与大陆网络准备清单。
