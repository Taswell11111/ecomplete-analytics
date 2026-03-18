
import React from 'react';
import { LayoutDashboard, Truck, Undo2, ShieldCheck, Lock, XCircle, Loader2, BarChart3 } from 'lucide-react';

type LoginPageProps = {
    activeUser: string | null;
    setActiveUser: (user: any) => void;
    handleLogin: () => void;
    isAuthenticating: boolean;
    error: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
    activeUser, setActiveUser, handleLogin, isAuthenticating, error
}) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#050505] via-slate-900 to-blue-950 flex items-stretch font-sans text-slate-300 selection:bg-blue-500/30 relative overflow-hidden">
            {/* Global Diamond Pattern Overlay */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIwIDAgTDQwIDIwIEwyMCA0MCBMMCAyMCBaIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')] opacity-100 pointer-events-none z-0"></div>
            
            {/* Global Atmospheric Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-ecomplete-primary/30 rounded-full blur-[120px] pointer-events-none z-0"></div>
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_top_right,_rgba(30,58,138,0.4),_transparent_60%)] pointer-events-none mix-blend-screen z-0"></div>
            <div className="absolute bottom-0 left-[20%] w-[600px] h-[600px] bg-[radial-gradient(circle_at_bottom_left,_rgba(15,23,42,0.6),_transparent_50%)] pointer-events-none mix-blend-screen z-0"></div>

            {/* Left Content Panel - Dark Luxury / Technical */}
            <div className="hidden lg:flex w-[67%] relative flex-col justify-between p-10 border-r border-white/10 z-10 bg-black/20 backdrop-blur-sm">

                <div className="z-10">
                    <div className="flex items-center gap-6 mb-10">
                        <div className="w-16 h-16 bg-ecomplete-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-ecomplete-primary/20 border border-white/10">
                            <BarChart3 size={32} />
                        </div>
                        <div>
                            <h1 className="text-[40px] font-black text-white tracking-tight leading-none">eCompleteCommerce</h1>
                            <p className="text-ecomplete-accent text-lg font-bold uppercase tracking-[0.3em] mt-2">Analytics Centre</p>
                        </div>
                    </div>

                    <div className="space-y-8 max-w-3xl mt-10">
                        <div className="group flex gap-6 items-start">
                            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-ecomplete-accent shrink-0 group-hover:scale-110 group-hover:bg-ecomplete-accent/10 group-hover:border-ecomplete-accent/30 transition-all duration-500 shadow-lg">
                                <LayoutDashboard size={22}/>
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-xl mb-2 tracking-tight">Unified Support Ecosystem</h3>
                                <div className="text-slate-400 text-sm leading-relaxed space-y-1">
                                    <p>&gt; Deep-dive sentiment analysis and proactive risk assessment across all support channels.</p>
                                    <p>&gt; Instantly identify bottlenecks and elevate customer satisfaction through AI-driven insights.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="group flex gap-6 items-start">
                            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-ecomplete-accent shrink-0 group-hover:scale-110 group-hover:bg-ecomplete-accent/10 group-hover:border-ecomplete-accent/30 transition-all duration-500 shadow-lg">
                                <Truck size={22}/>
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-xl mb-2 tracking-tight">Logistics Synchronisation</h3>
                                <div className="text-slate-400 text-sm leading-relaxed space-y-1">
                                    <p>&gt; Real-time performance tracking for outbound freight and warehouse receipting accuracy.</p>
                                    <p>&gt; Ensure seamless supply chain operations with predictive delay alerts and carrier metrics.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="group flex gap-6 items-start">
                            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-ecomplete-accent shrink-0 group-hover:scale-110 group-hover:bg-ecomplete-accent/10 group-hover:border-ecomplete-accent/30 transition-all duration-500 shadow-lg">
                                <Undo2 size={22}/>
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-xl mb-2 tracking-tight">Returns Lifecycle</h3>
                                <div className="text-slate-400 text-sm leading-relaxed space-y-1">
                                    <p>&gt; A unified view of RMAs and claim processing to identify systematic friction.</p>
                                    <p>&gt; Reduce return rates and optimise reverse logistics with comprehensive root-cause analysis.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="z-10 flex items-center justify-between border-t border-white/10 pt-4 mt-10">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-ecomplete-accent animate-pulse"></div>
                        <span className="text-slate-400 text-xs font-medium tracking-wide">System Operational</span>
                    </div>
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Powered by Gemini</span>
                </div>
            </div>

            {/* Right Login Panel - Clean Utility */}
            <div className="w-full lg:w-[33%] flex flex-col items-center justify-center p-6 lg:p-8 relative z-20 bg-black/40 backdrop-blur-md">
                <div className="w-full max-w-sm space-y-4 relative z-10">
                    <div className="text-center lg:text-left space-y-1">
                        <div className="inline-flex lg:hidden items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-ecomplete-primary rounded-lg flex items-center justify-center text-white shadow-lg">
                                <BarChart3 size={20} />
                            </div>
                            <div className="text-left">
                                <h1 className="text-lg font-bold text-white leading-none">eCompleteCommerce</h1>
                                <p className="text-ecomplete-accent text-[9px] font-bold uppercase tracking-[0.2em] mt-0.5">Analytics Centre</p>
                            </div>
                        </div>
                        
                        <h2 className="text-xl lg:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-ecomplete-accent tracking-tight drop-shadow-sm">Instant data and reporting dashboard.</h2>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-medium text-slate-400 ml-1">Client Identity</label>
                            <div className="relative group">
                                <input 
                                    type="text"
                                    className="w-full p-2.5 pl-9 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-ecomplete-primary/50 focus:border-ecomplete-primary/50 outline-none transition-all placeholder:text-slate-600" 
                                    value={activeUser || ''} 
                                    onChange={(e) => setActiveUser(e.target.value)}
                                    placeholder="Enter profile name..."
                                    onKeyDown={(e) => e.key === 'Enter' && activeUser && !isAuthenticating && handleLogin()}
                                />
                                <ShieldCheck className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-ecomplete-accent transition-colors" size={14} />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-[9px] font-medium bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                <XCircle size={12} className="shrink-0" /> {error}
                            </div>
                        )}

                        <div>
                            <button 
                                onClick={handleLogin} 
                                disabled={isAuthenticating || !activeUser} 
                                className="w-full bg-white text-black font-semibold py-2.5 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:bg-slate-200 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {isAuthenticating ? <Loader2 className="animate-spin text-black" size={14} /> : <Lock size={14} className="text-black" />} 
                                Access Analytics Centre
                            </button>
                            <p className="text-[8px] text-slate-500 text-center mt-2 uppercase tracking-wider">
                                N.B. IP addresses are taken into record upon accessing the analytics system.
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="w-full text-center pt-4 relative z-10">
                    <span className="text-slate-400 text-[8px] font-bold uppercase tracking-widest">Confidential Property of eCompleteCommerce</span>
                </div>
            </div>
        </div>
    );
};
