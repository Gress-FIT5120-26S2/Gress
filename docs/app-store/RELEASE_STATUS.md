# App Store 发布状态

更新日期：2026-10-12（Australia/Sydney）。发行方：Haoxuan Sun，公开邮箱：nariyirm@gmail.com。审核电话只保存于 App Store Connect 和本机忽略目录。

## 数据库与隐私

- 追加迁移 `20261012100000_app_store_privacy_and_erasure.sql` 已提交 Git（c7bdab3），先开发后生产，两库已应用，共 58 份迁移。
- 两库 lint 无 schema 错误。`verify-privacy-erasure.sql` 在两库均通过并完整回滚：凭证隔离、私人资料删除、其他成员数据保留、旧身份禁止重建、图片清理队列、今后的恢复链。
- TypeScript 检查通过；客户端学习测试 30 项及服务端测试 45 项通过。
- 新隐私／支持页面、AI 授权、身份删除与图片重试服务已部署到待推广的生产部署，尚待正式域名切换与 HTTP 核对。

## 商店与构建

- App Store Connect App ID：6805763159；Bundle ID：com.gressfit5120.kitchmemo；版本：1.0.0。
- 英语（澳大利亚）与简体中文的描述、推广文案、关键词、支持 URL 已保存；审核联系人和说明已保存，应用无需登录。
- 新版 iOS production／Android preview 构建仍待启动；旧 iOS build 11 不包含本次隐私改动，不能作为本次提审构建。
- 正式审核尚未提交，Apple 尚未批准发布。
- 澳大利亚为本次发行目标。中国大陆暂不开放：负责人确认未取得本 App 的备案号，且境外 AI 服务需完成地区方案核对。
- 仍需真实原生 iPhone 和 iPad 截屏。iPad 受支持，须提供对应素材；不得以虚构界面或拉伸手机图替代。

## 审核资料

- `metadata.json`：中英商店元数据。
- `APP_PRIVACY.md`：基于实际数据流的隐私问卷映射。
- `REVIEW_NOTES.md`：审核使用步骤与功能边界。
- `CHINA_MAINLAND.md`：备案、服务供应商与大陆网络准备清单。
