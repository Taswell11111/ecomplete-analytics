
import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { RefreshCw, ShieldAlert, CheckCircle, TrendingUp, Info, MessageSquarePlus, Send, Loader2, Footprints, Repeat, Clock } from 'lucide-react';
import { TicketActivity, Group } from '../types';
import { cleanMarkdown, parseSynopsisSection, parseBulletList, linkifyTicketIds, formatStrategicItem } from '../utils/textUtils';

type ExecutiveSynopsisProps = {
    executiveSummary: string;
    selectedGroup: Group;
    activities: TicketActivity[];
    testMode: boolean;
    onFeedbackSubmit: (feedback: string) => Promise<void>;
    isRegenerating: boolean;
}

export const ExecutiveSynopsis: React.FC<ExecutiveSynopsisProps> = ({ executiveSummary, selectedGroup, activities, testMode, onFeedbackSubmit, isRegenerating }) => {
    const [feedback, setFeedback] = useState('');

    if (!executiveSummary) return null;
    
    const cleanSummary = cleanMarkdown(executiveSummary);
    const overview = parseSynopsisSection(cleanSummary, "Executive Overview") || "Analysis in progress...";
    const notableRaw = parseSynopsisSection(cleanSummary, "Notable Points");
    const risksRaw = parseSynopsisSection(cleanSummary, "Critical Risk Alert");
    const nextStepsRaw = parseSynopsisSection(cleanSummary, "Immediate/Next Steps");
    
    let actionsRaw = parseSynopsisSection(cleanSummary, "Strategic Action Roadmap");
    if (!actionsRaw) {
        actionsRaw = parseSynopsisSection(cleanSummary, "Actionable Recommendations");
    }
    
    const notableItems = parseBulletList(notableRaw);
    const riskItems = parseBulletList(risksRaw);
    const actionItems = parseBulletList(actionsRaw);
    const nextStepItems = parseBulletList(nextStepsRaw);

    const avgSentiment = activities.length > 0 
        ? Math.round(activities.reduce((acc, curr) => acc + curr.sentimentScore, 0) / activities.length) 
        : 50;
    const avgRisk = activities.length > 0 
        ? Math.round(activities.reduce((acc, curr) => acc + curr.riskScore, 0) / activities.length) 
        : 0;

    // Logic for Repeat Contact Watchlist: last two responses are from requester (customer), no response in between or after from agent.
    const repeatWatchlist = useMemo(() => {
        return activities.filter(act => {
            const convs = act.conversations;
            if (convs.length < 2) return false;
            // Freshdesk conversations usually ordered ASC (oldest first)
            const last = convs[convs.length - 1];
            const secondLast = convs[convs.length - 2];
            // incoming: true means customer.
            // Check if both are from customer.
            return last.incoming === true && secondLast.incoming === true;
        }).slice(0, 10);
    }, [activities]);

    let riskColorClass = 'bg-slate-400';
    let riskTextColorClass = 'text-slate-400';
    let riskShadowClass = '';
    
    if (avgRisk >= 75) {
        riskColorClass = 'bg-red-500';
        riskTextColorClass = 'text-red-500';
        riskShadowClass = 'shadow-[0_0_20px_rgba(239,68,68,0.5)]';
    } else if (avgRisk >= 50) {
        riskColorClass = 'bg-orange-500';
        riskTextColorClass = 'text-orange-500';
        riskShadowClass = 'shadow-[0_0_20px_rgba(249,115,22,0.5)]';
    }

    let sentimentColorClass = 'bg-slate-400';
    let sentimentTextColorClass = 'text-slate-400';
    let sentimentShadowClass = '';

    if (avgSentiment >= 70) {
        sentimentColorClass = 'bg-emerald-500';
        sentimentTextColorClass = 'text-emerald-500';
        sentimentShadowClass = 'shadow-[0_0_20px_rgba(16,185,129,0.5)]';
    } else if (avgSentiment < 40) {
        sentimentColorClass = 'bg-red-500';
        sentimentTextColorClass = 'text-red-500';
        sentimentShadowClass = 'shadow-[0_0_20px_rgba(239,68,68,0.5)]';
    }

    const handleSubmit = async () => {
        if (!feedback.trim()) return;
        await onFeedbackSubmit(feedback);
        setFeedback('');
    };

    return (
      <section className="bg-white shadow-[0_50px_100px_rgba(0,0,0,0.05)] rounded-[3rem] overflow-hidden border border-slate-200 mb-12 w-full animate-in fade-in zoom-in duration-1000">
          {/* Header */}
          <div className="bg-ecomplete-primary p-12 border-b-[10px] border-ecomplete-accent flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
              <div>
                  <h2 className="text-lg font-black text-ecomplete-accent uppercase tracking-tighter leading-none mb-4 opacity-90 flex items-center gap-2">
                      <TrendingUp size={20}/> Proprietary Executive Report {testMode && <span className="bg-white/10 text-white px-4 py-1.5 rounded-full ml-4 text-[9px] tracking-normal border border-white/10">SIMULATED FEED</span>}
                  </h2>
                  <h1 className="text-5xl font-black text-white tracking-tighter leading-none">Executive Synopsis</h1>
                  <p className="text-2xl text-slate-400 font-bold mt-4 uppercase tracking-widest">{selectedGroup.name}</p>
              </div>
              <div className="text-left md:text-right w-full md:w-auto text-slate-400 flex flex-col items-start md:items-end">
                  <p className="text-white font-black text-2xl tracking-tighter">Snap Intelligence</p>
                  <p className="text-xs mt-2 font-black text-white uppercase tracking-widest">{format(new Date(), "HH:mm | dd MMM yyyy")}</p>
              </div>
          </div>

          {/* KPI Dashboard Strip */}
          <div className="bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 p-12 gap-12">
              <div className="flex flex-col gap-6 group">
                  <div className="flex justify-between items-end">
                      <div>
                          <span className="text-xl font-black text-slate-800 uppercase tracking-[0.3em] block mb-2">Brand Health Risk Threshold</span>
                          <span className="text-sm font-medium text-slate-400 italic tracking-wide block max-w-sm leading-relaxed">Evaluates the risk of customer attrition based on service failure points</span>
                      </div>
                      <span className={`text-6xl font-black ${riskTextColorClass} transition-colors`}>{avgRisk}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-5 overflow-hidden shadow-inner p-1">
                      <div className={`h-full rounded-full transition-all duration-1000 ${riskColorClass} ${riskShadowClass}`} style={{ width: `${avgRisk}%` }}></div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-2 text-xs font-black uppercase tracking-wider text-center opacity-70">
                      <div className="text-slate-400">0-49%<br/>Low</div>
                      <div className="text-orange-500">50-74%<br/>Caution</div>
                      <div className="text-red-500">75%+<br/>Critical</div>
                  </div>
              </div>

              <div className="flex flex-col gap-6 group">
                  <div className="flex justify-between items-end">
                      <div>
                          <span className="text-xl font-black text-slate-800 uppercase tracking-[0.3em] block mb-2">Customer Emotional Sentiment</span>
                          <span className="text-sm font-medium text-slate-400 italic tracking-wide block max-w-sm leading-relaxed">AI-derived linguistic tone assessment of current customer engagement</span>
                      </div>
                      <span className={`text-6xl font-black ${sentimentTextColorClass} transition-colors`}>{avgSentiment}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-5 overflow-hidden shadow-inner p-1">
                      <div className={`h-full rounded-full transition-all duration-1000 ${sentimentColorClass} ${sentimentShadowClass}`} style={{ width: `${avgSentiment}%` }}></div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-2 text-xs font-black uppercase tracking-wider text-center opacity-70">
                      <div className="text-red-500">0-39%<br/>Negative</div>
                      <div className="text-slate-400">40-69%<br/>Neutral</div>
                      <div className="text-emerald-600">70%+<br/>Positive</div>
                  </div>
              </div>
          </div>

          <div className="p-12 space-y-16">
              {/* Executive Overview */}
              <div className="space-y-12">
                  <div className="flex items-center gap-4 border-b-4 border-ecomplete-accent/30 pb-6">
                      {isRegenerating ? <Loader2 className="text-ecomplete-primary animate-spin" size={40}/> : <RefreshCw className="text-ecomplete-primary animate-spin-slow" size={40} />}
                      <h3 className="text-4xl font-black text-ecomplete-primary uppercase tracking-tighter">Executive Overview</h3>
                  </div>
                  
                  {isRegenerating ? (
                      <div className="p-12 text-center text-slate-400 font-black animate-pulse text-xl">REGENERATING OVERVIEW...</div>
                  ) : (
                      <div className="text-slate-700 leading-[2] text-2xl font-medium">
                          {overview.split('\n\n').map((para, i) => (
                              <p key={i} className="executive-insight-p first-letter:text-8xl first-letter:font-black first-letter:mr-6 first-letter:float-left first-letter:text-ecomplete-primary first-letter:leading-[0.8] transition-all hover:text-slate-900 mb-10">
                                {linkifyTicketIds(para)}
                              </p>
                          ))}
                      </div>
                  )}
              </div>

              {/* Notable Vectors */}
              {notableItems.length > 0 && (
                  <div className="space-y-12">
                      <h3 className="text-3xl font-black text-ecomplete-primary uppercase tracking-tighter border-b-4 border-ecomplete-accent/30 pb-6">Notable Vectors</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {notableItems.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-5 p-6 rounded-3xl bg-slate-50/80 border border-slate-100 hover:shadow-md transition-all">
                                  <div className="shrink-0 w-4 h-4 mt-2 rounded-full bg-ecomplete-accent shadow-[0_0_10px_rgba(255,235,0,0.8)] animate-pulse"></div>
                                  <p className="text-xl font-bold text-slate-700 leading-relaxed">{item}</p>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Critical Risk Alerts */}
              <div className="space-y-12">
                  <h3 className="text-3xl font-black text-red-500 uppercase tracking-tighter border-b-4 border-red-500/30 pb-6">Critical Risk Alerts</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {riskItems.length > 0 ? riskItems.map((item, idx) => (
                        <div key={idx} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-sm font-bold text-slate-300 leading-relaxed transition-all hover:bg-slate-800 cursor-default">
                            {linkifyTicketIds(item.replace(/Customer - /g, ''))}
                        </div>
                    )) : <div className="text-slate-500 italic text-sm text-center py-10 opacity-50 uppercase tracking-widest font-black">Zero critical threats detected.</div>}
                  </div>
              </div>

              {/* Strategic Action Roadmap */}
              <div className="space-y-12">
                  <div className="flex items-center gap-6 border-b-4 border-ecomplete-accent/30 pb-6">
                      <div className="w-16 h-16 bg-ecomplete-accent rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-ecomplete-accent/20 rotate-3">
                        <CheckCircle className="text-ecomplete-primary" size={32} />
                      </div>
                      <h3 className="text-3xl font-black text-ecomplete-primary uppercase tracking-tighter">Strategic Action Roadmap</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {actionItems.length > 0 ? actionItems.map((item, idx) => (
                          <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group flex gap-6">
                              <div className="absolute top-0 right-0 bg-ecomplete-accent/10 w-32 h-32 rounded-bl-[100px] pointer-events-none group-hover:bg-ecomplete-accent/20 transition-colors"></div>
                              <div className="shrink-0">
                                  <span className="w-12 h-12 rounded-2xl bg-ecomplete-primary text-white flex items-center justify-center font-black text-lg shadow-lg relative z-10">{idx+1}</span>
                              </div>
                              <div className="relative z-10 flex-1">
                                  {formatStrategicItem(item)}
                              </div>
                          </div>
                      )) : <div className="col-span-3 text-center text-slate-400 font-black uppercase tracking-widest py-10">No specific roadmap generated for this view.</div>}
                  </div>
              </div>
              
              {/* Immediate/Next Steps - keep at bottom or move? User didn't specify. I'll leave it here. */}
              {nextStepItems.length > 0 && (
                  <div className="bg-slate-50/50 rounded-[2.5rem] p-10 border border-slate-100">
                      <div className="flex items-center gap-4 mb-8">
                          <div className="w-10 h-10 bg-ecomplete-primary rounded-xl flex items-center justify-center text-white">
                              <Footprints size={20} />
                          </div>
                          <h3 className="text-2xl font-black text-ecomplete-primary uppercase tracking-tighter">Immediate / Next Steps</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {nextStepItems.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-all">
                                  <div className="shrink-0 w-6 h-6 mt-1 rounded-full bg-ecomplete-primary text-white flex items-center justify-center text-xs font-black">✓</div>
                                  <div className="text-lg font-medium text-slate-700 leading-relaxed">
                                      {formatStrategicItem(item)}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      </section>
    );
};
