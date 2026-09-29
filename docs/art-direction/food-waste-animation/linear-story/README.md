# 60 秒线性动画

`timeline.json` 是双语屏幕文字和时间码的编辑源；`preview.html` 是可拖动的低保真 animatic。`kitchmemo-food-waste-linear-60s.mp4` 是 App 使用的无字无音母版，`poster.png` 是视频首帧加载海报。App 入口是首页 3D 厨房小黑板，播放器实现位于 `src/components/LinearFoodWasteStory.tsx`。

从 `docs/art-direction/food-waste-animation/` 运行：

```powershell
C:\Python312\python.exe -m http.server 8767
```

然后打开 `http://127.0.0.1:8767/linear-story/preview.html`。预览支持中文／英文切换、暂停、重播和拖动。完整镜头意图与数据口径见 [`LINEAR_STORYBOARD.md`](../LINEAR_STORYBOARD.md)。

## 重建母版

从项目根目录运行：

```powershell
C:\Python312\python.exe docs/art-direction/food-waste-animation/linear-story/render_master.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python docs/art-direction/food-waste-animation/linear-story/encode_master.py
```

第一步需要 Pillow；第二步用 Blender 内置 FFmpeg 编码。前 150 帧通过已确认的 `proof-5s/generate_proof.py` 重建并移除固定标题与时间码，其后 1650 帧由本目录脚本生成。中间帧位于被 Git 忽略的 `.frames/`，不需提交。

## 当前验收范围

已完成母版导出、TypeScript 检查和 Expo Android／iOS Metro 静态导出（本地 Windows 沙箱无法启动 Hermes 编译器，导出检查使用 `--no-bytecode`）。还需在至少一台 iOS 与一台 Android 真机核对：首帧加载、长时间播放、文字阅读、暂停与拖动同步、前后台切换、降低动态效果、错误重试，以及从 3D 小黑板反复打开和关闭的内存表现。未测量的性能目标不算已达成。
