import React, { useMemo, useState } from 'react';
import { TicketActivity } from '../../types';
import { Bar, Doughnut } from 'react-chartjs-2';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ECOMPLETE_GROUPS } from '../../constants';
import { Activity, AlertTriangle, CheckCircle, Clock, MessageSquare, Tag } from 'lucide-react';

type FreshdeskPulseProps = {
    activities: TicketActivity[];
    onMetricClick?: (title: string, filterFn: (a: TicketActivity) => boolean) => void;
};

export const FreshdeskPulse: React.FC<FreshdeskPulseProps> = ({ activities, onMetricClick }) => {
    const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

    const stats = useMemo(() => {
        let totalOpen = 0;
        let totalCritical = 0;
        let unrespondedCount = 0;
        let respondedCount = 0;
        let requesterLastCount = 0;
        let agentLastCount = 0;
        let totalAgeDays = 0;

        const groupStats: Record<string, any> = {};
        const typeStats: Record<string, any> = {};
        const responseAgingStats: Record<string, any> = {};

        activities.forEach(a => {
            const t = a.ticket;
            const gName = a.brandName || 'Unassigned';
            const type = t.type && t.type.trim() !== '' ? t.type : 'Unclassified';

            if (!typeStats[type]) typeStats[type] = { total: 0 };
            typeStats[type].total++;

            if (!groupStats[gName]) {
                groupStats[gName] = { total: 0, age1: 0, age2: 0, age5: 0, agePlus: 0, statusCounts: { 'Open': 0, 'Pending/Waiting': 0 } };
                responseAgingStats[gName] = { 
                    no_response_1: 0, responded_1: 0,
                    no_response_2: 0, responded_2: 0,
                    no_response_5: 0, responded_5: 0,
                    no_response_plus: 0, responded_plus: 0
                };
            }
            groupStats[gName].total++;

            const daysOld = differenceInDays(new Date(), new Date(t.created_at));
            totalAgeDays += daysOld;

            let isRequesterLast = true;
            if (a.conversations && a.conversations.length > 0) {
                const lastMsg = a.conversations[a.conversations.length - 1];
                isRequesterLast = lastMsg.incoming;
            } else {
                isRequesterLast = t.status === 2; // If open, assume requester is waiting
            }

            const hasResponded = !isRequesterLast; // Corrected: agent has responded if requester is NOT last

            if (hasResponded) respondedCount++;
            else unrespondedCount++;

            if (isRequesterLast) requesterLastCount++;
            else agentLastCount++;

            if (daysOld > 2 && !hasResponded) totalCritical++;

            if (daysOld <= 1) {
                groupStats[gName].age1++;
                if (hasResponded) responseAgingStats[gName].responded_1++;
                else responseAgingStats[gName].no_response_1++;
            } else if (daysOld <= 2) {
                groupStats[gName].age2++;
                if (hasResponded) responseAgingStats[gName].responded_2++;
                else responseAgingStats[gName].no_response_2++;
            } else if (daysOld <= 5) {
                groupStats[gName].age5++;
                if (hasResponded) responseAgingStats[gName].responded_5++;
                else responseAgingStats[gName].no_response_5++;
            } else {
                groupStats[gName].agePlus++;
                if (hasResponded) responseAgingStats[gName].responded_plus++;
                else responseAgingStats[gName].no_response_plus++;
            }

            if (t.status === 2) {
                totalOpen++;
                groupStats[gName].statusCounts['Open']++;
            } else {
                groupStats[gName].statusCounts['Pending/Waiting']++;
            }
        });

        const sortedGroups = Object.entries(groupStats).sort((a, b) => b[1].total - a[1].total);
        const sortedTypes = Object.entries(typeStats).sort((a, b) => b[1].total - a[1].total);

        return {
            total: activities.length,
            totalOpen,
            totalCritical,
            avgAge: activities.length > 0 ? (totalAgeDays / activities.length).toFixed(1) : '0',
            topType: sortedTypes.length > 0 ? sortedTypes[0][0] : 'None',
            topTypeCount: sortedTypes.length > 0 ? sortedTypes[0][1].total : 0,
            respondedCount,
            unrespondedCount,
            requesterLastCount,
            agentLastCount,
            sortedGroups,
            responseAgingStats
        };
    }, [activities]);

    const groupLabels = stats.sortedGroups.map(g => g[0]);
    const groupColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    const brandVolumeData = {
        labels: groupLabels,
        datasets: [{
            label: 'Active Tickets',
            data: stats.sortedGroups.map(g => g[1].total),
            backgroundColor: stats.sortedGroups.map((_, i) => groupColors[i % groupColors.length]),
            borderRadius: 4
        }]
    };

    const ageBucketData = {
        labels: groupLabels,
        datasets: [
            { label: '< 3 Days', data: stats.sortedGroups.map(g => g[1].age1 + g[1].age2), backgroundColor: '#10B981' },
            { label: '3-7 Days', data: stats.sortedGroups.map(g => g[1].age5), backgroundColor: '#F97316' },
            { label: '8+ Days', data: stats.sortedGroups.map(g => g[1].agePlus), backgroundColor: '#EF4444' }
        ]
    };

    const agingResponseData = {
        labels: groupLabels,
        datasets: [
            { label: 'No Response 5d+', data: stats.sortedGroups.map(g => stats.responseAgingStats[g[0]].no_response_plus), backgroundColor: '#7f1d1d' },
            { label: 'No Response 2-5d', data: stats.sortedGroups.map(g => stats.responseAgingStats[g[0]].no_response_5), backgroundColor: '#dc2626' },
            { label: 'No Response < 2d', data: stats.sortedGroups.map(g => stats.responseAgingStats[g[0]].no_response_1 + stats.responseAgingStats[g[0]].no_response_2), backgroundColor: '#f87171' },
            { label: 'Responded 5d+', data: stats.sortedGroups.map(g => stats.responseAgingStats[g[0]].responded_plus), backgroundColor: '#064e3b' },
            { label: 'Responded 2-5d', data: stats.sortedGroups.map(g => stats.responseAgingStats[g[0]].responded_5), backgroundColor: '#10b981' },
            { label: 'Responded < 2d', data: stats.sortedGroups.map(g => stats.responseAgingStats[g[0]].responded_1 + stats.responseAgingStats[g[0]].responded_2), backgroundColor: '#4ade80' }
        ]
    };

    return (
        <div className="space-y-12 bg-white p-12 rounded-[3.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.03)] border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 bg-ecomplete-primary/5 text-ecomplete-primary px-4 py-1.5 rounded-full text-[10px] font-black mb-4 tracking-widest uppercase border border-ecomplete-primary/10">
                        <span className="w-2 h-2 bg-ecomplete-primary rounded-full animate-pulse"></span>
                        Live Active Backlog
                    </div>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Support Ecosystem <span className="text-ecomplete-primary">Pulse Check</span></h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div 
                    className={`bg-white rounded-3xl p-8 shadow-xl border-t-4 border-emerald-500 hover:scale-[1.02] transition-all duration-300 ${onMetricClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                    onClick={() => onMetricClick && onMetricClick('Total Active Volume', () => true)}
                >
                    <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-3">Total Active Volume</h3>
                    <div className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">{stats.total}</div>
                    <p className="text-[10px] text-emerald-600 font-black bg-emerald-50 inline-block px-3 py-1 rounded-lg uppercase tracking-wider">Excludes Closed</p>
                </div>
                <div 
                    className={`bg-white rounded-3xl p-8 shadow-xl border-t-4 border-blue-500 hover:scale-[1.02] transition-all duration-300 ${onMetricClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                    onClick={() => onMetricClick && onMetricClick(`Highest Volume Type: ${stats.topType}`, (a) => (a.ticket.type || 'Unclassified') === stats.topType)}
                >
                    <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-3">Highest Volume Type</h3>
                    <div className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">{stats.topTypeCount}</div>
                    <p className="text-[10px] text-blue-600 font-black bg-blue-50 inline-block px-3 py-1 rounded-lg uppercase tracking-wider truncate max-w-full">{stats.topType}</p>
                </div>
                <div 
                    className={`bg-white rounded-3xl p-8 shadow-xl border-t-4 border-purple-500 hover:scale-[1.02] transition-all duration-300 ${onMetricClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                    onClick={() => onMetricClick && onMetricClick('Total Backlog (Open)', (a) => a.ticket.status === 2)}
                >
                    <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-3">Total Backlog (Open)</h3>
                    <div className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">{stats.totalOpen}</div>
                    <p className="text-[10px] text-purple-600 font-black bg-purple-50 inline-block px-3 py-1 rounded-lg uppercase tracking-wider">Requiring Action</p>
                </div>
                <div 
                    className={`bg-white rounded-3xl p-8 shadow-xl border-t-4 border-red-500 hover:scale-[1.02] transition-all duration-300 ${onMetricClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                    onClick={() => onMetricClick && onMetricClick('Critical Aging', (a) => {
                        const daysOld = differenceInDays(new Date(), new Date(a.ticket.created_at));
                        const hasResponded = a.ticket.status !== 2;
                        return daysOld > 2 && !hasResponded;
                    })}
                >
                    <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-3">Critical Aging</h3>
                    <div className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">{stats.totalCritical}</div>
                    <p className="text-[10px] text-red-600 font-black bg-red-50 inline-block px-3 py-1 rounded-lg uppercase tracking-wider">&gt; 2 Days, No Resp</p>
                </div>
                <div className="bg-white rounded-3xl p-8 shadow-xl border-t-4 border-orange-500 hover:scale-[1.02] transition-all duration-300">
                    <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-3">Avg Backlog Age</h3>
                    <div className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">{stats.avgAge}</div>
                    <p className="text-[10px] text-orange-600 font-black bg-orange-50 inline-block px-3 py-1 rounded-lg uppercase tracking-wider">Days unresolved</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-50 rounded-[3rem] shadow-inner p-10 border border-slate-100">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Ticket-Agent Response Meter</h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest opacity-60">Proportion of active tickets awaiting first contact</p>
                    </div>
                    <div className="relative max-w-4xl mx-auto">
                        <div className="flex justify-between items-end mb-6 px-2">
                            <div className="text-left">
                                <div className="text-4xl font-black text-red-500 tracking-tighter">{stats.unrespondedCount}</div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">No Response</div>
                            </div>
                            <div className="text-right">
                                <div className="text-4xl font-black text-emerald-500 tracking-tighter">{stats.respondedCount}</div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Agent Responded</div>
                            </div>
                        </div>
                        <div className="w-full h-14 bg-slate-200 rounded-2xl overflow-hidden flex shadow-inner p-1.5">
                            <div className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg transition-all duration-1000" style={{ width: `${stats.total > 0 ? (stats.unrespondedCount / stats.total) * 100 : 0}%` }}>
                                {stats.total > 0 && (stats.unrespondedCount / stats.total) * 100 > 10 ? `${Math.round((stats.unrespondedCount / stats.total) * 100)}%` : ''}
                            </div>
                            <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg transition-all duration-1000 ml-1" style={{ width: `${stats.total > 0 ? (stats.respondedCount / stats.total) * 100 : 0}%` }}>
                                {stats.total > 0 && (stats.respondedCount / stats.total) * 100 > 10 ? `${Math.round((stats.respondedCount / stats.total) * 100)}%` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-[3rem] shadow-inner p-10 border border-slate-100">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Last Response Meter</h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest opacity-60">Volume of tickets by last interaction source</p>
                    </div>
                    <div className="relative max-w-4xl mx-auto">
                        <div className="flex justify-between items-end mb-6 px-2">
                            <div className="text-left">
                                <div className="text-4xl font-black text-orange-500 tracking-tighter">{stats.requesterLastCount}</div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Requester Last</div>
                            </div>
                            <div className="text-right">
                                <div className="text-4xl font-black text-blue-500 tracking-tighter">{stats.agentLastCount}</div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Agent Last</div>
                            </div>
                        </div>
                        <div className="w-full h-14 bg-slate-200 rounded-2xl overflow-hidden flex shadow-inner p-1.5">
                            <div className="h-full bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg transition-all duration-1000" style={{ width: `${stats.total > 0 ? (stats.requesterLastCount / stats.total) * 100 : 0}%` }}>
                                {stats.total > 0 && (stats.requesterLastCount / stats.total) * 100 > 10 ? `${Math.round((stats.requesterLastCount / stats.total) * 100)}%` : ''}
                            </div>
                            <div className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg transition-all duration-1000 ml-1" style={{ width: `${stats.total > 0 ? (stats.agentLastCount / stats.total) * 100 : 0}%` }}>
                                {stats.total > 0 && (stats.agentLastCount / stats.total) * 100 > 10 ? `${Math.round((stats.agentLastCount / stats.total) * 100)}%` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-50 rounded-[3rem] shadow-inner p-10 border border-slate-100">
                    <h2 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tight">Active Volume by Group</h2>
                    <div className="h-[300px]">
                        <Bar 
                            data={brandVolumeData} 
                            options={{ 
                                indexAxis: 'y', 
                                responsive: true, 
                                maintainAspectRatio: false, 
                                onClick: (e: any, elements: any[]) => {
                                    if (elements.length > 0 && onMetricClick) {
                                        const index = elements[0].index;
                                        const groupName = brandVolumeData.labels?.[index] as string;
                                        onMetricClick(`Active Volume: ${groupName}`, (a) => {
                                            const gName = ECOMPLETE_GROUPS.find(g => g.id === a.ticket.group_id)?.name || 'Unassigned';
                                            return gName === groupName;
                                        });
                                    }
                                },
                                plugins: { legend: { display: false }, datalabels: { color: '#ffffff', font: { weight: 'bold', size: 10 }, formatter: (value) => value > 0 ? value : '' } as any }, 
                                scales: { x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b', font: { weight: 'bold', size: 10 } } }, y: { grid: { display: false }, ticks: { color: '#64748b', font: { weight: 'bold', size: 10 } } } } 
                            }} 
                        />
                    </div>
                </div>
                <div className="bg-slate-50 rounded-[3rem] shadow-inner p-10 border border-slate-100">
                    <h2 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tight">Aging Analysis by Group</h2>
                    <div className="h-[300px]">
                        <Bar 
                            data={ageBucketData} 
                            options={{ 
                                responsive: true, 
                                maintainAspectRatio: false, 
                                onClick: (e: any, elements: any[]) => {
                                    if (elements.length > 0 && onMetricClick) {
                                        const datasetIndex = elements[0].datasetIndex;
                                        const index = elements[0].index;
                                        const groupName = ageBucketData.labels?.[index] as string;
                                        const bucketLabel = ageBucketData.datasets[datasetIndex].label;
                                        
                                        onMetricClick(`Aging Analysis: ${groupName} (${bucketLabel})`, (a) => {
                                            const gName = ECOMPLETE_GROUPS.find(g => g.id === a.ticket.group_id)?.name || 'Unassigned';
                                            if (gName !== groupName) return false;
                                            const daysOld = differenceInDays(new Date(), new Date(a.ticket.created_at));
                                            if (bucketLabel === '0-1 Days') return daysOld <= 1;
                                            if (bucketLabel === '1-2 Days') return daysOld > 1 && daysOld <= 2;
                                            if (bucketLabel === '3-5 Days') return daysOld > 2 && daysOld <= 5;
                                            return daysOld > 5;
                                        });
                                    }
                                },
                                plugins: { legend: { position: 'bottom', labels: { color: '#475569', font: { weight: 'bold', size: 10 }, usePointStyle: true, padding: 20 } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 10 }, formatter: (value) => value > 0 ? value : '' } as any }, 
                                scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', font: { weight: 'bold', size: 10 } } }, y: { stacked: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b', font: { weight: 'bold', size: 10 } } } } 
                            }} 
                        />
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-[3rem] shadow-inner p-10 border border-slate-100">
                <h2 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tight">Aging & Response Analysis by Group</h2>
                <div className="h-[350px]">
                    <Bar 
                        data={agingResponseData} 
                        options={{ 
                            responsive: true, 
                            maintainAspectRatio: false, 
                            onClick: (e: any, elements: any[]) => {
                                if (elements.length > 0 && onMetricClick) {
                                    const datasetIndex = elements[0].datasetIndex;
                                    const index = elements[0].index;
                                    const groupName = agingResponseData.labels?.[index] as string;
                                    const datasetLabel = agingResponseData.datasets[datasetIndex].label;
                                    
                                    onMetricClick(`Aging & Response: ${groupName} (${datasetLabel})`, (a) => {
                                        const gName = ECOMPLETE_GROUPS.find(g => g.id === a.ticket.group_id)?.name || 'Unassigned';
                                        if (gName !== groupName) return false;
                                        
                                        const daysOld = differenceInDays(new Date(), new Date(a.ticket.created_at));
                                        const hasResponded = a.ticket.status !== 2;
                                        
                                        const isResponded = datasetLabel?.includes('Responded');
                                        if (hasResponded !== isResponded) return false;
                                        
                                        if (datasetLabel?.includes('0-1 Days')) return daysOld <= 1;
                                        if (datasetLabel?.includes('1-2 Days')) return daysOld > 1 && daysOld <= 2;
                                        if (datasetLabel?.includes('3-5 Days')) return daysOld > 2 && daysOld <= 5;
                                        return daysOld > 5;
                                    });
                                }
                            },
                            plugins: { legend: { position: 'bottom', labels: { color: '#475569', font: { weight: 'bold', size: 9 }, usePointStyle: true, padding: 15 } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 9 }, formatter: (value) => value > 0 ? value : '' } as any }, 
                            scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', font: { weight: 'bold', size: 10 } } }, y: { stacked: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b', font: { weight: 'bold', size: 10 } } } } 
                        }} 
                    />
                </div>
            </div>
        </div>
    );
};
