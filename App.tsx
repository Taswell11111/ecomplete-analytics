
import React, { useState, useEffect } from 'react';
import { Group, ConnectionMode, TestConnectionStatus, TicketScope } from './types';
import { ECOMPLETE_GROUPS, CONSOLIDATED_GROUP_ID, RETURNGO_LEVIS_STORE_URL, BOUNTY_DIESEL_URL } from './constants';
import { testConnection } from './services/freshdeskService';
import { testReturnGoConnection } from './services/returnGoService';
import { Activity, LayoutDashboard, Truck, Undo2, ChevronLeft, ChevronRight, Settings, Package } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InsightReportPage } from './pages/InsightReportPage';
import { ShippingDashboard } from './shipping/Dashboard';
import { ReturnsPage } from './pages/ReturnsPage';
import { ConnectionValidator } from './components/ConnectionValidator';

import { ErrorBoundary } from './components/ErrorBoundary';

type Page = 'dashboard' | 'shipping' | 'returns' | 'insight' | 'inventory';

const App: React.FC = () => {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Core State ---
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [selectedGroup, setSelectedGroup] = useState<Group>(ECOMPLETE_GROUPS[0]);
  const [availableGroups, setAvailableGroups] = useState<Group[]>(ECOMPLETE_GROUPS);
  const [appContext, setAppContext] = useState<'levis' | 'bounty' | 'admin'>('admin');
  const [ticketScope, setTicketScope] = useState<TicketScope>('25');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [visitedPages, setVisitedPages] = useState<Set<string>>(new Set(['dashboard']));

  useEffect(() => {
    setVisitedPages(prev => new Set(prev).add(activePage));
  }, [activePage]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Connection Settings

  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(() => (localStorage.getItem('freshdesk_connection_mode') as ConnectionMode) || 'direct');
  
  // UI State
  const [testStatus, setTestStatus] = useState<TestConnectionStatus>('idle');
  const [returnGoTestStatus, setReturnGoTestStatus] = useState<TestConnectionStatus>('idle');
  const [returnGoTestError, setReturnGoTestError] = useState<string | null>(null);
  const [parcelninjaTestStatus, setParcelninjaTestStatus] = useState<TestConnectionStatus>('idle');
  const [parcelninjaTestDetails, setParcelninjaTestDetails] = useState<Record<string, { success: boolean, message?: string }> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showValidator, setShowValidator] = useState(false);

  useEffect(() => {
    // No longer handling API key here
  }, [activeUser]);

  // --- Shared Dashboard State (for Insight Report) ---
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [dashboardActivities, setDashboardActivities] = useState<any[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);

  // --- Audio State ---
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const playbackIdRef = React.useRef(0);

  const playAudio = async (base64: string) => {
    if (!base64) {
        console.error("Audio base64 is empty");
        return;
    }
    
    const currentId = ++playbackIdRef.current;
    
    if (audioRef.current) {
        audioRef.current.pause();
    }
    
    // Play chime sound (like phone charger)
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // First tone
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.type = 'sine';
        osc1.frequency.value = 659.25; // E5
        gain1.gain.setValueAtTime(0, audioCtx.currentTime);
        gain1.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc1.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 0.3);

        // Second tone
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'sine';
        osc2.frequency.value = 880; // A5
        gain2.gain.setValueAtTime(0, audioCtx.currentTime + 0.15);
        gain2.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        osc2.start(audioCtx.currentTime + 0.15);
        osc2.stop(audioCtx.currentTime + 0.6);

        await new Promise(resolve => setTimeout(resolve, 700));
    } catch(e) {
        console.error("Chime failed", e);
    }

    // Abort if another play request was made during the chime
    if (currentId !== playbackIdRef.current) {
        return;
    }

    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onpause = () => setIsPlayingAudio(false);
    audio.onplay = () => setIsPlayingAudio(true);
    audioRef.current = audio;
    
    // Fade-in effect removed to fix slow start
    audio.volume = 1;
    audio.play().catch(e => console.error("Audio play blocked", e));
    
    setIsPlayingAudio(true);
  };

  const pauseAudio = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
    }
  };

  const handleLogin = async () => { 
      if (!activeUser) return; 
      
      const user = activeUser.trim();
      if (user !== "Bounty" && user !== "Levi'sOnline") {
          setError("Invalid Identity Verification.");
          return;
      }

      setIsAuthenticating(true); 
      setError(null); 
      try { 
          const result = await testConnection({ connectionMode: 'direct' }); 
          if (result.success) { 
              setIsAuthenticated(true);
              
              // Dynamic Group Logic
              if (user === "Levi'sOnline") {
                  const levisGroup = ECOMPLETE_GROUPS.find(g => g.name === "Levi's South Africa Online");
                  if (levisGroup) {
                      setAvailableGroups([levisGroup]);
                      setSelectedGroup(levisGroup);
                      setAppContext('levis');
                  }
              } else if (user === "Bounty") {
                  setAvailableGroups([{ id: CONSOLIDATED_GROUP_ID, name: "Bounty Apparel" }]);
                  setSelectedGroup({ id: CONSOLIDATED_GROUP_ID, name: "Bounty Apparel" });
                  setAppContext('bounty');
              }
              
              setShowValidator(true);

              // Send access log asynchronously
              (async () => {
                  try {
                      const ipResponse = await fetch('https://api.ipify.org?format=json');
                      const ipData = await ipResponse.json();
                      const clientIp = ipData.ip;
                      
                      await fetch('/api/email/send-access-log', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ user, clientIp })
                      });
                  } catch (ipErr) {
                      console.error('Failed to fetch IP:', ipErr);
                      // Fallback without client IP
                      fetch('/api/email/send-access-log', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ user })
                      }).catch(err => console.error('Failed to send access log:', err));
                  }
              })();
          } else { 
              setError("Connection Failed."); 
          } 
      } catch (e: any) { 
          setError("Network Failure."); 
      } finally { 
          setIsAuthenticating(false); 
      } 
  };

  const handleTestConnection = async () => { 
      setTestStatus('testing'); 
      const result = await testConnection({ connectionMode }); 
      setTestStatus(result.success ? 'success' : 'failed'); 
  };

  const handleTestReturnGoConnection = async () => {
      setReturnGoTestStatus('testing');
      setReturnGoTestError(null);
      // Test with a default shop name based on context or just a common one
      const shopName = appContext === 'levis' ? RETURNGO_LEVIS_STORE_URL : BOUNTY_DIESEL_URL;
      const result = await testReturnGoConnection(shopName);
      setReturnGoTestStatus(result.success ? 'success' : 'failed');
      if (!result.success) {
          setReturnGoTestError(result.message);
      }
  };

  const handleTestParcelninjaConnection = async () => {
      setParcelninjaTestStatus('testing');
      setParcelninjaTestDetails(null);
      const { testParcelninjaConnection } = await import('./services/parcelninjaService');
      const result = await testParcelninjaConnection();
      setParcelninjaTestStatus(result.success ? 'success' : 'failed');
      setParcelninjaTestDetails(result.details || null);
  };

  if (!isAuthenticated) {
    return (
      <LoginPage 
          activeUser={activeUser}
          setActiveUser={setActiveUser}
          handleLogin={handleLogin}
          isAuthenticating={isAuthenticating}
          error={error}
      />
    );
  }

  const MainDashboard = (
    <DashboardPage 
        apiKey=""
        proxyUrl="https://corsproxy.io/?"
        connectionMode={connectionMode}
        selectedGroup={selectedGroup}
        setSelectedGroup={setSelectedGroup}
        availableGroups={availableGroups}
        ticketScope={ticketScope}
        setTicketScope={setTicketScope}
        appContext={appContext}
        audioBase64={audioBase64}
        isPlayingAudio={isPlayingAudio}
        isGeneratingAudio={isGeneratingAudio}
        onPlayAudio={playAudio}
        onPauseAudio={pauseAudio}
        onSetAudioBase64={setAudioBase64}
        onSetIsGeneratingAudio={setIsGeneratingAudio}
        audioRef={audioRef}
        onAnalysisComplete={(summary, activities, metrics) => {
            setExecutiveSummary(summary);
            setDashboardActivities(activities);
            setDashboardMetrics(metrics);
            setIsAnalysisComplete(true);
        }}
    />
  );

  const InsightReport = (
    <InsightReportPage 
        executiveSummary={executiveSummary}
        selectedGroup={selectedGroup}
        activities={dashboardActivities}
        metrics={dashboardMetrics}
        isAnalysisComplete={isAnalysisComplete}
        audioBase64={audioBase64}
        isPlayingAudio={isPlayingAudio}
        isGeneratingAudio={isGeneratingAudio}
        onPlayAudio={playAudio}
        onPauseAudio={pauseAudio}
        onNavigateToDashboard={() => setActivePage('dashboard')}
    />
  );

  return (
    <div className={`flex min-h-screen bg-slate-50 font-sans text-slate-900 relative ${isAuthenticated ? 'animate-[fade-in_1s_ease-out_forwards]' : ''}`}>
        
        {/* SIDE NAV MENU */}
        {!isMobile && (
          <aside 
              className={`fixed left-0 top-0 h-screen bg-slate-900 flex flex-col z-50 shadow-2xl border-r border-slate-800 transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-72' : 'w-20'}`}
          >
              <div className={`p-8 flex flex-col items-center border-b border-slate-800/50 transition-all duration-300 ${!sidebarOpen && 'px-2'}`}>
                  <div className="w-14 h-14 bg-ecomplete-primary rounded-3xl flex items-center justify-center text-white mb-4 shadow-xl shadow-blue-900/40 ring-4 ring-slate-800 shrink-0">
                      <Activity size={32} />
                  </div>
                  {sidebarOpen && (
                      <div className="animate-in fade-in duration-300 flex flex-col items-center">
                          <h2 className="text-white font-black uppercase text-sm tracking-[0.2em] text-center whitespace-nowrap">eComplete</h2>
                          <h1 className="text-ecomplete-accent font-black text-[10px] uppercase tracking-[0.3em] mt-1 opacity-80 whitespace-nowrap">Analytics Centre</h1>
                      </div>
                  )}
              </div>
              
              <nav className="flex-1 p-4 space-y-3 mt-4 overflow-y-auto overflow-x-hidden">
                  <div className="space-y-1">
                      <button 
                          onClick={() => setActivePage('dashboard')}
                          className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden ${activePage === 'dashboard' ? 'bg-ecomplete-primary text-white shadow-[0_10px_30px_rgba(44,62,80,0.5)]' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'} ${!sidebarOpen && 'justify-center px-0'}`}
                      >
                          {activePage === 'dashboard' && <div className="absolute left-0 top-0 w-1.5 h-full bg-ecomplete-accent"></div>}
                          <LayoutDashboard size={22} className={`shrink-0 ${activePage === 'dashboard' ? 'text-ecomplete-accent' : (!sidebarOpen ? 'text-white' : 'text-slate-600 group-hover:text-slate-300')}`} />
                          {sidebarOpen && <span className="font-black text-xs uppercase tracking-wider text-left leading-tight animate-in fade-in duration-300">Support Intelligence</span>}
                      </button>

                      {sidebarOpen && (
                          <div className="pl-12 space-y-1 animate-in slide-in-from-left-4 duration-500">
                              <button 
                                  onClick={() => setActivePage('insight')}
                                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest ${activePage === 'insight' ? 'text-ecomplete-accent bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
                              >
                                  <Activity size={12} />
                                  Operational Insight
                              </button>
                          </div>
                      )}
                  </div>

                  <button 
                      onClick={() => setActivePage('shipping')}
                      className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden ${activePage === 'shipping' ? 'bg-ecomplete-primary text-white shadow-[0_10px_30px_rgba(44,62,80,0.5)]' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'} ${!sidebarOpen && 'justify-center px-0'}`}
                  >
                      {activePage === 'shipping' && <div className="absolute left-0 top-0 w-1.5 h-full bg-ecomplete-accent"></div>}
                      <Truck size={22} className={`shrink-0 ${activePage === 'shipping' ? 'text-ecomplete-accent' : (!sidebarOpen ? 'text-white' : 'text-slate-600 group-hover:text-slate-300')}`} />
                      {sidebarOpen && <span className="font-black text-xs uppercase tracking-wider text-left leading-tight animate-in fade-in duration-300">Shipping Intelligence</span>}
                  </button>

                  <button 
                      onClick={() => setActivePage('returns')}
                      className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden ${activePage === 'returns' ? 'bg-ecomplete-primary text-white shadow-[0_10px_30px_rgba(44,62,80,0.5)]' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'} ${!sidebarOpen && 'justify-center px-0'}`}
                  >
                      {activePage === 'returns' && <div className="absolute left-0 top-0 w-1.5 h-full bg-ecomplete-accent"></div>}
                      <Undo2 size={22} className={`shrink-0 ${activePage === 'returns' ? 'text-ecomplete-accent' : (!sidebarOpen ? 'text-white' : 'text-slate-600 group-hover:text-slate-300')}`} />
                      {sidebarOpen && <span className="font-black text-xs uppercase tracking-wider text-left leading-tight animate-in fade-in duration-300">Returns Intelligence</span>}
                  </button>

                  <button 
                      onClick={() => setActivePage('inventory')}
                      className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden ${activePage === 'inventory' ? 'bg-ecomplete-primary text-white shadow-[0_10px_30px_rgba(44,62,80,0.5)]' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'} ${!sidebarOpen && 'justify-center px-0'}`}
                  >
                      {activePage === 'inventory' && <div className="absolute left-0 top-0 w-1.5 h-full bg-ecomplete-accent"></div>}
                      <Package size={22} className={`shrink-0 ${activePage === 'inventory' ? 'text-ecomplete-accent' : (!sidebarOpen ? 'text-white' : 'text-slate-600 group-hover:text-slate-300')}`} />
                      {sidebarOpen && <span className="font-black text-xs uppercase tracking-wider text-left leading-tight animate-in fade-in duration-300">Order/Inventory Intelligence</span>}
                  </button>
              </nav>

              <div className={`p-4 pb-6 border-t border-slate-800/50 bg-slate-950/30 transition-all duration-300 ${!sidebarOpen ? 'px-2 flex justify-center' : 'px-4'}`}>
                  <div className={`flex items-center ${!sidebarOpen ? 'justify-center' : 'justify-between'} w-full`}>
                      <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-black text-xs ring-2 ring-slate-700/50 shadow-inner shrink-0">{activeUser?.charAt(0)}</div>
                          {sidebarOpen && (
                              <div className="animate-in fade-in duration-300 overflow-hidden">
                                  <div className="text-white font-black text-[10px] tracking-tight whitespace-nowrap">{activeUser}</div>
                                  <div className="text-slate-500 text-[8px] font-bold uppercase tracking-widest whitespace-nowrap">Client Access</div>
                              </div>
                          )}
                      </div>
                      {sidebarOpen && (
                          <button 
                              onClick={() => setSettingsOpen(true)}
                              className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                          >
                              <Settings size={16} />
                          </button>
                      )}
                  </div>
              </div>
              
              <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="absolute -right-3 top-32 bg-white border border-slate-200 rounded-full p-1 shadow-md text-slate-500 hover:text-ecomplete-primary transition-colors z-50"
              >
                  {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
          </aside>
        )}

        {/* MAIN CONTENT AREA */}
        <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${(!isMobile && sidebarOpen) ? 'ml-72' : !isMobile ? 'ml-20' : 'ml-0'}`}>
            
            {/* Pages kept in DOM to maintain state/async operations when switching tabs */}
            
            {visitedPages.has('shipping') && (
                <div className={activePage === 'shipping' ? 'block' : 'hidden'}>
                    <ErrorBoundary>
                        <ShippingDashboard appContext={appContext} />
                    </ErrorBoundary>
                </div>
            )}

            {visitedPages.has('returns') && (
                <div className={activePage === 'returns' ? 'block' : 'hidden'}>
                    <ErrorBoundary>
                        <ReturnsPage selectedGroup={selectedGroup} appContext={appContext} />
                    </ErrorBoundary>
                </div>
            )}

            {visitedPages.has('inventory') && (
                <div className={activePage === 'inventory' ? 'block' : 'hidden'}>
                    <ErrorBoundary>
                        <div className="flex items-center justify-center h-screen text-slate-500 font-black uppercase tracking-widest">Planned for production</div>
                    </ErrorBoundary>
                </div>
            )}

            {visitedPages.has('insight') && (
                <div className={activePage === 'insight' ? 'block' : 'hidden'}>
                    <ErrorBoundary>
                        {InsightReport}
                    </ErrorBoundary>
                </div>
            )}
            
            <div className={activePage === 'dashboard' ? 'block' : 'hidden'}>
                <ErrorBoundary>
                    {MainDashboard}
                </ErrorBoundary>
            </div>

            <ConnectionValidator 
                isOpen={showValidator}
                onClose={() => setShowValidator(false)}
                appContext={appContext}
            />

            <SettingsModal 
                isOpen={settingsOpen} 
                onClose={() => setSettingsOpen(false)} 
                connectionMode={connectionMode} 
                setConnectionMode={setConnectionMode}
                testStatus={testStatus}
                onTestConnection={handleTestConnection}
                returnGoTestStatus={returnGoTestStatus}
                onTestReturnGoConnection={handleTestReturnGoConnection}
                returnGoTestError={returnGoTestError}
                parcelninjaTestStatus={parcelninjaTestStatus}
                onTestParcelninjaConnection={handleTestParcelninjaConnection}
                parcelninjaTestDetails={parcelninjaTestDetails}
                testMode={false}
                setTestMode={() => {}} 
                mobileMode={isMobile}
                setMobileMode={() => {}}
            />
        </div>
        <audio 
            ref={audioRef} 
            onEnded={() => setIsPlayingAudio(false)} 
            onPause={() => setIsPlayingAudio(false)} 
            onPlay={() => setIsPlayingAudio(true)} 
            className="hidden"
        />
    </div>
  );
};

export default App;
