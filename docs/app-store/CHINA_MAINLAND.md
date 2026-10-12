# 中国大陆发行准备

负责人已要求同时发行澳大利亚与中国大陆。澳大利亚资料与简体中文本地化继续准备；中国大陆可用性须等有效 App 备案及服务方案确认，不能用临时数字或网站备案号冒充本 App 的备案号。

1. 在 App Store Connect → App 信息 → 中国大陆合规信息，填写与 KitchMemo、备案主体和 Bundle ID 相匹配的有效 ICP/App 备案信息。当前 Bundle ID 为 `com.gressfit5120.kitchmemo`，App Store Connect ID 为 `6805763159`。本仓库未发现现有 App 备案号。
2. 通过接入服务商或所在地省级通信管理局确认备案主体、实名域名、网络资源与接入要求。当前正式 API 是 `kitchmemo-api.vercel.app`，属于平台子域名；不能宣称它已经满足中国大陆备案条件。请先确定可备案的主体、域名和接入方案，再迁移／配置客户端生产地址。
3. 现有 OpenAI、Gemini、Cloudflare 与境外识别服务，以及 Vercel/Supabase 的境外数据流，需要逐项核实中国大陆用户可用性、供应商支持地区、生成式 AI 服务和个人信息处理要求。服务器部署在海外并不自动解决终端用户的供应商地区限制。不能把普通语言选项当作安全的地区合规隔离。
4. 学习内容主要是家庭食物减废与澳大利亚包装分类参考。是否涉及需要额外前置审批的教育等业务，应由备案接入方／主管部门按实际业务确认，不能仅凭“学堂”名称判定必需或免除许可。
5. 在真实的中国大陆网络环境验证 API、Supabase、模型、条码、通知、公共支持／隐私页面的可访问性。不能以澳大利亚联网成功替代这一证据。
6. 备案完成后，在应用适当入口展示真实备案号并链接工信部备案系统，同步更新政策、商店说明与审核资料；随后重新构建和提审对应版本。

如果备案和区域服务尚未完成，可先完成澳大利亚提审，中国大陆资料保持待办；是否分批发行由负责人决定。

官方参考：[Apple App 信息中的大陆备案要求](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)、[Apple 大陆组织合规信息](https://developer.apple.com/help/app-store-connect/manage-compliance-information/view-china-mainland-compliance-information/)、[工信部 App 备案通知](https://www.miit.gov.cn/jgsj/xgj/wjfb/art/2023/art_dd783a581c9644a4aee10afa582811db.html)、[生成式人工智能服务管理暂行办法](https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)、[OpenAI API 支持地区](https://help.openai.com/en/articles/5347006-openai-api-supported-countries-and-territories)。这些来源说明需核对的要求，本文件不替代具体备案受理意见。负责人已明确尚无备案号，因此目前不开放中国大陆，也不在未完成上述步骤时宣称可以同时上线。
