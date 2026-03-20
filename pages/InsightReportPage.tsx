
import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ShieldAlert, Info, TrendingUp, MessageSquarePlus, Volume2, Pause, Loader2, RefreshCw, Send, ChevronLeft, Download } from 'lucide-react';
import { TicketActivity, Group, DashboardMetrics } from '../types';
import { cleanMarkdown, parseSynopsisSection, parseBulletList, linkifyTicketIdsToHtml } from '../utils/textUtils';
import { generateSpeech, regenerateExecutiveSummaryWithFeedback } from '../services/geminiService';

type InsightReportPageProps = {
    executiveSummary: string;
    selectedGroup: Group;
    activities: TicketActivity[];
    metrics: DashboardMetrics | null;
    isAnalysisComplete: boolean;
    audioBase64: string | null;
    isPlayingAudio: boolean;
    isGeneratingAudio: boolean;
    onPlayAudio: (base64: string) => void;
    onPauseAudio: () => void;
    onNavigateToDashboard: () => void;
}

export const InsightReportPage: React.FC<InsightReportPageProps> = ({
    executiveSummary: initialSummary,
    selectedGroup,
    activities,
    metrics,
    isAnalysisComplete,
    audioBase64,
    isPlayingAudio,
    isGeneratingAudio,
    onPlayAudio,
    onPauseAudio,
    onNavigateToDashboard
}) => {
    const [executiveSummary, setExecutiveSummary] = useState(initialSummary);
    const [feedback, setFeedback] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);

    useEffect(() => {
        setExecutiveSummary(initialSummary);
    }, [initialSummary]);

    const handleRegenerateInsight = async () => {
        if (!feedback.trim()) return;
        setIsRegenerating(true);
        try {
            const newSummary = await regenerateExecutiveSummaryWithFeedback(executiveSummary, feedback);
            setExecutiveSummary(newSummary);
            setFeedback('');
        } catch (e) {
            console.error("Regeneration failed", e);
            alert("Failed to regenerate insights.");
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleReadSummary = async () => {
        if (!executiveSummary) return;

        if (audioBase64) {
            if (isPlayingAudio) {
                onPauseAudio();
            } else {
                onPlayAudio(audioBase64);
            }
            return;
        }

        // We don't generate here anymore, we expect it to be generated in Dashboard
        // But if it's missing, we could generate it.
        // For now, let's just use the shared state.
        if (isGeneratingAudio) return;
        
        // If we really need to generate it here:
        // (This would require passing onSetAudioBase64 and onSetIsGeneratingAudio too)
        // But the user said it should have been saved.
    };

    if (!isAnalysisComplete) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50">
                <div className="bg-white p-16 rounded-[3rem] shadow-2xl border border-slate-100 flex flex-col items-center text-center max-w-2xl">
                    <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center text-white mb-8 shadow-xl shadow-blue-900/20">
                        <ShieldAlert size={48} className="text-ecomplete-accent" />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-4">Analysis Required</h2>
                    <p className="text-slate-500 font-medium leading-relaxed mb-10">
                        The Strategic Operational Insight Report requires a completed data analysis. 
                        Please return to the main dashboard and click "Initialise Analysis" to generate the latest insights.
                    </p>
                    <button 
                        onClick={onNavigateToDashboard}
                        className="flex items-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
                    >
                        <ChevronLeft size={18} />
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const cleanSummary = cleanMarkdown(executiveSummary);
    const overview = parseSynopsisSection(cleanSummary, "Executive Overview") || "Analysis in progress...";
    const notableItems = parseBulletList(parseSynopsisSection(cleanSummary, "Notable Points"));
    const riskItems = parseBulletList(parseSynopsisSection(cleanSummary, "Critical Risk Alert"));
    const actionItems = parseBulletList(parseSynopsisSection(cleanSummary, "Strategic Action Roadmap") || parseSynopsisSection(cleanSummary, "Actionable Recommendations"));

    return (
        <div className="flex-1 bg-slate-50 p-8 lg:p-12 overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header Section */}
                <header className="flex flex-col lg:flex-row justify-between items-start gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-3 bg-slate-900 text-white px-6 py-2 rounded-full text-[10px] font-black tracking-[0.3em] uppercase shadow-xl">
                            <ShieldAlert size={14} className="text-ecomplete-accent" />
                            Strategic Operational Insight
                        </div>
                        <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-[0.9] uppercase">
                            Executive <span className="text-ecomplete-primary">Intelligence</span> <br/>
                            Synopsis
                        </h1>
                        <div className="flex items-center gap-6 pt-4">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Entity</span>
                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{selectedGroup.name}</span>
                            </div>
                            <div className="h-8 w-px bg-slate-200"></div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Report Date</span>
                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{format(new Date(), "dd MMMM yyyy")}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <button 
                            onClick={handleReadSummary}
                            disabled={isGeneratingAudio}
                            className={`flex items-center gap-3 px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl ${isPlayingAudio ? 'bg-ecomplete-accent text-slate-900 ring-4 ring-ecomplete-accent/20' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                        >
                            {isGeneratingAudio ? <Loader2 size={18} className="animate-spin" /> : isPlayingAudio ? <Pause size={18} /> : <Volume2 size={18} />}
                            {isGeneratingAudio ? 'Synthesizing...' : isPlayingAudio ? 'Pause Briefing' : 'Audio Briefing'}
                        </button>
                        <button className="flex items-center gap-3 px-10 py-5 bg-white border-2 border-slate-900 text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-md">
                            <Download size={18} />
                            Export PDF
                        </button>
                    </div>
                </header>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-8 space-y-12">
                        {/* Executive Overview */}
                        <div className="bg-white p-12 rounded-[3.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.03)] border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-ecomplete-primary"></div>
                            <h3 className="text-xs font-black text-ecomplete-primary uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                                <Info size={16} />
                                Executive Overview
                            </h3>
                            <div className="text-2xl font-medium text-slate-700 leading-relaxed italic tracking-tight">
                                {overview}
                            </div>
                        </div>

                        {/* Analysis Vectors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em] flex items-center gap-3 pb-6 border-b border-slate-100">
                                    <TrendingUp size={16} className="text-emerald-500" />
                                    Notable Vectors
                                </h3>
                                <ul className="space-y-6">
                                    {notableItems.map((item, i) => (
                                        <li key={i} className="flex gap-5 group/item">
                                            <span className="text-emerald-500 font-black text-sm mt-1">0{i+1}</span>
                                            <span className="text-sm font-bold text-slate-600 leading-relaxed group-hover/item:text-slate-900 transition-colors" dangerouslySetInnerHTML={{ __html: linkifyTicketIdsToHtml(item) }}></span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em] flex items-center gap-3 pb-6 border-b border-slate-100">
                                    <ShieldAlert size={16} className="text-red-500" />
                                    Critical Risk Alerts
                                </h3>
                                <ul className="space-y-6">
                                    {riskItems.map((item, i) => (
                                        <li key={i} className="flex gap-5 group/item">
                                            <span className="text-red-500 font-black text-sm mt-1">!</span>
                                            <span className="text-sm font-bold text-slate-600 leading-relaxed group-hover/item:text-slate-900 transition-colors" dangerouslySetInnerHTML={{ __html: linkifyTicketIdsToHtml(item) }}></span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 space-y-12">
                        {/* Strategic Roadmap */}
                        <div className="bg-slate-900 text-white p-10 rounded-[3.5rem] shadow-2xl space-y-8">
                            <h3 className="text-xs font-black text-ecomplete-accent uppercase tracking-[0.4em] flex items-center gap-3">
                                <MessageSquarePlus size={18} />
                                Strategic Roadmap
                            </h3>
                            <div className="space-y-6">
                                {actionItems.map((item, i) => (
                                    <div key={i} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 hover:border-ecomplete-accent/50 transition-all group/card">
                                        <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-ecomplete-accent text-slate-900 flex items-center justify-center text-[10px] font-black shrink-0">
                                                {i+1}
                                            </div>
                                            <p className="text-xs font-bold text-slate-300 leading-relaxed group-hover/card:text-white transition-colors" dangerouslySetInnerHTML={{ __html: linkifyTicketIdsToHtml(item) }}></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Refine Intelligence */}
                        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-6">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em]">Refine Intelligence</h3>
                            <div className="relative">
                                <textarea 
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    placeholder="Provide feedback to refine analysis..."
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 text-xs font-bold text-slate-700 focus:ring-4 focus:ring-ecomplete-primary/10 outline-none transition-all h-40 resize-none shadow-inner"
                                />
                                <button 
                                    onClick={handleRegenerateInsight}
                                    disabled={isRegenerating || !feedback.trim()}
                                    className="absolute bottom-4 right-4 bg-ecomplete-primary text-white p-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50"
                                >
                                    {isRegenerating ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
