
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Loader2, X, Terminal, ShieldCheck, AlertCircle, Package, RefreshCw } from 'lucide-react';
import { testConnection as testFreshdesk } from '../services/freshdeskService';
import { testReturnGoRmas as testReturnGo } from '../services/returnGoService';
import { testParcelninjaConnection as testParcelninja } from '../services/parcelninjaService';
import { testGeminiConnection as testGemini } from '../services/geminiService';
import { RETURNGO_LEVIS_STORE_URL } from '../constants';

interface ConnectionLog {
    service: string;
    status: 'pending' | 'success' | 'failed';
    message: string;
    timestamp: string;
    details?: string;
    extraInfo?: React.ReactNode;
}

interface ConnectionValidatorProps {
    isOpen: boolean;
    onClose: () => void;
    appContext: 'levis' | 'bounty' | 'admin';
}

export const ConnectionValidator: React.FC<ConnectionValidatorProps> = ({ isOpen, onClose, appContext }) => {
    const [logs, setLogs] = useState<ConnectionLog[]>([
        { service: 'Freshdesk', status: 'pending', message: 'Initializing connection...', timestamp: new Date().toLocaleTimeString() },
        { service: 'Parcelninja', status: 'pending', message: 'Initializing connection...', timestamp: new Date().toLocaleTimeString() },
        { service: 'ReturnGo', status: 'pending', message: 'Initializing connection...', timestamp: new Date().toLocaleTimeString() },
        { service: 'Gemini AI', status: 'pending', message: 'Initializing connection...', timestamp: new Date().toLocaleTimeString() },
    ]);
    const [isComplete, setIsComplete] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [showDetails, setShowDetails] = useState<string | null>(null);

    const updateLog = (service: string, status: 'success' | 'failed', message: string, details?: string, extraInfo?: React.ReactNode) => {
        setLogs(prev => prev.map(log => 
            log.service === service 
                ? { ...log, status, message, timestamp: new Date().toLocaleTimeString(), details, extraInfo } 
                : log
        ));
    };

    useEffect(() => {
        if (!isOpen) return;

        const runTests = async () => {
            // Freshdesk
            try {
                const fdResult = await testFreshdesk({ connectionMode: 'direct' });
                updateLog('Freshdesk', fdResult.success ? 'success' : 'failed', fdResult.message, fdResult.success ? undefined : fdResult.message);
            } catch (e: any) {
                updateLog('Freshdesk', 'failed', 'Network failure', e.message);
            }

            // Parcelninja
            try {
                const pnResult = await testParcelninja(appContext);
                let details = '';
                let extraInfo: React.ReactNode = null;

                if (pnResult.details && Object.keys(pnResult.details).length > 0) {
                    const storeResults = Object.entries(pnResult.details as Record<string, any>);
                    details = storeResults
                        .map(([store, res]) => `${store}: ${res.success ? 'OK' : 'FAILED (' + res.message + ')'}`)
                        .join('\n');

                    extraInfo = (
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                <Package size={10} />
                                Recent Outbounds
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                                {storeResults.map(([store, res]) => (
                                    <div key={store} className="flex items-center justify-between p-2 bg-slate-950/50 rounded-lg border border-slate-800/50">
                                        <span className="text-[9px] font-bold text-slate-400">{store}</span>
                                        {res.lastOutbound ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-mono text-emerald-400">{res.lastOutbound.outboundNo}</span>
                                                <span className="text-[8px] text-slate-600">{new Date(res.lastOutbound.createDate).toLocaleDateString()}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[8px] text-slate-600 italic">No data</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                } else if (!pnResult.success) {
                    details = pnResult.message;
                }
                updateLog('Parcelninja', pnResult.success ? 'success' : 'failed', pnResult.message, details, extraInfo);
            } catch (e: any) {
                updateLog('Parcelninja', 'failed', 'Network failure', e.message);
            }

            // ReturnGo
            try {
                const rgResults = await testReturnGo(appContext);
                const storeResults = Object.entries(rgResults);
                const failed = storeResults.filter(([_, r]) => !r.success);
                
                let details = storeResults.map(([name, r]) => `${name}: ${r.success ? 'OK' : 'FAILED (' + r.error + ')'}`).join('\n');
                
                const extraInfo = (
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            <RefreshCw size={10} />
                            Recent RMAs
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                            {storeResults.map(([name, r]) => (
                                <div key={name} className="flex items-center justify-between p-2 bg-slate-950/50 rounded-lg border border-slate-800/50">
                                    <span className="text-[9px] font-bold text-slate-400">{name}</span>
                                    {r.success && r.rmaId ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-mono text-blue-400">{r.rmaId}</span>
                                            <span className="text-[8px] text-slate-600">{r.daysSinceUpdate}d ago</span>
                                        </div>
                                    ) : (
                                        <span className="text-[8px] text-slate-600 italic">{r.success ? 'No RMAs' : 'Error'}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );

                if (failed.length === 0) {
                    updateLog('ReturnGo', 'success', `All ${storeResults.length} stores verified`, undefined, extraInfo);
                } else {
                    updateLog('ReturnGo', 'failed', `${failed.length}/${storeResults.length} stores failed`, details, extraInfo);
                }
            } catch (e: any) {
                updateLog('ReturnGo', 'failed', 'Network failure', e.message);
            }

            // Gemini AI
            try {
                const geminiResult = await testGemini();
                updateLog('Gemini AI', geminiResult.success ? 'success' : 'failed', geminiResult.message, geminiResult.success ? undefined : geminiResult.message);
            } catch (e: any) {
                updateLog('Gemini AI', 'failed', 'Network failure', e.message);
            }
        };

        runTests();
    }, [isOpen, appContext]);

    useEffect(() => {
        const allFinished = logs.every(log => log.status !== 'pending');
        if (allFinished) {
            const anyFailed = logs.some(log => log.status === 'failed');
            setHasError(anyFailed);
            setIsComplete(true);

            if (!anyFailed) {
                const timer = setTimeout(() => {
                    onClose();
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [logs, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasError ? 'bg-red-500/20 text-red-400' : isComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {isComplete ? (hasError ? <AlertCircle size={24} /> : <ShieldCheck size={24} />) : <Loader2 size={24} className="animate-spin" />}
                        </div>
                        <div>
                            <h3 className="text-white font-black uppercase text-sm tracking-[0.2em]">System Verification</h3>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                {isComplete ? 'Verification Sequence Complete' : 'Executing Connection Protocol...'}
                            </p>
                        </div>
                    </div>
                    {hasError && (
                        <button 
                            onClick={onClose}
                            className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Logs Area */}
                <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {logs.map((log, idx) => (
                        <div key={idx} className="group">
                            <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                                log.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' : 
                                log.status === 'failed' ? 'bg-red-500/5 border-red-500/20' : 
                                'bg-slate-800/30 border-slate-800'
                            }`}>
                                <div className="flex items-center gap-4">
                                    <div className={`shrink-0 ${
                                        log.status === 'success' ? 'text-emerald-400' : 
                                        log.status === 'failed' ? 'text-red-400' : 
                                        'text-slate-600'
                                    }`}>
                                        {log.status === 'success' && <CheckCircle2 size={20} />}
                                        {log.status === 'failed' && <XCircle size={20} />}
                                        {log.status === 'pending' && <Loader2 size={20} className="animate-spin" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-black text-xs uppercase tracking-wider">{log.service}</span>
                                            <span className="text-slate-600 text-[9px] font-mono">[{log.timestamp}]</span>
                                        </div>
                                        <p className={`text-[10px] mt-0.5 ${
                                            log.status === 'success' ? 'text-emerald-500/70' : 
                                            log.status === 'failed' ? 'text-red-500/70' : 
                                            'text-slate-500'
                                        }`}>
                                            {log.message}
                                        </p>
                                    </div>
                                </div>
                                
                                {log.status === 'failed' && (
                                    <button 
                                        onClick={() => setShowDetails(showDetails === log.service ? null : log.service)}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                                    >
                                        {showDetails === log.service ? 'Hide Details' : 'View Error'}
                                    </button>
                                )}
                            </div>

                            {log.extraInfo && (
                                <div className="px-4 pb-3">
                                    <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/50 font-mono text-[10px] text-slate-400 leading-relaxed">
                                        {log.extraInfo}
                                    </div>
                                </div>
                            )}

                            <AnimatePresence>
                                {showDetails === log.service && log.details && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-2 p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[10px] text-red-400/80 leading-relaxed break-all">
                                            <div className="flex items-center gap-2 mb-2 text-slate-600 font-black uppercase tracking-widest text-[8px]">
                                                <Terminal size={10} />
                                                Error Trace
                                            </div>
                                            {log.details}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isComplete ? (hasError ? 'bg-red-500 animate-pulse' : 'bg-emerald-500') : 'bg-blue-500 animate-pulse'}`} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {isComplete ? (hasError ? 'Action Required' : 'System Nominal') : 'Verification in Progress'}
                        </span>
                    </div>
                    {isComplete && !hasError && (
                        <span className="text-emerald-500 font-black text-[10px] uppercase tracking-widest animate-pulse">
                            Redirecting to Dashboard...
                        </span>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
