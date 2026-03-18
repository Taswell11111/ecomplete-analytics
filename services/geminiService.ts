
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Conversation, GeminiSummaryResponse, Ticket, CATEGORIES, TicketActivity, DashboardMetrics, Group } from '../types';
import { ECOMPLETE_GROUPS } from '../constants';

// Manual implementation of base64 decoding for audio
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function pcmToWav(pcmData: Uint8Array, sampleRate: number): string {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM data
  const pcmView = new Uint8Array(buffer, 44);
  pcmView.set(pcmData);

  // Convert to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Manual implementation of raw PCM decoding
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const analyseAndSummariseTicket = async (
  ticket: Ticket,
  conversations: Conversation[]
): Promise<GeminiSummaryResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const conversationText = conversations
    .slice(-8)
    .map(c => `[${c.incoming ? 'Customer' : 'Agent'}]: ${c.body_text}`)
    .join('\n\n');

  const validCategoriesString = CATEGORIES.join(', ');

  const prompt = `
    Analyse this support ticket.
    Subject: ${ticket.subject}
    Description: ${ticket.description_text}
    History: ${conversationText}
    
    Tasks:
    1. Determine URGENCY (CRITICAL, HIGH, MEDIUM, LOW).
    2. Determine CATEGORY (Strictly one of: ${validCategoriesString}). If no fit, use "Other".
    3. Provide a 1 sentence status summary of the customer's wants and current state.
    4. Estimate time spent by agents in minutes (approx).
    5. Determine SENTIMENT SCORE (0-100).
    6. Determine BRAND RISK SCORE (0-100).
    
    IMPORTANT: Use British English spelling (e.g., "colour", "programme", "centre", "analyse", "summarise") for all text outputs.
    Output JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            timeSpentMinutes: { type: Type.NUMBER },
            urgency: { type: Type.STRING, enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
            category: { type: Type.STRING, enum: [...CATEGORIES] },
            sentimentScore: { type: Type.NUMBER },
            riskScore: { type: Type.NUMBER }
          },
          required: ["summary", "urgency", "category", "sentimentScore", "riskScore"]
        }
      }
    });
    const result = JSON.parse(response.text || "{}") as GeminiSummaryResponse;
    if (result.urgency) result.urgency = result.urgency.toUpperCase();
    return result;
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return { summary: "Analysis failed.", timeSpentMinutes: 0, urgency: "LOW", category: "Other", sentimentScore: 50, riskScore: 0 };
  }
};

export const generateExecutiveSummary = async (tickets: TicketActivity[], metrics: DashboardMetrics): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    if (tickets.length === 0) return "No data available.";

    const created7DaysAgo = metrics.createdToday - metrics.createdTrend7d;
    const volumeComparisonStr = `Volume Context: Tickets created in the last 24h: ${metrics.createdToday}. Same period 7 days ago: ${created7DaysAgo}.`;

    const dataSummary = tickets.map(t => ({
        subject: t.ticket.subject,
        cat: t.analysis.category,
        urg: t.analysis.urgency,
        risk: t.riskScore,
        id: t.ticket.id,
        summary: t.aiSummary
    })).slice(0, 50);

    const prompt = `
    You are a world-class Senior Business Analyst for eCompleteCommerce.
    
    KEY METRICS:
    - Current Active Queue: ${metrics.activeTickets}
    - ${volumeComparisonStr}
    - Brand Health Risk: ${Math.round(tickets.reduce((acc, curr) => acc + curr.riskScore, 0) / (tickets.length || 1))}%
    - Customer Sentiment: ${Math.round(tickets.reduce((acc, curr) => acc + curr.sentimentScore, 0) / (tickets.length || 1))}%
    
    AGING & RESPONSE ANALYSIS:
    - Responded Tickets: ${metrics.respondedCount || 'N/A'}
    - Unresponded Tickets: ${metrics.unrespondedCount || 'N/A'}
    - Average Ticket Age: ${metrics.avgAgeDays || 'N/A'} days
    - Requester Last Message: ${metrics.requesterLastCount || 'N/A'}
    - Agent Last Message: ${metrics.agentLastCount || 'N/A'}
    
    TICKET DATA: ${JSON.stringify(dataSummary)}

    Generate a comprehensive, data-driven executive synopsis and audio briefing script. 
    The script must be professional, authoritative, and focus on data analytics: ticket volume, frequency, types, and key points of attention.
    Specifically, analyze the Aging & Response metrics. If the unresponded count is high or the average age is high, highlight this as a critical operational risk.

    The audio briefing script MUST reflect on:
    1. Total Active Ticket Queue (which represents the Total Active Volume) and the breakdown per group.
    2. Historical Backlog Matrix (Active Queue Volume).
    3. Brand Health Risk Threshold.
    4. Customer Emotional Sentiment.
    5. Metric blocks for Created Today, Closed Today, Today's activity, Reopened Today, Avg Response.
    6. Sequential Volume Flow chart data.
    7. Urgency profile and Category Matrix.
    8. In-depth Support Ecosystem Pulse Check.

    The script should follow this flow:
    1. Greeting and Introduction.
    2. Total Active Queue Breakdown (mentioning the ${metrics.activeTickets} tickets and breakdown per group).
    3. Historical Backlog Analysis (trends in ticket creation dates).
    4. Aging & Response Analysis (Discuss response rates and ticket age).
    5. Brand Health Risk and Customer Sentiment assessment.
    6. Metric Highlights (Created Today, Closed Today, Activity, Reopened Today, Avg Response).
    7. Sequential Volume Flow analysis.
    8. Urgency profile and Category Matrix analysis.
    9. Support Ecosystem Pulse Check (Key themes and specific high-risk tickets).
    10. Strategic Action Roadmap.

    Output strictly using these headers and rules:

    **Executive Overview**: 
    1. Write 3-4 detailed paragraphs in British English.
    2. LEAN HEAVILY ON DATA ANALYTICS regarding the SPECIFIC REASONS customers are submitting service requests.
    3. EXPLICITLY NOTE COMMON THEMES AND TRENDS being reported by customers across the brands.
    4. START THE VOLUME SYNTHESIS PARAGRAPH EXACTLY WITH: "With a reference to the ticket volume comparison..." and analyse if the volume is up or down compared to last week and what that implies.
    5. End the Executive Overview with a distinct, final paragraph summarising the overall operational condition and leading into the Pulse Check.

    **Notable Points**:
    Provide exactly 3 high-level strategic insight sentences based on volume and frequency data. Format as a bulleted list.

    **Critical Risk Alert**: List specific high-risk tickets (Format: Customer - #ID: Description of risk). Bulleted list.

    **Immediate/Next Steps**:
    List 3-5 distinct, urgent actions. BE SPECIFIC.
    Format: "Contact customer [Name/ID] regarding ticket #[ID] to resolve [Issue]..."
    Focus on critical urgency items and brand health/sentiment risks. Bulleted list.

    **Strategic Action Roadmap**:
    List 3 specific, high-impact steps to resolve the biggest issues identified above. 
    Format as numbered list: 1. [Action] - [Reason]
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: [{ parts: [{ text: prompt }] }],
            config: { thinkingConfig: { thinkingBudget: 32768 } }
        });
        return response.text || "Summary failed.";
    } catch (e: any) {
        console.error("Summary generation failed:", e);
        return "Unable to generate summary.";
    }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    // Clean the text for better TTS (remove markdown headers)
    const cleanText = text.replace(/\*\*/g, '').replace(/#/g, '');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this executive summary professionally and clearly. Use a steady, authoritative tone suitable for a business briefing: ${cleanText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // Decode base64 to get raw PCM bytes
      const pcmData = decodeBase64(base64Audio);
      // Convert PCM to WAV
      const wavBase64 = pcmToWav(pcmData, 24000);
      return wavBase64;
    }
    return null;
  } catch (e) {
    console.error("TTS generation failed", e);
    return null;
  }
};

export const regenerateExecutiveSummaryWithFeedback = async (
    currentSummary: string, 
    userFeedback: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
    You are refining an Executive Report for eCompleteCommerce.
    
    CURRENT REPORT CONTENT:
    ${currentSummary}

    USER FEEDBACK / NEW CONTEXT:
    "${userFeedback}"

    TASK:
    Regenerate the "Strategic Insight", "Notable Points", "Critical Risk Alert", and "Strategic Action Roadmap" sections taking the user's feedback into account.
    If the feedback provides new information about a resolution or a false alarm, update the risks accordingly.
    Keep the "Executive Overview" mostly intact unless the feedback fundamentally changes the situation, but ensure the tone aligns.
    
    Output the FULL report content with the same headers:
    **Executive Overview**
    **Notable Points**
    **Critical Risk Alert**
    **Immediate/Next Steps**
    **Strategic Action Roadmap**
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ parts: [{ text: prompt }] }],
            config: { thinkingConfig: { thinkingBudget: 1024 } } 
        });
        return response.text || currentSummary;
    } catch (e: any) {
        console.error("Regeneration failed:", e);
        throw e;
    }
};

export const generateCSStrategyReport = async (
    allBrandData: { brandName: string, metrics: DashboardMetrics, tickets: TicketActivity[] }[]
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const brandBriefs = allBrandData.map(d => ({
        brand: d.brandName,
        totalActive: d.metrics.activeTickets,
        sample: d.tickets.map(t => ({
            id: t.ticket.id,
            subj: t.ticket.subject,
            summ: t.aiSummary,
            risk: t.riskScore,
            urg: t.analysis.urgency
        })).slice(0, 12)
    }));

    const prompt = `
    You are the CS Operations Director for eComplete Commerce. 
    You are creating a "Daily Strategic Directive" for the Customer Service Team.
    
    DATA SOURCE: ${JSON.stringify(brandBriefs)}

    Output strictly using these headers:

    **Brand Snapshots**:
    For each brand, provide:
    [Brand Name]
    Risk Level: [LOW / MODERATE / HIGH]
    One paragraph explaining the current operational state, hidden risks (e.g. drop in volume suggesting intake failure), and specific customer friction points found in the tickets.
    Key tickets to prioritise: List 2-3 specific ticket #IDs with a one-sentence instruction on why they are priority.
    Immediate focus: One sentence defining the goal for this brand today.

    **Cross-Brand Risk Heatmap**:
    Provide three lists: HIGH RISK, MODERATE RISK, LOW RISK. 
    Under each, list the brands and a one-phrase reason for their placement.

    **Agent Ticket Allocation**:
    Assign 10 of the most critical discovered tickets (from any brand) to 5 virtual Agent slots.
    Format:
    AGENT 1
    #ID (Brand) - Specific instruction for resolution.
    #ID (Brand) - Specific instruction for resolution.
    [Repeat for AGENT 2, 3, 4, 5]

    **Conclusion**:
    Provide two lists:
    SYSTEMIC ISSUES: Issues affecting multiple brands (e.g. Courier failures, Refund silence).
    BRAND-SPECIFIC ISSUES: Unique issues for individual brands.

    **Key Message to Team**:
    Write a final 1-sentence "Battle Cry" or priority message to the team in bold.

    RULES:
    - Use British English.
    - Be authoritative, strategic, and concise.
    - Focus on "Closing Loops" and "Proactive De-escalation".
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ parts: [{ text: prompt }] }],
            config: { thinkingConfig: { thinkingBudget: 16384 } }
        });
        return response.text || "CS Strategy generation failed.";
    } catch (e: any) {
        console.error("CS Strategy generation failed:", e);
        return "Unable to generate CS Strategy.";
    }
};

export const testGeminiConnection = async (): Promise<{ success: boolean; message: string }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: 'Respond with "OK" if you are active.' }] }],
        });
        if (response.text?.includes('OK')) {
            return { success: true, message: 'Gemini AI connection verified.' };
        }
        return { success: false, message: 'Gemini AI returned an unexpected response.' };
    } catch (error: any) {
        console.error('Gemini connection test failed:', error);
        return { success: false, message: error.message || 'Failed to connect to Gemini AI.' };
    }
};
