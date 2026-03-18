
import React from 'react';
import { X, Clock } from 'lucide-react';
import { TicketActivity } from '../types';
import { formatDistanceToNow } from 'date-fns';

type MetricDetailModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    tickets: TicketActivity[];
    onTicketClick?: (ticket: TicketActivity) => void;
}

export const MetricDetailModal: React.FC<MetricDetailModalProps> = ({
    isOpen, onClose, title, tickets, onTicketClick
}) => {
    if (!isOpen) return null;

    const getUrgencyColor = (urgency: string) => {
        switch(urgency.toUpperCase()) {
            case 'CRITICAL': return '#ef4444';
            case 'HIGH': return '#f97316';
            case 'MEDIUM': return '#eab308';
            case 'LOW': return '#22c55e';
            default: return '#94a3b8';
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-ecomplete-primary uppercase tracking-wide">{title}</h3>
                        <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{tickets.length} Tickets Found</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24}/></button>
                </div>
                
                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-black tracking-[0.2em] sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 border-b border-slate-200">Ticket #</th>
                                <th className="p-4 border-b border-slate-200 w-1/4">Subject</th>
                                <th className="p-4 border-b border-slate-200">Category</th>
                                <th className="p-4 border-b border-slate-200">Store</th>
                                <th className="p-4 border-b border-slate-200">Urgency</th>
                                <th className="p-4 border-b border-slate-200">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tickets.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-medium italic">No matching tickets found.</td></tr>
                            ) : (
                                tickets.map((act) => (
                                    <tr 
                                        key={act.ticket.id} 
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                        onClick={() => onTicketClick && onTicketClick(act)}
                                    >
                                        <td className="p-4 text-blue-600 font-black">#{act.ticket.id}</td>
                                        <td className="p-4 font-bold text-slate-800 line-clamp-1">{act.ticket.subject}</td>
                                        <td className="p-4"><span className="px-2 py-1 rounded-md text-[10px] font-black uppercase text-slate-600 bg-slate-200 border border-slate-300">{act.analysis.category}</span></td>
                                        <td className="p-4 font-bold text-slate-600 text-xs">{act.brandName || 'Unknown'}</td>
                                        <td className="p-4"><span className="px-3 py-1 rounded-full text-[10px] font-black uppercase text-white shadow-sm" style={{ backgroundColor: getUrgencyColor(act.analysis.urgency) }}>{act.analysis.urgency}</span></td>
                                        <td className="p-4 text-[10px] text-slate-400 font-black uppercase tracking-tight whitespace-nowrap">{formatDistanceToNow(new Date(act.ticket.created_at))} ago</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
