import { TiamoImageEditor, MyImageEditor } from './sdk';
export { TiamoImageEditor, MyImageEditor } from './sdk';
export type { EditOptions, EditResult, EditorMode, OutputType } from './sdk';

// 导出顶层方法，确保在 UMD 模式下 window.TiamoImageEditor.edit 即可直接调用
export const edit = TiamoImageEditor.edit.bind(TiamoImageEditor);
export const modal = TiamoImageEditor.modal.bind(TiamoImageEditor);
export const toolbar = TiamoImageEditor.toolbar.bind(TiamoImageEditor);
export const distributed = TiamoImageEditor.distributed.bind(TiamoImageEditor);

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
  // 防覆盖：若源码 ESM 内核已挂载，迟到的打包产物不得覆盖全局对象
  const sourceAlreadyMounted = !isSourceBuild && globalObj.__SDK_LOADED_FROM_SOURCE__ === true;

  if (sourceAlreadyMounted) {
    if (globalObj.__TIAMO_IMAGE_EDITOR_SOURCE__) {
      globalObj.TiamoImageEditor = globalObj.__TIAMO_IMAGE_EDITOR_SOURCE__;
      globalObj.MyImageEditor = globalObj.__TIAMO_IMAGE_EDITOR_SOURCE__;
    }
    console.warn(`[TiamoImageEditor SDK] 检测到源码内核已挂载，忽略打包产物 ${SDK_VERSION} (${SDK_BUILD_TIME}) 的全局覆盖`);
  } else {
    // 挂载 TiamoImageEditor 主命名空间
    globalObj.TiamoImageEditor = TiamoImageEditor;
    globalObj.TiamoImageEditor.edit = edit;
    globalObj.TiamoImageEditor.modal = modal;
    globalObj.TiamoImageEditor.toolbar = toolbar;
    globalObj.TiamoImageEditor.distributed = distributed;
    globalObj.TiamoImageEditor.version = SDK_VERSION;
    globalObj.TiamoImageEditor.buildTime = SDK_BUILD_TIME;

    // 同时向后兼容 MyImageEditor 引用
    globalObj.MyImageEditor = globalObj.TiamoImageEditor;

    if (isSourceBuild) {
      globalObj.__SDK_LOADED_FROM_SOURCE__ = true;
      globalObj.__TIAMO_IMAGE_EDITOR_SOURCE__ = TiamoImageEditor;
    }
    console.log(`%c[TiamoImageEditor SDK] 已挂载${isSourceBuild ? '源码' : '打包'}内核 %c${SDK_VERSION}%c (${SDK_BUILD_TIME})`, 'color:#2563eb;font-weight:bold;', 'background:#2563eb;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;', 'color:#64748b;');
  }
}

export default TiamoImageEditor;
