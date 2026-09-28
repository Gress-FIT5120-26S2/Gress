# 食物浪费互动动画

首页 3D 厨房后墙的小黑板是入口。点击后，`src/components/FoodWasteStory.tsx` 打开全屏、可回退的七幕互动故事。中文或英文文案跟随应用已保存的语言选择。数据卡片停留到用户主动继续，场景中的冰箱、食材、食物桶和社区厨房可点击；每幕也有「上一幕／下一幕」按钮。降低动态效果的系统设置会关闭图片推进动画。

| 幕 | 画面 | 操作与信息 |
| --- | --- | --- |
| 1 再次购物 | `01-shopping.png` | 点冰箱进入内部。 |
| 2 冰箱深处 | `02-forgotten.png` | 点被忘记的食材。 |
| 3 常见浪费 | `02-forgotten.png` | OzHarvest 2025 年调查：47% 的受访家庭报告丢弃蔬菜，45% 报告丢弃剩食。此处是**全体受访家庭**，不是年轻家庭专属比例。 |
| 4 丢弃 | `04-discarded.png` | 点食物桶查看年度估计。画面是教学情境，不是真实受访户记录。 |
| 5 年轻家庭 | `04-discarded.png` | OzHarvest 2025 年调查估计：有 35 岁以下成员的家庭每年丢弃约 **113 kg** 食物，价值超过 **A$1,500**。这是调查群体估计，不是画面中人物的账单。 |
| 6 全国规模 | `05-neighbourhood.png` | 2021 年全国研究估计：澳大利亚家庭每年浪费约 **250 万吨**食物，约占全国食物浪费总量的 **30%**。点亮灯的厨房进入结尾。 |
| 7 下一次购物前 | `03-next-time.png` | 先查看家中已有食物；可重播或关闭。 |

来源：[OzHarvest, *Half Eaten: Australian Household Food Waste Research* (2025)](https://www.ozharvest.org/australian-household-food-waste-research/)；[澳大利亚气候变化、能源、环境与水部：Reducing Australia’s food waste](https://www.dcceew.gov.au/environment/protection/waste/food-waste)。每张数据卡都在应用内提供直接来源链接。不同研究和统计对象的数据不相加，也不作为 KitchMemo 已减少浪费的效果证明。

`kitchmemo-food-waste-visual.mp4` 保留为旧版、无字的 36 秒连续分镜预览。互动版由图片与原生转场构成，因此可以暂停阅读、点击物件、返回上一幕；这个 MP4 不包含新增镜头或交互。当前版本仍无配音。新增的 `04-discarded.png` 和 `05-neighbourhood.png` 使用内置 imagegen 依据旧图的角色、色彩和材质生成。
