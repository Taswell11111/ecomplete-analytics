import React, { useState, useEffect } from 'react';
import { X, Loader2, Package, User, DollarSign, MessageSquare, Truck } from 'lucide-react';
import { ReturnGoRMA } from '../types';
import { fetchRmaDetail } from '../services/returnGoService';
import { format, parseISO } from 'date-fns';

type RmaFullDetailModalProps = {
    isOpen: boolean;
    onClose: () => void;
    rmaId: string;
    shopName: string;
}

export const RmaFullDetailModal: React.FC<RmaFullDetailModalProps> = ({ isOpen, onClose, rmaId, shopName }) => {
    const [rma, setRma] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && rmaId) {
            setLoading(true);
            fetchRmaDetail(shopName, rmaId)
                .then(setRma)
                .finally(() => setLoading(false));
        }
    }, [isOpen, rmaId, shopName]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-wide">RMA Details: {rmaId}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={24}/>
                    </button>
                </div>
                
                <div className="flex-1 overflow-auto p-8">
                    {loading ? (
                        <div className="flex items-center justify-center h-full"><Loader2 size={40} className="animate-spin text-ecomplete-primary" /></div>
                    ) : rma ? (
                        <div className="space-y-8">
                            {/* Summary Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</div>
                                    <div className="text-lg font-bold text-slate-900 flex items-center gap-2"><User size={16}/> {rma.customer?.name || 'N/A'}</div>
                                    <div className="text-sm text-slate-600">{rma.customer?.email || 'N/A'}</div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order</div>
                                    <div className="text-lg font-bold text-slate-900">{rma.orderName || 'N/A'}</div>
                                    <div className="text-sm text-slate-600">{format(parseISO(rma.createdAt), 'PPP')}</div>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Package size={18} /> Items
                                </h4>
                                <div className="space-y-2">
                                    {rma.items?.map((item: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl">
                                            <div className="font-bold text-slate-800">{item.productName}</div>
                                            <div className="text-sm text-slate-600">{item.returnReason}</div>
                                            <div className="font-mono font-bold text-slate-900">R{item.paidPrice?.amount || 0}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Shipments */}
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Truck size={18} /> Shipments
                                </h4>
                                {rma.shipments?.length > 0 ? (
                                    rma.shipments.map((s: any, i: number) => (
                                        <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl">
                                            <div className="text-xs font-bold text-slate-500">Tracking: {s.trackingNumber || 'N/A'}</div>
                                            <div className="text-sm font-medium text-slate-800">Carrier: {s.carrier || 'N/A'}</div>
                                        </div>
                                    ))
                                ) : <p className="text-sm text-slate-400 italic">No shipment info.</p>}
                            </div>

                            {/* Comments */}
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <MessageSquare size={18} /> Comments
                                </h4>
                                {rma.comments?.length > 0 ? (
                                    rma.comments.map((c: any, i: number) => (
                                        <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl mb-2">
                                            <div className="text-xs font-bold text-slate-500">{c.author} - {format(parseISO(c.createdAt), 'PPp')}</div>
                                            <div className="text-sm text-slate-800 mt-1">{c.text}</div>
                                        </div>
                                    ))
                                ) : <p className="text-sm text-slate-400 italic">No comments.</p>}
                            </div>
                        </div>
                    ) : <p className="text-center text-slate-500">Failed to load RMA details.</p>}
                </div>
            </div>
        </div>
    );
};
