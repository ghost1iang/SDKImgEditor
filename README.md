# MyImageEditor SDK

基于《AI图片编辑器.tsx》全量核心功能封装的**零框架依赖独立图片编辑 SDK**。
所有核心算法代码（魔棒 BFS 选色、顶点拉伸、套索、透明检测、智能修边裁切、取色涂色、旋转变换、PDF.js 高清导入、Gemini AI 重构）100% 完整保留。

宿主应用（原生 JS、Vue 2/3、React、Angular）只需引入一个打包后的 JS 文件，一行代码即可唤起并以 Promise 方式获取处理后的图片。

---

## 🌟 特性

1. **零框架依赖 (Zero Dependencies)**：
   SDK 将 React 运行时、图标库与 Tailwind CSS 全部打包进单一独立 JS 文件（UMD / ES 模块），宿主应用无需安装任何 npm 依赖即可直接运行。
2. **样式完全隔离 (Shadow DOM)**：
   默认挂载于 Shadow DOM 中，Tailwind 类名与自定义样式绝不污染原宿主应用的 CSS，也不受宿主已有 CSS 样式干扰。
3. **三大接入模式**：
   - 🪟 **新开窗口（Modal 弹窗模式）**：SDK 提供完整窗口，包含编辑历史侧边栏、工具栏、缩放工作区与 AI 重构指令栏。
   - 🎯 **原地编辑（Toolbar Popover 模式）**：直接传入页面中的 `<img>` 或 `<canvas>` 节点，SDK 自动计算坐标在其上方弹出浮动工具栏，在原图片上方原地编辑，完成后自动替换原图并返回。
   - 🧩 **分布式（Distributed 模式）**：分别在宿主工程中指定工具栏放置容器 (`toolbarContainer`) 和画布容器 (`canvasContainer`)，两者分离挂载并实时同步联动。
4. **统一 Promise 异步返回**：
   用户点击【完成】后，Promise 自动 resolve 返回新处理后的图片（支持 `Blob` / `Base64` / `HTMLCanvasElement`）。

---

## 📦 打包产物

执行构建后在 `dist/` 目录下生成：
- `dist/my-image-editor.umd.js`：适合 `<script src="...">` 直接在浏览器中引入（挂载全局对象 `window.MyImageEditor`）。
- `dist/my-image-editor.es.js`：适合现代前端工程 `import { MyImageEditor } from '...'`。
- `dist/types/`：TypeScript 完整类型声明定义。

---

## 🚀 快速上手

### 1. 原生 HTML / 浏览器直引

```html
<!-- 引入 SDK -->
<script src="./dist/my-image-editor.umd.js"></script>

<img id="my-avatar" src="avatar.png" />
<button id="edit-btn">编辑图片</button>

<script>
  document.getElementById('edit-btn').addEventListener('click', async () => {
    const imgEl = document.getElementById('my-avatar');

    // 一行代码唤起原地编辑（或弹窗编辑）：
    const newBlob = await window.MyImageEditor.edit(imgEl, {
      mode: 'toolbar', // 'modal' | 'toolbar' | 'distributed'
      outputType: 'blob'
    });

    console.log('编辑完成，获得新图片 Blob:', newBlob);
  });
</script>
```

### 2. Vue / React 工程中使用

```javascript
import { MyImageEditor } from './dist/my-image-editor.es.js';

// 在任何点击事件中调用：
const newImageBlob = await MyImageEditor.edit(targetImageElement, {
  mode: 'modal',       // 'modal'（弹窗编辑） 或 'toolbar'（直接吸附在目标图片旁弹出工具栏）
  outputType: 'blob',  // 'blob' | 'base64' | 'canvas'
  autoUpdateTarget: true, // 自动把新图赋值给 targetImageElement.src
});

// 或者手动更新：
targetImageElement.src = URL.createObjectURL(newImageBlob);
```

---

## 📖 三大接入模式详解

### 模式一：新开窗口（Modal）
```javascript
const resultBlob = await MyImageEditor.edit(sourceImage, {
  mode: 'modal',
  outputType: 'blob'
});
```
- 打开一个全屏半透明遮罩的模态窗口。
- 包含左侧历史记录列表、顶部所有编辑工具、中央缩放平移画布、底部 AI 指令输入栏。
- 顶部右侧提供绿色的【完成】按钮与【取消】按钮。

### 模式二：原地编辑（Toolbar Popover）
```javascript
const resultBlob = await MyImageEditor.edit(document.getElementById('my-image'), {
  mode: 'toolbar',
  autoUpdateTarget: true // 完成后原地自动将新图片赋值给 my-image.src
});
```
- 工具栏以浮动卡片（Popover Toolbar）形式吸附在目标图片上方。
- 在目标图片上方覆盖轻量交互层，可直接进行魔棒选色、矩形修边、套索、吸管取色、涂色填充、四角拉伸与旋转。
- 点击工具栏【完成】后自动更新原图并 resolve 返回。

### 模式三：分布式（Distributed）
```javascript
const resultBlob = await MyImageEditor.edit(sourceImage, {
  mode: 'distributed',
  toolbarContainer: '#my-toolbar-slot', // 宿主界面中工具栏挂载节点或选择器
  canvasContainer: '#my-canvas-slot',   // 宿主界面中画布挂载节点或选择器
});
```
- SDK 将工具栏渲染到 `toolbarContainer`，画布渲染到 `canvasContainer`。
- 状态与操作完全同步联动。

---

## 🛠 API 配置项 `EditOptions`

| 参数名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `mode` | `'modal' \| 'toolbar' \| 'distributed'` | `'modal'` | 编辑器模式 |
| `outputType` | `'blob' \| 'base64' \| 'canvas'` | `'blob'` | 完成后的返回值类型 |
| `autoUpdateTarget` | `boolean` | `true` | 若传入目标为 `HTMLImageElement`，是否自动将新图写入其 `src` |
| `toolbarContainer` | `HTMLElement \| string` | `undefined` | 分布式模式：工具栏放置容器或选择器 |
| `canvasContainer` | `HTMLElement \| string` | `undefined` | 分布式模式：画布放置容器或选择器 |
| `apiKey` | `string` | `""` | 可选 Gemini API Key（支持 AI 图像重构） |
| `useShadowDOM` | `boolean` | `true` | 是否使用 Shadow DOM 进行样式隔离 |
| `rejectOnCancel` | `boolean` | `true` | 用户点击取消时是否 reject Promise |
| `onComplete` | `(result) => void` | `undefined` | 完成编辑的回调函数 |
| `onCancel` | `() => void` | `undefined` | 取消编辑的回调函数 |

---

## 💻 本地演示与构建

- **启动本地演示服务**：
  ```bash
  npm run dev
  ```
  然后在浏览器中打开 `http://localhost:5173` 体验演示页面。

- **重新构建 SDK 单文件**：
  ```bash
  npm run build
  ```
