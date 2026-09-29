# KitchMemo 互动动画完整版

App 入口仍在主页 3D 厨房的小黑板。全屏厨房循环提供冰箱与货架热点；两条路线各有连续进入动画、动态数据页和返回动画。分支可反复选择，旁白可关闭或重播。画面不含烘焙字幕；中文与英文文字、旁白由 App 按当前语言选择。系统开启“减少动态效果”时，使用静态海报和文字。

## 预览和素材

从本目录运行 `python -m http.server 8766`，打开 `http://127.0.0.1:8766/preview.html`。浏览器页与 App 共用 `assets/` 中的视频、海报及旁白。

影片为 540 × 960、30 fps。冰箱和货架进入动画各 3.2 秒，数据页循环各 2 秒，返回动画各 0.8 秒。中英文旁白是分别生成的 WAV 文件，故事文字留在原生界面层，因此无需为每种语言复制视频。

## 重建

从项目根目录依次运行：

```powershell
C:\Python312\python.exe docs/art-direction/food-waste-animation/final-story/generate_frames.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python docs/art-direction/food-waste-animation/final-story/encode_video.py
& 'docs/art-direction/food-waste-animation/final-story/generate_narration.ps1'
```

帧生成依赖 Pillow；旁白生成依赖 Windows System.Speech 及已安装的中文、英文语音。脚本可重新生成素材，但交付时不需要保留 `.frames/`。现有旁白采用本机系统女声，语气和节奏贴近勺勺的轻柔引导；如果以后有勺勺正式配音，只需替换四个 WAV 文件。

## 数据

冰箱页使用 OzHarvest *Half Eaten* 2025 调查的估计：有 35 岁以下成员的家庭每年约丢弃 113 kg 食物，估计价值约 A$1,503。货架页的三个行为是研究提及的相关行为，并非原因排名。界面提供[研究来源](https://www.ozharvest.org/australian-household-food-waste-research/)；完整口径见[项目数据整理](../../../research/FOOD_WASTE_ANIMATION_GAME_DATA.md)。
