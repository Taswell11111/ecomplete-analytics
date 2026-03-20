
import { format, formatDistanceToNow, eachDayOfInterval, isBefore, isSameDay } from 'date-fns';
import { TicketActivity, Group, DashboardMetrics } from '../../types';
import { CATEGORIES } from '../../constants';
import { cleanMarkdown, parseSynopsisSection, parseBulletList, linkifyTicketIdsToHtml } from '../../utils/textUtils';
import { getCategoryColor } from '../../utils/styles';

// subDays and startOfDay are manually implemented as they may be missing from certain date-fns bundle configurations
const subDays = (date: Date | number, amount: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() - amount);
  return result;
};

const startOfDay = (date: Date | number): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

// Icons SVGs
const iconRefresh = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw" style="color:#2C3E50;"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>`;
const iconShield = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-alert" style="color:white;"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>`;
const iconFootprints = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-footprints" style="color:white;"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"></path><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"></path><path d="M16 17h4"></path><path d="M4 13h4"></path></svg>`;
const iconCheck = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-check-big" style="color:#2C3E50;"><path d="M21.801 10A10 10 0 1 1 17 3.335"></path><path d="m9 11 3 3L22 4"></path></svg>`;
const iconRepeat = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-repeat" style="color:white;"><path d="m17 2 4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="m7 22-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path></svg>`;
const iconActivity = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-activity" style="color:#2C3E50;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>`;

// Helper function to generate stat boxes in the HTML report
const getStatBoxHtml = (label: string, value: string | number, trend24h: number | null, trend7d: number | null, type: string) => {
    const renderTrend = (trend: number | null, trendLabel: string) => {
        if (trend === null || trend === undefined) return '';
        const color = trend > 0 ? '#16a34a' : trend < 0 ? '#ef4444' : '#94a3b8';
        const arrow = trend > 0 ? '↑' : trend < 0 ? '↓' : '-';
        return `<div style="color:${color}; display:flex; align-items:center; gap:4px; font-size:10px; font-weight:bold;"><span>${arrow}</span> <span>${Math.abs(trend)} ${trendLabel}</span></div>`;
    };

    return `
    <div class="stat-box">
        <div class="stat-lbl">${label}</div>
        <div class="stat-val">${value}</div>
        <div class="stat-trend-container">
            ${renderTrend(trend24h, '24h')}
            <div style="width:1px; background:#e2e8f0; height:12px;"></div>
            ${renderTrend(trend7d, '7d')}
        </div>
    </div>
    `;
};

export const generateReportHtml = (
    executiveSummary: string, 
    displayMetrics: DashboardMetrics | null, 
    activities: TicketActivity[], 
    selectedGroup: Group,
    actualBacklogData: { labels: string[], data: number[] } | null = null,
    audioBase64: string | null = null
) => {
    if (!executiveSummary || !displayMetrics) return '';
    
    const cleanSummary = cleanMarkdown(executiveSummary);
    const overview = parseSynopsisSection(cleanSummary, "Executive Overview") || "Analysis in progress...";
    const notableRaw = parseSynopsisSection(cleanSummary, "Notable Points");
    const risksRaw = parseSynopsisSection(cleanSummary, "Critical Risk Alert");
    let actionsRaw = parseSynopsisSection(cleanSummary, "Strategic Action Roadmap");
    if (!actionsRaw) actionsRaw = parseSynopsisSection(cleanSummary, "Actionable Recommendations");
    const nextStepsRaw = parseSynopsisSection(cleanSummary, "Immediate/Next Steps");
    
    const riskItems = parseBulletList(risksRaw);
    const actionItems = parseBulletList(actionsRaw);
    const nextStepItems = parseBulletList(nextStepsRaw);
    const notableItems = parseBulletList(notableRaw);

    // --- REPEAT WATCHLIST LOGIC ---
    const repeatWatchlist = activities.filter(act => {
        const convs = act.conversations;
        if (convs.length < 2) return false;
        // Last two must be from customer
        return convs[convs.length - 1].incoming === true && convs[convs.length - 2].incoming === true;
    }).slice(0, 5);

    const linkifyForReport = (text: string) => {
        return text.replace(/(^|\s|[^\w/])#(\d+)\b/g, (match, prefix, id) => {
            return `${prefix}<a href="https://ecomplete.freshdesk.com/a/tickets/${id}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; text-decoration:underline; font-weight:900;">#${id}</a>`;
        });
    };

    const overviewHtml = overview.split('\n\n').map(para => `<p class="executive-insight-p">${linkifyForReport(para)}</p>`).join('');
    
    const avgSentiment = activities.length > 0 ? Math.round(activities.reduce((acc, curr) => acc + curr.sentimentScore, 0) / activities.length) : 50;
    const avgRisk = activities.length > 0 ? Math.round(activities.reduce((acc, curr) => acc + curr.riskScore, 0) / activities.length) : 50;
    
    const riskColor = avgRisk > 70 ? '#ef4444' : avgRisk > 40 ? '#eab308' : '#22c55e';
    const riskTextColor = avgRisk > 70 ? '#b91c1c' : avgRisk > 40 ? '#a16207' : '#15803d';
    
    const sentColor = avgSentiment > 70 ? '#22c55e' : avgSentiment > 40 ? '#eab308' : '#ef4444';
    const sentTextColor = avgSentiment > 70 ? '#15803d' : avgSentiment > 40 ? '#a16207' : '#b91c1c';

    const formatStrategicItemForReport = (item: string) => {
        if (!item || typeof item !== 'string') return '';
        const parts = item.split(':');
        if (parts.length > 1) {
            return `<strong style="color:#2C3E50; font-weight:900; display:block; margin-bottom:8px; font-size:16px;">${linkifyForReport(parts[0].trim())}</strong><span style="color:#64748b; display:block;">${linkifyForReport(parts.slice(1).join(':').trim())}</span>`;
        }
        return `<span style="color:#64748b; font-weight:500;">${linkifyForReport(item)}</span>`;
    };

    const matrixRows = activities.map(act => {
        const t = act.ticket;
        const color = getCategoryColor(act.analysis.category);
        const uColor = act.analysis.urgency === 'HIGH' || act.analysis.urgency === 'CRITICAL' ? '#ef4444' : act.analysis.urgency === 'MEDIUM' ? '#eab308' : '#22c55e';
        const rColor = act.riskScore > 70 ? '#ef4444' : act.riskScore > 40 ? '#eab308' : '#22c55e';
        const sColor = act.sentimentScore > 70 ? '#22c55e' : act.sentimentScore > 40 ? '#eab308' : '#ef4444';
        
        return `<tr>
            <td style="font-weight:900; color:#2C3E50;">#${t.id}</td>
            <td style="font-weight:700; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.subject}</td>
            <td style="font-size:12px; color:#64748b; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${act.aiSummary}</td>
            <td><span class="badge" style="background:${color}">${act.analysis.category}</span></td>
            <td><span class="badge" style="background:#e2e8f0; color:#475569;">${t.status}</span></td>
            <td style="font-size:12px; color:#64748b;">${formatDistanceToNow(new Date(t.created_at), {addSuffix:true})}</td>
            <td><span class="badge" style="background:${uColor}">${act.analysis.urgency}</span></td>
            <td style="font-weight:900; color:${rColor}">${act.riskScore}%</td>
            <td style="font-weight:900; color:${sColor}">${act.sentimentScore}%</td>
        </tr>`;
    }).join('');

    const uData = [
        activities.filter(a => a.analysis.urgency === 'LOW').length,
        activities.filter(a => a.analysis.urgency === 'MEDIUM').length,
        activities.filter(a => a.analysis.urgency === 'HIGH').length,
        activities.filter(a => a.analysis.urgency === 'CRITICAL').length
    ].join(',');

    const catCounts: Record<string, number> = {};
    CATEGORIES.forEach(c => catCounts[c] = 0);
    activities.forEach(a => {
        if (catCounts[a.analysis.category] !== undefined) {
            catCounts[a.analysis.category]++;
        } else {
            catCounts['Other'] = (catCounts['Other'] || 0) + 1;
        }
    });
    
    const catLabels = CATEGORIES.map(c => `"${c}"`).join(',');
    const catData = CATEGORIES.map(c => catCounts[c]).join(',');
    const catColors = CATEGORIES.map(c => `"${getCategoryColor(c)}"`).join(',');

    // --- FRESHDESK PULSE STATS ---
    const groupStats: Record<string, any> = {};
    const responseAgingStats: Record<string, any> = {};
    let respondedCount = 0;
    let unrespondedCount = 0;
    
    activities.forEach(a => {
        const t = a.ticket;
        const gName = a.brandName || 'Unassigned';
        
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

        const daysOld = Math.floor((new Date().getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24));
        
        let isRequesterLast = true;
        if (a.conversations && a.conversations.length > 0) {
            const lastMsg = a.conversations[a.conversations.length - 1];
            isRequesterLast = lastMsg.incoming;
        } else {
            isRequesterLast = t.status === 2;
        }

        const hasResponded = !isRequesterLast;
        if (hasResponded) respondedCount++;
        else unrespondedCount++;

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
            groupStats[gName].statusCounts['Open']++;
        } else {
            groupStats[gName].statusCounts['Pending/Waiting']++;
        }
    });

    const sortedGroups = Object.entries(groupStats).sort((a, b) => b[1].total - a[1].total);
    const groupLabels = sortedGroups.map(g => `"${g[0]}"`).join(',');
    const groupTotalData = sortedGroups.map(g => g[1].total).join(',');
    const groupOpenData = sortedGroups.map(g => g[1].statusCounts['Open']).join(',');
    const groupPendingData = sortedGroups.map(g => g[1].statusCounts['Pending/Waiting']).join(',');

    const age1Data = sortedGroups.map(g => g[1].age1).join(',');
    const age2Data = sortedGroups.map(g => g[1].age2).join(',');
    const age5Data = sortedGroups.map(g => g[1].age5).join(',');
    const agePlusData = sortedGroups.map(g => g[1].agePlus).join(',');

    const resp1Data = sortedGroups.map(g => responseAgingStats[g[0]].responded_1).join(',');
    const noResp1Data = sortedGroups.map(g => responseAgingStats[g[0]].no_response_1).join(',');
    const resp2Data = sortedGroups.map(g => responseAgingStats[g[0]].responded_2).join(',');
    const noResp2Data = sortedGroups.map(g => responseAgingStats[g[0]].no_response_2).join(',');
    const resp5Data = sortedGroups.map(g => responseAgingStats[g[0]].responded_5).join(',');
    const noResp5Data = sortedGroups.map(g => responseAgingStats[g[0]].no_response_5).join(',');
    const respPlusData = sortedGroups.map(g => responseAgingStats[g[0]].responded_plus).join(',');
    const noRespPlusData = sortedGroups.map(g => responseAgingStats[g[0]].no_response_plus).join(',');

    const responseRate = activities.length > 0 ? Math.round((respondedCount / activities.length) * 100) : 0;

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Executive Report - ${selectedGroup.name}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;900&display=swap');
      body { font-family: 'Inter', sans-serif; background: #f8f9fa; padding: 40px; color: #334155; zoom: 0.85; margin: 0 auto; max-width: 1400px; position: relative; overflow-x: hidden; }
      
      .container { width: 100%; position: relative; animation: fade-in 1.5s ease-out forwards; opacity: 0; }
      @keyframes fade-in { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }

      .section-card { background: white; border-radius: 56px; box-shadow: 0 30px 70px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 50px; }
      .banner { background: #2C3E50; color: white; padding: 48px; border-bottom: 12px solid #FFEB00; display:flex; justify-content:space-between; align-items:flex-end; }
      .banner h1 { font-size: 56px; font-weight: 900; letter-spacing: -3px; margin: 0; }
      .content { padding: 60px; }
      .overview-text { font-size: 20px; line-height: 1.8; font-weight:500; }
      .executive-insight-p { margin-bottom: 30px; }
      .executive-insight-p::first-letter { font-size: 72px; font-weight: 900; float: left; margin-right: 16px; line-height: 0.8; }
      
      .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 30px; margin-top: 30px; }
      .stat-box { background: white; border: 1px solid #f1f5f9; border-radius: 24px; padding: 1.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0,0,0,0.03); }
      .stat-lbl { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #94a3b8; margin-bottom: 0.5rem; letter-spacing: 0.2em; }
      .stat-val { font-size: 2.5rem; font-weight: 900; color: #1e293b; }
      .stat-trend-container { display: flex; gap: 12px; justify-content: center; width: 80%; border: 1px solid #f1f5f9; padding: 6px; border-radius: 99px; background: #f8fafc; margin-top: 10px; }
      
      .badge { padding: 4px 10px; border-radius: 20px; color: white; font-weight: 900; text-transform: uppercase; font-size: 9px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
      .roadmap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
      .roadmap-item { background: white; padding: 30px; border-radius: 40px; border: 1px solid #e2e8f0; display: flex; gap: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
      .roadmap-item .num { background: #2C3E50; color: white; width: 48px; height: 48px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-weight: 900; flex-shrink: 0; font-size: 18px; }
      
      .table-container { overflow-x: auto; width: 100%; border-radius: 24px; border: 1px solid #e2e8f0; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      th { background: #f8fafc; padding: 20px; text-align: left; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 900; letter-spacing: 1px; }
      td { padding: 20px; border-top: 1px solid #f1f5f9; vertical-align: middle; }
      
      .active-queue-card { background: white; border-radius: 56px; padding: 3.5rem; text-align: center; position: relative; overflow: hidden; margin-bottom: 30px; box-shadow: 0 30px 70px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
      .active-queue-accent { position: absolute; top: 0; left: 0; width: 100%; height: 6px; background: #FFEB00; }
      
      .step-item { display: flex; align-items: flex-start; gap: 20px; padding: 24px; background: white; border: 1px solid #e2e8f0; border-radius: 24px; margin-bottom: 20px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
      .step-icon { flex-shrink: 0; width: 32px; height: 32px; border-radius: 12px; background-color: #2C3E50; color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; }
      
      .kpi-row { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding: 48px; border-bottom: 1px solid #f1f5f9; background: #f8fafc; }
      .kpi-card { display: flex; flex-direction: column; gap: 1.5rem; }
      .kpi-header { display: flex; justify-content: space-between; align-items: flex-end; }
      .kpi-value { font-size: 2.25rem; font-weight: 900; }
      .kpi-progress-bg { width: 100%; height: 1rem; background-color: #e2e8f0; border-radius: 9999px; overflow: hidden; }
      .kpi-progress-fill { height: 100%; border-radius: 9999px; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
    </head><body>
    <div class="container">
      <div class="section-card">
          <div class="banner">
             <div><h1>Active Insight Stream</h1><h3 style="color:#94a3b8; letter-spacing:2px; text-transform:uppercase; margin-top:10px;">${selectedGroup.name}</h3></div>
             <div style="text-align:right;"><div>Snap Intelligence</div><div>${format(new Date(), "HH:mm | dd MMM yyyy")}</div></div>
          </div>
          ${audioBase64 ? `
          <div style="padding: 20px 48px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 20px;">
              <div style="width: 40px; height: 40px; background: #2C3E50; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:white;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
              </div>
              <div style="flex: 1;">
                  <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 4px;">Executive Audio Briefing</div>
                  <audio controls style="width: 100%; height: 32px;">
                      <source src="data:audio/mp3;base64,${audioBase64}" type="audio/mp3">
                      Your browser does not support the audio element.
                  </audio>
              </div>
          </div>
          ` : ''}
          <div class="kpi-row">
              <div class="kpi-card">
                  <div class="kpi-header"><div><span style="font-weight:900; text-transform:uppercase; letter-spacing:1px;">Brand Health Risk</span></div><span class="kpi-value" style="color:${riskTextColor}">${avgRisk}%</span></div>
                  <div class="kpi-progress-bg"><div class="kpi-progress-fill" style="width:${avgRisk}%; background:${riskColor}"></div></div>
              </div>
              <div class="kpi-card">
                  <div class="kpi-header"><div><span style="font-weight:900; text-transform:uppercase; letter-spacing:1px;">Emotional Sentiment</span></div><span class="kpi-value" style="color:${sentTextColor}">${avgSentiment}%</span></div>
                  <div class="kpi-progress-bg"><div class="kpi-progress-fill" style="width:${avgSentiment}%; background:${sentColor}"></div></div>
              </div>
          </div>
          <div class="content">
            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:60px;">
                <div>
                    <div style="display:flex; align-items:center; gap:16px; padding-bottom:24px; margin-bottom:24px; border-bottom:4px solid rgba(255,235,0,0.3);">
                        ${iconRefresh}
                        <h2 style="font-weight:900; text-transform:uppercase; color:#2C3E50; font-size:32px; letter-spacing:-1px; margin:0;">Strategic Insight</h2>
                    </div>
                    ${notableItems.length > 0 ? `<div style="margin-bottom:30px; margin-top: 30px;">${notableItems.map(item => `<div style="display:flex; gap:15px; margin-bottom:15px; background:#f8fafc; padding:15px; border-radius:15px; border:1px solid #f1f5f9;"><div style="width:10px; height:10px; background:#FFEB00; border-radius:50%; margin-top:6px;"></div><div style="font-weight:700; color:#334155;">${item}</div></div>`).join('')}</div>` : ''}
                    <div class="overview-text">${overviewHtml}</div>
                    
                    <div style="margin-top:60px; margin-bottom:40px;">
                        <div style="display:flex; align-items:center; gap:16px; padding-bottom:24px; margin-bottom:24px; border-bottom:4px solid rgba(255,235,0,0.3);">
                            <div style="width:50px; height:50px; background:#FFEB00; border-radius:16px; display:flex; align-items:center; justify-content:center;">${iconCheck}</div>
                            <h2 style="font-weight:900; text-transform:uppercase; color:#2C3E50; font-size:32px; letter-spacing:-1px; margin:0;">Strategic Action Roadmap</h2>
                        </div>
                        <div class="roadmap-grid" style="grid-template-columns: 1fr; gap: 20px;">
                            ${actionItems.map((item, idx) => `
                                <div class="roadmap-item">
                                    <div class="num">${idx+1}</div>
                                    <div style="font-size:15px; line-height:1.6;">${formatStrategicItemForReport(item)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div style="margin-top:40px; border-top:1px solid #eee; padding-top:40px;">
                        <div style="display:flex; align-items:center; gap:16px; margin-bottom:32px;">
                            <div style="width:40px; height:40px; background:#2C3E50; border-radius:12px; display:flex; align-items:center; justify-content:center;">${iconFootprints}</div>
                            <h3 style="font-weight:900; text-transform:uppercase; color:#2C3E50; font-size:24px; margin:0;">Immediate / Next Steps</h3>
                        </div>
                        ${nextStepItems.map(item => `<div class="step-item"><div class="step-icon">✓</div><div class="step-text">${formatStrategicItemForReport(item)}</div></div>`).join('')}
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:32px; position:sticky; top:32px; height:fit-content;">
                    <div style="background:#0f172a; color:white; padding:40px; border-radius:40px; box-shadow: 0 20px 50px rgba(0,0,0,0.2);">
                        <div style="display:flex; align-items:center; gap:16px; margin-bottom:32px;">
                            <div style="width:48px; height:48px; background:#ef4444; border-radius:16px; display:flex; align-items:center; justify-content:center;">${iconShield}</div>
                            <h3 style="font-size:14px; font-weight:900; text-transform:uppercase; letter-spacing:3px; margin:0;">Critical Risk Matrix</h3>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:24px;">
                            ${riskItems.length > 0 ? riskItems.map(item => `<div style="background:rgba(255,255,255,0.05); padding:24px; border-radius:24px; font-size:14px; font-weight:700; border: 1px solid rgba(255,255,255,0.1);">${linkifyForReport(item.replace(/Customer - /g, ''))}</div>`).join('') : '<div style="opacity:0.5; text-align:center;">Zero critical threats detected.</div>'}
                        </div>
                    </div>

                    <div style="background:white; color:#334155; padding:40px; border-radius:40px; border:1px solid #e2e8f0; box-shadow: 0 20px 50px rgba(0,0,0,0.05);">
                        <div style="display:flex; align-items:center; gap:16px; margin-bottom:32px;">
                            <div style="width:48px; height:48px; background:#f59e0b; border-radius:16px; display:flex; align-items:center; justify-content:center;">${iconRepeat}</div>
                            <h3 style="font-size:14px; font-weight:900; text-transform:uppercase; letter-spacing:3px; margin:0;">Repeat contact-watchlist</h3>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:20px;">
                            ${repeatWatchlist.length > 0 ? repeatWatchlist.map(act => `
                                <div style="background:#f8fafc; padding:20px; border-radius:24px; border: 1px solid #f1f5f9;">
                                    <div style="font-size:10px; font-weight:900; color:#f59e0b; text-transform:uppercase; margin-bottom:8px;">Double Follow-up</div>
                                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-bottom:8px;">${act.ticket.subject}</div>
                                    <div style="font-size:12px; font-weight:900; color:#2563eb;">#${act.ticket.id}</div>
                                </div>
                            `).join('') : '<div style="opacity:0.5; text-align:center; padding:20px;">No dual follow-ups detected.</div>'}
                        </div>
                    </div>
                </div>
            </div>
          </div>
      </div>

      <div class="active-queue-card">
          <div class="active-queue-accent"></div>
          <div style="font-weight:900; color:#94a3b8; text-transform:uppercase; font-size:14px; letter-spacing:4px; margin-bottom:30px;">Total Active Ticket Queue</div>
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:30px;">
              <div style="display:flex; flex-direction:column; align-items:center;">
                  <div style="font-size:110px; font-weight:900; color:#2C3E50; line-height:1; margin-bottom:10px;">${displayMetrics.activeTickets}</div>
                  <div style="font-size:14px; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:2px;">${format(new Date(), 'dd MMM yyyy')}</div>
              </div>
              <div style="height:250px; width:100%; max-width:800px; margin-left:-40px;"><canvas id="agingChart"></canvas></div>
          </div>
      </div>

      <div class="stat-grid">
          ${getStatBoxHtml('Created Today', displayMetrics.createdToday, displayMetrics.createdTrend24h, displayMetrics.createdTrend7d, 'Created')}
          ${getStatBoxHtml('Closed Today', displayMetrics.closedToday, displayMetrics.closedTrend24h, displayMetrics.closedTrend7d, 'Closed')}
          ${getStatBoxHtml('Today\'s activity', displayMetrics.workedToday, displayMetrics.workedTrend24h, displayMetrics.workedTrend7d, 'Worked')}
          ${getStatBoxHtml('Reopened Today', displayMetrics.reopenedToday, displayMetrics.reopenedTrend24h, displayMetrics.reopenedTrend7d, 'Reopened')}
          ${getStatBoxHtml('Creation Freq', displayMetrics.createdFrequency, null, null, 'Active')}
          ${getStatBoxHtml('Avg Response', displayMetrics.responseFrequency, null, null, 'Response')}
      </div>

      <div class="section-card" style="padding:60px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:40px;">
              <h3 style="font-weight:900; text-transform:uppercase; color:#2C3E50; font-size:28px; display:flex; align-items:center; gap:15px;">${iconActivity} Sequential Volume Flow</h3>
          </div>
          <div style="height:350px;"><canvas id="timelineChart"></canvas></div>
      </div>

      <div class="section-card" style="padding:60px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:40px;">
              <h3 style="font-weight:900; text-transform:uppercase; color:#2C3E50; font-size:28px; display:flex; align-items:center; gap:15px;">Support Ecosystem Pulse Check</h3>
          </div>
          
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:30px; margin-bottom:40px;">
              <div class="stat-box" style="background:#f8fafc;">
                  <div class="stat-lbl">Response Rate</div>
                  <div class="stat-val" style="color:${responseRate < 50 ? '#ef4444' : responseRate < 80 ? '#f59e0b' : '#22c55e'}">${responseRate}%</div>
                  <div style="font-size:12px; color:#64748b; margin-top:10px; font-weight:700;">${respondedCount} Responded / ${unrespondedCount} Waiting</div>
              </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr; gap:40px; margin-bottom:40px;">
              <div>
                  <h4 style="font-weight:900; text-transform:uppercase; font-size:14px; margin-bottom:20px; color:#64748b;">Active Volume by Group</h4>
                  <div style="height:250px;"><canvas id="pulseGroupChart"></canvas></div>
              </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:40px;">
              <div>
                  <h4 style="font-weight:900; text-transform:uppercase; font-size:14px; margin-bottom:20px; color:#64748b;">Aging Analysis by Group</h4>
                  <div style="height:250px;"><canvas id="pulseAgingChart"></canvas></div>
              </div>
              <div>
                  <h4 style="font-weight:900; text-transform:uppercase; font-size:14px; margin-bottom:20px; color:#64748b;">Aging & Response Analysis by Group</h4>
                  <div style="height:250px;"><canvas id="pulseResponseChart"></canvas></div>
              </div>
          </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:40px; margin-bottom:50px;">
          <div class="section-card" style="padding:40px;">
              <h3 style="font-weight:900; text-transform:uppercase; font-size:16px; margin-bottom:30px;">Urgency Profile</h3>
              <div style="height:250px;"><canvas id="uChart"></canvas></div>
          </div>
          <div class="section-card" style="padding:40px;">
              <h3 style="font-weight:900; text-transform:uppercase; font-size:16px; margin-bottom:30px;">Category Matrix</h3>
              <div style="height:250px;"><canvas id="cChart"></canvas></div>
          </div>
      </div>

      <div class="section-card">
          <div style="padding:40px; background:#f8fafc; border-bottom:1px solid #f1f5f9;">
              <h3 style="font-weight:900; text-transform:uppercase; font-size:20px; margin:0;">Active Ticket Sample (${activities.length} Records)</h3>
          </div>
          <div class="table-container">
              <table>
                  <thead><tr><th>ID</th><th>Subject</th><th>Summary</th><th>Category</th><th>Status</th><th>Created</th><th>Urgency</th><th>Risk</th><th>Sentiment</th></tr></thead>
                  <tbody>${matrixRows}</tbody>
              </table>
          </div>
      </div>
    </div>

    <script>
      function initCharts() {
          Chart.register(ChartDataLabels);
          
          const agingCtx = document.getElementById('agingChart').getContext('2d');
          new Chart(agingCtx, { 
            type:'line', 
            data:{ 
                labels:[${actualBacklogData ? actualBacklogData.labels.map(l=>`"${l}"`).join(',') : '""'}], 
                datasets:[{ 
                    data:[${actualBacklogData ? actualBacklogData.data.join(',') : '0'}], 
                    borderColor:'#FFEB00', 
                    borderWidth:3, 
                    fill:true, 
                    backgroundColor:'rgba(255,235,0,0.2)', 
                    pointRadius:4, 
                    pointBackgroundColor: '#2C3E50',
                    tension:0.4 
                }] 
            }, 
            options:{ 
                responsive: true,
                maintainAspectRatio:false, 
                plugins:{ 
                    legend:{display:false},
                    datalabels: {
                        display: true,
                        align: 'top',
                        font: { weight: 'bold', size: 10 },
                        color: '#2C3E50',
                        formatter: (v) => v > 0 ? v : ''
                    }
                }, 
                scales:{ 
                    x:{
                        display:true, 
                        grid:{display:false}, 
                        ticks:{font:{size:9, weight:'bold'}, color:'#94a3b8', maxTicksLimit:15}
                    }, 
                    y:{display:false, min:0} 
                } 
            } 
          });
          
          const timelineCtx = document.getElementById('timelineChart').getContext('2d');
          new Chart(timelineCtx, { 
            type:'line', 
            data:{ 
                labels:Array.from({length:24}, (_,i)=>i+":00"), 
                datasets:[
                  { label:'Present Day', data:[${displayMetrics.ticketsByHour.join(',')}], borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,0.1)', fill:true, tension:0.4 },
                  { label:'Yesterday', data:[${displayMetrics.ticketsByHour24hAgo.join(',')}], borderColor:'#60a5fa', borderDash:[5,5], tension:0.4 },
                  { label:'7 Days Ago', data:[${displayMetrics.ticketsByHour7dAgo.join(',')}], borderColor:'#f97316', backgroundColor:'rgba(249,115,22,0.05)', borderDash:[2,2], fill:true, tension:0.4 }
                ]
            }, 
            options:{ 
                responsive: true,
                maintainAspectRatio:false, 
                plugins:{ 
                    legend:{display:false},
                    datalabels: { display: false }
                }, 
                scales:{ 
                    x:{ grid:{display:false}, ticks:{font:{weight:'bold', size:10}, color:'#94a3b8'} },
                    y:{ beginAtZero:true, grid:{color:'#f1f5f9'}, ticks:{font:{weight:'bold', size:10}, color:'#94a3b8'} } 
                } 
            } 
          });

          const uCtx = document.getElementById('uChart').getContext('2d');
          new Chart(uCtx, { 
            type:'doughnut', 
            data:{ 
                labels:['LOW','MEDIUM','HIGH','CRITICAL'], 
                datasets:[{ 
                    data:[${uData}], 
                    backgroundColor:['#22c55e', '#eab308', '#f97316', '#ef4444'], 
                    borderWidth:2,
                    borderColor: '#ffffff',
                    hoverOffset: 15
                }] 
            }, 
            options:{ 
                responsive: true,
                maintainAspectRatio:false, 
                cutout:'70%', 
                plugins:{ 
                    legend:{display:false},
                    datalabels: {
                        color: '#ffffff',
                        font: { weight: 'bold' },
                        formatter: (value, ctx) => {
                            let sum = 0;
                            const dataArr = ctx.chart.data.datasets[0].data;
                            dataArr.map(data => { sum += data; });
                            if (sum === 0 || value === 0) return "";
                            return (value * 100 / sum).toFixed(0) + "%";
                        }
                    }
                } 
            } 
          });
          
          const cCtx = document.getElementById('cChart').getContext('2d');
          new Chart(cCtx, { 
            type:'bar', 
            data:{ 
                labels:[${catLabels}], 
                datasets:[{ 
                    data:[${catData}], 
                    backgroundColor:[${catColors}], 
                    borderRadius:4,
                    barPercentage: 0.7
                }] 
            }, 
            options:{ 
                indexAxis:'y', 
                responsive: true,
                maintainAspectRatio:false, 
                plugins:{ 
                    legend:{display:false},
                    datalabels: {
                        color: '#ffffff',
                        font: { weight: 'bold' },
                        anchor: 'center',
                        align: 'center',
                        formatter: (value, ctx) => {
                            let sum = 0;
                            const dataArr = ctx.chart.data.datasets[0].data;
                            dataArr.map(data => { sum += data; });
                            if (sum === 0 || value === 0) return "";
                            const percentage = (value * 100 / sum).toFixed(0);
                            return parseInt(percentage) > 3 ? percentage + "%" : "";
                        }
                    }
                }, 
                scales:{ 
                    x:{display:false},
                    y:{ grid:{display:false}, ticks:{font:{weight:'bold', size:10}, color:'#475569'} }
                } 
            } 
          });

          // Pulse Charts
          const pulseGroupCtx = document.getElementById('pulseGroupChart').getContext('2d');
          new Chart(pulseGroupCtx, {
              type: 'bar',
              data: {
                  labels: [${groupLabels}],
                  datasets: [
                      { label: 'Open', data: [${groupOpenData}], backgroundColor: '#3b82f6', borderRadius: 4 },
                      { label: 'Pending/Waiting', data: [${groupPendingData}], backgroundColor: '#94a3b8', borderRadius: 4 }
                  ]
              },
              options: {
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'top', labels: { font: { weight: 'bold', size: 10 } } }, datalabels: { display: false } },
                  scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { weight: 'bold', size: 10 } } }, y: { stacked: true, grid: { color: '#f1f5f9' } } }
              }
          });

          const pulseAgingCtx = document.getElementById('pulseAgingChart').getContext('2d');
          new Chart(pulseAgingCtx, {
              type: 'bar',
              data: {
                  labels: [${groupLabels}],
                  datasets: [
                      { label: '< 1 Day', data: [${age1Data}], backgroundColor: '#22c55e' },
                      { label: '1-2 Days', data: [${age2Data}], backgroundColor: '#3b82f6' },
                      { label: '3-5 Days', data: [${age5Data}], backgroundColor: '#f59e0b' },
                      { label: '6+ Days', data: [${agePlusData}], backgroundColor: '#ef4444' }
                  ]
              },
              options: {
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'top', labels: { font: { weight: 'bold', size: 10 } } }, datalabels: { display: false } },
                  scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { weight: 'bold', size: 10 } } }, y: { stacked: true, grid: { color: '#f1f5f9' } } }
              }
          });

          const pulseResponseCtx = document.getElementById('pulseResponseChart').getContext('2d');
          new Chart(pulseResponseCtx, {
              type: 'bar',
              data: {
                  labels: [${groupLabels}],
                  datasets: [
                      { label: 'Responded (< 1 Day)', data: [${resp1Data}], backgroundColor: '#22c55e', stack: 'Stack 0' },
                      { label: 'No Response (< 1 Day)', data: [${noResp1Data}], backgroundColor: '#bbf7d0', stack: 'Stack 0' },
                      { label: 'Responded (1-2 Days)', data: [${resp2Data}], backgroundColor: '#3b82f6', stack: 'Stack 1' },
                      { label: 'No Response (1-2 Days)', data: [${noResp2Data}], backgroundColor: '#bfdbfe', stack: 'Stack 1' },
                      { label: 'Responded (3-5 Days)', data: [${resp5Data}], backgroundColor: '#f59e0b', stack: 'Stack 2' },
                      { label: 'No Response (3-5 Days)', data: [${noResp5Data}], backgroundColor: '#fde68a', stack: 'Stack 2' },
                      { label: 'Responded (6+ Days)', data: [${respPlusData}], backgroundColor: '#ef4444', stack: 'Stack 3' },
                      { label: 'No Response (6+ Days)', data: [${noRespPlusData}], backgroundColor: '#fecaca', stack: 'Stack 3' }
                  ]
              },
              options: {
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'top', labels: { font: { weight: 'bold', size: 10 } } }, datalabels: { display: false } },
                  scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { weight: 'bold', size: 10 } } }, y: { stacked: true, grid: { color: '#f1f5f9' } } }
              }
          });
      }
      document.addEventListener('DOMContentLoaded', initCharts);
    </script>
    </body></html>`;
};
