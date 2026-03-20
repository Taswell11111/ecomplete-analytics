import { format } from 'date-fns';
import { cleanMarkdown, linkifyTicketIdsToHtml } from '../../utils/textUtils';

export const generateCSReportHtml = (
    csStrategyContent: string, 
    brandsIncluded: string[]
) => {
    if (!csStrategyContent || typeof csStrategyContent !== 'string') return '';
    
    // Process the content into sections based on the expected headers
    const sections = csStrategyContent.split(/\*\*([^*]+)\*\*:/g);
    
    // Helper to extract section by name
    const getSection = (name: string) => {
        const idx = sections.findIndex(s => s.toLowerCase().trim().includes(name.toLowerCase().trim()));
        return idx !== -1 ? sections[idx + 1] : null;
    };

    const snapshots = getSection("Brand Snapshots");
    const heatmap = getSection("Cross-Brand Risk Heatmap");
    const allocation = getSection("Agent Ticket Allocation");
    const conclusion = getSection("Conclusion");
    const message = getSection("Key Message to Team");

    const linkify = (text: string) => linkifyTicketIdsToHtml(text);

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>CS Strategic Directive - ${format(new Date(), "dd MMM")}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;900&family=JetBrains+Mono:wght@700&display=swap');
      body { font-family: 'Inter', sans-serif; background: #0f172a; padding: 40px; color: #cbd5e1; margin: 0 auto; max-width: 1200px; line-height: 1.6; }
      
      .directive-header { border-bottom: 2px solid #FFEB00; padding-bottom: 40px; margin-bottom: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
      .directive-title { font-size: 56px; font-weight: 900; color: white; letter-spacing: -3px; margin: 0; line-height: 1; text-transform: uppercase; }
      .directive-sub { color: #FFEB00; font-weight: 900; font-size: 14px; letter-spacing: 5px; text-transform: uppercase; margin-top: 10px; }
      
      .brand-card { background: #1e293b; border-radius: 32px; padding: 40px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 40px; position: relative; overflow: hidden; }
      .brand-card::before { content: ''; position: absolute; top: 0; left: 0; width: 6px; height: 100%; background: #FFEB00; }
      .brand-title { font-size: 24px; font-weight: 900; color: white; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 15px; }
      .brand-risk { font-size: 10px; background: rgba(255,235,0,0.1); color: #FFEB00; padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,235,0,0.3); }
      
      .ticket-item { background: rgba(0,0,0,0.2); border-radius: 16px; padding: 20px; margin-top: 20px; border-left: 4px solid #3b82f6; }
      .ticket-num { font-family: 'JetBrains Mono', monospace; color: #3b82f6; font-size: 16px; margin-bottom: 5px; display: block; text-decoration: none; }
      
      .heatmap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; }
      .heatmap-col { background: #1e293b; border-radius: 24px; padding: 30px; }
      .heatmap-hdr { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
      .hdr-high { color: #ef4444; } .hdr-mod { color: #f97316; } .hdr-low { color: #22c55e; }
      
      .agent-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 15px; }
      .agent-row { display: flex; gap: 20px; background: #1e293b; padding: 25px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); }
      .agent-id { width: 100px; flex-shrink: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #94a3b8; text-transform: uppercase; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 20px; }
      .agent-tasks { flex: 1; }
      
      .message-box { background: #FFEB00; color: #0f172a; padding: 40px; border-radius: 32px; text-align: center; margin-top: 60px; box-shadow: 0 20px 40px rgba(255,235,0,0.2); }
      .message-box h2 { font-weight: 900; text-transform: uppercase; font-size: 32px; margin-bottom: 10px; letter-spacing: -1px; }
      
      h3 { color: white; text-transform: uppercase; letter-spacing: 2px; font-size: 18px; margin-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; }
      p { margin-bottom: 20px; }
      ul { list-style: none; padding: 0; margin-bottom: 30px; }
      li { margin-bottom: 15px; padding-left: 20px; position: relative; }
      li::before { content: '→'; position: absolute; left: 0; color: #FFEB00; }
      
      a { color: #60a5fa; text-decoration: none; font-weight: 900; }
      a:hover { text-decoration: underline; }
    </style>
    </head><body>
      <div class="directive-header">
        <div>
          <h1 class="directive-title">CS Strategic Directive</h1>
          <div class="directive-sub">Cross-Brand Alignment & Action Plan</div>
        </div>
        <div style="text-align: right">
          <div style="font-weight: 900; font-size: 14px; color: white;">Snap Intelligence</div>
          <div style="font-size: 12px; opacity: 0.6;">${format(new Date(), "HH:mm | dd MMM yyyy")}</div>
        </div>
      </div>

      <section>
        <h3>Brand Snapshots & Key Tickets</h3>
        ${(snapshots && typeof snapshots === 'string') ? linkify(snapshots).split('\n\n').map(p => {
          if (p.includes('Risk Level:')) {
            return `<div class="brand-card">${p.replace(/\n/g, '<br>')}</div>`;
          }
          return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('') : ''}
      </section>

      <section style="margin-top: 80px;">
        <h3>Cross-Brand Risk Heatmap</h3>
        <div class="heatmap-grid">
           ${(heatmap && typeof heatmap === 'string') ? heatmap.split('\n\n').map((col, i) => {
             const title = i === 0 ? 'HIGH RISK' : i === 1 ? 'MODERATE RISK' : 'LOW RISK';
             const cls = i === 0 ? 'hdr-high' : i === 1 ? 'hdr-mod' : 'hdr-low';
             return `<div class="heatmap-col">
               <div class="heatmap-hdr ${cls}">${title}</div>
               <div style="font-size: 13px; font-weight: 500;">${col.replace(/\n/g, '<br>')}</div>
             </div>`;
           }).join('') : ''}
        </div>
      </section>

      <section style="margin-top: 80px;">
        <h3>Agent Ticket Allocation (Today)</h3>
        <div class="agent-grid">
          ${(allocation && typeof allocation === 'string') ? allocation.split('AGENT').slice(1).map(entry => {
            const lines = entry.trim().split('\n');
            const agentNum = lines[0];
            const tasks = lines.slice(1).join('<br>');
            return `
              <div class="agent-row">
                <div class="agent-id">AGENT ${agentNum}</div>
                <div class="agent-tasks">${linkify(tasks)}</div>
              </div>
            `;
          }).join('') : ''}
        </div>
      </section>

      <section style="margin-top: 80px;">
        <h3>Strategic Conclusion</h3>
        <div style="background: rgba(255,255,255,0.02); padding: 40px; border-radius: 32px;">
          ${(conclusion && typeof conclusion === 'string') ? conclusion.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('') : ''}
        </div>
      </section>

      <div class="message-box">
        <h2>Message to the Team</h2>
        <div style="font-size: 20px; font-weight: 700;">${message || 'Stay focused. Close the loops.'}</div>
      </div>

      <div style="margin-top: 100px; text-align: center; opacity: 0.3; font-size: 10px; font-weight: 900; letter-spacing: 5px;">
        CONFIDENTIAL PROPERTY OF ECOMPLETE COMMERCE
      </div>
    </body></html>`;
};