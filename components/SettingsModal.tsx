
import React from 'react';
import { X, Save, Key, Globe, Eye, EyeOff, Smartphone, Monitor, Truck } from 'lucide-react';
import { ConnectionMode, TestConnectionStatus } from '../types';

type SettingsModalProps = {
    isOpen: boolean;
    onClose: () => void;

    connectionMode: ConnectionMode;
    setConnectionMode: (mode: ConnectionMode) => void;
    testStatus: TestConnectionStatus;
    onTestConnection: () => void;
    returnGoTestStatus: TestConnectionStatus;
    onTestReturnGoConnection: () => void;
    returnGoTestError?: string | null;
    parcelninjaTestStatus: TestConnectionStatus;
    onTestParcelninjaConnection: () => void;
    parcelninjaTestDetails?: Record<string, { success: boolean, message?: string }> | null;
    testMode: boolean;
    setTestMode: (mode: boolean) => void;
    mobileMode: boolean;
    setMobileMode: (mode: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, 
    connectionMode, setConnectionMode,
    testStatus, onTestConnection,
    returnGoTestStatus, onTestReturnGoConnection,
    returnGoTestError,
    parcelninjaTestStatus, onTestParcelninjaConnection,
    parcelninjaTestDetails,
    mobileMode, setMobileMode
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-xl font-black text-ecomplete-primary uppercase tracking-tight flex items-center gap-3">
                        System Configuration
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20}/>
                    </button>
                </div>
                
                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                    {/* Device Selection Section */}
                    <div className="space-y-4">
                        <h4 className="font-black text-slate-800 flex items-center gap-2 text-xs uppercase tracking-widest"><Monitor size={16}/> Interface Mode</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setMobileMode(false)}
                                className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${!mobileMode ? 'bg-ecomplete-primary border-ecomplete-primary text-white shadow-xl' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                                <Monitor size={24} />
                                <span className="font-black text-[10px] uppercase tracking-widest">Desktop Review</span>
                            </button>
                            <button 
                                onClick={() => setMobileMode(true)}
                                className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${mobileMode ? 'bg-ecomplete-primary border-ecomplete-primary text-white shadow-xl' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                                <Smartphone size={24} />
                                <span className="font-black text-[10px] uppercase tracking-widest">Mobile Review</span>
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* Freshdesk Config */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-black text-slate-800 flex items-center gap-2 text-xs uppercase tracking-widest"><Key size={16}/> Freshdesk Auth</h4>
                            <button 
                                onClick={onTestConnection} 
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${testStatus === 'success' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                            >
                                {testStatus === 'testing' ? 'Testing...' : testStatus === 'success' ? 'Link Valid' : 'Verify Connection'}
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Traffic Route</label>
                            <select 
                                value={connectionMode} 
                                onChange={e => setConnectionMode(e.target.value as ConnectionMode)}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold appearance-none"
                            >
                                <option value="direct">Direct Tunnel</option>
                                <option value="proxy">Relay Proxy</option>
                            </select>
                        </div>
                    </div>

                    {/* Parcelninja Config */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-black text-slate-800 flex items-center gap-2 text-xs uppercase tracking-widest"><Truck size={16}/> Parcelninja Auth</h4>
                            <button 
                                onClick={onTestParcelninjaConnection} 
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${parcelninjaTestStatus === 'success' ? 'bg-green-50 text-green-600 border-green-200' : parcelninjaTestStatus === 'failed' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                            >
                                {parcelninjaTestStatus === 'testing' ? 'Testing...' : parcelninjaTestStatus === 'success' ? 'All Stores Valid' : parcelninjaTestStatus === 'failed' ? 'Some Stores Failed' : 'Verify Connection'}
                            </button>
                        </div>
                        {parcelninjaTestStatus === 'success' && (
                            <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">✓ All Parcelninja stores connected successfully</p>
                        )}
                        {parcelninjaTestStatus === 'failed' && (
                            <div className="space-y-2">
                                <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">✕ Some Parcelninja stores failed to connect</p>
                                <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
                                    {parcelninjaTestDetails && Object.entries(parcelninjaTestDetails).map(([store, res]: [string, any]) => (
                                        <div key={store} className="flex items-center justify-between gap-4">
                                            <span className="text-[10px] font-bold text-slate-700">{store}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase tracking-wider ${res.success ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {res.success ? 'OK' : 'Failed'}
                                                </span>
                                                {!res.success && (
                                                    <span className="text-[8px] text-red-400 font-medium max-w-[150px] truncate" title={res.message}>
                                                        ({res.message})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* ReturnGo Config */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-black text-slate-800 flex items-center gap-2 text-xs uppercase tracking-widest"><Globe size={16}/> Returngo Auth</h4>
                            <button 
                                onClick={onTestReturnGoConnection} 
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${returnGoTestStatus === 'success' ? 'bg-green-50 text-green-600 border-green-200' : returnGoTestStatus === 'failed' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                            >
                                {returnGoTestStatus === 'testing' ? 'Testing...' : returnGoTestStatus === 'success' ? 'Connection Valid' : returnGoTestStatus === 'failed' ? 'Connection Failed' : 'Verify Connection'}
                            </button>
                        </div>
                        {returnGoTestStatus === 'success' && (
                            <p className="text-[10px] text-green-600 font-black uppercase tracking-widest">✓ ReturnGo API Connection Successful</p>
                        )}
                        {returnGoTestStatus === 'failed' && (
                            <div className="space-y-1">
                                <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">✕ ReturnGo API Connection Failed</p>
                                {returnGoTestError && (
                                    <p className="text-[9px] text-red-500 font-bold bg-red-50 p-2 rounded-lg border border-red-100 break-words">
                                        {returnGoTestError}
                                    </p>
                                )}
                            </div>
                        )}
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            Validates API connectivity for Diesel, Hurley, Jeep, Reebok, and Superdry stores.
                        </p>
                    </div>

                    <div className="h-px bg-slate-100"></div>

                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="bg-ecomplete-primary text-white font-black py-4 px-10 rounded-2xl hover:bg-slate-800 transition-all flex items-center gap-3 uppercase text-xs tracking-widest shadow-xl shadow-blue-900/20">
                        <Save size={18} /> Update Environment
                    </button>
                </div>
            </div>
        </div>
    );
};
