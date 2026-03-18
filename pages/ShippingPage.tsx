
import React from 'react';
import { Package, Anchor, Truck } from 'lucide-react';

type ShippingPageProps = {
    appContext: 'levis' | 'bounty' | 'admin';
}

export const ShippingPage: React.FC<ShippingPageProps> = ({ appContext }) => {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="relative">
                <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex items-center justify-center text-slate-300 relative z-10">
                    <Package size={64} className="text-slate-400 group-hover:animate-bounce" />
                </div>
            </div>
            <div>
                <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-4">Shipping Intelligence Module</h2>
                <p className="text-slate-500 font-bold max-w-lg mx-auto leading-relaxed text-sm uppercase tracking-widest opacity-80">
                    Status: <span className="text-ecomplete-primary">Prototype Development Stage</span>
                </p>
                {appContext !== 'admin' && (
                    <p className="text-ecomplete-primary font-black uppercase tracking-widest text-xs mt-2">
                        Context: {appContext === 'levis' ? "Levi's® South Africa" : "Bounty Apparel"}
                    </p>
                )}
                <p className="text-slate-400 mt-4 max-w-md mx-auto leading-relaxed text-lg font-medium">
                    Future integration will feature outbound performance metrics, inbound stock tracking, and automated courier SLA failure identification.
                </p>
            </div>
            <div className="flex gap-6 mt-10">
                <div className="px-10 py-8 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex flex-col items-center hover:shadow-xl hover:border-blue-200 transition-all cursor-default">
                    <Anchor size={32} className="text-blue-500 mb-4" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Inbound Analytics</span>
                </div>
                <div className="px-10 py-8 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex flex-col items-center hover:shadow-xl hover:border-emerald-200 transition-all cursor-default">
                    <Truck size={32} className="text-emerald-500 mb-4" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Outbound Performance</span>
                </div>
            </div>
        </div>
    );
};
