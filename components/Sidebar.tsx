
import React from 'react';
import { Clock, Trash2, Download, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SavedReport } from '../types';
import { format } from 'date-fns';

type SidebarProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  savedReports: SavedReport[];
  onLoadReport: (report: SavedReport) => void;
  onDeleteReport: (id: string) => void;
  onDownloadReport: (report: SavedReport) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, savedReports, onLoadReport, onDeleteReport, onDownloadReport }) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[45] lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div 
        className={`fixed left-0 bg-white border-r border-slate-200 transition-all duration-300 flex flex-col
          /* Mobile: Full height overlay, slide-in */
          z-[50] top-0 h-full w-80 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          /* Desktop: Below header, width transition */
          lg:translate-x-0 lg:z-40 lg:top-[100px] lg:h-[calc(100vh-100px)] lg:shadow-xl
          ${isOpen ? 'lg:w-80' : 'lg:w-0 lg:border-r-0 lg:overflow-hidden'}
        `}
      >
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                <Clock size={14} /> Report History
            </h3>
            <div className="flex items-center gap-2">
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{savedReports.length}</span>
                {/* Mobile Close Button */}
                <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
                    <X size={18} />
                </button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {savedReports.length === 0 ? (
                <div className="text-center p-8 text-slate-400 text-sm">No saved reports yet. Generate a report to see it here.</div>
            ) : (
                savedReports.map(report => (
                    <div key={report.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="font-bold text-slate-700 text-sm">{report.group.name}</div>
                                <div className="text-xs text-slate-400">{format(new Date(report.timestamp), 'dd MMM HH:mm')}</div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteReport(report.id); }}
                                className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                title="Delete Report"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <button 
                                onClick={() => { onLoadReport(report); if(window.innerWidth < 1024) setIsOpen(false); }}
                                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                            >
                                <Eye size={12} /> Load
                            </button>
                            <button 
                                onClick={() => onDownloadReport(report)}
                                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                            >
                                <Download size={12} /> HTML
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Desktop Toggle Button (Hidden on Mobile) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`hidden lg:flex fixed top-[110px] transition-all duration-300 z-50 bg-white border border-slate-200 shadow-md p-1.5 rounded-r-lg text-slate-500 hover:text-blue-600 items-center justify-center ${isOpen ? 'left-80' : 'left-0'}`}
        title={isOpen ? "Close History" : "Open History"}
      >
        {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>
    </>
  );
};
