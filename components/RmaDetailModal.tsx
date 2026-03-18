import React, { useState } from 'react';
import { X, Copy, ExternalLink, Check, DollarSign, Package, User } from 'lucide-react';
import { ReturnGoRMA } from '../types';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';

type RmaDetailModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    rmas: ReturnGoRMA[];
    shopName: string; // Add shopName to construct correct RMA link
    onRmaClick: (rmaId: string) => void;
}

export const RmaDetailModal: React.FC<RmaDetailModalProps> = ({ isOpen, onClose, title, rmas, shopName, onRmaClick }) => {
    const [copiedTracking, setCopiedTracking] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('All');

    if (!isOpen) return null;

    const filteredRmas = statusFilter === 'All' 
        ? rmas 
        : rmas.filter(rma => (rma.rmaSummary?.status || rma.status) === statusFilter);

    const statuses = ['All', ...new Set(rmas.map(rma => rma.rmaSummary?.status || rma.status || 'Unknown'))];

    const handleCopyTracking = (trackingNumber: string) => {
        navigator.clipboard.writeText(trackingNumber);
        setCopiedTracking(trackingNumber);
        setTimeout(() => setCopiedTracking(null), 2000);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-ecomplete-primary uppercase tracking-wide">{title}</h3>
                        <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{filteredRmas.length} / {rmas.length} RMAs Found</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <select 
                            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ecomplete-primary"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <X size={24}/>
                        </button>
                    </div>
                </div>
                
                {/* Content Table */}
                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-black tracking-[0.2em] sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 border-b border-slate-200">RMA #</th>
                                <th className="p-4 border-b border-slate-200">Order #</th>
                                <th className="p-4 border-b border-slate-200">Customer</th>
                                <th className="p-4 border-b border-slate-200">Status</th>
                                <th className="p-4 border-b border-slate-200">Reason</th>
                                <th className="p-4 border-b border-slate-200 text-center">Days Open</th>
                                <th className="p-4 border-b border-slate-200">Tracking #</th>
                                <th className="p-4 border-b border-slate-200">Resolution Type</th>
                                <th className="p-4 border-b border-slate-200 text-center">Actioned</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRmas.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-medium italic">No matching RMAs found.</td></tr>
                            ) : (
                                filteredRmas.map((rma) => (
                                    <tr key={rma.rmaId} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onRmaClick(rma.rmaId)}>
                                        <td className="p-4 text-blue-600 font-black flex items-center gap-2">
                                            {rma.rmaId}
                                        </td>
                                        <td className="p-4 font-bold text-slate-800">{rma.orderName || 'N/A'}</td>
                                        <td className="p-4 text-slate-700 font-medium flex items-center gap-2">
                                            <User size={14} className="text-slate-400"/>
                                            {rma.customerName || 'Guest'}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-600 bg-slate-200 border border-slate-300">
                                                {rma.rmaSummary?.status || rma.status || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-700 text-xs font-medium">
                                            {rma.items && rma.items.length > 0 ? rma.items[0].returnReason || 'N/A' : 'N/A'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {(() => {
                                                const dateStr = rma.createdAt || rma.rma_created_at;
                                                if (!dateStr) return <span className="text-slate-400 italic text-xs">N/A</span>;
                                                const parsedDate = parseISO(dateStr);
                                                if (!isValid(parsedDate)) return <span className="text-slate-400 italic text-xs">N/A</span>;
                                                const days = differenceInDays(new Date(), parsedDate);
                                                return <span className={`font-bold ${days > 14 ? 'text-amber-600' : 'text-slate-700'}`}>{days} days</span>;
                                            })()}
                                        </td>
                                        <td className="p-4">
                                            {rma.trackingNumber ? (
                                                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 text-slate-700 text-xs font-mono">
                                                    <span>{rma.trackingNumber}</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleCopyTracking(rma.trackingNumber!); }} 
                                                        className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-colors"
                                                        title="Copy tracking number"
                                                    >
                                                        {copiedTracking === rma.trackingNumber ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic text-xs">No Tracking</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-600 bg-slate-200 border border-slate-300">
                                                {rma.resolutionTypeOverall || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {rma.resolutionActioned ? (
                                                <span className="px-4 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">Yes</span>
                                            ) : (
                                                <span className="px-4 py-1 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700">No</span>
                                            )}
                                        </td>
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
