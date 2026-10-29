import React from 'react';
import { History, Trash2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageEditorCore } from '../core/useImageEditorCore';

interface SidebarProps {
  core: ImageEditorCore;
}

export const Sidebar: React.FC<SidebarProps> = ({ core }) => {
  const {
    sidebarOpen,
    setSidebarOpen,
    history,
    setHistory,
    setCurrentImage,
    activeRecord,
    setActiveRecord,
    setPrompt,
    resetWand,
  } = core;

  return (
    <>
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-white border-r border-slate-200 flex flex-col relative overflow-hidden shadow-sm shrink-0`}>
        <div className="p-2 border-b border-slate-100 flex justify-between items-center whitespace-nowrap text-xs leading-none">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-blue-50 text-blue-600 font-black rounded">
              <History size={14} />
            </div>
            <span className="font-bold text-slate-700">编辑历史</span>
          </div>
          <button 
            onClick={() => {
              setHistory([]); 
              setCurrentImage(null); 
              setActiveRecord(null); 
              setPrompt(""); 
              resetWand();
            }} 
            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors rounded"
            title="清空历史"
          >
            <Trash2 size={12} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
          {history.map((item) => (
            <div 
              key={item.id} 
              onClick={() => { setCurrentImage(item.url); setActiveRecord(item); }} 
              className={`group cursor-pointer border-2 p-1.5 transition-all duration-200 rounded-xl ${activeRecord?.id === item.id ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
            >
              <div className="relative aspect-[4/3] overflow-hidden mb-1 bg-slate-100 border border-slate-200 shadow-inner rounded-lg leading-[0]">
                <img src={item.url} alt="History" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <RotateCcw size={16} className="text-blue-600" />
                </div>
              </div>
              <p className="px-0.5 text-[9px] font-medium text-slate-500 truncate leading-tight italic">"{item.prompt}"</p>
            </div>
          ))}
        </div>
      </aside>

      {/* 展开/收起按钮 */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)} 
        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-white border border-slate-200 shadow-sm p-1 text-slate-400 hover:text-blue-600 transition-colors rounded-r-lg"
      >
        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </>
  );
};
