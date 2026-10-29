import React, { useState, useEffect, useRef } from 'react';
import { useImageEditorCore, CoreOptions } from '../core/useImageEditorCore';
import { Toolbar } from '../components/Toolbar';
import { ConfirmModal } from '../components/ConfirmModal';
import { Loader2 } from 'lucide-react';

export interface ToolbarPopoverEditorProps extends CoreOptions {
  targetElement: HTMLElement;
  onFinish?: () => void;
  onCancel?: () => void;
}

export const ToolbarPopoverEditor: React.FC<ToolbarPopoverEditorProps> = (props) => {
  const { targetElement } = props;
  const core = useImageEditorCore(props);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // 更新目标元素的位置与尺寸
  const updateRect = () => {
    if (targetElement) {
      setTargetRect(targetElement.getBoundingClientRect());
    }
  };

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [targetElement]);

  // 如果初始未设置图片且目标是 <img> 或 <canvas>，自动加载
  useEffect(() => {
    if (!core.currentImage && targetElement) {
      if (targetElement instanceof HTMLImageElement && targetElement.src) {
        core.loadImageSource(targetElement.src);
      } else if (targetElement instanceof HTMLCanvasElement) {
        core.loadImageSource(targetElement.toDataURL('image/png'));
      }
    }
  }, [targetElement, core.currentImage]);

  const {
    currentImage,
    isPanning,
    spacePressed,
    activeTool,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    rotationAngle,
    showAlphaMask,
    isLoading,
    imageRef,
    displayMaskRef,
    drawingPath,
    selectionRegion,
    isRegionInverted,
    quadPoints,
    isPolyClosed,
    polyHoverClose,
    polyMousePos,
    draggingPointIdx,
  } = core;

  // 计算浮动工具栏坐标
  const toolbarTop = targetRect 
    ? (targetRect.top > 60 ? targetRect.top - 52 : targetRect.bottom + 10) 
    : 20;
  const toolbarLeft = targetRect 
    ? Math.max(12, Math.min(window.innerWidth - 680, targetRect.left)) 
    : 20;

  return (
    <div className="fixed inset-0 z-[999990] pointer-events-none select-none">
      {/* 浮动吸附工具栏 */}
      <div 
        className="fixed z-[999999] pointer-events-auto transition-all duration-150 animate-in fade-in slide-in-from-top-2"
        style={{ top: `${toolbarTop}px`, left: `${toolbarLeft}px` }}
      >
        <Toolbar 
          core={core} 
          mode="toolbar" 
          showComplete={true} 
          showCancel={true} 
          onFinish={props.onFinish} 
          onCancel={props.onCancel} 
        />
      </div>

      {/* 如果有选区，点击图片外部区域取消选区 */}
      {core.hasSelection && (
        <div 
          className="fixed inset-0 z-[999980] pointer-events-auto cursor-default"
          onMouseDown={() => core.clearSelection()}
        />
      )}

      {/* 原地编辑遮罩层 (与目标元素重合) */}
      {targetRect && currentImage && (
        <div 
          className="fixed pointer-events-auto overflow-visible cursor-crosshair ring-4 ring-blue-500/80 shadow-2xl rounded-sm transition-all"
          style={{
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
          }}
          onMouseDown={handleMouseDown} 
          onMouseMove={handleMouseMove} 
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 原位渲染画布与选区 */}
          <div 
            className="relative w-full h-full overflow-hidden leading-[0]"
            style={{ transform: `rotate(${rotationAngle}deg)`, transformOrigin: 'center center' }}
          >
            <img 
              ref={imageRef} 
              src={currentImage} 
              alt="In-place Workspace" 
              draggable="false" 
              className={`w-full h-full object-contain pointer-events-none transition-all ${isLoading ? 'blur-sm opacity-40' : 'opacity-100'}`} 
            />
            <canvas ref={displayMaskRef} className="absolute inset-0 pointer-events-none w-full h-full" />

            {/* 套索路径 SVG */}
            {drawingPath.length > 1 && imageRef.current && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                <polyline points={drawingPath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              </svg>
            )}

            {/* 选区矩形 / 任意路径 */}
            {selectionRegion && imageRef.current && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {selectionRegion.type === 'rect' ? (
                  <div 
                    className={`absolute border-2 border-blue-500 border-dashed ${isRegionInverted ? 'bg-black/40' : 'shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]'}`} 
                    style={{ 
                      left: `${(selectionRegion.data.x / imageRef.current.naturalWidth) * 100}%`, 
                      top: `${(selectionRegion.data.y / imageRef.current.naturalHeight) * 100}%`, 
                      width: `${(selectionRegion.data.w / imageRef.current.naturalWidth) * 100}%`, 
                      height: `${(selectionRegion.data.h / imageRef.current.naturalHeight) * 100}%` 
                    }} 
                  >
                    {[0, 1, 2, 3].map(i => (
                      <div 
                        key={i} 
                        className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-full shadow-lg z-30 pointer-events-auto cursor-move" 
                        style={{ 
                          left: i === 1 || i === 2 ? '100%' : '0', 
                          top: i === 2 || i === 3 ? '100%' : '0', 
                          transform: 'translate(-50%, -50%)' 
                        }} 
                      />
                    ))}
                  </div>
                ) : (
                  <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                    <defs>
                      <mask id="inplaceLassoMask">
                        <rect width="100%" height="100%" fill={isRegionInverted ? "black" : "white"} />
                        <polygon points={(selectionRegion.data as any[]).map(p => `${p.x},${p.y}`).join(' ')} fill={isRegionInverted ? "white" : "black"} />
                      </mask>
                    </defs>
                    <rect width="100%" height="100%" fill="rgba(0,0,0,0.4)" mask="url(#inplaceLassoMask)" />
                    <polygon points={(selectionRegion.data as any[]).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                  </svg>
                )}
              </div>
            )}

            {/* 多边范围 / 顶点拉伸 */}
            {activeTool === 'quad' && imageRef.current && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                {isPolyClosed && quadPoints && (
                  <>
                    <polygon points={quadPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(79, 70, 229, 0.15)" stroke="#4f46e5" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {quadPoints.map((p, i) => (
                      <circle 
                        key={i} 
                        cx={p.x} 
                        cy={p.y} 
                        r="6" 
                        fill={draggingPointIdx === i ? "#ffffff" : "#4f46e5"} 
                        stroke="#ffffff" 
                        strokeWidth="2" 
                        className="pointer-events-auto cursor-move drop-shadow-md" 
                      />
                    ))}
                  </>
                )}
                {!isPolyClosed && quadPoints && quadPoints.length > 0 && (
                  <>
                    <polyline points={quadPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#4f46e5" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {polyMousePos && (
                      <line 
                        x1={quadPoints[quadPoints.length - 1].x} 
                        y1={quadPoints[quadPoints.length - 1].y} 
                        x2={polyMousePos.x} 
                        y2={polyMousePos.y} 
                        stroke="#4f46e5" 
                        strokeWidth="2" 
                        strokeDasharray="4 4" 
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {quadPoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="1.5" />
                    ))}
                    {polyHoverClose && (
                      <g>
                        <circle cx={quadPoints[0].x} cy={quadPoints[0].y} r="10" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3 3" />
                        <circle cx={quadPoints[0].x} cy={quadPoints[0].y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                      </g>
                    )}
                  </>
                )}
              </svg>
            )}

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                <Loader2 size={24} className="text-white animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 确认弹窗 */}
      <ConfirmModal core={core} />
    </div>
  );
};
