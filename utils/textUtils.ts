import React from 'react';

// Clean markdown utility
export const cleanMarkdown = (text: string) => {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/\*\*/g, '').replace(/###/g, '').replace(/##/g, '');
};

export const parseSynopsisSection = (text: string, header: string) => {
    if (!text || typeof text !== 'string') return null;
    const headers = [
        "Executive Overview",
        "Notable Points",
        "Ticket Category Breakdown",
        "Key Operational Failures",
        "Critical Risk Alert",
        "Immediate/Next Steps",
        "Actionable Recommendations",
        "Strategic Action Roadmap",
        "Ready to Close & Spam"
    ];
    
    const lowerText = text.toLowerCase();
    const lowerHeader = header.toLowerCase();
    
    const headerIndex = lowerText.indexOf(lowerHeader);
    if (headerIndex === -1) return null;

    const contentStart = headerIndex + header.length;
    let nextHeaderIndex = text.length;

    headers.forEach(h => {
        if (h.toLowerCase() !== lowerHeader) {
            const idx = lowerText.indexOf(h.toLowerCase(), contentStart);
            if (idx !== -1 && idx < nextHeaderIndex) {
                nextHeaderIndex = idx;
            }
        }
    });

    return text.substring(contentStart, nextHeaderIndex).trim();
};

export const parseBulletList = (text: string | null) => {
    if (!text || typeof text !== 'string') return [];
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || /^\d+\./.test(line)))
      .map(line => line.replace(/^[-•*]|\d+\.\s*/, '').trim());
};

export const linkifyTicketIds = (text: string) => {
    if (!text || typeof text !== 'string') return '';
    const regex = /#(\d+)/g;
    const parts = text.split(regex);
    return parts.map((part, i) => {
        if (i % 2 === 1) {
            return React.createElement('a', {
                key: i,
                href: `https://ecomplete.freshdesk.com/a/tickets/${part}`,
                target: "_blank",
                rel: "noreferrer",
                className: "text-blue-600 underline hover:text-blue-800 transition-colors decoration-1 font-black"
            }, `${part}`); // Removed #
        }
        return part;
    });
};

export const linkifyTicketIdsToHtml = (text: string) => {
    if (!text || typeof text !== 'string') return '';
    // Strictly target # followed by digits, ensuring it's not already part of a URL
    return text.replace(/(^|\s|[^\w/])#(\d+)\b/g, (match, prefix, id) => {
        return `${prefix}<a href="https://ecomplete.freshdesk.com/a/tickets/${id}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; text-decoration:underline; font-weight:900;">${id}</a>`; // Removed # in display
    });
};

export const formatStrategicItem = (text: string) => {
    if (!text || typeof text !== 'string') return null;
    let colonIndex = text.indexOf(':');
    let separatorLength = 1;
    
    // Check for dash separator if colon not found or dash appears earlier (e.g. "Title - Body")
    const dashIndex = text.indexOf(' - ');
    if (dashIndex !== -1 && (colonIndex === -1 || dashIndex < colonIndex)) {
        colonIndex = dashIndex;
        separatorLength = 3; // " - " is 3 chars
    }

    if (colonIndex !== -1) {
        const title = text.substring(0, colonIndex);
        const body = text.substring(colonIndex + separatorLength);
        
        return React.createElement(React.Fragment, null, 
            React.createElement('span', { className: 'text-lg font-black text-slate-800 mr-2' }, linkifyTicketIds(title)),
            React.createElement('span', { className: 'text-base font-normal text-slate-600' }, linkifyTicketIds(body))
        );
    }
    return React.createElement('span', { className: 'text-base font-normal text-slate-600' }, linkifyTicketIds(text));
};

export const formatStrategicHtml = (text: string) => {
    if (!text || typeof text !== 'string') return '';
    const linkified = linkifyTicketIdsToHtml(text);
    
    // Logic to separate bold title from body
    // Priority: Colon, then " - "
    let separatorIndex = linkified.indexOf(':');
    let separatorLen = 1;

    const dashIndex = linkified.indexOf(' - ');
    if (dashIndex !== -1 && (separatorIndex === -1 || dashIndex < separatorIndex)) {
        separatorIndex = dashIndex;
        separatorLen = 3;
    }

    if (separatorIndex !== -1) {
        const title = linkified.substring(0, separatorIndex);
        const body = linkified.substring(separatorIndex + separatorLen);
        return `<span style="color:#1e293b; font-weight:900; font-size:16px;">${title}</span> <span style="color:#475569; font-weight:400; font-size:15px;">${body}</span>`;
    }
    return `<span style="color:#334155; font-weight:400; font-size:15px; line-height:1.6;">${linkified}</span>`;
};