# App 资源与文档边界

App 运行时要使用的本地文件统一放在项目根目录的 `assets/`，并由 Git 跟踪：

```text
assets/
├── *.png                         # App 图标、角色图与共享冰箱图片
├── achievements/                 # 成就页运行时图片
├── models/                       # App 加载的 GLB 模型
│   └── achievements/
└── story/food-waste/             # 正式动画视频、海报与双语时间码
```

`src/` 存放应用代码；`src/assets/kitchenModel.ts` 和 `spoonieModel.ts` 只是模型引用入口，不存放二进制模型。`models/` 存放 Blender 工程和源素材，`docs/` 存放说明、分镜、预览及生成脚本。需要保留的模型源文件及说明文档由 Git 跟踪，但 `.easignore` 将这两个目录排除在 EAS 构建上传之外。

新增本地素材时，将运行时版本放进 `assets/`，在代码中使用静态 `require()` 引用；需在原生包内预置的资源另写入 `app.json` 的 `expo-asset` 列表。设计源文件和交接说明放在 `docs/` 或模型工程目录。动画重建脚本直接把正式母版输出到 `assets/story/food-waste/`。
