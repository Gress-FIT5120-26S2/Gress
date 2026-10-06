# P0 基准、独立素材与基础样式验收

执行日期：2026-10-05（Australia/Sydney）。结论：**P0 完成，允许后续从 P1 开始。** 本记录不是原生页面、Quiz 或数据库验收。

## 已完成产物

- 逐张核对批准的五张 v2 最终图；未修改这些参考图。
- 8 张独立生成资产，以及官方英文／中文 SDG 13 图片；所有正式运行时文件位于项目内。
- [图片来源与使用要求](../../../../assets/learning-room/SOURCE.md)、[逐张生成提示词](../../../../assets/learning-room/GENERATION_PROMPTS.json)、[尺寸／透明性／hash 清单](../../../../assets/learning-room/ASSET_MANIFEST.json)。
- [learningTheme.ts](../../../../src/components/learning/learningTheme.ts)：固定配色、字体层级、间距、圆角、最小触控尺寸、基础静态样式。
- [learningAssets.ts](../../../../src/components/learning/learningAssets.ts)：9 个稳定 assetKey、10 个静态 require，中英 SDG 按语言选择。
- [资产重建脚本](../../../../scripts/prepare-learning-assets.mjs)：本地按比例缩放与编码，不改色、裁剪或丢失 alpha。
- [入口定位](../../ENTRY_INTEGRATION.md)：HomeAmbientOverlay 主入口、Profile collection 副入口、Root 暂停／返回接入方式。

## 素材构图核对

| 基准 | 运行时图片 | 核对结论 |
| --- | --- | --- |
| 01 hero | [静物](../../../../assets/learning-room/waste-basics-still-life.png) | 纸盒左后、银罐右后、番茄前景、叶片右下；透明独立主体，无文字／手机框 |
| 02 | [初级封面](../../../../assets/learning-room/waste-basics-course-cover.webp) | 保留叶菜、番茄、苹果、胡萝卜、燕麦罐、金属罐、奶瓶、蛋盒的左右关系与厨房日光 |
| 03 | [空铝罐](../../../../assets/learning-room/empty-aluminium-can.png) | 银色无品牌、开口可见、三分之四视角、主体完整；课程题干仍负责说明适用投放场景 |
| 04 | [完成徽章](../../../../assets/learning-room/learning-complete-seal.png) | 浅蓝圆底、自然植物、绿圈白 check，无 XP 或共享成就符号 |
| 05 | [气候封面](../../../../assets/learning-room/waste-climate-cover.webp) | 食物纸袋左、蔬菜前景、香蕉碗右，暖中性色厨房光线 |
| 01／04 补充 | [叶片](../../../../assets/learning-room/learning-leaf-sprig.png) | 同一自然植物语言，独立透明底 |
| 中级补充 | [包装封面](../../../../assets/learning-room/packaging-recycling-cover.webp) | 清洁容器与分离部件，同一 2:1 构图与厨房摄影风格 |
| 高级补充 | [预防封面](../../../../assets/learning-room/preventing-waste-cover.webp) | 已有食材、玻璃容器、纸袋；同一 2:1 构图与厨房摄影风格 |
| SDG 13 | [英文官方图](../../../../assets/learning-room/sdg-13-climate-action-en.png)、[中文官方图](../../../../assets/learning-room/sdg-13-climate-action-zh.png) | 官方原色与完整比例；生成 mockup 的绿色略有差异，以官方原文件为准 |

核对主体／构图已通过，独立生成图片不是批准图中像素的逐点复制。透明 PNG 已有真正 alpha，P2 还需在真实浅蓝／薄荷背景中检查显示和阴影，不以本记录替代页面截图验收。

## 可读性变体

按 sRGB 相对亮度公式计算静态色值，P2 还需在设备中验证实际字体／状态。

| 组合 | 对比度 | P0 处理 |
| --- | --- | --- |
| 白字／批准橙 #F58220 | 2.59:1 | 原品牌色保留；白字 CTA 用 #BE570A |
| 白字／按钮橙 #BE570A | 4.61:1 | 基础 primaryButton 默认采用 |
| 原灰绿 #70827A／背景 | 3.90:1 | 原色保留；小字用 #64756D |
| 小字 #64756D／背景 | 4.67:1 | caption／secondary 默认采用 |
| 原绿 #2A8A61／白 | 4.28:1 | 继续用于较大 segment 字、进度、radio 和状态图形 |
| 链接绿 #237B55／背景 | 4.99:1 | 小字号绿色文字采用 |

保持背景、白表面、深绿正文、mint／sky、品牌原橙和原绿的固定值。差异已同步 VISUAL_SPEC；不影响 Fridge／Achievements 现有样式。

## 命令与实测结果

- `node scripts/prepare-learning-assets.mjs`：PASS，10 张输出，合计 **2,653,475 bytes（2.53 MiB）**。
- `node node_modules/typescript/bin/tsc --noEmit`：PASS，退出 0，无诊断。
- 运行时 10 张图片 SHA-256 与 manifest 一致：PASS。
- 运行时尺寸与 manifest 一致：PASS；4 张照片 1200×600，3 张竖向透明素材 640×960，徽章与两张 SDG 图 512×512。
- 4 张透明生成素材均保留 alpha 且非完全不透明：PASS；官网中文图虽有 alpha 通道，但官方方块图本身完全不透明，属于正常情况。
- 10 个静态 require 引用的项目文件全部存在：PASS。
- 无新增依赖；没有导入原图、整屏 mockup 或机器本地生成路径作为 App 运行时素材。

批准图 SHA-256 登记：

| 图 | SHA-256 |
| --- | --- |
| 01 | 800b8fe261760808d7640b5161719f3d00124b40907ef297d58366c14d8f41c7 |
| 02 | 38994acd7925b9575e22677b6b2f873d8113b0663e4795a96d0ff9ffcdbfb4f6 |
| 03 | 2b65ab500ac57986dae8c1cb9a7cb42a47b13a796c61a03b147c7f9d25e702a7 |
| 04 | ac1bcdd868ab5e980037fb10679959e118270cd445f74baabdc0f8058eaf9a8b |
| 05 | cd51f2d9eb1440d024a3f8b956b0f90bb96cb369760d1dad37c08b8d4d92f483 |

## 实际完成边界与下一步

没有修改 App.tsx、Home／Profile、现有动画／Bin Action、Express 或 Supabase；没有 migration、部署或 Git 提交。基础文件尚未被真实屏幕引用，不能宣称学习室已经可以打开。

下次执行 P1：双语 catalog／activity／resource 与私有 question bank schema；内容 validator；逐条制作三阶段内容和可靠来源审核，补齐两条近期新闻。P2 才建立原生屏幕，并保存五个标准情景和小屏／大字体截图。
