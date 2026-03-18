
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
// Fixed: removed non-existent WaveformIcon and added missing Zap icon
import { X, Mic, MicOff, Loader2, Volume2, Zap } from 'lucide-react';
import { DashboardMetrics, TicketActivity } from '../types';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type LiveVoiceConsoleProps = {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  metrics: DashboardMetrics | null;
  activities: TicketActivity[];
};

export const LiveVoiceConsole: React.FC<LiveVoiceConsoleProps> = ({ isOpen, onClose, summary, metrics, activities }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('Ready to connect');
  const [needsApiKey, setNeedsApiKey] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const addTranscription = (text: string, isUser: boolean) => {
    setTranscription(prev => {
      const lastEntry = prev[prev.length - 1];
      const prefix = isUser ? 'YOU: ' : 'AI: ';
      
      if (lastEntry && lastEntry.startsWith(prefix)) {
        // Append to the last entry if it's the same speaker
        const updatedLastEntry = lastEntry + " " + text;
        return [...prev.slice(0, -1), updatedLastEntry];
      } else {
        // Create a new entry for a new speaker or first message
        return [...prev, `${prefix}${text}`].slice(-10);
      }
    });
  };

  const decodeBase64 = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const encodeBase64 = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
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

  const startSession = async () => {
    if (isActive) return;
    setIsConnecting(true);
    setStatus('Establishing Secure Link...');
    
    try {
      // Check for API key if using premium models
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        setNeedsApiKey(true);
        setStatus('API Key Required');
        setIsConnecting(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputAudioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            setStatus('Active Session');
            addTranscription('Voice Link Established.', false);
            
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const blob = {
                data: encodeBase64(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: blob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              addTranscription(message.serverContent.outputTranscription.text, false);
            } else if (message.serverContent?.inputTranscription) {
              addTranscription(message.serverContent.inputTranscription.text, true);
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
              const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), outputAudioContext, 24000, 1);
              const source = outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioContext.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              for (const s of sourcesRef.current) s.stop();
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => stopSession(),
          onerror: (e) => {
            console.error('Live session error', e);
            stopSession();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `You are an AI Executive Assistant. Live API Data: Total active tickets across 5 brands is ${metrics?.activeTickets || 0}. High priority count: ${activities.filter(a=>a.analysis.urgency==='HIGH').length}. Answer queries based ONLY on this live API data.
          The executive summary is: "${summary}". 
          The metrics are: Total active tickets: ${metrics?.activeTickets}, created today: ${metrics?.createdToday}, closed today: ${metrics?.closedToday}.
          Answer the executive's questions briefly and professionally using British English.`,
        },
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error('Mic or connection error', err);
      setIsConnecting(false);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('Microphone Permission Denied');
        alert('Please allow microphone access in your browser settings to use the Voice Console.');
      } else if (err.message?.includes('Requested entity was not found')) {
        // Reset key selection if it fails with this specific error
        if (window.aistudio) {
          setNeedsApiKey(true);
          setStatus('API Key Error - Please re-select');
        }
      } else {
        setStatus('Error accessing microphone');
      }
    }
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setNeedsApiKey(false);
      startSession();
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
        try { sessionRef.current.close(); } catch(e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setIsActive(false);
    setIsConnecting(false);
    setStatus('Ready to connect');
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center z-[100] p-6">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[70vh] border border-white/10 animate-in zoom-in duration-300">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isActive ? 'bg-red-500 animate-pulse text-white shadow-lg shadow-red-200' : 'bg-slate-200 text-slate-400'}`}>
              {isActive ? <Mic size={24} /> : <MicOff size={24} />}
            </div>
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-tighter">AI Voice Console</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{status}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full transition-all text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-4 bg-slate-50/50">
          {transcription.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <Mic size={64} className="mb-6 text-slate-300" />
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Connect to start voice interaction</p>
            </div>
          ) : (
            transcription.map((t, i) => (
              <div key={i} className={`p-5 rounded-3xl text-sm font-bold ${t.startsWith('YOU') ? 'bg-blue-600 text-white ml-auto max-w-[80%]' : 'bg-white text-slate-700 shadow-sm border border-slate-100 mr-auto max-w-[80%]'}`}>
                {t}
              </div>
            ))
          )}
        </div>

        <div className="p-8 bg-white border-t border-slate-100 flex flex-col items-center gap-4">
          {needsApiKey ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-bold text-red-500 uppercase tracking-widest text-center">
                A paid Gemini API key is required for the Live Voice API.<br/>
                Please select a key from a paid Google Cloud project.
              </p>
              <button 
                onClick={handleOpenKeySelector}
                className="px-12 py-5 bg-amber-500 text-white font-black rounded-3xl hover:bg-amber-600 transition-all shadow-2xl shadow-amber-900/30 flex items-center gap-3 uppercase text-sm tracking-widest"
              >
                <Zap size={20} />
                Select API Key
              </button>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-slate-600 underline uppercase font-bold tracking-widest"
              >
                Learn about billing
              </a>
            </div>
          ) : !isActive ? (
            <button 
              onClick={startSession}
              disabled={isConnecting}
              className="px-12 py-5 bg-ecomplete-primary text-white font-black rounded-3xl hover:bg-slate-800 transition-all shadow-2xl shadow-blue-900/30 flex items-center gap-3 uppercase text-sm tracking-widest"
            >
              {isConnecting ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
              Initiate Voice Link
            </button>
          ) : (
            <button 
              onClick={stopSession}
              className="px-12 py-5 bg-red-500 text-white font-black rounded-3xl hover:bg-red-600 transition-all shadow-2xl shadow-red-900/30 flex items-center gap-3 uppercase text-sm tracking-widest"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
