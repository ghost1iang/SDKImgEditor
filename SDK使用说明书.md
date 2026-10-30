# TiamoImageEditor SDK 说明书

本说明书详细介绍 **TiamoImageEditor SDK** 的系统架构、实现原理、功能特性、配置参数及在不同前端框架下的接入实践。

---

## 目录
1. [系统架构与实现原理](#1-系统架构与实现原理)
2. [主要功能特性](#2-主要功能特性)
3. [SDK 参数配置表](#3-sdk-参数配置表)
4. [三大接入方式详解与代码示例](#4-三大接入方式详解与代码示例)
   - [4.1 模式一：新开窗口（Modal）](#41-模式一新开窗口modal)
   - [4.2 模式二：原地编辑（Toolbar Popover）](#42-模式二原地编辑toolbar-popover)
   - [4.3 模式三：分布式（Distributed）](#43-模式三分布式distributed)
5. [常见前端框架快速接入 (Vue 3 / React)](#5-常见前端框架快速接入-vue-3--react)
6. [快捷静态方法一览](#6-快捷静态方法一览)
7. [最近版本演进与关键变更记录 (Change Log)](#7-最近版本演进与关键变更记录-change-log)

---

## 1. 系统架构与实现原理

TiamoImageEditor SDK 旨在将复杂的图像编辑组件转变为一个**零依赖、低耦合、即插即用**的现代 JavaScript 库。

### 1.1 零框架依赖独立单文件打包
- **内置完整运行时**：打包配置使用 Vite 与 Rollup，将 React 18 运行时、ReactDOM、Lucide 图标组件库以及编译后的 Tailwind CSS 样式全部静态打包进单文件（`dist/tiamo-image-editor.umd.js` 与 `dist/tiamo-image-editor.es.js`）。
- **外部零安装**：无论是无框架的原生 HTML 页面，还是使用 Vue 2/3、Angular、Svelte、React 的项目，均**无需在 package.json 中安装任何额外依赖**，直接引入即可调用。

### 1.2 样式隔离 (Shadow DOM 沙箱)
- **隔离机制**：SDK 唤起时会动态在宿主页面创建挂载宿主容器，并调用 `host.attachShadow({ mode: 'open' })` 开启影子根节点。
- **双向无干扰**：SDK 内置的 Tailwind 工具类与定制样式只在当前 Shadow DOM 生效，不会污染宿主应用的全局 CSS；同时宿主应用的 CSS 规则也不会破坏编辑器的 UI 排版与布局。

### 1.3 Promise 异步闭环工作流
- 整个编辑过程被封装为一个标准异步函数：`const result = await TiamoImageEditor.edit(target, options);`。
- 用户操作完成后，点击右上角绿色的【完成】按钮，SDK 内部捕获当前最新的高分辨率 Canvas 数据，自动将其转换为用户指定的格式（`Blob`、`Base64` 或 `HTMLCanvasElement`）并触发 Promise 的 `resolve`。
- 完成或取消时，SDK 自动清理 Shadow DOM 与监听器，释放内存，保证宿主页面无 DOM 残留。

### 1.4 算法代码保真机制
- 根目录下的 `AI图片编辑器.tsx` 所有算法与功能代码一个字符都未变动。
- 图像算法引擎（魔棒 BFS 选区扫描、四角透视顶点剪裁、智能修边 Alpha 扫描、任意角度旋转外接矩形矩阵重算等）均以高保真形式在 SDK 中完全运行。

---

## 2. 主要功能特性

SDK 拥有全套专业图像处理与 AI 能力：

| 功能模块 | 对应工具图标/操作 | 说明 |
| :--- | :--- | :--- |
| **矩形选区** | `Square` | 可在画布上框选任意矩形，支持四角控制点二次缩放拖拽。 |
| **套索选区** | `Pencil` | 鼠标手绘闭合路径，自动生成多边形遮罩与高亮提示。 |
| **反转选区** | `FlipHorizontal` | 一键反转当前选区范围，实现内外像素的快速反转保护。 |
| **透明检测** | `Eye` | 切换透明区域检测底纹（红白点阵），精准识别 Alpha 通道。 |
| **智能魔棒** | `Wand2` + `Eraser` | 支持**全屏色彩匹配**与**连通区域 BFS 漫水填充**两种模式；容差度可在 1~255 范围内精确平滑调节。**内置全色相智能去溢色算法（Universal De-spill）**，擦除时默认自动消除背景杂色光，无需手动切换。 |
| **智能修边** | `Crop` | 自动扫描图像中非透明像素的外接边界框，智能去多余留白。 |
| **顶点拉伸** | `LandPlot` | 激活图像四角 4 个控制锚点，支持自由不规则透视剪裁与拉伸（按住 Shift/Cmd 可锁定水平/垂直轴）。 |
| **吸管取色** | `Pipette` | 实时拾取画布任意坐标的像素 RGB 并转为十六进制色值。 |
| **选区着色** | `PaintBucket` | 将当前吸管选中的色彩批量填充到魔棒选区或矩形闭合区域内。 |
| **镜像翻转** | `FlipHorizontal2` / `FlipVertical2` | 支持水平镜像与垂直镜像一键对称翻转。 |
| **快捷90°旋转** | `RotateCcw` / `RotateCw` | 逆时针 90° 与顺时针 90° 一键正角旋转。 |
| **自由旋转校正** | `Compass` | **全新重构的高级毛玻璃浮窗面板**（自适应浅色/深色主题），支持 -180°~+180° 滑块平滑无级调节、精确度数输入、`[-1°]` / `[+1°]` 摄影级细微校平步进、常用刻度快捷直达，画布实时同步旋转预览。 |
| **工具栏设置** | `Settings` | **全新工具栏按钮自定义浮窗**：点击展开自适应分类浮窗，支持勾选实时显隐任意按钮、快捷一键推荐/纯抠图/清空/全选，随心裁剪界面元素。 |
| **PDF 导入** | 文件上传选择 | 动态按需加载 PDF.js 解析引擎，将 PDF 第一页按 2x 高清视口渲染转换为编辑画布。 |
| **AI 图像重构** | 底部 Prompt 输入框 | 接入 Gemini 2.5 Flash Image Preview 接口，支持输入文本指令进行图像结构化修改与重构。 |
| **历史版本栈** | 左侧折叠边栏 | 记录每一次编辑操作快照与缩略图，支持回滚并提供新分支开启确认弹窗。 |
| **视口手势控制**| 缩放/平移 | 空格键（Space）抓手拖拽平移，50%~500% 缩放，双击或点击重置回到居中视图。 |

---

## 3. SDK 参数配置表

调用方法：`TiamoImageEditor.edit(targetOrSource, options)`

### 3.1 入参 `targetOrSource`
| 参数类型 | 示例 | 说明 |
| :--- | :--- | :--- |
| `HTMLImageElement` | `document.getElementById('tiamo-img')` | 目标图片节点（原地模式必传，完成后可自动更新该节点） |
| `HTMLCanvasElement` | `canvasNode` | 目标 Canvas 画布 |
| `string` | `'https://example.com/a.png'` 或 `data:image/png;base64,...` | 图片 URL 或 Base64 编码字符串 |
| `Blob` / `File` | `fileInput.files[0]` | 本地文件对象 |
| `null` / `undefined` | `null` | 空开画布，呈现文件上传与导入指引 |

### 3.2 配置对象 `options`
| **`visibleTools`** | `ToolbarToolId[]` | `undefined` (全显) | 全模式 | **按钮白名单**：指定工具栏默认仅显示哪些按钮（如 `['rect', 'wand', 'erase', 'settings']`） |
| **`hiddenTools`** | `ToolbarToolId[]` | `undefined` | 全模式 | **按钮黑名单**：指定工具栏默认隐藏哪些按钮（如 `['quad', 'pipette']`） |
| **`tools`** | `ToolbarToolId[] \| Record<string, boolean>` | `undefined` | 全模式 | **按钮灵活配置**：支持传入 ID 数组或布尔字典（如 `{ quad: false, lasso: false }`） |
| **`mode`** | `'modal' \| 'toolbar' \| 'distributed'` | `'modal'` | 全模式 | **核心模式**：`modal` (新开窗口)、`toolbar` (原地吸附)、`distributed` (分布式) |
| **`outputType`** | `'blob' \| 'base64' \| 'canvas'` | `'blob'` | 全模式 | 用户点击【完成】后 Promise 返回的图片格式 |
| **`autoUpdateTarget`** | `boolean` | `true` | `toolbar` / `modal` | 当传入目标为 `HTMLImageElement` 时，是否自动把处理后的新图赋给其 `.src` |
| **`toolbarContainer`**| `string \| HTMLElement` | `undefined` | `distributed` | 分布式模式：宿主工程中**工具栏**的挂载插槽节点或 CSS 选择器 |
| **`canvasContainer`** | `string \| HTMLElement` | `undefined` | `distributed` | 分布式模式：宿主工程中**画布工作区**的挂载插槽节点或 CSS 选择器 |
| **`useShadowDOM`** | `boolean` | `true` | `modal` / `toolbar` | 是否开启 Shadow DOM 样式隔离沙箱 |
| **`apiKey`** | `string` | `""` | 全模式 | 可选 Gemini API Key，用于执行 AI 重构功能 |
| **`rejectOnCancel`** | `boolean` | `true` | 全模式 | 用户点击【取消】时，Promise 是否抛出错误（若设为 `false` 则 resolve `null`） |
| **`onComplete`** | `(res) => void` | `undefined` | 全模式 | 编辑完成时的回调通知函数 |
| **`onCancel`** | `() => void` | `undefined` | 全模式 | 编辑取消时的回调通知函数 |

### 3.3 可配置工具栏按钮 ID 清单 (`ToolbarToolId`)
SDK 支持对工具栏的 **22 个功能按钮** 进行细粒度配置与按需裁剪：

| 分类 | 按钮 ID (`ToolbarToolId`) | 按钮名称 | 说明 |
| :--- | :--- | :--- | :--- |
| **选区工具** | `rect` | 矩形范围 | 矩形框选与四角二次缩放 |
| | `cropAuto` | 智能修边 | 自动扫描最小非透明像素外接框 |
| | `lasso` | 索套范围 | 鼠标手绘闭合不规则选区 |
| | `quad` | 多边范围 | 连线闭合多边形与顶点透视拉伸剪裁 |
| | `invert` | 反选选区 | 一键反转选区范围 |
| | `clear` | 清除选区 | 清空当前所有活动选区 |
| **魔棒抠图** | `alphaMask` | 透明检测 | 切换红白点阵 Alpha 底纹 |
| | `wand` | 魔棒选色 | 点击画面自动选取同类色彩 |
| | `wandMode` | 选色模式 | 切换全屏色彩匹配 vs 连通区域漫水 |
| | `tolerance` | 容差调节 | 1~255 平滑调节魔棒选色容差度滑块 |
| | `erase` | 橡皮擦除 | 一键扣除魔棒已选中的颜色像素（内置去溢色） |
| **色彩吸管** | `colorPicker` | 调色板 | 选择着色填充的目标色彩 |
| | `pipette` | 吸管取色 | 拾取画布任意像素十六进制颜色 |
| **选区操作** | `crop` | 按区剪裁 | 将画面剪裁至当前选区范围 |
| | `fill` | 选区着色 | 向选区内批量填充调色板颜色 |
| **旋转镜像** | `flipH` | 水平镜像 | 水平左右对称翻转 |
| | `flipV` | 垂直镜像 | 垂直上下对称翻转 |
| | `rotateCcw` | 逆时针90° | 向左旋转 90 度 |
| | `rotateCw` | 顺时针90° | 向右旋转 90 度 |
| | `rotateAny` | 自由旋转 | 精确度数输入与无级滑块旋转浮窗 |
| **辅助功能** | `download` | 保存下载 | 直接将当前图像保存至本地 |
| | `upload` | 重新上传 | 重新选择本地图片或导入 PDF（仅非吸附模式） |
| | `settings` | 工具栏设置 | 点击呼出按钮自定义显隐设置浮窗 |

---

## 4. 三大接入方式详解与代码示例

### 4.1 模式一：新开窗口（Modal）
> **特点**：全功能独立弹窗。SDK 完整提供历史记录列表、顶部工具栏、居中缩放画布与底部 AI 对话框。最适合独立的修图流程。

```html
<button id="btn-modal">弹窗编辑图片</button>
<img id="tiamo-pic" src="avatar.png" width="200" />

<script src="./dist/tiamo-image-editor.umd.js"></script>
<script>
  document.getElementById('btn-modal').addEventListener('click', async () => {
    try {
      // 唤起全屏弹窗编辑：
      const newBlob = await window.TiamoImageEditor.edit(document.getElementById('tiamo-pic'), {
        mode: 'modal',
        outputType: 'blob',
        apiKey: 'YOUR_GEMINI_API_KEY', // 可选
      });
      console.log('编辑完成，获得 Blob 对象:', newBlob);
    } catch (e) {
      console.log('用户取消了编辑');
    }
  });
</script>
```

---

### 4.2 模式二：原地编辑（Toolbar Popover）
> **特点**：直接定位在传入的目标 `<img>` 或 `<canvas>` 节点上方，自动计算并吸附弹出浮动工具栏，且在目标元素上方覆盖一层微交互画布，用户无需离开当前页面上下文即可原地魔棒抠图、剪裁、着色或拉伸，点击【完成】后原图即刻原地更新。

```html
<div style="margin: 60px auto; width: 320px;">
  <img id="target-photo" src="product.jpg" style="width: 100%; border-radius: 8px;" />
  <button id="btn-inplace" style="margin-top: 10px;">吸附工具栏原地编辑</button>
</div>

<script src="./dist/tiamo-image-editor.umd.js"></script>
<script>
  document.getElementById('btn-inplace').addEventListener('click', async () => {
    const imgEl = document.getElementById('target-photo');

    // 原地弹出浮动工具栏编辑：
    const newImageBlob = await window.TiamoImageEditor.edit(imgEl, {
      mode: 'toolbar',
      autoUpdateTarget: true, // 核心属性：完成后自动更新 imgEl.src
      outputType: 'blob'
    });

    console.log('原地编辑成功！');
  });
</script>
```

---

### 4.3 模式三：分布式（Distributed）
> **特点**：用于与宿主现有工程的复杂界面布局深度融合。宿主工程可以自己定义工具栏放在页面的哪个位置（如左侧固定栏、顶部固定导航栏），画布放在哪个区域（如中央主视图），SDK 将工具栏和画布分别传送挂载到两个容器中，两者底层共享同一份实时响应式数据流。

```html
<!-- 宿主界面自行排版的两个容器 -->
<div class="custom-layout">
  <div id="slot-toolbar" style="height: 48px; border: 1px solid #ccc; border-radius: 8px;">
    <!-- SDK 工具栏将被渲染在此处 -->
  </div>

  <div id="slot-canvas" style="height: 500px; margin-top: 12px; border: 1px solid #ccc;">
    <!-- SDK 画布将被渲染在此处 -->
  </div>
</div>

<button id="btn-mount-dist">将编辑器挂载到预设布局</button>

<script src="./dist/tiamo-image-editor.umd.js"></script>
<script>
  document.getElementById('btn-mount-dist').addEventListener('click', async () => {
    const result = await window.TiamoImageEditor.edit('https://example.com/banner.png', {
      mode: 'distributed',
      toolbarContainer: '#slot-toolbar', // 指定工具栏容器
      canvasContainer: '#slot-canvas',   // 指定画布容器
      outputType: 'base64'
    });

    console.log('分布式编辑完成，Base64 数据:', result);
  });
</script>
```

---

## 5. 常见前端框架快速接入 (Vue 3 / React)

### 5.1 Vue 3 接入示例
```vue
<template>
  <div class="user-profile">
    <img ref="avatarRef" :src="avatarUrl" class="avatar-preview" />
    <div class="actions">
      <button @click="editInModal">弹窗编辑</button>
      <button @click="editInPlace">原地吸附编辑</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { TiamoImageEditor } from 'tiamo-image-editor-sdk'; // 或从本地 dist 引入

const avatarUrl = ref('/images/default-avatar.png');
const avatarRef = ref(null);

// 方式 1：新开窗口弹窗编辑
const editInModal = async () => {
  try {
    const blob = await TiamoImageEditor.edit(avatarUrl.value, {
      mode: 'modal',
      outputType: 'blob'
    });
    avatarUrl.value = URL.createObjectURL(blob);
  } catch (err) {
    console.log('用户取消操作');
  }
};

// 方式 2：原地吸附浮动工具栏编辑
const editInPlace = async () => {
  if (!avatarRef.value) return;
  await TiamoImageEditor.edit(avatarRef.value, {
    mode: 'toolbar',
    autoUpdateTarget: true, // 自动同步更新 DOM 节点的 src
  });
};
</script>
```

### 5.2 React 接入示例
```tsx
import React, { useRef, useState } from 'react';
import { TiamoImageEditor } from 'tiamo-image-editor-sdk';

export function ImageUploader() {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState('/demo.jpg');

  const handleInplaceEdit = async () => {
    if (!imgRef.current) return;
    try {
      const resultBlob = await TiamoImageEditor.edit(imgRef.current, {
        mode: 'toolbar',
        outputType: 'blob',
        autoUpdateTarget: true,
      });
      // 如果需要同步 React 状态：
      setImgSrc(URL.createObjectURL(resultBlob as Blob));
    } catch {
      // 用户取消
    }
  };

  return (
    <div>
      <img ref={imgRef} src={imgSrc} alt="Preview" style={{ width: 300, height: 200 }} />
      <button onClick={handleInplaceEdit}>原地编辑此图</button>
    </div>
  );
}
```

---

## 6. 快捷静态方法一览

为了让代码更语义化，SDK 提供了除 `.edit()` 外的静态捷径方法：

```javascript
// 1. 快捷弹窗模式
TiamoImageEditor.modal(imageSource, { outputType: 'blob' });

// 2. 快捷原地吸附模式
TiamoImageEditor.toolbar(targetImageElement, { autoUpdateTarget: true });

// 3. 快捷分布式模式
TiamoImageEditor.distributed(toolbarSlotNode, canvasSlotNode, imageSource, options);
```

---

## 7. 最近版本演进与关键变更记录 (Change Log)

### v1.5.0 (当前版本)
- **🛠️ 工具栏定制设置系统 (Toolbar Customization & Visibility)**：
  - **工具栏内置设置浮窗 (运行时交互)**：工具栏新增【工具栏设置】按钮（齿轮图标），点击弹出高质感自适应毛玻璃浮窗，提供 22 个按钮的分类独立开关、一键推荐/纯抠图/几何/清空/全选预设，勾选实时生效；
  - **参数化显隐配置 (接入前控制)**：SDK 新增 `visibleTools`（白名单）、`hiddenTools`（黑名单）和 `tools`（对象字典或数组）参数，方便宿主工程在唤起前定制裁剪特定按钮；
  - **本地体验与测试工作台**：在 `index.html` 增加专用的“工具栏按钮显示配置测试”卡片，包含快捷预设方案与 22 个工具的复选框，让开发者在接入 SDK 前即可直接测试不同配置组合的效果。
- **🏷️ 全局品牌命名统一为 TiamoImageEditor**：
  - 全局命名空间、类名、导出名及文档全量规范统一为 `TiamoImageEditor` 与 `tiamo-image-editor`。

### v1.4.2
- **🚀 旋转浮窗架构彻底重构 (Rotation Popover)**：
  - **根治裁剪问题**：将浮窗从工具栏内部子容器移至工具栏根容器渲染，彻底解决在 `overflow-x-auto` 下被截断截胡的顽疾。
  - **剔除冗余代码**：彻底删除 240+ 行晦涩脆弱的 SVG 罗盘圆盘算法、三角函数计算与全局事件监听；
  - **杜绝 Portal 样式脱离**：坚决不向 `document.body` 跨 Shadow DOM 进行 Portal 挂载，完全保留在组件树内，100% 享受 ShadowRoot 内的高质感样式；
  - **交互与功能丰富**：支持数值精准键盘打字输入、`[-1°]` / `[+1°]` 极细粒度校平步进、无级滑动条（-180°~+180°）、快捷刻度跳转与中心指示小指针。
- **🎨 界面配色升级（自适应浅色毛玻璃）**：
  - 彻底废除突兀的暗黑色硬编码配色；
  - 在全屏弹窗与分布式白底工具栏下，自动应用**现代高质感浅色毛玻璃**（`bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl`），与编辑器主体清爽风格浑然一体；
  - 在吸附工具栏（`isCompact`）深色胶囊条下，保持深色主题自适应。
- **✨ 智能去色边全自动化 (Zero-Click De-spill)**：
  - 从工具栏中移除多余独立的“去色边”按钮，为工具栏释放大量横向排版空间；
  - 在魔棒抠图擦除算法中，**默认 100% 全自动开启全色相智能去溢色算法**，擦除时后台自动净化边缘残留杂光，无需用户手动寻找或开启开关。
- **⚡ 编译与热更死锁根治**：
  - 修复 `vite.config.ts` 中全局注入 `process.env.NODE_ENV=production` 导致本地开发环境 React Refresh 崩溃的致命缺陷，改为仅在 `build` 生产打包时注入；
  - 修复 `index.html` 的模块入口加载机制，采用标准的静态 ESM 入口，让 Vite 自动保障 React Refresh Preamble 依赖链。
- **📦 版本统一收敛**：
  - 全局版本号收敛至 `src/version.ts` 单一信任源，彻底杜绝多处硬编码版本号相互覆盖的问题。
