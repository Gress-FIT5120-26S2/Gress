# Learning Room 独立素材来源

制作／核对：2026-10-05，P0。原始文件保存在 originals/；App 只引用该目录上层的运行时版本。共 10 张运行时图片、约 2.53 MiB。

## 生成素材

8 张原创应用素材使用内置 image_gen 工具，以用户批准的 app-palette-v2 效果图为构图／风格参考。不是从手机 mockup 裁图；没有 UI、品牌、新闻文字或统计数字。独立图片用于插图，不是事实来源，不保证真实商品的材料或回收资格。

完整逐张提示词、参考图和原始生成文件名在 [GENERATION_PROMPTS.json](GENERATION_PROMPTS.json)；尺寸、透明性、原图及运行时 SHA-256 在 [ASSET_MANIFEST.json](ASSET_MANIFEST.json)。来源为本项目生成输出，没有第三方图库许可声明；不得误标 CC0 或联合国素材。

| 文件 | 构图／用途 | 基准 |
| --- | --- | --- |
| waste-basics-still-life.png | 纸盒、银罐、番茄、叶片；首页 hero | 01 |
| waste-basics-course-cover.webp | 食物／包装厨房静物；初级课程封面 | 02 |
| empty-aluminium-can.png | 无品牌空铝罐；标准 Quiz 题图 | 03 |
| learning-complete-seal.png | 浅蓝植物环与 check；学习完成 | 04 |
| waste-climate-cover.webp | 食物纸袋与蔬菜；气候阅读 | 05 |
| learning-leaf-sprig.png | 独立植物点缀；SDG teaser／resume note | 01 |
| packaging-recycling-cover.webp | 分离后的包装容器；中级封面／缩略图 | 同 02 摄影体系 |
| preventing-waste-cover.webp | 已有食材与玻璃容器；高级封面／缩略图 | 同 05 摄影体系 |

原图透明 alpha 已验证；黑色不是图片背景，是透明内容在部分预览中的显示底。prepare 脚本只按比例缩放、PNG 无损编码／照片 WebP 编码，不裁剪、改色、重新绘制或更换主体。

## 联合国官方 SDG 13

- [联合国官方英文素材页](https://www.un.org/sustainabledevelopment/news/communications-material/)
- [英文官方下载包](https://www.un.org/sustainabledevelopment/wp-content/uploads/2020/10/Goal-13.zip)，提取 `Goal 13/E_WEB_13.png`。
- 下载包 SHA-256：`c7a53469d8aff8e3bf3ddd8d9a92ecba6732d5ab73d77e65c437b95c1165bc44`。包含大量无关印刷／动画资料，仅提取所需 PNG，不将整个包作为运行时依赖。
- [联合国官方中文素材页](https://www.un.org/sustainabledevelopment/zh/news/communications-material/)
- [中文官方 PNG](https://www.un.org/sustainabledevelopment/zh/wp-content/uploads/sites/6/2019/09/C-WEB-Goal-13.png)
- [官方 SDG 使用指引（2023）](https://www.un.org/sustainabledevelopment/wp-content/uploads/2023/09/E_SDG_Guidelines_Sep20238.pdf)

官方图标适用 UN SDG 使用指引，**不是 CC0**。本功能用途为 waste／气候教育的说明性内容。图标不改色、不伸缩、不拆出数字或重绘地球符号，不用联合国徽记版本，不做 App 官方认证／广告标记。原始颜色与批准生成图的轻微色差以官方原文件为准。

实施阅读页时，在来源区使用 `learningSdgAttribution` 中的官方声明与 UN 链接；来源区可自然滚动，不塞进主标题。若以后用于商业推广或募资，需按官方规则另行处理；本次没有发送任何许可申请。

## 复用的已有资源

- `assets/waste-bins/`：沿用该目录 [SOURCE.md](../waste-bins/SOURCE.md) 的 CC0 原模型出处；图仅是教学视觉，不能据桶颜色推出本地规则。
- `assets/story/food-waste/`：沿用现有视频／poster／timeline，不在此复制大视频。
- SDG 框以外的小型 UI 图标继续使用已有 @expo/vector-icons，不生成整屏 UI 图。

## 重建运行时资产

在仓库根执行 `node scripts/prepare-learning-assets.mjs`。依赖现有 sharp，无新增依赖或网络请求；原始 PNG 必须已经存在。输出 manifest 与静态 assetKey 映射互相核对后接入原生页面。
