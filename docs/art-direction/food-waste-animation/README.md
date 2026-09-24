# 食物浪费动画：本地化预演

`kitchmemo-food-waste-visual.mp4` 是 36 秒、720 × 1280、24 fps 的无字竖屏分镜预演。三张概念图通过镜头推进和交叉渐变连接；目前没有配音或音乐。

应用在首页 3D 厨房的后墙台面上方放置可点击的小黑板，点击后打开全屏动画。`src/components/FoodWasteStory.tsx` 根据已保存的应用语言（中文或英文）和播放时间显示字幕、113 kg 数据卡片及来源。语言在「我的」页面更改后，重播短片就会显示对应语言；若播放时语言状态发生改变，文字也会直接更新。无字 MP4 本身没有固定语言。

## 镜头顺序

1. 下班后再次买入食材。
2. 冰箱深处仍有上次的食物。
3. 展示 OzHarvest 2025 调查中有 35 岁以下成员的家庭每年约丢弃 113 kg 食物的估计。
4. 下一次购物前先查看冰箱。

统计来源：OzHarvest, *Half Eaten: Australian Household Food Waste Research* (2025), https://www.ozharvest.org/app/uploads/2025/08/Half-Eaten-Australian-Household-Food-Waste-Research-Report-2025.pdf 。画面中的人物和食材属于教学情境，不是单个家庭的真实记录。

## 再生成

用 Blender 5.2 执行 `blender -b -noaudio --python render_animatic.py`。字幕文案与时间点在 `src/components/FoodWasteStory.tsx` 中维护，不应再烘进视频。

正式短片仍需确定 Spoonie 音色并录制中英文配音；配音也应随应用语言选择。若改用参考图视频生成，三张概念图可分别作为镜头起始帧，并逐镜头检查角色、食材和冰箱的一致性。
