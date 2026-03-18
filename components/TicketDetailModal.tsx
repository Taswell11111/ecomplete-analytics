
import React, { useState } from 'react';
import { X, User, MessageSquare, AlertTriangle, Send, Check, Tag, Info, Sliders, Eye, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { TicketActivity, CATEGORIES } from '../types';
import { TICKET_TYPES, TICKET_STATUS_MAP } from '../constants';

type TicketDetailModalProps = {
    isOpen: boolean;
    onClose: () => void;
    activity: TicketActivity | null;
    editCategory: string;
    setEditCategory: (val: string) => void;
    editType: string;
    setEditType: (val: string) => void;
    editTags: string;
    setEditTags: (val: string) => void;
    onSave: () => void;
    onMarkAsSpam: () => void;
    onReply: (ticketId: number, body: string, status: number) => Promise<void>;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
    isOpen, onClose, activity, editCategory, setEditCategory, editType, setEditType, editTags, setEditTags, onSave, onMarkAsSpam, onReply
}) => {
    const [activeTab, setActiveTab] = useState<'details' | 'reply'>('details');
    const [replyBody, setReplyBody] = useState('');
    const [replyStatus, setReplyStatus] = useState<number>(4); // Default to Resolved
    const [isSending, setIsSending] = useState(false);

    if (!isOpen || !activity) return null;

    const handleSendReply = async () => {
        if (!replyBody.trim()) return;
        setIsSending(true);
        try {
            await onReply(activity.ticket.id, replyBody, replyStatus);
            setReplyBody('');
            setActiveTab('details'); // Switch back to view conversation update
        } catch (e) {
            console.error("Failed to send reply", e);
            alert("Failed to send reply. Please try again.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${activity.analysis.urgency === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                {activity.analysis.urgency}
                            </span>
                            <a 
                                href={`https://ecomplete.freshdesk.com/a/tickets/${activity.ticket.id}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-mono transition-colors"
                            >
                                #{activity.ticket.id}
                            </a>
                            <span className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest">
                                {activity.statusName}
                            </span>
                            {activity.brandName && (
                                <span className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest">
                                    {activity.brandName}
                                </span>
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 line-clamp-1">{activity.ticket.subject}</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={24}/>
                    </button>
                </div>
                
                {/* Tab Navigation */}
                <div className="flex border-b border-slate-200 bg-white px-6">
                    <button 
                        onClick={() => setActiveTab('details')}
                        className={`py-4 px-2 text-sm font-bold border-b-2 transition-colors mr-6 ${activeTab === 'details' ? 'border-ecomplete-primary text-ecomplete-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Conversation
                    </button>
                    <button 
                        onClick={() => setActiveTab('reply')}
                        className={`py-4 px-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'reply' ? 'border-ecomplete-primary text-ecomplete-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <MessageSquare size={14} /> Reply to Customer
                    </button>
                </div>
                
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                    
                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50">
                        {activeTab === 'details' ? (
                            <div className="space-y-8">
                                {/* AI Summary Card */}
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl shadow-xl shadow-blue-900/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                                                <Zap size={18} className="text-ecomplete-accent" />
                                            </div>
                                            <h4 className="text-xs font-black text-white/80 uppercase tracking-[0.2em]">Gemini Intelligence Summary</h4>
                                        </div>
                                        <p className="text-xl font-bold text-white leading-relaxed italic">
                                            "{activity.aiSummary}"
                                        </p>
                                        <div className="mt-6 flex gap-6">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Sentiment</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                                        <div className="h-full bg-ecomplete-accent" style={{ width: `${activity.sentimentScore}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-black text-white">{activity.sentimentScore}%</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Risk Level</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                                        <div className="h-full bg-red-400" style={{ width: `${activity.riskScore}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-black text-white">{activity.riskScore}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Original Description */}
                                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                            <User size={16}/>
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800">{activity.requesterName}</div>
                                            <div className="text-xs text-slate-400">{format(new Date(activity.ticket.created_at), 'dd MMM yyyy HH:mm')}</div>
                                        </div>
                                    </div>
                                    <div className="prose prose-sm max-w-none text-slate-600 break-words" dangerouslySetInnerHTML={{ __html: activity.ticket.description }} />
                                </div>

                                {/* Conversations */}
                                {activity.conversations.map(c => (
                                    <div key={c.id} className={`flex ${c.incoming ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[90%] sm:max-w-[85%] p-4 sm:p-6 rounded-lg border shadow-sm ${c.incoming ? 'bg-white border-slate-200' : 'bg-blue-50 border-blue-100'}`}>
                                            <div className="flex items-center gap-2 mb-3 opacity-70 text-xs font-bold uppercase tracking-wider border-b border-black/5 pb-2">
                                                {c.incoming ? <User size={12}/> : <MessageSquare size={12}/>}
                                                {c.incoming ? 'Customer' : 'Agent'} • {format(new Date(c.created_at), 'dd MMM HH:mm')}
                                            </div>
                                            <div className="prose prose-sm max-w-none text-slate-700 break-words" dangerouslySetInnerHTML={{ __html: c.body }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* Reply Interface with Preview */
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><MessageSquare size={16}/> Compose Reply</h4>
                                    <textarea 
                                        className="w-full flex-1 p-4 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none text-sm leading-relaxed"
                                        placeholder="Type your response here..."
                                        value={replyBody}
                                        onChange={(e) => setReplyBody(e.target.value)}
                                    ></textarea>
                                    
                                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                                        <div className="flex items-center gap-4">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Set Status:</label>
                                            <select 
                                                value={replyStatus} 
                                                onChange={e => setReplyStatus(Number(e.target.value))}
                                                className="bg-slate-50 border border-slate-200 rounded p-2 text-sm font-medium"
                                            >
                                                {Object.entries(TICKET_STATUS_MAP).map(([val, label]) => (
                                                    <option key={val} value={val}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button 
                                            onClick={handleSendReply}
                                            disabled={isSending || !replyBody.trim()}
                                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200"
                                        >
                                            {isSending ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span> : <Send size={16} />}
                                            Send
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-slate-100 p-6 rounded-xl border border-slate-200 h-full overflow-hidden flex flex-col">
                                    <h4 className="font-bold text-slate-500 mb-4 flex items-center gap-2 uppercase text-xs tracking-wider"><Eye size={14}/> Live Preview</h4>
                                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex-1 overflow-y-auto">
                                         <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
                                             <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                                             <div>
                                                 <div className="h-3 w-24 bg-slate-200 rounded mb-1"></div>
                                                 <div className="h-2 w-16 bg-slate-100 rounded"></div>
                                             </div>
                                         </div>
                                         <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                                            {replyBody || <span className="text-slate-300 italic">Start typing to preview...</span>}
                                         </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Actions (Only show in details tab) */}
                    {activeTab === 'details' && (
                        <div className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0 max-h-[40vh] lg:max-h-full">
                            <div className="p-6 bg-slate-50 border-b border-slate-200">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sliders size={14}/> Ticket Properties</h4>
                            </div>
                            
                            <div className="p-6 space-y-6 overflow-y-auto">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Category</label>
                                    <select 
                                        value={editCategory} 
                                        onChange={e => setEditCategory(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-ecomplete-primary/20 outline-none"
                                    >
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Type</label>
                                    <select 
                                        value={editType} 
                                        onChange={e => setEditType(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-ecomplete-primary/20 outline-none"
                                    >
                                        <option value="">-- Select --</option>
                                        {TICKET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1"><Tag size={12}/> Tags</label>
                                    <input 
                                        type="text" 
                                        value={editTags} 
                                        onChange={e => setEditTags(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-ecomplete-primary/20 outline-none"
                                        placeholder="Add tags..."
                                    />
                                </div>

                                <button 
                                    onClick={onSave}
                                    className="w-full bg-ecomplete-primary text-white hover:bg-slate-800 font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                                >
                                    <Check size={16}/> Save Changes
                                </button>
                                
                                <div className="pt-6 border-t border-slate-100">
                                     <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            onMarkAsSpam();
                                        }}
                                        className="w-full bg-white text-red-500 hover:bg-red-50 border border-red-100 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all text-xs uppercase tracking-wide"
                                    >
                                        <AlertTriangle size={14} /> Mark as SPAM
                                    </button>
                                </div>
                            </div>


                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
