import { MyImageEditor } from './sdk';
export { MyImageEditor } from './sdk';
export type { EditOptions, EditResult, EditorMode, OutputType } from './sdk';

// 导出顶层方法，确保在 UMD 模式下 window.MyImageEditor.edit 即可直接调用
export const edit = MyImageEditor.edit.bind(MyImageEditor);
export const modal = MyImageEditor.modal.bind(MyImageEditor);
export const toolbar = MyImageEditor.toolbar.bind(MyImageEditor);
export const distributed = MyImageEditor.distributed.bind(MyImageEditor);

export { useImageEditorCore } from './core/useImageEditorCore';
export type { ImageEditorCore, HistoryRecord, Point, SelectionRegion } from './core/useImageEditorCore';

export { Toolbar } from './components/Toolbar';
export { CanvasWorkspace } from './components/CanvasWorkspace';
export { Sidebar } from './components/Sidebar';
export { FooterPrompt } from './components/FooterPrompt';
export { ConfirmModal } from './components/ConfirmModal';

export { ModalEditor } from './modes/ModalEditor';
export { ToolbarPopoverEditor } from './modes/ToolbarPopoverEditor';
export { DistributedEditor } from './modes/DistributedEditor';

import { SDK_VERSION, SDK_BUILD_TIME, SDK_DESCRIPTION } from './version';
export { SDK_VERSION, SDK_BUILD_TIME, SDK_DESCRIPTION };

// 自动挂载至全局 window 对象，确保在开发或模块导入模式下直接全局可用
if (typeof window !== 'undefined') {
  const globalObj = (window as any);
  // 仅 Vite 开发态（源码 ESM）才算“源码热更”；打包后的 UMD/ES 产物中 import.meta.env.DEV 恒为 false
  const isSourceBuild = !!import.meta.env.DEV;
  // 防覆盖：若源码 ESM 内核已挂载，迟到的打包产物（可能是旧版 dist）不得覆盖全局对象
  const sourceAlreadyMounted = !isSourceBuild && globalObj.__SDK_LOADED_FROM_SOURCE__ === true;

  if (sourceAlreadyMounted) {
    // UMD 包装器在执行工厂函数前会先执行 `window.MyImageEditor = {}`，此处需还原源码内核
    if (globalObj.__MY_IMAGE_EDITOR_SOURCE__) globalObj.MyImageEditor = globalObj.__MY_IMAGE_EDITOR_SOURCE__;
    console.warn(`[MyImageEditor SDK] 检测到源码内核已挂载，忽略打包产物 ${SDK_VERSION} (${SDK_BUILD_TIME}) 的全局覆盖`);
  } else {
    globalObj.MyImageEditor = MyImageEditor;
    globalObj.MyImageEditor.edit = edit;
    globalObj.MyImageEditor.modal = modal;
    globalObj.MyImageEditor.toolbar = toolbar;
    globalObj.MyImageEditor.distributed = distributed;
    globalObj.MyImageEditor.version = SDK_VERSION;
    globalObj.MyImageEditor.buildTime = SDK_BUILD_TIME;
    if (isSourceBuild) {
      globalObj.__SDK_LOADED_FROM_SOURCE__ = true;
      globalObj.__MY_IMAGE_EDITOR_SOURCE__ = MyImageEditor;
    }
    console.log(`%c[MyImageEditor SDK] 已挂载${isSourceBuild ? '源码' : '打包'}内核 %c${SDK_VERSION}%c (${SDK_BUILD_TIME})`, 'color:#2563eb;font-weight:bold;', 'background:#2563eb;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;', 'color:#64748b;');
  }
}

export default MyImageEditor;
