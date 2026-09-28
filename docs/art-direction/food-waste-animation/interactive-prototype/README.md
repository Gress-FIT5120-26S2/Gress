# 厨房交互动画样机

点击厨房中的冰箱进入浪费数据，返回后可点击货架进入原因分析。每条路线都有独立的进入和返回动画；厨房本身循环播放。页面文字跟随系统语言显示中文或英文。

## 体验入口

- App：主页 3D 厨房中的小黑板。
- 浏览器：在此目录运行 `python -m http.server 8765`，打开 `http://127.0.0.1:8765/preview.html`。

浏览器页和 App 使用同一组 MP4 与海报。交互、字幕和研究来源链接在各自的界面层中实现，不烘焙进视频。

## 重新生成素材

从项目根目录运行：

```powershell
python docs/art-direction/food-waste-animation/interactive-prototype/generate_assets.py
blender --background --python docs/art-direction/food-waste-animation/interactive-prototype/encode_assets.py
```

第一步需要 Pillow，第二步需要 Blender 5.2。中间帧保存在本目录的 `.frames/`，交付素材保存在 `assets/`。视频为 540 × 960、30 fps；厨房循环约 2.4 秒，每段转场约 1.5 秒。

## 数据边界

113 kg／年及约 A$1,503／年是 OzHarvest 2025 年家庭调查中“有 35 岁以下成员的家庭”的估计值，不是每个家庭的实测值。货架页列的是研究提及的相关行为，不表示年轻家庭的原因排名。详情见 [数据整理](../../../research/FOOD_WASTE_ANIMATION_GAME_DATA.md)及[原研究](https://www.ozharvest.org/australian-household-food-waste-research/)。

本版用于验证动画转场与热点导航。音效、配音、更多数据分支和正式美术素材尚未加入。
