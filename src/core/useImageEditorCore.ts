import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SDK_VERSION } from '../version';

export interface HistoryRecord {
  id: number;
  url: string;
  prompt: string;
  timestamp: string;
  width?: number;
  height?: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SelectionRegion {
  type: 'rect' | 'path';
  data: any;
}

export interface RectDragPoints {
  current: Point;
  opposite: Point;
}

export interface CoreOptions {
  initialImage?: string | Blob | File | HTMLImageElement | HTMLCanvasElement | null;
  apiKey?: string;
  onComplete?: (result: { blob: Blob; base64: string; canvas: HTMLCanvasElement }) => void;
  onCancel?: () => void;
}

export function useImageEditorCore(options: CoreOptions = {}) {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<HistoryRecord | null>(null); 
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [prompt, setPrompt] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false); 
  const [showAlphaMask, setShowAlphaMask] = useState<boolean>(false); 

  // 视口状态
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [spacePressed, setSpacePressed] = useState<boolean>(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 工具状态
  const [activeTool, setActiveTool] = useState<string | null>(null); // 'wand' | 'rect' | 'lasso' | 'pipette' | 'quad' | 'rotate'
  const [selectionMode, setSelectionMode] = useState<'global' | 'connected'>('global'); 
  const [selectionRegion, setSelectionRegion] = useState<SelectionRegion | null>(null); 
  const [rectDragPoints, setRectDragPoints] = useState<RectDragPoints | null>(null); 
  const [isRegionInverted, setIsRegionInverted] = useState<boolean>(false); 
  const [drawingPath, setDrawingPath] = useState<Point[]>([]); 
  const [regionStart, setRegionStart] = useState<Point | null>(null); 
  const [maskCanvas, setMaskCanvas] = useState<HTMLCanvasElement | null>(null); 
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
  const [tolerance, setTolerance] = useState<number>(32); 
  const [lastClickPos, setLastClickPos] = useState<{ x: number; y: number; isAdding: boolean } | null>(null); 
  const [fillColor, setFillColor] = useState<string>("#3b82f6"); 
  const [deSpillGreen, setDeSpillGreen] = useState<boolean>(true); // 智能去色边开关
  const [sampledColor, setSampledColor] = useState<{ r: number; g: number; b: number; a: number } | null>(null); // 魔棒当前吸附的背景色

  // 变换与多边形状态
  const [quadPoints, setQuadPoints] = useState<Point[] | null>(null); 
  const [isPolyClosed, setIsPolyClosed] = useState<boolean>(false);
  const [polyHoverClose, setPolyHoverClose] = useState<boolean>(false);
  const [polyMousePos, setPolyMousePos] = useState<Point | null>(null);
  const [draggingPointIdx, setDraggingPointIdx] = useState<number>(-1); 
  const [rotationAngle, setRotationAngle] = useState<number>(0); // 预览角度
  const dragStartData = useRef<any>(null); 
  const mouseDownOutsideRef = useRef<{ x: number; y: number } | null>(null);
  
  const imageRef = useRef<HTMLImageElement | null>(null);
  const displayMaskRef = useRef<HTMLCanvasElement | null>(null);

  // 当前版本号：统一读取 src/version.ts，禁止在此硬编码
  const version = SDK_VERSION;
  const effectiveApiKey = options.apiKey || (typeof window !== 'undefined' && (window as any).GEMINI_API_KEY) || "";

  // 动态加载 PDF.js 库
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.async = true;
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
  }, []);

  // 重置魔棒与辅助
  const resetWand = () => { 
    setActiveTool(null); 
    setMaskCanvas(null); 
    setLastClickPos(null); 
    setQuadPoints(null);
    setIsPolyClosed(false);
    setPolyMousePos(null);
    setPolyHoverClose(false);
  };
  const resetView = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); };
  const changeZoom = (delta: number) => setZoom(prev => Math.max(0.5, Math.min(5, Math.round((prev + delta) * 100) / 100)));
  const hasSelection = !!(maskCanvas || selectionRegion || (quadPoints && isPolyClosed));

  const toggleInvertSelection = () => {
    if (maskCanvas) {
      handleInvertSelection();
    }
    if (selectionRegion || (quadPoints && isPolyClosed)) {
      setIsRegionInverted(prev => !prev);
    }
  };

  const clearSelection = () => {
    setSelectionRegion(null);
    setRectDragPoints(null);
    setIsRegionInverted(false);
    setMaskCanvas(null);
    setQuadPoints(null);
    setIsPolyClosed(false);
    setDrawingPath([]);
    setPolyMousePos(null);
    setPolyHoverClose(false);
    setActiveTool(null);
  };

  // 初始化图片加载
  const loadImageSource = useCallback((source: string | Blob | File | HTMLImageElement | HTMLCanvasElement) => {
    if (!source) return;
    if (typeof source === 'string') {
      const newRecord: HistoryRecord = { 
        id: Date.now(), 
        url: source, 
        prompt: `加载图片`, 
        timestamp: new Date().toLocaleTimeString() 
      };
      setCurrentImage(source);
      setActiveRecord(newRecord);
      setHistory([newRecord]);
      setPrompt("");
      resetWand();
      resetView();
      setSelectionRegion(null);
      setIsRegionInverted(false);
      setRotationAngle(0);
    } else if (source instanceof HTMLImageElement) {
      loadImageSource(source.src);
    } else if (source instanceof HTMLCanvasElement) {
      loadImageSource(source.toDataURL('image/png'));
    } else if (source instanceof Blob) {
      processFile(source as File);
    }
  }, []);

  useEffect(() => {
    if (options.initialImage) {
      loadImageSource(options.initialImage);
    }
  }, [options.initialImage, loadImageSource]);

  // 处理文件上传（支持图片和 PDF）
  const processFile = (file: File) => {
    if (!file) return;
    
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    if (isPDF) {
      if (!(window as any).pdfjsLib) {
        setErrorMessage("错误: PDF 解析引擎仍在加载中，请稍后再试");
        return;
      }
      setIsLoading(true);
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const loadingTask = (window as any).pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          
          if (pdf.numPages === 0) {
            throw new Error("该PDF文件不包含任何有效页面");
          }
          
          // 默认读取并渲染第一页
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 }); // 使用 2x 缩放保证渲染清晰度
          
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("无法创建画布上下文");
          
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;
          const base64 = canvas.toDataURL('image/png');
          
          const newRecord: HistoryRecord = { 
            id: Date.now(), 
            url: base64, 
            prompt: `导入PDF第1页: ${file.name}`, 
            timestamp: new Date().toLocaleTimeString() 
          };
          
          setCurrentImage(base64); 
          setActiveRecord(newRecord); 
          setHistory([newRecord]);
          setPrompt(""); 
          resetWand(); 
          resetView(); 
          setSelectionRegion(null); 
          setIsRegionInverted(false); 
          setRotationAngle(0);
        } catch (err: any) {
          setErrorMessage("PDF 导入失败: " + err.message);
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
      
    } else if (file.type.startsWith('image/')) {
      setIsLoading(true);
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newRecord: HistoryRecord = { 
          id: Date.now(), 
          url: base64, 
          prompt: `导入图片: ${file.name}`, 
          timestamp: new Date().toLocaleTimeString() 
        };
        setCurrentImage(base64); 
        setActiveRecord(newRecord); 
        setHistory([newRecord]);
        setPrompt(""); 
        resetWand(); 
        resetView(); 
        setSelectionRegion(null); 
        setIsRegionInverted(false); 
        setRotationAngle(0);
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } else {
      setErrorMessage("错误: 不支持的文件格式（请上传图片或 PDF）");
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  useEffect(() => {
    if (activeTool !== 'quad') {
      if (!isPolyClosed) {
        setQuadPoints(null);
        setPolyHoverClose(false);
        setPolyMousePos(null);
      }
    }
  }, [activeTool, isPolyClosed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space' && !isLoading) setSpacePressed(true); };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpacePressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isLoading]);

  useEffect(() => {
    maskCanvasRef.current = maskCanvas; 
    if (maskCanvas && displayMaskRef.current) {
      const canvas = displayMaskRef.current;
      canvas.width = maskCanvas.width;
      canvas.height = maskCanvas.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(maskCanvas, 0, 0);
      }
    } else if (!maskCanvas && displayMaskRef.current) {
      const ctx = displayMaskRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, displayMaskRef.current.width, displayMaskRef.current.height);
      }
    }
  }, [maskCanvas]);

  const isInsideLockedRegion = (x: number, y: number, region: SelectionRegion | null) => {
    if (!region) return true;
    let inside = false;
    if (region.type === 'rect') {
      const r = region.data;
      inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    } else if (region.type === 'path') {
      const path = region.data as Point[];
      if (path.length < 3) return true;
      for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
        const xi = path[i].x, yi = path[i].y;
        const xj = path[j].x, yj = path[j].y;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
    }
    return isRegionInverted ? !inside : inside;
  };

  const computeSelection = useCallback((startX: number, startY: number, currentTolerance: number, mode: 'global' | 'connected', region: SelectionRegion | null, isAdding: boolean) => {
    if (!currentImage || !imageRef.current) return;
    const img = imageRef.current;
    if (!img.complete || img.naturalWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data; const { width, height } = canvas;
    const targetIdx = (startY * width + startX) * 4;
    const [targetR, targetG, targetB, targetA] = [data[targetIdx], data[targetIdx+1], data[targetIdx+2], data[targetIdx+3]];
    setSampledColor({ r: targetR, g: targetG, b: targetB, a: targetA });
    const mCanvas = document.createElement('canvas'); mCanvas.width = width; mCanvas.height = height;
    const mCtx = mCanvas.getContext('2d');
    if (!mCtx) return;
    if (isAdding && maskCanvasRef.current) mCtx.drawImage(maskCanvasRef.current, 0, 0);
    const mImageData = mCtx.getImageData(0, 0, width, height);
    const mData = mImageData.data; const tolSq = currentTolerance * currentTolerance;
    let hasSelected = false;
    const isSimilar = (idx: number) => {
      const dr = data[idx] - targetR, dg = data[idx+1] - targetG, db = data[idx+2] - targetB, da = data[idx+3] - targetA;
      return (dr*dr + dg*dg + db*db + da*da) < tolSq;
    };
    if (mode === 'global') {
      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % width, y = Math.floor((i / 4) / width);
        if (isSimilar(i) && isInsideLockedRegion(x, y, region)) {
          mData[i] = 255; mData[i+1] = 255; mData[i+2] = 0; mData[i+3] = 180; hasSelected = true;
        }
      }
    } else {
      if (!isInsideLockedRegion(startX, startY, region)) return;
      const visited = new Uint8Array(width * height); const stack: [number, number][] = [[startX, startY]];
      visited[startY * width + startX] = 1;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!; const pIdx = (cy * width + cx) * 4;
        mData[pIdx] = 255; mData[pIdx+1] = 255; mData[pIdx+2] = 0; mData[pIdx+3] = 180; hasSelected = true;
        const neighbors: [number, number][] = [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!visited[nIdx] && isSimilar(nIdx * 4) && isInsideLockedRegion(nx, ny, region)) {
              visited[nIdx] = 1; stack.push([nx, ny]);
            }
          }
        }
      }
    }
    if (hasSelected || isAdding) { mCtx.putImageData(mImageData, 0, 0); setMaskCanvas(mCanvas); } 
    else setMaskCanvas(null);
  }, [currentImage, isRegionInverted]); 

  useEffect(() => {
    if (activeTool === 'wand' && lastClickPos) {
      computeSelection(lastClickPos.x, lastClickPos.y, tolerance, selectionMode, selectionRegion, lastClickPos.isAdding);
    }
  }, [tolerance, activeTool, lastClickPos, selectionMode, selectionRegion, isRegionInverted, computeSelection]); 

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const isAdding = e.metaKey || e.ctrlKey;

    const nw = imageRef.current!.naturalWidth, nh = imageRef.current!.naturalHeight;
    const rawX = Math.floor(((e.clientX - rect.left) / rect.width) * nw);
    const rawY = Math.floor(((e.clientY - rect.top) / rect.height) * nh);
    const imgX = Math.max(0, Math.min(nw, rawX));
    const imgY = Math.max(0, Math.min(nh, rawY));

    const isOutsideImage = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;

    // 快捷键空格、非鼠标主键或未选择任何绘制工具时，进入画布平移拖拽模式
    if (e.button !== 0 || spacePressed || !activeTool) {
      e.preventDefault();
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (isOutsideImage) {
        mouseDownOutsideRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    // 非框选/套索类工具（如魔棒、吸管、多边形打点），在画布外点击时作为画布平移处理
    if (isOutsideImage && activeTool !== 'rect' && activeTool !== 'lasso') {
      if (e.button === 0) {
        setIsPanning(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        mouseDownOutsideRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    if (activeTool === 'quad') {
      if (isPolyClosed && quadPoints) {
        const thr = 20 / zoom;
        const idx = quadPoints.findIndex(p => Math.abs(p.x - imgX) < thr && Math.abs(p.y - imgY) < thr);
        if (idx !== -1) { setDraggingPointIdx(idx); dragStartData.current = { x: quadPoints[idx].x, y: quadPoints[idx].y }; return; }
      } else {
        // 多边范围打点：点一次拉一根直线，首尾相连则结束选定
        if (!quadPoints || quadPoints.length === 0) {
          setQuadPoints([{ x: imgX, y: imgY }]);
          setIsPolyClosed(false);
          return;
        }
        const p0 = quadPoints[0];
        const dist = Math.hypot(p0.x - imgX, p0.y - imgY);
        if (quadPoints.length >= 3 && dist < (20 / zoom)) {
          // 首尾相连闭合！
          setIsPolyClosed(true);
          setSelectionRegion({ type: 'path', data: quadPoints });
          setPolyHoverClose(false);
          setPolyMousePos(null);
          return;
        }
        setQuadPoints(prev => prev ? [...prev, { x: imgX, y: imgY }] : [{ x: imgX, y: imgY }]);
        return;
      }
    }
    if (activeTool === 'rect' && selectionRegion?.type === 'rect') {
      const r = selectionRegion.data; const thr = 20 / zoom; let hitIdx = -1;
      if (Math.abs(r.x - imgX) < thr && Math.abs(r.y - imgY) < thr) hitIdx = 0;
      else if (Math.abs(r.x + r.w - imgX) < thr && Math.abs(r.y - imgY) < thr) hitIdx = 1;
      else if (Math.abs(r.x + r.w - imgX) < thr && Math.abs(r.y + r.h - imgY) < thr) hitIdx = 2;
      else if (Math.abs(r.x - imgX) < thr && Math.abs(r.y + r.h - imgY) < thr) hitIdx = 3;
      if (hitIdx !== -1) { 
        setDraggingPointIdx(hitIdx); 
        dragStartData.current = { ...r }; 
        const curPt = hitIdx === 0 ? { x: r.x, y: r.y } :
                      hitIdx === 1 ? { x: r.x + r.w, y: r.y } :
                      hitIdx === 2 ? { x: r.x + r.w, y: r.y + r.h } :
                      { x: r.x, y: r.y + r.h };
        const oppPt = hitIdx === 0 ? { x: r.x + r.w, y: r.y + r.h } :
                      hitIdx === 1 ? { x: r.x, y: r.y + r.h } :
                      hitIdx === 2 ? { x: r.x, y: r.y } :
                      { x: r.x + r.w, y: r.y };
        setRectDragPoints({ current: curPt, opposite: oppPt });
        return; 
      }
    }
    if (activeTool === 'pipette') {
      const canvas = document.createElement('canvas'); canvas.width = nw; canvas.height = nh;
      const ctx = canvas.getContext('2d'); 
      if (ctx && imageRef.current) {
        ctx.drawImage(imageRef.current, 0, 0);
        const pixel = ctx.getImageData(Math.min(nw-1, imgX), Math.min(nh-1, imgY), 1, 1).data;
        setFillColor("#" + Array.from(pixel.slice(0, 3)).map(x => x.toString(16).padStart(2, '0')).join(''));
      }
      setActiveTool(null); return;
    }
    if (activeTool === 'rect') {
      // 支持画布外负数/超界坐标拖动：自动将起点智能吸附至画布边缘 (0~nw, 0~nh)
      setRegionStart({ x: imgX, y: imgY });
      setSelectionRegion({ type: 'rect', data: { x: imgX, y: imgY, w: 0, h: 0 } });
      setRectDragPoints({ current: { x: imgX, y: imgY }, opposite: { x: imgX, y: imgY } });
    } else if (activeTool === 'lasso') {
      setDrawingPath([{ x: imgX, y: imgY }]);
    } else if (activeTool === 'wand') {
      setLastClickPos({ x: imgX, y: imgY, isAdding });
      computeSelection(imgX, imgY, tolerance, selectionMode, selectionRegion, isAdding);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeTool === 'quad' && !isPolyClosed && quadPoints && quadPoints.length >= 3) {
      setIsPolyClosed(true);
      setSelectionRegion({ type: 'path', data: quadPoints });
      setPolyHoverClose(false);
      setPolyMousePos(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x, dy = e.clientY - lastMousePos.current.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY }; return;
    }
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const nw = imageRef.current.naturalWidth, nh = imageRef.current.naturalHeight;
    const rawX = Math.floor(((e.clientX - rect.left) / rect.width) * nw);
    const rawY = Math.floor(((e.clientY - rect.top) / rect.height) * nh);
    const imgX = Math.max(0, Math.min(nw, rawX));
    const imgY = Math.max(0, Math.min(nh, rawY));

    if (activeTool === 'quad') {
      if (isPolyClosed && draggingPointIdx !== -1 && quadPoints) {
        let fx = imgX, fy = imgY;
        if ((e.metaKey || e.ctrlKey) && dragStartData.current) {
          if (Math.abs(imgX - dragStartData.current.x) > Math.abs(imgY - dragStartData.current.y)) fy = dragStartData.current.y; else fx = dragStartData.current.x;
        }
        setQuadPoints(prev => { 
          if (!prev) return null;
          const n = [...prev]; n[draggingPointIdx] = { x: fx, y: fy }; return n; 
        }); 
        setSelectionRegion({ type: 'path', data: quadPoints });
        return;
      }
      if (!isPolyClosed && quadPoints && quadPoints.length > 0) {
        setPolyMousePos({ x: imgX, y: imgY });
        const p0 = quadPoints[0];
        const dist = Math.hypot(p0.x - imgX, p0.y - imgY);
        setPolyHoverClose(quadPoints.length >= 3 && dist < (20 / zoom));
        return;
      }
    }
    if (activeTool === 'rect' && draggingPointIdx !== -1 && selectionRegion?.type === 'rect') {
      const r = { ...selectionRegion.data }; const start = dragStartData.current; let fx = imgX, fy = imgY;
      if (e.metaKey || e.ctrlKey) {
        const bx = (draggingPointIdx === 0 || draggingPointIdx === 3) ? start.x : start.x + start.w;
        const by = (draggingPointIdx === 0 || draggingPointIdx === 1) ? start.y : start.y + start.h;
        if (Math.abs(imgX - bx) > Math.abs(imgY - by)) fy = by; else fx = bx;
      }
      if (draggingPointIdx === 0) { r.w += r.x - fx; r.h += r.y - fy; r.x = fx; r.y = fy; }
      else if (draggingPointIdx === 1) { r.w = fx - r.x; r.h += r.y - fy; r.y = fy; }
      else if (draggingPointIdx === 2) { r.w = fx - r.x; r.h = fy - r.y; }
      else if (draggingPointIdx === 3) { r.w += r.x - fx; r.x = fx; r.h = fy - r.y; }
      setSelectionRegion({ type: 'rect', data: r });
      
      const curPt = draggingPointIdx === 0 ? { x: r.x, y: r.y } :
                    draggingPointIdx === 1 ? { x: r.x + r.w, y: r.y } :
                    draggingPointIdx === 2 ? { x: r.x + r.w, y: r.y + r.h } :
                    { x: r.x, y: r.y + r.h };
      const oppPt = draggingPointIdx === 0 ? { x: r.x + r.w, y: r.y + r.h } :
                    draggingPointIdx === 1 ? { x: r.x, y: r.y + r.h } :
                    draggingPointIdx === 2 ? { x: r.x, y: r.y } :
                    { x: r.x + r.w, y: r.y };
      setRectDragPoints({ current: curPt, opposite: oppPt });
      return;
    }
    if (!regionStart && drawingPath.length === 0) return;
    if (activeTool === 'rect' && regionStart) {
      const x = Math.min(regionStart.x, imgX), y = Math.min(regionStart.y, imgY);
      const w = Math.abs(regionStart.x - imgX), h = Math.abs(regionStart.y - imgY);
      setSelectionRegion({ type: 'rect', data: { x, y, w, h } });
      setRectDragPoints({
        current: { x: imgX, y: imgY },
        opposite: { x: regionStart.x, y: regionStart.y },
      });
    } else if (activeTool === 'lasso' && drawingPath.length > 0) {
      setDrawingPath(prev => [...prev, { x: imgX, y: imgY }]);
    }
  };

  const handleMouseUp = (e?: React.MouseEvent) => {
    setIsPanning(false); 
    setDraggingPointIdx(-1); 
    dragStartData.current = null;
    setRectDragPoints(null);

    // 若在画布外部点击且没有实质移动（纯点击取消），统一在 mouse up 释放时清除选区
    if (mouseDownOutsideRef.current) {
      const startPos = mouseDownOutsideRef.current;
      mouseDownOutsideRef.current = null;
      const clientX = e ? e.clientX : startPos.x;
      const clientY = e ? e.clientY : startPos.y;
      const dist = Math.hypot(clientX - startPos.x, clientY - startPos.y);
      if (dist < 5 && hasSelection) {
        clearSelection();
      }
    }

    if (activeTool === 'rect' && regionStart) {
      setRegionStart(null); 
      // 拖拽宽度或高度过小（单次点击或原地微移），判定为取消/退出框选状态
      if (selectionRegion && (selectionRegion.data.w < 2 || selectionRegion.data.h < 2)) { 
        clearSelection();
      }
    } else if (activeTool === 'lasso' && drawingPath.length > 0) {
      if (drawingPath.length > 3) setSelectionRegion({ type: 'path', data: drawingPath }); 
      else setSelectionRegion(null);
      setDrawingPath([]); 
      setActiveTool(null);
    }
  };

  // 保持事件引用最新，便于 window 全局监听调用
  const handleMouseMoveRef = useRef(handleMouseMove);
  handleMouseMoveRef.current = handleMouseMove;
  const handleMouseUpRef = useRef(handleMouseUp);
  handleMouseUpRef.current = handleMouseUp;

  const isDraggingAny = !!(regionStart || isPanning || draggingPointIdx !== -1 || drawingPath.length > 0 || rectDragPoints);

  // 处于拖拽框选、视口平移或定点拉伸状态时，全局接管 mousemove 和 mouseup，彻底杜绝鼠标移出工作区或经过外部 UI 时发生卡顿或丢失拖拽
  useEffect(() => {
    if (!isDraggingAny) return;

    const onGlobalMouseMove = (e: MouseEvent) => {
      handleMouseMoveRef.current(e as any);
    };

    const onGlobalMouseUp = (e: MouseEvent) => {
      handleMouseUpRef.current(e as any);
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [isDraggingAny]);

  // 旋转应用逻辑
  const handleApplyRotation = () => {
    if (!currentImage || !imageRef.current || rotationAngle === 0) return;
    setIsLoading(true);
    const img = imageRef.current;
    const angleRad = (rotationAngle * Math.PI) / 180;
    
    // 计算旋转后的新画布尺寸
    const nw = Math.abs(img.naturalWidth * Math.cos(angleRad)) + Math.abs(img.naturalHeight * Math.sin(angleRad));
    const nh = Math.abs(img.naturalWidth * Math.sin(angleRad)) + Math.abs(img.naturalHeight * Math.cos(angleRad));
    
    const canvas = document.createElement('canvas');
    canvas.width = nw; canvas.height = nh;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsLoading(false); return; }
    
    ctx.translate(nw / 2, nh / 2);
    ctx.rotate(angleRad);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    
    const res = canvas.toDataURL();
    const rec: HistoryRecord = { id: Date.now(), url: res, prompt: `旋转图像 (${rotationAngle}°)`, timestamp: new Date().toLocaleTimeString() };
    setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec);
    setRotationAngle(0); setActiveTool(null); setIsLoading(false);
  };

  const handleFlipHorizontal = () => {
    if (!currentImage || !imageRef.current) return;
    setIsLoading(true);
    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsLoading(false); return; }
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    const res = canvas.toDataURL();
    const rec: HistoryRecord = { id: Date.now(), url: res, prompt: "水平镜像", timestamp: new Date().toLocaleTimeString() };
    setHistory(prev => [rec, ...prev]);
    setCurrentImage(res);
    setActiveRecord(rec);
    clearSelection();
    setIsLoading(false);
  };

  const handleFlipVertical = () => {
    if (!currentImage || !imageRef.current) return;
    setIsLoading(true);
    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsLoading(false); return; }
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(img, 0, 0);
    const res = canvas.toDataURL();
    const rec: HistoryRecord = { id: Date.now(), url: res, prompt: "垂直镜像", timestamp: new Date().toLocaleTimeString() };
    setHistory(prev => [rec, ...prev]);
    setCurrentImage(res);
    setActiveRecord(rec);
    clearSelection();
    setIsLoading(false);
  };

  const handleRotate90 = (direction: 'cw' | 'ccw' = 'cw') => {
    if (!currentImage || !imageRef.current) return;
    setIsLoading(true);
    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsLoading(false); return; }
    if (direction === 'cw') {
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
    } else {
      ctx.translate(0, canvas.height);
      ctx.rotate(-Math.PI / 2);
    }
    ctx.drawImage(img, 0, 0);
    const res = canvas.toDataURL();
    const rec: HistoryRecord = { 
      id: Date.now(), 
      url: res, 
      prompt: direction === 'cw' ? "顺时针旋转 90°" : "逆时针旋转 90°", 
      timestamp: new Date().toLocaleTimeString() 
    };
    setHistory(prev => [rec, ...prev]);
    setCurrentImage(res);
    setActiveRecord(rec);
    clearSelection();
    setIsLoading(false);
  };

  const handleApplyQuadCrop = () => {
    if (!quadPoints || !currentImage || !imageRef.current) return;
    setIsLoading(true);
    const img = imageRef.current; const canvas = document.createElement('canvas');
    const nw = img.naturalWidth, nh = img.naturalHeight; canvas.width = nw; canvas.height = nh;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) { setIsLoading(false); return; }
    ctx.beginPath(); ctx.moveTo(quadPoints[0].x, quadPoints[0].y);
    quadPoints.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.clip(); ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, nw, nh); const data = pixels.data;
    let bound = { top: null as number | null, left: null as number | null, right: null as number | null, bottom: null as number | null };
    for (let i = 0; i < data.length; i += 4) { if (data[i + 3] !== 0) { const x = (i / 4) % nw, y = Math.floor((i / 4) / nw); if (bound.top === null || y < bound.top) bound.top = y; if (bound.left === null || x < bound.left) bound.left = x; if (bound.right === null || x > bound.right) bound.right = x; if (bound.bottom === null || y > bound.bottom) bound.bottom = y; } }
    if (bound.top !== null && bound.left !== null && bound.right !== null && bound.bottom !== null) {
      const copy = document.createElement('canvas'); const tw = bound.right - bound.left + 1, th = bound.bottom - bound.top + 1;
      copy.width = tw; copy.height = th; 
      const copyCtx = copy.getContext('2d');
      if (copyCtx) {
        copyCtx.putImageData(ctx.getImageData(bound.left, bound.top, tw, th), 0, 0);
        const res = copy.toDataURL(); const rec: HistoryRecord = { id: Date.now(), url: res, prompt: "顶点不规则剪裁", timestamp: new Date().toLocaleTimeString() };
        setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec);
      }
    }
    setActiveTool(null); setIsLoading(false);
  };

  const handleFillSelection = () => {
    if ((!maskCanvas && !selectionRegion) || !imageRef.current) return;
    const img = imageRef.current; const canvas = document.createElement('canvas');
    const nw = img.naturalWidth, nh = img.naturalHeight; canvas.width = nw; canvas.height = nh;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const imgDataObj = ctx.getImageData(0, 0, nw, nh); const imgData = imgDataObj.data;
    const r = parseInt(fillColor.slice(1, 3), 16), g = parseInt(fillColor.slice(3, 5), 16), b = parseInt(fillColor.slice(5, 7), 16);
    if (maskCanvas) { 
      const maskData = maskCanvas.getContext('2d')?.getImageData(0, 0, nw, nh).data; 
      if (maskData) {
        for (let i = 0; i < maskData.length; i += 4) { 
          if (maskData[i + 3] > 0) { imgData[i] = r; imgData[i+1] = g; imgData[i+2] = b; imgData[i+3] = 255; } 
        }
      }
    } else if (selectionRegion) { 
      for (let y = 0; y < nh; y++) { 
        for (let x = 0; x < nw; x++) { 
          if (isInsideLockedRegion(x, y, selectionRegion)) { 
            const i = (y * nw + x) * 4; imgData[i] = r; imgData[i+1] = g; imgData[i+2] = b; imgData[i+3] = 255; 
          } 
        } 
      } 
    }
    ctx.putImageData(imgDataObj, 0, 0); const res = canvas.toDataURL();
    const rec: HistoryRecord = { id: Date.now(), url: res, prompt: `选区着色 (${fillColor})`, timestamp: new Date().toLocaleTimeString() };
    setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec); clearSelection();
  };

  const handleCropSelection = () => {
    if (!currentImage || !imageRef.current || !hasSelection) return;
    const img = imageRef.current;
    const nw = img.naturalWidth, nh = img.naturalHeight;

    // 1. 矩形选区剪裁
    if (selectionRegion?.type === 'rect') {
      commitFinalCrop();
      return;
    }

    // 2. 多边范围或套索选区剪裁
    const pts = (quadPoints && isPolyClosed) ? quadPoints : (selectionRegion?.type === 'path' ? (selectionRegion.data as Point[]) : null);
    if (pts && pts.length >= 3) {
      setIsLoading(true);
      const canvas = document.createElement('canvas');
      canvas.width = nw; canvas.height = nh;
      const ctx = canvas.getContext('2d'); 
      if (!ctx) { setIsLoading(false); return; }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0);

      const pixels = ctx.getImageData(0, 0, nw, nh);
      const data = pixels.data;
      let bound = { top: null as number | null, left: null as number | null, right: null as number | null, bottom: null as number | null };
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] !== 0) {
          const x = (i / 4) % nw, y = Math.floor((i / 4) / nw);
          if (bound.top === null || y < bound.top) bound.top = y;
          if (bound.left === null || x < bound.left) bound.left = x;
          if (bound.right === null || x > bound.right) bound.right = x;
          if (bound.bottom === null || y > bound.bottom) bound.bottom = y;
        }
      }
      if (bound.top !== null && bound.left !== null && bound.right !== null && bound.bottom !== null) {
        const copy = document.createElement('canvas');
        const tw = bound.right - bound.left + 1, th = bound.bottom - bound.top + 1;
        copy.width = tw; copy.height = th; 
        const copyCtx = copy.getContext('2d');
        if (copyCtx) {
          copyCtx.putImageData(ctx.getImageData(bound.left, bound.top, tw, th), 0, 0);
          const res = copy.toDataURL();
          const rec: HistoryRecord = { id: Date.now(), url: res, prompt: "按选区剪裁", timestamp: new Date().toLocaleTimeString() };
          setHistory(prev => [rec, ...prev]);
          setCurrentImage(res);
          setActiveRecord(rec);
        }
      }
      clearSelection();
      setIsLoading(false);
      return;
    }

    // 3. 魔棒蒙版剪裁
    if (maskCanvas) {
      setIsLoading(true);
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        const maskData = maskCtx.getImageData(0, 0, nw, nh).data;
        let bound = { top: null as number | null, left: null as number | null, right: null as number | null, bottom: null as number | null };
        for (let i = 0; i < maskData.length; i += 4) {
          if (maskData[i + 3] > 0) {
            const x = (i / 4) % nw, y = Math.floor((i / 4) / nw);
            if (bound.top === null || y < bound.top) bound.top = y;
            if (bound.left === null || x < bound.left) bound.left = x;
            if (bound.right === null || x > bound.right) bound.right = x;
            if (bound.bottom === null || y > bound.bottom) bound.bottom = y;
          }
        }
        if (bound.top !== null && bound.left !== null && bound.right !== null && bound.bottom !== null) {
          const canvas = document.createElement('canvas');
          const tw = bound.right - bound.left + 1, th = bound.bottom - bound.top + 1;
          canvas.width = tw; canvas.height = th;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, bound.left, bound.top, tw, th, 0, 0, tw, th);
            const res = canvas.toDataURL();
            const rec: HistoryRecord = { id: Date.now(), url: res, prompt: "魔棒选区剪裁", timestamp: new Date().toLocaleTimeString() };
            setHistory(prev => [rec, ...prev]);
            setCurrentImage(res);
            setActiveRecord(rec);
          }
        }
      }
      clearSelection();
      setIsLoading(false);
    }
  };

  const handleCropTransparency = () => {
    if (!currentImage || !imageRef.current) return;
    const img = imageRef.current; const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height); const data = pixels.data;
    let bound = { top: null as number | null, left: null as number | null, right: null as number | null, bottom: null as number | null };
    for (let i = 0; i < data.length; i += 4) { if (data[i + 3] !== 0) { const x = (i / 4) % canvas.width, y = Math.floor((i / 4) / canvas.width); if (bound.top === null || y < bound.top) bound.top = y; if (bound.left === null || x < bound.left) bound.left = x; if (bound.right === null || x > bound.right) bound.right = x; if (bound.bottom === null || y > bound.bottom) bound.bottom = y; } }
    if (bound.top !== null && bound.left !== null && bound.right !== null && bound.bottom !== null) {
      const tw = bound.right - bound.left + 1, th = bound.bottom - bound.top + 1;
      setSelectionRegion({ type: 'rect', data: { x: bound.left, y: bound.top, w: tw, h: th } }); setActiveTool('rect'); 
    }
  };

  const commitFinalCrop = () => {
    if (!selectionRegion || selectionRegion.type !== 'rect' || !imageRef.current) return;
    setIsLoading(true); const r = selectionRegion.data; const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, r.w); canvas.height = Math.max(1, r.h);
    const ctx = canvas.getContext('2d'); 
    if (!ctx) { setIsLoading(false); return; }
    ctx.drawImage(imageRef.current, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    const res = canvas.toDataURL(); const rec: HistoryRecord = { id: Date.now(), url: res, prompt: "精细选区裁剪", timestamp: new Date().toLocaleTimeString() };
    setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec);
    setSelectionRegion(null); setActiveTool(null); setIsLoading(false);
  };

  const handleInvertSelection = () => {
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d'); 
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) { if (data[i + 3] > 0) data[i + 3] = 0; else { data[i]=255; data[i+1]=255; data[i+2]=0; data[i+3]=180; } }
    const newCanvas = document.createElement('canvas'); newCanvas.width = maskCanvas.width; newCanvas.height = maskCanvas.height;
    newCanvas.getContext('2d')?.putImageData(imageData, 0, 0); setMaskCanvas(newCanvas);
  };

  // 全色相智能去溢色算法 (Universal Chroma & Color De-Spill Filter)
  // 完美支持：绿底 (Green)、蓝底 (Blue)、黄底 (Yellow)、红底 (Red)、青底 (Cyan)、品红 (Magenta) 及任意魔棒吸附背景色
  const processUniversalDeSpill = (
    data: Uint8ClampedArray,
    bg: { r: number; g: number; b: number } | null,
    tol: number
  ): boolean => {
    // 若未采样则默认按传统绿幕 (0, 255, 0)
    const tr = bg ? bg.r : 0;
    const tg = bg ? bg.g : 255;
    const tb = bg ? bg.b : 0;

    // 智能识别吸附颜色的色彩主导倾向
    const isGreen = tg > tr * 1.15 && tg > tb * 1.15;
    const isBlue = tb > tr * 1.15 && tb > tg * 1.15;
    const isRed = tr > tg * 1.15 && tr > tb * 1.15;
    const isYellow = tr > tb * 1.25 && tg > tb * 1.25 && Math.abs(tr - tg) < 70;
    const isCyan = tg > tr * 1.25 && tb > tr * 1.25 && Math.abs(tg - tb) < 70;
    const isMagenta = tr > tg * 1.25 && tb > tg * 1.25 && Math.abs(tr - tg) < 70;

    const tolRange = Math.max(40, tol * 1.5);
    const tolSq = tolRange * tolRange;
    let modified = false;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (isGreen) {
        // 绿幕经典算法：G_new = min(G, (R+B)/2)
        if (g > r && g > b) {
          const limit = (r + b) / 2;
          if (g > limit) {
            const excess = g - limit;
            data[i + 1] = Math.round(limit);
            data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.35)));
            modified = true;
          }
        }
      } else if (isBlue) {
        // 蓝幕经典算法：B_new = min(B, (R+G)/2)
        if (b > r && b > g) {
          const limit = (r + g) / 2;
          if (b > limit) {
            const excess = b - limit;
            data[i + 2] = Math.round(limit);
            data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.35)));
            modified = true;
          }
        }
      } else if (isRed) {
        // 红幕经典算法：R_new = min(R, (G+B)/2)
        if (r > g && r > b) {
          const limit = (g + b) / 2;
          if (r > limit) {
            const excess = r - limit;
            data[i] = Math.round(limit);
            data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.35)));
            modified = true;
          }
        }
      } else if (isYellow) {
        // 黄幕算法：黄色是红+绿高而蓝低，压制 R 和 G 突出分量，平滑边缘发黄
        if (r > b && g > b) {
          const excess = Math.min(r - b, g - b);
          if (excess > 12) {
            const damp = excess * 0.55;
            data[i] = Math.round(r - damp);
            data[i + 1] = Math.round(g - damp);
            data[i + 2] = Math.min(255, Math.round(b + damp * 0.3));
            data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.25)));
            modified = true;
          }
        }
      } else if (isCyan) {
        // 青幕算法：绿+蓝高而红低
        if (g > r && b > r) {
          const excess = Math.min(g - r, b - r);
          if (excess > 12) {
            const damp = excess * 0.55;
            data[i + 1] = Math.round(g - damp);
            data[i + 2] = Math.round(b - damp);
            data[i] = Math.min(255, Math.round(r + damp * 0.3));
            data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.25)));
            modified = true;
          }
        }
      } else if (isMagenta) {
        // 品红算法：红+蓝高而绿低
        if (r > g && b > g) {
          const excess = Math.min(r - g, b - g);
          if (excess > 12) {
            const damp = excess * 0.55;
            data[i] = Math.round(r - damp);
            data[i + 2] = Math.round(b - damp);
            data[i + 1] = Math.min(255, Math.round(g + damp * 0.3));
            data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.25)));
            modified = true;
          }
        }
      } else {
        // 通用复合色相去杂边：在容差过渡区内将受背景污染的色调引向中性明度
        const dr = r - tr;
        const dg = g - tg;
        const db = b - tb;
        const distSq = dr * dr + dg * dg + db * db;
        if (distSq < tolSq) {
          const factor = 1 - Math.sqrt(distSq) / tolRange;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const blend = factor * 0.6;
          data[i] = Math.round(r * (1 - blend) + lum * blend);
          data[i + 1] = Math.round(g * (1 - blend) + lum * blend);
          data[i + 2] = Math.round(b * (1 - blend) + lum * blend);
          data[i + 3] = Math.max(0, Math.min(255, Math.round(a - factor * 35)));
          modified = true;
        }
      }
    }

    return modified;
  };

  // 执行单独去色边滤镜
  const applyDeSpillGreen = () => {
    if (!currentImage || !imageRef.current) return;
    setIsLoading(true);
    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsLoading(false); return; }
    ctx.drawImage(img, 0, 0);

    const imgDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgDataObj.data;
    const modified = processUniversalDeSpill(data, sampledColor, tolerance);

    if (modified) {
      ctx.putImageData(imgDataObj, 0, 0);
      const res = canvas.toDataURL();
      const colorDesc = sampledColor ? `rgb(${sampledColor.r},${sampledColor.g},${sampledColor.b})` : "背景色";
      const rec: HistoryRecord = {
        id: Date.now(),
        url: res,
        prompt: `智能去色边 (${colorDesc})`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setHistory(prev => [rec, ...prev]);
      setCurrentImage(res);
      setActiveRecord(rec);
    }
    setIsLoading(false);
  };

  const applyWandCutout = () => {
    if (!maskCanvas || !imageRef.current) return;
    const img = imageRef.current; const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const maskData = maskCanvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!maskData) return;
    const imgDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgDataObj.data;

    // 1. 将魔棒选区部分透明化
    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i + 3] > 0) {
        data[i + 3] = 0;
      }
    }

    // 2. 默认自动开启全色相智能去溢色算法（消除边缘残留杂光）
    processUniversalDeSpill(data, sampledColor, tolerance);

    ctx.putImageData(imgDataObj, 0, 0); const res = canvas.toDataURL();
    const colorDesc = sampledColor ? `去色边` : "智能去边";
    const rec: HistoryRecord = { 
      id: Date.now(), 
      url: res, 
      prompt: `魔棒擦除 (${colorDesc})`, 
      timestamp: new Date().toLocaleTimeString() 
    };
    setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec); resetWand();
  };

  const executeEdit = async () => {
    if (!currentImage || !prompt.trim()) return;
    setIsLoading(true); setErrorMessage(null); setShowConfirmModal(false);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${effectiveApiKey}`;
      const payload = { contents: [{ parts: [{ text: `Modify: ${prompt}. Consistent style. Removed parts alpha=0.` }, { inlineData: { mimeType: "image/png", data: currentImage.split(',')[1] } }]}], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      const base64Data = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
      if (base64Data) { const res = `data:image/png;base64,${base64Data}`; const rec: HistoryRecord = { id: Date.now(), url: res, prompt: prompt, timestamp: new Date().toLocaleTimeString() }; setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec); setPrompt(""); } 
      else throw new Error(result.error?.message || "无图像生成");
    } catch (err: any) { setErrorMessage(String(err.message || err)); } finally { setIsLoading(false); }
  };

  const handleEditClick = () => { if (history.length > 0 && activeRecord?.id !== history[0]?.id) setShowConfirmModal(true); else executeEdit(); };

  // 导出图像为 Blob / Base64 / Canvas
  const exportResult = useCallback(async (outputType: 'blob' | 'base64' | 'canvas' = 'blob'): Promise<any> => {
    if (!currentImage) throw new Error("没有可导出的图像");
    
    // 如果需要返回当前旋转角度未应用的状态，这里返回当前已被应用历史记录的最新图像
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentImage;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("无法创建画布上下文");
    ctx.drawImage(img, 0, 0);

    if (outputType === 'canvas') return canvas;
    if (outputType === 'base64') return canvas.toDataURL('image/png');

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("转换为 Blob 失败"));
      }, 'image/png');
    });
  }, [currentImage]);

  // SDK 完成动作
  const handleFinish = async () => {
    if (!currentImage) {
      if (options.onCancel) options.onCancel();
      return;
    }
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentImage;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(img, 0, 0);
    const base64 = canvas.toDataURL('image/png');
    
    canvas.toBlob((blob) => {
      if (blob && options.onComplete) {
        options.onComplete({ blob, base64, canvas });
      }
    }, 'image/png');
  };

  const handleCancel = () => {
    if (options.onCancel) options.onCancel();
  };

  return {
    version,
    currentImage,
    setCurrentImage,
    activeRecord,
    setActiveRecord,
    history,
    setHistory,
    prompt,
    setPrompt,
    isLoading,
    sidebarOpen,
    setSidebarOpen,
    errorMessage,
    showConfirmModal,
    setShowConfirmModal,
    isDragging,
    setIsDragging,
    showAlphaMask,
    setShowAlphaMask,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    isPanning,
    spacePressed,
    activeTool,
    setActiveTool,
    selectionMode,
    setSelectionMode,
    selectionRegion,
    setSelectionRegion,
    isRegionInverted,
    setIsRegionInverted,
    drawingPath,
    maskCanvas,
    tolerance,
    setTolerance,
    deSpillGreen,
    setDeSpillGreen,
    applyDeSpillGreen,
    sampledColor,
    setSampledColor,
    fillColor,
    setFillColor,
    quadPoints,
    setQuadPoints,
    isPolyClosed,
    setIsPolyClosed,
    polyHoverClose,
    polyMousePos,
    draggingPointIdx,
    regionStart,
    rectDragPoints,
    rotationAngle,
    setRotationAngle,
    imageRef,
    displayMaskRef,
    hasSelection,
    resetWand,
    resetView,
    changeZoom,
    processFile,
    handleUpload,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    handleApplyRotation,
    handleFlipHorizontal,
    handleFlipVertical,
    handleRotate90,
    handleApplyQuadCrop,
    handleCropSelection,
    handleFillSelection,
    handleCropTransparency,
    commitFinalCrop,
    handleInvertSelection,
    toggleInvertSelection,
    clearSelection,
    applyWandCutout,
    executeEdit,
    handleEditClick,
    exportResult,
    handleFinish,
    handleCancel,
    loadImageSource,
  };
}

export type ImageEditorCore = ReturnType<typeof useImageEditorCore>;
