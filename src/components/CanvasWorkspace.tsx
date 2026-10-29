import React from 'react';
import { ZoomIn, ZoomOut, Maximize, Loader2, Upload } from 'lucide-react';
import { ImageEditorCore } from '../core/useImageEditorCore';

interface CanvasWorkspaceProps {
  core: ImageEditorCore;
  showZoomControls?: boolean;
  className?: string;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  core,
  showZoomControls = true,
  className = "",
}) => {
  const {
    currentImage,
    isPanning,
    spacePressed,
    activeTool,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    setIsDragging,
    processFile,
    zoom,
    changeZoom,
    setZoom,
    setPanOffset,
    panOffset,
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
    handleUpload,
  } = core;

  return (
    <div 
      className={`flex-1 flex flex-col p-2 overflow-hidden relative no-scrollbar select-none ${isPanning || spacePressed ? 'cursor-grabbing' : (activeTool === 'rect' || activeTool === 'lasso' || activeTool === 'pipette' || activeTool === 'quad' ? 'cursor-crosshair' : (activeTool === 'wand' ? 'cursor-cell' : 'cursor-grab'))} ${className}`} 
      onMouseDown={handleMouseDown} 
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp} 
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} 
      onDragLeave={() => setIsDragging(false)} 
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
    >
      {/* 缩放控制器 */}
      {currentImage && showZoomControls && (
        <div className="absolute top-4 right-4 z-40 animate-in fade-in slide-in-from-right-2">
          <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-2xl p-1.5 flex items-center gap-1 rounded-2xl">
            <button onClick={() => changeZoom(-0.25)} className="p-1 hover:bg-slate-100 text-slate-600 transition-colors rounded-lg"><ZoomOut size={12} /></button>
            <button onClick={() => setZoom(1)} className="px-2 text-[10px] font-black text-slate-800 min-w-[36px] text-center">{Math.round(zoom * 100)}%</button>
            <button onClick={() => changeZoom(0.25)} className="p-1 hover:bg-slate-100 text-slate-600 transition-colors rounded-lg"><ZoomIn size={12} /></button>
            <div className="w-px h-3 bg-slate-200 mx-0.5" />
            <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg" title="重置"><Maximize size={12} /></button>
          </div>
        </div>
      )}

      {/* 画布中央区域 */}
      <div 
        className="min-h-full min-w-full flex items-center justify-center relative transition-all" 
        style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)`, transition: isPanning ? 'none' : 'transform 0.1s ease-out' }}
      >
        {currentImage ? (
          <div 
            className="relative transition-transform duration-200 inline-block pointer-events-none" 
            style={{ transform: `scale(${zoom}) rotate(${rotationAngle}deg)`, transformOrigin: 'center center' }}
          >
            <div className={`relative overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border-4 border-white select-none pointer-events-auto leading-[0] transition-colors ${showAlphaMask ? 'alpha-mask-bg' : 'bg-white/5'}`}>
              <img 
                ref={imageRef} 
                src={currentImage} 
                alt="Workspace" 
                draggable="false" 
                className={`max-w-none transition-all duration-300 ${isLoading ? 'blur-xl opacity-30' : 'opacity-100'}`} 
                style={{ maxHeight: '70vh' }} 
              />
              <canvas ref={displayMaskRef} className="absolute inset-0 pointer-events-none w-full h-full" />
              
              {/* 套索路径 SVG */}
              {drawingPath.length > 1 && imageRef.current && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                  <polyline points={drawingPath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth={(2 / zoom).toString()} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                </svg>
              )}

              {/* 选区高亮 (矩形 / 任意路径) */}
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
                      {(activeTool === 'rect' || activeTool === null) && [0, 1, 2, 3].map(i => (
                        <div 
                          key={i} 
                          className="absolute w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-lg z-30 pointer-events-auto cursor-move" 
                          style={{ 
                            left: i === 1 || i === 2 ? '100%' : '0', 
                            top: i === 2 || i === 3 ? '100%' : '0', 
                            transform: `translate(-50%, -50%) scale(${1 / zoom})` 
                          }} 
                        />
                      ))}
                    </div>
                  ) : (
                    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                      <defs>
                        <mask id="lassoMask">
                          <rect width="100%" height="100%" fill={isRegionInverted ? "black" : "white"} />
                          <polygon points={(selectionRegion.data as any[]).map(p => `${p.x},${p.y}`).join(' ')} fill={isRegionInverted ? "white" : "black"} />
                        </mask>
                      </defs>
                      <rect width="100%" height="100%" fill="rgba(0,0,0,0.4)" mask="url(#lassoMask)" />
                      <polygon points={(selectionRegion.data as any[]).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth={(2 / zoom).toString()} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                    </svg>
                  )}
                </div>
              )}

              {/* 多边范围 (多边形连线 / 顶点拉伸) */}
              {activeTool === 'quad' && imageRef.current && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                  {/* 闭合后状态：填充色、描边、可拖拽定点圆圈 (与原顶点拉伸视觉完全一致) */}
                  {isPolyClosed && quadPoints && (
                    <>
                      <polygon 
                        points={quadPoints.map(p => `${p.x},${p.y}`).join(' ')} 
                        fill="rgba(79, 70, 229, 0.15)" 
                        stroke="#4f46e5" 
                        strokeWidth={(2 / zoom).toString()} 
                        vectorEffect="non-scaling-stroke"
                      />
                      {quadPoints.map((p, i) => (
                        <circle 
                          key={i} 
                          cx={p.x} 
                          cy={p.y} 
                          r={(8 / zoom).toString()} 
                          fill={draggingPointIdx === i ? "#ffffff" : "#4f46e5"} 
                          stroke="#ffffff" 
                          strokeWidth={(2 / zoom).toString()} 
                          className="pointer-events-auto cursor-move drop-shadow-md" 
                        />
                      ))}
                    </>
                  )}

                  {/* 绘制中状态：折线、动态橡皮筋直线、端点指示器、首尾相连指示 */}
                  {!isPolyClosed && quadPoints && quadPoints.length > 0 && (
                    <>
                      {/* 已落点的折线 */}
                      <polyline 
                        points={quadPoints.map(p => `${p.x},${p.y}`).join(' ')} 
                        fill="none" 
                        stroke="#4f46e5" 
                        strokeWidth={(2 / zoom).toString()} 
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* 鼠标移动的动态橡皮筋直线 */}
                      {polyMousePos && (
                        <line 
                          x1={quadPoints[quadPoints.length - 1].x} 
                          y1={quadPoints[quadPoints.length - 1].y} 
                          x2={polyMousePos.x} 
                          y2={polyMousePos.y} 
                          stroke="#4f46e5" 
                          strokeWidth={(2 / zoom).toString()} 
                          strokeDasharray="4 4" 
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                      {/* 已落点的小圆圈 */}
                      {quadPoints.map((p, i) => (
                        <circle 
                          key={i} 
                          cx={p.x} 
                          cy={p.y} 
                          r={(5 / zoom).toString()} 
                          fill="#ffffff" 
                          stroke="#4f46e5" 
                          strokeWidth={(2 / zoom).toString()} 
                        />
                      ))}
                      {/* 悬停在起点准备首尾相连闭合时的靶心提示 */}
                      {polyHoverClose && (
                        <g>
                          <circle 
                            cx={quadPoints[0].x} 
                            cy={quadPoints[0].y} 
                            r={(12 / zoom).toString()} 
                            fill="none" 
                            stroke="#10b981" 
                            strokeWidth={(2.5 / zoom).toString()} 
                            strokeDasharray="3 3"
                          />
                          <circle 
                            cx={quadPoints[0].x} 
                            cy={quadPoints[0].y} 
                            r={(6 / zoom).toString()} 
                            fill="#10b981" 
                            stroke="#ffffff" 
                            strokeWidth={(1.5 / zoom).toString()} 
                          />
                        </g>
                      )}
                    </>
                  )}
                </svg>
              )}

              {/* 加载动画 */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[2px]">
                  <Loader2 size={32} className="text-blue-600 animate-spin" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-3xl text-center bg-white/50">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
              <Upload size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">请上传图片或 PDF 开始编辑</h3>
            <p className="text-xs text-slate-400 mb-4">支持拖拽文件到此处，或点击下方按钮导入</p>
            <label className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow cursor-pointer hover:bg-slate-800 active:scale-95 transition-all">
              选择文件
              <input type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
