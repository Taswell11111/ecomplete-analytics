
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Group, TicketActivity, ConnectionMode, TicketScope, DashboardMetrics, SortConfig, Ticket
} from '../types';
import { ECOMPLETE_GROUPS, TICKET_STATUS_MAP, ACTIVE_TICKET_STATUSES, CATEGORIES, CONSOLIDATED_GROUP_ID, BOUNTY_APPAREL_GROUP_IDS, MASTER_GROUP_ID, REAL_GROUP_IDS } from '../constants';
import { getTickets, getConversations, getRequesters, updateTicket, sendTicketReply, getDashboardMetrics } from '../services/freshdeskService';
import { analyseAndSummariseTicket, generateExecutiveSummary, regenerateExecutiveSummaryWithFeedback, generateCSStrategyReport, generateSpeech } from '../services/geminiService';
import { uploadHtmlReport } from '../services/storageService';
import { generateReportHtml } from '../features/dashboard/reportHtml';
import { generateCSReportHtml } from '../features/dashboard/csReportHtml';
import { getCategoryColor, getUrgencyColor } from '../utils/styles';
import { 
  Loader2, Download, RefreshCw, Link as LinkIcon, Terminal, XCircle, MousePointerClick,
  Activity, BarChart3, Layers, Zap, Share2, ChevronDown, Check, Users, Repeat, Search, ChevronUp, Mic, Volume2, MicOff, PlayCircle, PauseCircle,
  AlertCircle, X, Menu, Settings, ArrowUp, ArrowDown
} from 'lucide-react';
import { format, formatDistanceToNow, isSameDay, eachDayOfInterval, isBefore, differenceInDays, eachHourOfInterval, isSameHour } from 'date-fns';
import { StatBox } from '../components/StatBox';
import { TicketDetailModal } from '../components/TicketDetailModal';
import { MetricDetailModal } from '../components/MetricDetailModal';
import { LinkResultModal } from '../components/LinkResultModal';
import { LiveVoiceConsole } from '../components/LiveVoiceConsole';
import { FreshdeskPulse } from '../FreshdeskPulse';

import Chart from 'chart.js/auto';
// @ts-ignore
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ChartDataLabels);

// Manual implementation of subDays
const subDays = (date: Date | number, amount: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() - amount);
  return result;
};

// Manual implementation of startOfDay
const startOfDay = (date: Date | number): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

type DashboardPageProps = {
    apiKey: string;
    proxyUrl: string;
    connectionMode: ConnectionMode;
    selectedGroup: Group;
    setSelectedGroup: (group: Group) => void;
    availableGroups: Group[];
    ticketScope: TicketScope;
    setTicketScope: (scope: TicketScope) => void;
    appContext?: 'levis' | 'bounty' | 'admin';
    audioBase64: string | null;
    isPlayingAudio: boolean;
    isGeneratingAudio: boolean;
    onPlayAudio: (base64: string) => void;
    onPauseAudio: () => void;
    onSetAudioBase64: (base64: string) => void;
    onSetIsGeneratingAudio: (isGenerating: boolean) => void;
    audioRef: React.RefObject<HTMLAudioElement | null>;
    onAnalysisComplete?: (summary: string, activities: TicketActivity[], metrics: DashboardMetrics) => void;
}

const getGroupColor = (index: number) => {
  const colors = ['#1e3a8a', '#eab308', '#0ea5e9', '#10b981', '#f43f5e', '#8b5cf6'];
  return colors[index % colors.length];
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ 
    apiKey, proxyUrl, connectionMode, selectedGroup, setSelectedGroup, availableGroups, ticketScope, setTicketScope, appContext, 
    audioBase64, isPlayingAudio, isGeneratingAudio, onPlayAudio, onPauseAudio, onSetAudioBase64, onSetIsGeneratingAudio,
    audioRef, onAnalysisComplete
}) => {
  // Data State
  const [activities, setActivities] = useState<TicketActivity[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [groupActiveCounts, setGroupActiveCounts] = useState<{ id: number, name: string, count: number }[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  const [isReportVisible, setIsReportVisible] = useState(false);
  const [isRegeneratingInsight, setIsRegeneratingInsight] = useState(false);
  
  // Synopsis loading state
  const [synopsisElapsedTime, setSynopsisElapsedTime] = useState(0);
  const [synopsisLogs, setSynopsisLogs] = useState<string[]>(['Initialising synopsis...']);

  useEffect(() => {
    let interval: any;
    if (isGeneratingAudio) {
      interval = setInterval(() => {
        setSynopsisElapsedTime(prev => prev + 1);
        if (synopsisElapsedTime % 5 === 0) {
          setSynopsisLogs(prev => [`Log: Processing data point ${Math.floor(Math.random() * 100)}...`, ...prev].slice(0, 3));
        }
      }, 1000);
    } else {
      setSynopsisElapsedTime(0);
      setSynopsisLogs(['Initialising synopsis...']);
    }
    return () => clearInterval(interval);
  }, [isGeneratingAudio, synopsisElapsedTime]);

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState('Initialising...');
  const [error, setError] = useState<string | null>(null);
  
  // Helper to update progress and logs
  const updateProgress = (message: string) => {
    setProgress(message);
    addLog(message);
  };
  const [timelineTab, setTimelineTab] = useState<'created' | 'worked' | 'closed'>('created');
  const [isLiveConsoleOpen, setIsLiveConsoleOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);

  const handleReadSummary = async () => {
    if (!executiveSummary) {
      handleFetchActivity();
      return;
    }
    
    if (isPlayingAudio) {
      onPauseAudio();
      return;
    }

    if (audioBase64) {
      onPlayAudio(audioBase64);
      return;
    }
    
    // Update state to indicate processing
    onSetIsGeneratingAudio(true);
    setSynopsisLogs(['Generating audio briefing...']);
    
    try {
      const wavBase64 = await generateSpeech(executiveSummary);
      if (wavBase64) {
        onSetAudioBase64(wavBase64);
        onPlayAudio(wavBase64);
      }
    } catch (error) {
      console.error("Failed to generate speech:", error);
      setSynopsisLogs(prev => [...prev, 'Error generating audio briefing.']);
    } finally {
      onSetIsGeneratingAudio(false);
    }
  };
  
  // Table Filters
  const [tableFilters, setTableFilters] = useState({
    id: '',
    subject: '',
    category: '',
    brand: '',
    status: '',
    urgency: ''
  });

  const uniqueCategories = useMemo(() => Array.from(new Set(activities.map(a => a.analysis.category))).sort(), [activities]);
  const uniqueBrands = useMemo(() => Array.from(new Set(activities.map(a => a.brandName || 'Unknown'))).sort(), [activities]);
  const uniqueStatuses = useMemo(() => Array.from(new Set(activities.map(a => a.statusName))).sort(), [activities]);
  const uniqueUrgencies = useMemo(() => Array.from(new Set(activities.map(a => a.analysis.urgency))).sort(), [activities]);
  
  // Chart Visibility State
  const [hiddenDatasets, setHiddenDatasets] = useState<number[]>([]);

  // Audio Highlighting Logic
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);

  // Effect to determine if we need to scroll to see the highlighted section
  useEffect(() => {
      if (!isPlayingAudio || !highlightedSection) {
          setScrollDirection(null);
          return;
      }

      const checkScroll = () => {
          const element = document.getElementById(`section-${highlightedSection}`);
          if (!element) return;

          const rect = element.getBoundingClientRect();
          const viewportHeight = window.innerHeight;

          // If element is above viewport
          if (rect.bottom < 100) {
              setScrollDirection('up');
          } 
          // If element is below viewport
          else if (rect.top > viewportHeight - 100) {
              setScrollDirection('down');
          } 
          // Element is visible
          else {
              setScrollDirection(null);
          }
      };

      checkScroll();
      window.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      
      return () => {
          window.removeEventListener('scroll', checkScroll);
          window.removeEventListener('resize', checkScroll);
      };
  }, [highlightedSection, isPlayingAudio]);

  useEffect(() => {
    if (!isPlayingAudio || !audioRef.current) {
        setHighlightedSection(null);
        return;
    }

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        const time = audioRef.current.currentTime;
        const duration = audioRef.current.duration;
        
        if (!duration) return;

        // Rough estimation of sections based on typical briefing structure
        const progress = time / duration;
        
        if (progress < 0.1) setHighlightedSection('greeting');
        else if (progress < 0.2) setHighlightedSection('queue');
        else if (progress < 0.35) setHighlightedSection('backlog');
        else if (progress < 0.5) setHighlightedSection('risk');
        else if (progress < 0.65) setHighlightedSection('metrics');
        else if (progress < 0.8) setHighlightedSection('pulse');
        else setHighlightedSection('roadmap');
    };

    const audio = audioRef.current;
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isPlayingAudio]);
  const [sampleDropdownOpen, setSampleDropdownOpen] = useState(false);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);

  // Chart Filtering
  const [chartFilterUrgency, setChartFilterUrgency] = useState<string[]>([]); 
  const [chartFilterCategory, setChartFilterCategory] = useState<string | null>(null);

  // Accurate Backlog State
  const [actualBacklogData, setActualBacklogData] = useState<{ labels: string[], data: number[] } | null>(null);
  const [allActiveTickets, setAllActiveTickets] = useState<Ticket[]>([]);
  const [isFetchingBacklog, setIsFetchingBacklog] = useState(false);
  const [backlogChartSubtitle, setBacklogChartSubtitle] = useState('');

  // Metric Modal State
  const [metricModalOpen, setMetricModalOpen] = useState(false);
  const [metricModalTitle, setMetricModalTitle] = useState('');
  const [metricModalTickets, setMetricModalTickets] = useState<TicketActivity[]>([]);

  // Link Modal State
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isGeneratingCSLink, setIsGeneratingCSLink] = useState(false);
  const [uploadedReportFileName, setUploadedReportFileName] = useState<string | null>(null);

  // Table Filtering
  const [filterText, setFilterText] = useState('');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterUrgency, setFilterUrgency] = useState<string>('All');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ticket.created_at', direction: 'descending' });

  // Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTicketActivity, setSelectedTicketActivity] = useState<TicketActivity | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editType, setEditType] = useState('');
  const [editTags, setEditTags] = useState('');

  useEffect(() => {
    if (selectedTicketActivity) {
      setEditCategory(selectedTicketActivity.analysis.category || '');
      setEditType(selectedTicketActivity.ticket.type || '');
      setEditTags(selectedTicketActivity.ticket.tags?.join(', ') || '');
    }
  }, [selectedTicketActivity]);

  // Define showTable based on visibility of data after analysis
  const showTable = activities.length > 0;

  const pulseActivities = useMemo(() => {
    if (allActiveTickets.length === 0) return activities;
    
    // Create a map of analysed tickets for quick lookup
    const analysedMap = new Map(activities.map(a => [a.ticket.id, a]));
    
    return allActiveTickets.map(t => {
      if (analysedMap.has(t.id)) return analysedMap.get(t.id)!;
      
      const brandName = ECOMPLETE_GROUPS.find(g => g.id === t.group_id)?.name || 'Unknown Brand';
      return {
        ticket: t,
        conversations: [],
        aiSummary: 'Not analysed',
        timeSpent: 0,
        analysis: { urgency: 'LOW', category: 'Other' }, // Default values for unanalysed
        requesterName: 'Customer',
        lastResponseDate: null,
        statusSince: t.updated_at,
        statusName: TICKET_STATUS_MAP[t.status] || 'Unknown',
        periodInStatus: formatDistanceToNow(new Date(t.updated_at)),
        sentimentScore: 50,
        riskScore: 0,
        brandName
      } as TicketActivity;
    });
  }, [allActiveTickets, activities]);

  // Refs
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const timelineChartRef = useRef<HTMLCanvasElement>(null);
  const agingChartRef = useRef<HTMLCanvasElement>(null);
  const doughnutChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartInstance = useRef<any>(null);
  const barChartInstance = useRef<any>(null);
  const timelineChartInstance = useRef<any>(null);
  const agingChartInstance = useRef<any>(null);
  const doughnutChartInstance = useRef<any>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const displayMetrics = metrics;

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 10)); 
  };

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const toggleDataset = (index: number) => {
      setHiddenDatasets(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  };

  useEffect(() => {
    if (isLoading || !displayMetrics || !isReportVisible) return;
    
    const timer = setTimeout(() => {
        const renderCharts = () => {
            const urgencyCounts: any = { "CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0 };
            const categoryCounts: { [key: string]: number } = {};
            const sampleSize = activities.length;
            let scaleFactor = (sampleSize > 0 && displayMetrics.activeTickets > sampleSize) ? displayMetrics.activeTickets / sampleSize : 1;

            if (activities.length > 0) {
                activities.forEach(a => {
                    let urg = (a.analysis?.urgency || 'LOW').toUpperCase();
                    if (urgencyCounts[urg] !== undefined) urgencyCounts[urg]++;
                    const cat = a.analysis?.category || "Other";
                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                });
                
                // Scale counts to reflect actual volume
                Object.keys(urgencyCounts).forEach(k => {
                    urgencyCounts[k] = Math.round(urgencyCounts[k] * scaleFactor);
                });
                Object.keys(categoryCounts).forEach(k => {
                    categoryCounts[k] = Math.round(categoryCounts[k] * scaleFactor);
                });
                
                if (pieChartRef.current) {
                    if (pieChartInstance.current) pieChartInstance.current.destroy();
                    pieChartInstance.current = new Chart(pieChartRef.current, { 
                        type: 'doughnut', 
                        data: { 
                            labels: Object.keys(urgencyCounts), 
                            datasets: [{ 
                                data: Object.values(urgencyCounts), 
                                backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'], 
                                borderWidth: 2, 
                                borderColor: '#ffffff', 
                                hoverOffset: 15 
                            }] 
                        }, 
                        options: { 
                            cutout: '70%', 
                            responsive: true, 
                            maintainAspectRatio: false, 
                            onClick: (e: any, elements: any[]) => {
                                if (elements.length > 0) {
                                    const index = elements[0].index;
                                    const urgency = Object.keys(urgencyCounts)[index];
                                    const filtered = activities.filter(a => (a.analysis?.urgency || 'LOW').toUpperCase() === urgency);
                                    setMetricModalTitle(`Tickets: ${urgency}`);
                                    setMetricModalTickets(filtered);
                                    setMetricModalOpen(true);
                                }
                            },
                            plugins: { 
                                legend: { display: false }, 
                                tooltip: {
                                    callbacks: {
                                        label: (item: any) => {
                                            const urgency = item.label;
                                            const count = item.raw;
                                            const brandBreakdown = activities
                                                .filter(a => (a.analysis?.urgency || 'LOW').toUpperCase() === urgency)
                                                .reduce((acc: any, curr) => {
                                                    acc[curr.brandName] = (acc[curr.brandName] || 0) + 1;
                                                    return acc;
                                                }, {});
                                            const breakdownLines = Object.entries(brandBreakdown)
                                                .map(([brand, bCount]) => `  ${brand}: ${bCount}`);
                                            return [`Total: ${count}`, `Breakdown:`, ...breakdownLines];
                                        }
                                    }
                                },
                                datalabels: { 
                                    color: '#ffffff', 
                                    font: { weight: 'bold' }, 
                                    formatter: (value: number, ctx: any) => {
                                        return value;
                                    } 
                                } 
                            } as any
                        } 
                    });
                }

                if (barChartRef.current) {
                    const sortedLabels = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);
                    const sortedData = sortedLabels.map(l => categoryCounts[l]);
                    const sortedColors = sortedLabels.map(l => getCategoryColor(l));
                    if (barChartInstance.current) barChartInstance.current.destroy();
                    barChartInstance.current = new Chart(barChartRef.current, { 
                        type: 'bar', 
                        data: { 
                            labels: sortedLabels, 
                            datasets: [{ 
                                data: sortedData, 
                                backgroundColor: sortedColors, 
                                borderRadius: 4, 
                                barPercentage: 0.7 
                            }] 
                        }, 
                        options: { 
                            indexAxis: 'y', 
                            responsive: true, 
                            maintainAspectRatio: false, 
                            plugins: { 
                                legend: { display: false }, 
                                tooltip: {
                                    callbacks: {
                                        label: (item: any) => {
                                            const cat = item.label;
                                            const count = Math.round(item.raw);
                                            const brandBreakdown = activities
                                                .filter(a => (a.analysis?.category || 'Other') === cat)
                                                .reduce((acc: any, curr) => {
                                                    acc[curr.brandName] = (acc[curr.brandName] || 0) + 1;
                                                    return acc;
                                                }, {});
                                            const breakdownLines = Object.entries(brandBreakdown)
                                                .map(([brand, bCount]) => `  ${brand}: ${bCount}`);
                                            return [`Total: ${count}`, `Breakdown:`, ...breakdownLines];
                                        }
                                    }
                                },
                                datalabels: { 
                                    color: '#ffffff', 
                                    font: { weight: 'bold' }, 
                                    anchor: 'center', 
                                    align: 'center', 
                                    formatter: (value: number, ctx: any) => {
                                        return value;
                                    } 
                                } 
                            } as any, 
                            onClick: (e: any, elements: any) => { 
                                if (elements.length > 0) { 
                                    const index = elements[0].index; 
                                    const label = sortedLabels[index]; 
                                    setChartFilterCategory(prev => prev === label ? null : label); 
                                } 
                            }, 
                            scales: { 
                                x: { display: false }, 
                                y: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 10 }, color: '#475569' } } 
                            } 
                        } 
                    });
                }
            }

            if (agingChartRef.current) {
                let labels: string[]; let data: number[]; let subtitle: string;
                const today = startOfDay(new Date());
                const sourceData = actualBacklogData ? pulseActivities : activities;
                const oldestDate = sourceData.length > 0 
                    ? startOfDay(new Date(sourceData.reduce((oldest, curr) => {
                        const currDate = new Date(curr.ticket.created_at);
                        const oldestDate = new Date(oldest.ticket.created_at);
                        return currDate < oldestDate ? curr : oldest;
                      }, sourceData[0]).ticket.created_at))
                    : today;
                
                const diffDays = differenceInDays(today, oldestDate) + 1;
                const daysToShow = Math.max(diffDays, 1);
                const startDate = oldestDate;
                
                if (actualBacklogData) {
                    labels = actualBacklogData.labels; data = actualBacklogData.data;
                    // Filter out zero-value points only at the leading/trailing edges, not in the middle
                    const firstNonZero = labels.findIndex((_, i) => data[i] > 0);
                    const lastNonZero = labels.map((_, i) => data[i] > 0 ? i : -1).filter(i => i !== -1).pop() ?? 0;
                    if (firstNonZero > 0) {
                        labels = labels.slice(firstNonZero);
                        data = data.slice(firstNonZero);
                    }
                    if (lastNonZero < labels.length - 1) {
                        labels = labels.slice(0, lastNonZero - firstNonZero + 1);
                        data = data.slice(0, lastNonZero - firstNonZero + 1);
                    }
                    subtitle = `Actual creation dates for all ${displayMetrics.activeTickets} active tickets in queue.`;
                } else {
                    const interval = eachDayOfInterval({ start: startDate, end: today });
                    const dateKeys = interval.map(d => format(d, 'MMM dd'));
                    const dailyCounts: Record<string, number> = {}; dateKeys.forEach(k => dailyCounts[k] = 0);
                    
                    activities.forEach(a => {
                        const created = startOfDay(new Date(a.ticket.created_at));
                        const k = format(created, 'MMM dd');
                        if (dailyCounts[k] !== undefined) dailyCounts[k]++;
                    });
                    
                    if (scaleFactor > 1.05) {
                        Object.keys(dailyCounts).forEach(key => {
                            dailyCounts[key] = Math.round(dailyCounts[key] * scaleFactor);
                        });
                    }
                    
                    labels = dateKeys;
                    data = dateKeys.map(k => dailyCounts[k]);
                    
                    // Filter out zero-value points only at the leading/trailing edges, not in the middle
                    const firstNonZero = labels.findIndex((_, i) => data[i] > 0);
                    const lastNonZero = labels.map((_, i) => data[i] > 0 ? i : -1).filter(i => i !== -1).pop() ?? 0;
                    if (firstNonZero > 0) {
                        labels = labels.slice(firstNonZero);
                        data = data.slice(firstNonZero);
                    }
                    if (lastNonZero < labels.length - 1) {
                        labels = labels.slice(0, lastNonZero - firstNonZero + 1);
                        data = data.slice(0, lastNonZero - firstNonZero + 1);
                    }

                    subtitle = `Projected from a sample of ${activities.length} tickets across a total queue of ${displayMetrics.activeTickets}.`;
                    if (isFetchingBacklog) subtitle += ` A fully accurate analysis is loading now...`;
                }
                setBacklogChartSubtitle(subtitle);
                if (agingChartInstance.current) agingChartInstance.current.destroy();
                agingChartInstance.current = new Chart(agingChartRef.current, { 
                    type: 'line', 
                    data: { 
                        labels, 
                        datasets: [{ 
                            label: 'Active Tickets by Creation Date', 
                            data, 
                            borderColor: '#FFEB00', 
                            borderWidth: 3, 
                            backgroundColor: 'rgba(255, 235, 0, 0.2)', 
                            fill: true, 
                            tension: 0.4, 
                            pointRadius: 6, 
                            pointBackgroundColor: '#2C3E50' 
                        }] 
                    }, 
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        interaction: { mode: 'index', intersect: false }, 
                        onClick: (e: any, elements: any[]) => { 
                            if (elements.length > 0) { 
                                const index = elements[0].index; 
                                const label = labels[index]; 
                                let filtered: TicketActivity[] = []; 
                                filtered = pulseActivities.filter(a => format(startOfDay(new Date(a.ticket.created_at)), 'MMM dd') === label); 
                                setMetricModalTitle(`Tickets Created: ${label}`); 
                                setMetricModalTickets(filtered); 
                                setMetricModalOpen(true); 
                            } 
                        }, 
                        plugins: { 
                            legend: { display: false }, 
                            tooltip: { 
                                callbacks: { 
                                    title: (items: any) => `Created on ${items[0].label}`, 
                                    label: (item: any) => `${item.raw} active tickets` 
                                } 
                            }, 
                            datalabels: { 
                                display: true, 
                                align: 'top', 
                                font: { weight: 'bold', size: 12 }, 
                                color: '#2C3E50', 
                                formatter: (v: any) => v > 0 ? v : '' 
                            } 
                        } as any, 
                        scales: { 
                            x: { 
                                display: true, 
                                grid: { display: false }, 
                                ticks: { 
                                    font: { size: 11, weight: 'bold' }, 
                                    color: '#94a3b8', 
                                    maxTicksLimit: Math.min(labels.length, 20),
                                    autoSkip: true,
                                    maxRotation: labels.length > 30 ? 45 : 0,
                                } 
                            }, 
                            y: { display: false, min: 0 } 
                        } 
                    } 
                });
            }
            
            if (timelineChartRef.current && displayMetrics) {
                if (timelineChartInstance.current) timelineChartInstance.current.destroy();
                
                const hours = eachHourOfInterval({
                    start: startOfDay(new Date()),
                    end: new Date()
                });
                const timelineLabels = hours.map(h => format(h, 'HH:mm'));
                
                const datasets: any[] = [];
                
                // Primary Dataset (Today)
                const brands = groupActiveCounts.length > 0 ? groupActiveCounts.map(g => g.name.replace(' Online South Africa', '')) : ['Brand'];
                const brandColors = brands.map((_, i) => getGroupColor(i));
                
                if (!hiddenDatasets.includes(0)) {
                    const todayData = hours.map((hour, i) => {
                        let sampleVolume = 0;
                        const brandBreakdown: Record<string, number> = {};
                        brands.forEach(b => brandBreakdown[b] = 0);

                        activities.forEach(a => {
                            const aBrand = (a.brandName || 'Unknown').replace(' Online South Africa', '');
                            if (brands.includes(aBrand)) {
                                let date: Date | null = null;
                                if (timelineTab === 'created') {
                                    date = new Date(a.ticket.created_at);
                                } else if (timelineTab === 'closed') {
                                    if (a.ticket.status === 4 || a.ticket.status === 5) date = new Date(a.ticket.updated_at);
                                } else {
                                    date = new Date(a.ticket.updated_at);
                                }
                                if (date && isSameHour(date, hour) && isSameDay(date, hour)) {
                                    sampleVolume++;
                                    brandBreakdown[aBrand]++;
                                }
                            }
                        });
                        
                        const actualTotal = timelineTab === 'created' ? displayMetrics.ticketsByHour[i] :
                                            timelineTab === 'closed' ? displayMetrics.closedTicketsByHour[i] :
                                            displayMetrics.workedTicketsByHour[i];
                                            
                        const scaledBreakdown: Record<string, number> = {};
                        if (sampleVolume > 0) {
                            Object.entries(brandBreakdown).forEach(([brand, count]) => {
                                scaledBreakdown[brand] = Math.round((count / sampleVolume) * (actualTotal || 0));
                            });
                        }

                        return {
                            y: actualTotal || 0,
                            breakdown: scaledBreakdown
                        };
                    });
                    
                    datasets.push({
                        label: 'Today',
                        data: todayData.map(d => d.y),
                        borderColor: '#3b82f6',
                        backgroundColor: '#3b82f633',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        hidden: false,
                        breakdownData: todayData.map(d => d.breakdown)
                    });
                }

                // Yesterday Dataset
                if (!hiddenDatasets.includes(1)) {
                    const yesterdayData = timelineTab === 'created' ? displayMetrics.ticketsByHour24hAgo : 
                                         timelineTab === 'closed' ? displayMetrics.closedTicketsByHour24hAgo : 
                                         displayMetrics.workedTicketsByHour24hAgo;
                    
                    datasets.push({
                        label: 'Yesterday (Comparative)',
                        data: yesterdayData.slice(0, hours.length),
                        borderColor: '#94a3b8',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        pointRadius: 2
                    });
                }

                // 7 Days Ago Dataset
                if (!hiddenDatasets.includes(2)) {
                    const sevenDaysAgoData = timelineTab === 'created' ? displayMetrics.ticketsByHour7dAgo : 
                                            timelineTab === 'closed' ? displayMetrics.closedTicketsByHour7dAgo : 
                                            displayMetrics.workedTicketsByHour7dAgo;
                    
                    datasets.push({
                        label: '7 Days Ago (Comparative)',
                        data: sevenDaysAgoData.slice(0, hours.length),
                        borderColor: '#f97316',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [2, 2],
                        fill: false,
                        tension: 0.4,
                        pointRadius: 2
                    });
                }

                timelineChartInstance.current = new Chart(timelineChartRef.current, { 
                    type: 'line', 
                    data: { 
                        labels: timelineLabels, 
                        datasets 
                    }, 
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        onClick: (e: any, elements: any[]) => {
                            if (elements.length > 0) {
                                const index = elements[0].index;
                                const hour = timelineLabels[index];
                                const filtered = activities.filter(a => {
                                    let date: Date | null = null;
                                    if (timelineTab === 'created') date = new Date(a.ticket.created_at);
                                    else if (timelineTab === 'closed') {
                                        if (a.ticket.status === 4 || a.ticket.status === 5) date = new Date(a.ticket.updated_at);
                                    } else date = new Date(a.ticket.updated_at);
                                    return date && format(date, 'HH:mm') === hour;
                                });
                                setMetricModalTitle(`Tickets at ${hour}`);
                                setMetricModalTickets(filtered);
                                setMetricModalOpen(true);
                            }
                        },
                        plugins: { 
                            legend: { 
                                display: true, 
                                position: 'bottom',
                                labels: { boxWidth: 12, font: { size: 10, weight: 'bold' } }
                            }, 
                            datalabels: { 
                                display: true,
                                color: '#475569',
                                font: { weight: 'bold', size: 10 },
                                align: 'top',
                                formatter: (val: any) => val > 0 ? val : ''
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                callbacks: {
                                    label: (ctx: any) => {
                                        if (ctx.dataset.label === 'Today' && ctx.dataset.breakdownData) {
                                            const breakdown = ctx.dataset.breakdownData[ctx.dataIndex];
                                            const lines = [`Today: ${ctx.raw}`];
                                            Object.entries(breakdown).forEach(([brand, count]) => {
                                                if ((count as number) > 0) {
                                                    lines.push(`  ${brand}: ${count}`);
                                                }
                                            });
                                            return lines;
                                        }
                                        return `${ctx.dataset.label}: ${ctx.raw}`;
                                    }
                                }
                            }
                        } as any, 
                        scales: { 
                            x: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 10 }, color: '#94a3b8' } }, 
                            y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { weight: 'bold', size: 10 }, color: '#94a3b8' } } 
                        } 
                    } 
                });
            }
            if (doughnutChartRef.current && groupActiveCounts.length > 0) {
                if (doughnutChartInstance.current) doughnutChartInstance.current.destroy();
                const labels = groupActiveCounts.map(g => g.name.replace(' Online South Africa', ''));
                const data = groupActiveCounts.map(g => g.count);
                const total = data.reduce((a, b) => a + b, 0);
                const backgroundColors = groupActiveCounts.map((_, i) => getGroupColor(i));
                
                doughnutChartInstance.current = new Chart(doughnutChartRef.current, {
                    type: 'doughnut',
                    data: {
                        labels,
                        datasets: [{
                            data,
                            backgroundColor: backgroundColors,
                            borderWidth: 4,
                            borderColor: '#ffffff',
                            hoverOffset: 20,
                            offset: 15 // 5mm spacing simulation
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '75%',
                        onClick: (e: any, elements: any[]) => {
                            if (elements.length > 0) {
                                const index = elements[0].index;
                                const brandName = labels[index];
                                const filtered = pulseActivities.filter(a => (a.brandName || '').replace(' Online South Africa', '') === brandName);
                                setMetricModalTitle(`Tickets: ${brandName}`);
                                setMetricModalTickets(filtered);
                                setMetricModalOpen(true);
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (context: any) => {
                                        const brandName = context.label;
                                        const val = context.raw;
                                        const perc = total > 0 ? Math.round((val / total) * 100) : 0;
                                        
                                        const brandActivities = pulseActivities.filter(a => (a.brandName || '').replace(' Online South Africa', '') === brandName);
                                        const typeCounts: Record<string, number> = {};
                                        brandActivities.forEach(a => {
                                            const type = a.ticket.type || 'Unassigned';
                                            typeCounts[type] = (typeCounts[type] || 0) + 1;
                                        });
                                        
                                        const sampleSize = brandActivities.length;
                                        const scale = (sampleSize > 0 && val > sampleSize) ? val / sampleSize : 1;
                                        
                                        const breakdownLines = Object.keys(typeCounts).sort((a,b) => typeCounts[b] - typeCounts[a]).map(type => {
                                            return `  ${type}: ${Math.round(typeCounts[type] * scale)}`;
                                        });
                                        
                                        return [` ${val} tickets (${perc}%)`, ``, `Ticket-Type Breakdown:`, ...breakdownLines];
                                    }
                                }
                            },
                            datalabels: {
                                color: '#ffffff',
                                font: { weight: 'bold', size: 12 },
                                formatter: (value: number) => {
                                    const perc = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return perc > 5 ? perc + "%" : "";
                                }
                            }
                        }
                    } as any
                });
            }
        };
        requestAnimationFrame(renderCharts);
    }, 100);
    return () => clearTimeout(timer);
  }, [activities, isLoading, displayMetrics, timelineTab, isReportVisible, hiddenDatasets, actualBacklogData, isFetchingBacklog, pulseActivities]);

  const handleCancel = () => { if (abortControllerRef.current) { abortControllerRef.current.abort(); addLog("Cancelling operation..."); } };
  const handleReplyTicket = async (ticketId: number, body: string, status: number) => { try { const config = { apiKey, proxyUrl, connectionMode }; await sendTicketReply(ticketId, { body }, config); await updateTicket(ticketId, { status }, config); const newConvs = await getConversations(ticketId, config); if (selectedTicketActivity) { setSelectedTicketActivity({ ...selectedTicketActivity, conversations: newConvs, ticket: { ...selectedTicketActivity.ticket, status } }); } alert("Reply sent successfully!"); } catch (error: any) { throw new Error(error.message || "Failed to send reply"); } };
  const handleRegenerateInsight = async (feedback: string) => { setIsRegeneratingInsight(true); try { const newSummary = await regenerateExecutiveSummaryWithFeedback(executiveSummary, feedback); setExecutiveSummary(newSummary); } catch (e) { console.error("Regeneration failed", e); alert("Failed to regenerate insights."); } finally { setIsRegeneratingInsight(false); } };

  const handleSendEmail = async (html: string) => {
      try {
          const response = await fetch('/api/email/send-brief', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ html_content: html })
          });
          if (response.ok) {
              alert("Brief sent successfully.");
          } else {
              alert("Failed to send brief.");
          }
      } catch (e) {
          console.error("Failed to send email", e);
          alert("Failed to send brief.");
      }
  };
  const toggleUrgencyFilter = (u: string) => setChartFilterUrgency(prev => prev.includes(u) ? prev.filter(item => item !== u) : [...prev, u]);

  const handleFetchActivity = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    setIsLoading(true); setShowSplash(true); setIsAnalysisComplete(false); setIsReportVisible(false); setError(null);
    setActivities([]); setMetrics(null); setDebugLogs([]); setChartFilterUrgency([]); setChartFilterCategory(null);
    setHiddenDatasets([]); setActualBacklogData(null); setIsFetchingBacklog(false); setBacklogChartSubtitle(''); setGroupActiveCounts([]);
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let hasError = false;
    try {
        const config = { apiKey, proxyUrl, connectionMode };
        addLog(`Initialising sync for ${selectedGroup.name}...`);
        const m = await getDashboardMetrics(selectedGroup.id, config);
        setMetrics(m);
        
        let localGroupCounts: {id: number, name: string, count: number}[] = [];
        if (selectedGroup.id === CONSOLIDATED_GROUP_ID) {
            const counts = [];
            for (const id of BOUNTY_APPAREL_GROUP_IDS) {
                const gm = await getDashboardMetrics(id, config);
                counts.push({ id, name: ECOMPLETE_GROUPS.find(g => g.id === id)?.name || 'Unknown', count: gm.activeTickets });
                await delay(200); // Small delay between groups
            }
            localGroupCounts = counts;
            setGroupActiveCounts(counts);
        } else if (selectedGroup.id === MASTER_GROUP_ID) {
            const counts = [];
            for (const id of REAL_GROUP_IDS) {
                const gm = await getDashboardMetrics(id, config);
                counts.push({ id, name: ECOMPLETE_GROUPS.find(g => g.id === id)?.name || 'Unknown', count: gm.activeTickets });
                await delay(200); // Small delay between groups
            }
            localGroupCounts = counts;
            setGroupActiveCounts(counts);
        }
        
        let count = ticketScope === 'all' ? m.activeTickets : Math.ceil(m.activeTickets * (parseInt(ticketScope)/100));
        count = Math.max(count, 10);
        count = Math.min(count, 300);
        
        let groupQueryPart = `group_id:${selectedGroup.id}`;
        if (selectedGroup.id === CONSOLIDATED_GROUP_ID) {
            groupQueryPart = `(${BOUNTY_APPAREL_GROUP_IDS.map(id => `group_id:${id}`).join(' OR ')})`;
        } else if (selectedGroup.id === MASTER_GROUP_ID) {
            groupQueryPart = `(${REAL_GROUP_IDS.map(id => `group_id:${id}`).join(' OR ')})`;
        }

        const activeStatusString = ACTIVE_TICKET_STATUSES.map(s => `status:${s}`).join(' OR ');
        const query = `${groupQueryPart} AND (${activeStatusString})`;
        
        let processed: TicketActivity[] = [];

        if (selectedGroup.id === CONSOLIDATED_GROUP_ID) {
            updateProgress(`Syncing and Analysing Bounty Brands...`);
            const results = [];
            for (const groupId of BOUNTY_APPAREL_GROUP_IDS) {
                const groupName = ECOMPLETE_GROUPS.find(g => g.id === groupId)?.name || 'Unknown Brand';
                const groupActiveCount = localGroupCounts.find(g => g.id === groupId)?.count || 0;
                let groupCount = ticketScope === 'all' ? groupActiveCount : Math.ceil(groupActiveCount * (parseInt(ticketScope)/100));
                groupCount = Math.max(groupCount, 10);
                groupCount = Math.min(groupCount, 60); // Cap per group
                
                const groupQuery = `group_id:${groupId} AND (${activeStatusString})`;
                let allTickets: Ticket[] = []; let page = 1; let fetching = true;
                while (fetching && allTickets.length < groupCount) { 
                    if (signal.aborted) throw new Error("Cancelled"); 
                    const resp = await getTickets(groupQuery, config, page); 
                    if (resp.results && resp.results.length > 0) { 
                        allTickets = [...allTickets, ...resp.results]; 
                        if (resp.results.length < 30 || allTickets.length >= groupCount) {
                            fetching = false;
                        } else {
                            page++;
                        }
                    } else { 
                        fetching = false; 
                    } 
                    if (page > 10) fetching = false; 
                }
                let tickets = allTickets.slice(0, groupCount);
                const groupProcessed: TicketActivity[] = [];
                for(let i=0; i < tickets.length; i++) { 
                    if (signal.aborted) throw new Error("Cancelled"); 
                    const t = tickets[i]; 
                    if (i > 0) await delay(450);
                    const convs = await getConversations(t.id, config); 
                    const ana = await analyseAndSummariseTicket(t, convs); 
                    let reqName = 'Customer'; 
                    try { const rs = await getRequesters([t.requester_id], config); if(rs.length) reqName = rs[0].name; } catch(e){} 
                    groupProcessed.push({ ticket: t, conversations: convs, aiSummary: ana.summary, timeSpent: ana.timeSpentMinutes, analysis: { urgency: ana.urgency as any, category: ana.category as any }, requesterName: reqName, lastResponseDate: convs.length ? convs[convs.length-1].created_at : null, statusSince: t.updated_at, statusName: TICKET_STATUS_MAP[t.status] || 'Unknown', periodInStatus: formatDistanceToNow(new Date(t.updated_at)), sentimentScore: ana.sentimentScore, riskScore: ana.riskScore, brandName: groupName }); 
                }
                results.push(groupProcessed);
            }
            processed = results.flat();
        } else if (selectedGroup.id === MASTER_GROUP_ID) {
            updateProgress(`Syncing and Analysing All Brands...`);
            const results = [];
            for (const groupId of REAL_GROUP_IDS) {
                const groupName = ECOMPLETE_GROUPS.find(g => g.id === groupId)?.name || 'Unknown Brand';
                const groupActiveCount = localGroupCounts.find(g => g.id === groupId)?.count || 0;
                let groupCount = ticketScope === 'all' ? groupActiveCount : Math.ceil(groupActiveCount * (parseInt(ticketScope)/100));
                groupCount = Math.max(groupCount, 10);
                groupCount = Math.min(groupCount, 60); // Cap per group
                
                const groupQuery = `group_id:${groupId} AND (${activeStatusString})`;
                let allTickets: Ticket[] = []; let page = 1; let fetching = true;
                while (fetching && allTickets.length < groupCount) { 
                    if (signal.aborted) throw new Error("Cancelled"); 
                    const resp = await getTickets(groupQuery, config, page); 
                    if (resp.results && resp.results.length > 0) { 
                        allTickets = [...allTickets, ...resp.results]; 
                        if (resp.results.length < 30 || allTickets.length >= groupCount) {
                            fetching = false;
                        } else {
                            page++;
                        }
                    } else { 
                        fetching = false; 
                    } 
                    if (page > 10) fetching = false; 
                }
                let tickets = allTickets.slice(0, groupCount);
                const groupProcessed: TicketActivity[] = [];
                for(let i=0; i < tickets.length; i++) { 
                    if (signal.aborted) throw new Error("Cancelled"); 
                    const t = tickets[i]; 
                    if (i > 0) await delay(450);
                    const convs = await getConversations(t.id, config); 
                    const ana = await analyseAndSummariseTicket(t, convs); 
                    let reqName = 'Customer'; 
                    try { const rs = await getRequesters([t.requester_id], config); if(rs.length) reqName = rs[0].name; } catch(e){} 
                    groupProcessed.push({ ticket: t, conversations: convs, aiSummary: ana.summary, timeSpent: ana.timeSpentMinutes, analysis: { urgency: ana.urgency as any, category: ana.category as any }, requesterName: reqName, lastResponseDate: convs.length ? convs[convs.length-1].created_at : null, statusSince: t.updated_at, statusName: TICKET_STATUS_MAP[t.status] || 'Unknown', periodInStatus: formatDistanceToNow(new Date(t.updated_at)), sentimentScore: ana.sentimentScore, riskScore: ana.riskScore, brandName: groupName }); 
                }
                results.push(groupProcessed);
            }
            processed = results.flat();
        } else {
            let allTickets: Ticket[] = []; let page = 1; let fetching = true;
            while (fetching && allTickets.length < count) { 
                if (signal.aborted) throw new Error("Cancelled"); 
                updateProgress(`Syncing Page ${page}...`); 
                const resp = await getTickets(query, config, page); 
                if (resp.results && resp.results.length > 0) { 
                    allTickets = [...allTickets, ...resp.results]; 
                    if (resp.results.length < 30 || allTickets.length >= count) {
                        fetching = false;
                    } else {
                        page++;
                    }
                } else { 
                    fetching = false; 
                } 
                if (page > 10) fetching = false; 
            }
            let tickets = allTickets.slice(0, count);
            for(let i=0; i < tickets.length; i++) { 
                if (signal.aborted) throw new Error("Cancelled"); 
                const t = tickets[i]; updateProgress(`Analysing ${i+1}/${tickets.length} (#${t.id})`); 
                if (i > 0) await delay(450); // Respecting rate limits more closely
                const convs = await getConversations(t.id, config); 
                const ana = await analyseAndSummariseTicket(t, convs); 
                let reqName = 'Customer'; 
                try { const rs = await getRequesters([t.requester_id], config); if(rs.length) reqName = rs[0].name; } catch(e){} 
                const brandName = ECOMPLETE_GROUPS.find(g => g.id === t.group_id)?.name || 'Unknown Brand';
                processed.push({ ticket: t, conversations: convs, aiSummary: ana.summary, timeSpent: ana.timeSpentMinutes, analysis: { urgency: ana.urgency as any, category: ana.category as any }, requesterName: reqName, lastResponseDate: convs.length ? convs[convs.length-1].created_at : null, statusSince: t.updated_at, statusName: TICKET_STATUS_MAP[t.status] || 'Unknown', periodInStatus: formatDistanceToNow(new Date(t.updated_at)), sentimentScore: ana.sentimentScore, riskScore: ana.riskScore, brandName }); 
            }
        }
        if (signal.aborted) throw new Error("Cancelled"); 
        setActivities(processed); updateProgress('Synthesising Synopsis...'); 
        const summary = await generateExecutiveSummary(processed, m); 
        if (signal.aborted) throw new Error("Cancelled"); 
        setExecutiveSummary(summary);
        
        if (onAnalysisComplete) {
            onAnalysisComplete(summary, processed, m);
        }

        // Generate Audio Briefing as the last step of analysis
        updateProgress('Generating Audio Briefing...');
        try {
            onSetIsGeneratingAudio(true);
            const audioWav = await generateSpeech(summary);
            if (audioWav) {
                onSetAudioBase64(audioWav);
                onPlayAudio(audioWav); // Auto-play
            }
        } catch (e) {
            console.error("Audio briefing generation failed", e);
        } finally {
            onSetIsGeneratingAudio(false);
        }

        setIsFetchingBacklog(true);
        (async () => {
            try {
                const allActiveTicketsFetched: Ticket[] = []; let p = 1; let hasMore = true;
                while (hasMore) {
                    if (signal.aborted) throw new Error("Cancelled");
                    const response = await getTickets(query, config, p);
                    if (response.results && response.results.length > 0) { 
                        allActiveTicketsFetched.push(...response.results); 
                        p++; 
                        if (response.results.length < 30 || allActiveTicketsFetched.length >= m.activeTickets) hasMore = false; 
                    } else hasMore = false;
                    if (p > 100) hasMore = false;
                }
                setAllActiveTickets(allActiveTicketsFetched);
                const today = startOfDay(new Date()); 
                const oldestDate = allActiveTicketsFetched.length > 0 
                    ? startOfDay(new Date(allActiveTicketsFetched.reduce((oldest, curr) => {
                        const currDate = new Date(curr.created_at);
                        const oldestDate = new Date(oldest.created_at);
                        return currDate < oldestDate ? curr : oldest;
                      }, allActiveTicketsFetched[0]).created_at))
                    : today;
                
                const startDate = oldestDate;
                const interval = eachDayOfInterval({ start: startDate, end: today });
                const dateKeys = interval.map(d => format(d, 'MMM dd'));
                const dailyCounts: Record<string, number> = {};
                dateKeys.forEach(k => dailyCounts[k] = 0);

                allActiveTicketsFetched.forEach(t => {
                    const created = startOfDay(new Date(t.created_at));
                    const k = format(created, 'MMM dd');
                    if (dailyCounts[k] !== undefined) dailyCounts[k]++;
                });

                const totalMapped = Object.values(dailyCounts).reduce((a, b) => a + b, 0);
                const scaleFactor2 = (m.activeTickets > totalMapped && totalMapped > 0)
                    ? m.activeTickets / totalMapped
                    : 1;

                if (scaleFactor2 > 1.05) {
                    let runningTotal = 0;
                    const keys = Object.keys(dailyCounts);
                    keys.forEach(k => {
                        dailyCounts[k] = Math.round(dailyCounts[k] * scaleFactor2);
                        runningTotal += dailyCounts[k];
                    });
                    // Adjust largest bucket to hit exact total
                    const diff = m.activeTickets - runningTotal;
                    if (diff !== 0) {
                        const maxKey = keys.reduce((a, b) => dailyCounts[a] > dailyCounts[b] ? a : b);
                        dailyCounts[maxKey] = Math.max(0, dailyCounts[maxKey] + diff);
                    }
                }

                const finalLabels = dateKeys;
                const finalData = dateKeys.map(k => dailyCounts[k]);
                setActualBacklogData({ labels: finalLabels, data: finalData });
            } catch (err: any) {} finally { setIsFetchingBacklog(false); }
        })();
    } catch(err: any) { 
        if (err.message !== "Cancelled" && !signal.aborted) {
            const msg = err.message || "An unexpected error occurred during analysis.";
            setError(msg);
            setDebugLogs(prev => [`ERROR: ${msg}`, ...prev]);
            hasError = true;
        }
    } 
    finally { 
        setIsLoading(false); 
        if (!signal.aborted && !hasError) { 
            setTimeout(() => { 
                setShowSplash(false); 
                setIsAnalysisComplete(true); 
                setIsReportVisible(true); 
            }, 500); 
        } else { 
            setTimeout(() => setShowSplash(false), 500); 
        } 
    }
  };

  const handleSendSupportSynopsis = async () => {
      setIsGeneratingCSLink(true);
      setShowSplash(true);
      updateProgress("Scanning Brand Ecosystem...");
      setDebugLogs(["Initialising cross-brand intelligence sweep..."]);
      
      const config = { apiKey, proxyUrl, connectionMode };
      const allTargetBrands = [
          { id: 24000008969, name: "Levi's South Africa Online" },
          { id: 24000009010, name: "Diesel Online South Africa" },
          { id: 24000009052, name: "Hurley Online South Africa" },
          { id: 24000009038, name: "Jeep Apparel Online South Africa" },
          { id: 24000009035, name: "Reebok Online South Africa" },
          { id: 24000009051, name: "Superdry Online South Africa" }
      ];
      
      const targetBrands = appContext === 'bounty' 
          ? allTargetBrands.filter(b => b.name !== "Levi's South Africa Online")
          : appContext === 'levis'
          ? allTargetBrands.filter(b => b.name === "Levi's South Africa Online")
          : allTargetBrands;

      try {
          const brandIntelligence: any[] = [];
          for (let i = 0; i < targetBrands.length; i++) {
              const brand = targetBrands[i];
              updateProgress(`Analysing ${brand.name}...`);
              addLog(`Syncing brand data: ${brand.name}`);
              
              const m = await getDashboardMetrics(brand.id, config);
              const query = `group_id:${brand.id} AND (${ACTIVE_TICKET_STATUSES.map(s => `status:${s}`).join(' OR ')})`;
              const resp = await getTickets(query, config, 1);
              const tickets = (resp.results || []).slice(0, 15);
              
              const processedTickets: TicketActivity[] = [];
              for (const t of tickets) {
                  const convs = await getConversations(t.id, config);
                  const ana = await analyseAndSummariseTicket(t, convs);
                  processedTickets.push({ 
                      ticket: t, 
                      conversations: convs, 
                      aiSummary: ana.summary, 
                      timeSpent: ana.timeSpentMinutes, 
                      analysis: { urgency: ana.urgency as any, category: ana.category as any }, 
                      requesterName: 'Customer', 
                      lastResponseDate: null, statusSince: '', statusName: '', periodInStatus: '', 
                      sentimentScore: ana.sentimentScore, 
                      riskScore: ana.riskScore 
                  });
                  await new Promise(r => setTimeout(r, 450));
              }
              brandIntelligence.push({ brandName: brand.name, metrics: m, tickets: processedTickets });
          }

          updateProgress("Synthesising CS Directive...");
          addLog("Generating cross-brand heatmap and task allocations...");
          const strategyText = await generateCSStrategyReport(brandIntelligence);
          
          updateProgress("Publishing Directive...");
          const html = generateCSReportHtml(strategyText, targetBrands.map(b => b.name));
          const url = await uploadHtmlReport(html, "CS_Strategy_Directive");
          
          setGeneratedLink(url);
          setLinkModalOpen(true);
      } catch (e: any) {
          alert(`CS Sync Failed: ${e.message}`);
      } finally {
          setIsGeneratingCSLink(false);
          setShowSplash(false);
      }
  };

  const sortedAndFilteredActivities = useMemo(() => {
    let result = activities.filter(a => ACTIVE_TICKET_STATUSES.includes(a.ticket.status));
    if (filterCategories.length > 0) result = result.filter(a => filterCategories.includes(a.analysis.category));
    if (filterUrgency !== 'All') result = result.filter(a => a.analysis.urgency.toUpperCase() === filterUrgency.toUpperCase());
    if (chartFilterUrgency.length > 0) result = result.filter(a => chartFilterUrgency.includes(a.analysis.urgency.toUpperCase()));
    if (chartFilterCategory) result = result.filter(a => a.analysis.category === chartFilterCategory);
    
    // Header Filters
    if (tableFilters.id) result = result.filter(a => a.ticket.id.toString().includes(tableFilters.id));
    if (tableFilters.subject) result = result.filter(a => a.ticket.subject.toLowerCase().includes(tableFilters.subject.toLowerCase()) || a.aiSummary.toLowerCase().includes(tableFilters.subject.toLowerCase()));
    if (tableFilters.category) result = result.filter(a => a.analysis.category.toLowerCase().includes(tableFilters.category.toLowerCase()));
    if (tableFilters.brand) result = result.filter(a => (a.brandName || '').toLowerCase().includes(tableFilters.brand.toLowerCase()));
    if (tableFilters.status) result = result.filter(a => a.statusName.toLowerCase().includes(tableFilters.status.toLowerCase()));
    if (tableFilters.urgency) result = result.filter(a => a.analysis.urgency.toLowerCase().includes(tableFilters.urgency.toLowerCase()));

    if (filterText) { const lowerText = filterText.toLowerCase(); result = result.filter(a => a.ticket.id.toString().includes(lowerText) || a.ticket.subject.toLowerCase().includes(lowerText) || a.aiSummary.toLowerCase().includes(lowerText)); }
    result.sort((a, b) => { let valA: any, valB: any; if (sortConfig.key.includes('.')) { const [p1, p2] = sortConfig.key.split('.'); valA = (a as any)[p1][p2]; valB = (b as any)[p1][p2]; } else { valA = (a as any)[sortConfig.key]; valB = (b as any)[sortConfig.key]; } if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1; return 0; });
    return result;
  }, [activities, sortConfig, filterText, filterCategories, filterUrgency, chartFilterUrgency, chartFilterCategory, tableFilters]);

  const requestSort = (key: string) => { let direction: 'ascending' | 'descending' = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending'; setSortConfig({ key, direction }); };

  const handleMetricClick = async (type: string) => {
      setMetricModalTitle(type.toUpperCase() + (type.includes('Frequency') ? '' : ' TICKETS')); 
      setMetricModalOpen(true);
      setMetricModalTickets([]); // Clear previous tickets while loading
      
      if (type === 'Active') return; // Handled differently or ignored

      const config = { apiKey, proxyUrl, connectionMode };
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      let groupQuery = `group_id:${selectedGroup.id}`;
      if (selectedGroup.id === CONSOLIDATED_GROUP_ID) {
          groupQuery = `(${BOUNTY_APPAREL_GROUP_IDS.map(id => `group_id:${id}`).join(' OR ')})`;
      } else if (selectedGroup.id === MASTER_GROUP_ID) {
          groupQuery = `(${REAL_GROUP_IDS.map(id => `group_id:${id}`).join(' OR ')})`;
      }

      let query = '';
      switch(type) { 
          case 'Created': query = `${groupQuery} AND created_at:'${todayStr}'`; break; 
          case 'Worked': query = `${groupQuery} AND updated_at:'${todayStr}'`; break; 
          case 'Closed': query = `${groupQuery} AND (status:4 OR status:5) AND updated_at:'${todayStr}'`; break; 
          case 'Reopened': query = `${groupQuery} AND status:9 AND updated_at:'${todayStr}'`; break; 
          default: return; 
      } 

      try {
          const allTickets: Ticket[] = [];
          let p = 1; let hasMore = true;
          while (hasMore) {
              const response = await getTickets(query, config, p);
              if (response.results && response.results.length > 0) { 
                  allTickets.push(...response.results); 
                  p++; 
                  if (response.results.length < 30) hasMore = false; 
              } else hasMore = false;
              if (p > 10) hasMore = false; // Limit to 300 tickets to prevent excessive loading
          }
          
          const mapped = allTickets.map(t => {
              const brandName = ECOMPLETE_GROUPS.find(g => g.id === t.group_id)?.name || 'Unknown Brand';
              return {
                  ticket: t,
                  conversations: [],
                  aiSummary: 'Not analysed',
                  timeSpent: 0,
                  analysis: { urgency: 'LOW', category: 'Other' },
                  requesterName: 'Customer',
                  lastResponseDate: null,
                  statusSince: t.updated_at,
                  statusName: TICKET_STATUS_MAP[t.status] || 'Unknown',
                  periodInStatus: formatDistanceToNow(new Date(t.updated_at)),
                  sentimentScore: 50,
                  riskScore: 0,
                  brandName
              } as TicketActivity;
          });
          setMetricModalTickets(mapped);
      } catch (e) {
          console.error("Failed to fetch metric tickets", e);
      }
  };

  const getUrgencyCountScaled = (urgency: string) => { 
      let count = 0; activities.forEach(a => { if (a.analysis.urgency.toUpperCase() === urgency.toUpperCase()) count++; }); 
      const scaleFactor = (activities.length > 0 && displayMetrics.activeTickets > activities.length) ? displayMetrics.activeTickets / activities.length : 1;
      return Math.round(count * scaleFactor); 
  };

  const handleDownloadReport = () => { 
      const html = generateReportHtml(executiveSummary, displayMetrics, activities, selectedGroup, actualBacklogData, audioBase64); 
      if (!html) return; 
      const blob = new Blob([html], { type: 'text/html' }); 
      const url = URL.createObjectURL(blob); 
      const a = document.createElement('a'); 
      a.href = url; 
      // Sanitize filename to remove invalid characters
      const safeGroupName = selectedGroup.name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
      a.download = `Report_${safeGroupName}_${format(new Date(), 'yyyyMMdd')}.html`; 
      a.click(); 
      URL.revokeObjectURL(url); 
  };
  const handleGenerateLink = async () => { setIsGeneratingLink(true); try { const html = generateReportHtml(executiveSummary, displayMetrics, activities, selectedGroup, actualBacklogData, audioBase64); if (!html) throw new Error("Report content generation returned empty."); const safeGroupName = selectedGroup.name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_'); const { url, fileName } = await uploadHtmlReport(html, safeGroupName); setGeneratedLink(url); setUploadedReportFileName(fileName); setLinkModalOpen(true); setDebugLogs(prev => [`[Storage] Report uploaded: ${fileName}`, ...prev]); } catch (e: any) { alert(`Failed to generate link. Detail: ${e.message || e}`); } finally { setIsGeneratingLink(false); } };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 bg-gradient-to-r from-slate-900 via-ecomplete-primary to-slate-900 border-b border-white/10 z-40 h-28 lg:h-32 flex items-stretch px-0 shadow-2xl overflow-visible">
          <div className="flex items-center pl-6 lg:pl-12 flex-1 min-w-0">
              <div className="shrink-0 mr-4 lg:mr-12">
                  <div className="flex flex-col">
                      <h1 className="text-lg lg:text-2xl font-bold text-white tracking-tighter flex items-center gap-2 lg:gap-3">
                          <BarChart3 className="text-ecomplete-accent shrink-0" size={20} />
                          <span className="truncate">Support Intelligence</span>
                      </h1>
                      <div className="flex items-center gap-4 mt-1">
                          <span className="hidden sm:inline text-ecomplete-accent font-bold text-2xl">| {appContext === 'levis' ? "Levi's Online" : "Bounty Apparel"}</span>
                          <span className="hidden sm:inline text-white/40 font-semibold text-xs tracking-widest">Session Initialised: {new Date().toLocaleString()}</span>
                      </div>
                  </div>
              </div>
          </div>

          <div className="flex items-center h-full shrink-0">
              <div className="hidden lg:flex items-center gap-4 px-8 border-l border-slate-700/50 h-full relative">
                  {appContext === 'admin' && (
                  <div className="relative z-50">
                      <button onClick={() => setBrandDropdownOpen(!brandDropdownOpen)} className="flex items-center justify-between gap-4 bg-slate-50 font-black text-[11px] uppercase tracking-widest py-3.5 px-6 rounded-2xl border border-slate-200 hover:border-ecomplete-primary hover:bg-white transition-all shadow-sm min-w-[200px]">
                          <span className="truncate">{selectedGroup.name}</span>
                          <ChevronDown size={14} className={`transition-transform duration-300 ${brandDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {brandDropdownOpen && (<> <div className="fixed inset-0 z-40" onClick={() => setBrandDropdownOpen(false)}></div> <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"> {availableGroups.map(g => ( <button key={g.id} onClick={() => { setSelectedGroup(g); setBrandDropdownOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-xl text-left text-[11px] font-black uppercase tracking-wider transition-all ${selectedGroup.id === g.id ? 'bg-ecomplete-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}> <span className="truncate">{g.name}</span> {selectedGroup.id === g.id && <Check size={14} />} </button> ))} </div> </>)}
                  </div>
                  )}
                  <div className="relative z-50">
                      <button onClick={() => { setSampleDropdownOpen(!sampleDropdownOpen); setBrandDropdownOpen(false); }} className="flex items-center justify-between gap-4 bg-slate-800 text-white font-black text-[11px] uppercase tracking-widest py-3.5 px-6 rounded-2xl border border-slate-700 hover:border-ecomplete-accent hover:bg-slate-700 transition-all shadow-sm min-w-[140px]">
                          <span>{ticketScope === 'all' ? 'FULL' : `${ticketScope}%`} SAMPLE</span>
                          <ChevronDown size={14} className={`transition-transform duration-300 ${sampleDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {sampleDropdownOpen && ( <> <div className="fixed inset-0 z-40" onClick={() => setSampleDropdownOpen(false)}></div> <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"> {['25','50','75','all'].map(s => ( <button key={s} onClick={() => { setTicketScope(s as any); setSampleDropdownOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-xl text-left text-[11px] font-black uppercase tracking-wider transition-all ${ticketScope === s ? 'bg-ecomplete-accent text-slate-900' : 'text-slate-300 hover:bg-slate-700'}`}> <span>{s === 'all' ? 'FULL' : `${s}%`} SAMPLE</span> {ticketScope === s && <Check size={14} />} </button> ))} </div> </> )}
                  </div>
              </div>

              <button onClick={handleFetchActivity} disabled={isLoading} className={`bg-ecomplete-accent text-slate-900 px-6 lg:px-12 h-full font-black flex flex-col items-center justify-center gap-1 lg:gap-2 shadow-[inset_-4px_0_10px_rgba(255,255,255,0.3),0_0_40px_-5px_#FFEB00] uppercase tracking-[0.2em] hover:bg-yellow-400 transition-all text-[9px] lg:text-[11px] shrink-0 rounded-none border-x border-yellow-500 relative group ${isGeneratingAudio || isPlayingAudio ? 'animate-pulse ring-4 ring-white/50' : ''}`}>
                  <div className="absolute top-0 left-0 w-2 h-full bg-white opacity-50 group-hover:opacity-100 transition-opacity shadow-[0_0_15px_#ffffff]"></div>
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-700" />} 
                  <span className="text-center whitespace-nowrap uppercase tracking-widest leading-tight">Initiate<br/>Freshdesk<br/>Analysis</span>
              </button>

              <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden flex items-center justify-center px-6 h-full text-white hover:bg-white/10 transition-colors">
                  <Menu size={24} />
              </button>

              <div className="hidden lg:flex flex-col h-full shrink-0">
                <div className="flex items-center gap-3 px-10 h-full border-l border-slate-700/50 bg-slate-800/50">
                    <button onClick={handleGenerateLink} disabled={!isAnalysisComplete || isGeneratingLink} className="flex items-center gap-2 px-5 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-all shadow-lg shadow-black/20 disabled:opacity-50 font-bold text-[9px] uppercase tracking-wider" title="Generate Shareable Link">
                        {isGeneratingLink ? <Loader2 size={14} className="animate-spin"/> : <LinkIcon size={14}/>}
                        <span className="hidden 2xl:inline">Access Report Link</span>
                    </button>
                    <button onClick={handleDownloadReport} disabled={!isAnalysisComplete} className="flex items-center gap-2 px-5 py-3 bg-slate-800 border border-slate-600 text-slate-200 rounded-xl hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50 font-bold text-[9px] uppercase tracking-wider" title="Download HTML Report">
                        <Download size={14}/>
                        <span className="hidden 2xl:inline">Download HTML Report</span>
                    </button>
                </div>
                <button 
                    onClick={handleSendSupportSynopsis}
                    disabled={isGeneratingCSLink || isLoading}
                    className="h-10 border-t border-l border-slate-700/50 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                >
                    {isGeneratingCSLink ? <Loader2 size={12} className="animate-spin"/> : <Users size={12}/>}
                    Send Support Synopsis
                </button>
                <button 
                    onClick={() => handleSendEmail(generateReportHtml(executiveSummary, displayMetrics, activities, selectedGroup, actualBacklogData, audioBase64))}
                    disabled={isLoading || !executiveSummary}
                    className="h-10 border-t border-l border-slate-100 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                >
                    <Share2 size={12}/>
                    Send Email Brief
                </button>
              </div>
          </div>
      </header>

      <main className="flex-1 p-4 md:p-10 lg:p-14 max-w-[2000px] mx-auto w-full">
          {error && (
              <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="bg-red-50 border-2 border-red-100 p-8 rounded-[2.5rem] flex items-center gap-6 shadow-xl shadow-red-900/5">
                      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
                          <AlertCircle size={32} />
                      </div>
                      <div className="flex-1">
                          <h3 className="text-red-900 font-black uppercase tracking-widest text-sm mb-1">Analysis Error Encountered</h3>
                          <p className="text-red-700 font-bold text-xs opacity-80 leading-relaxed">{error}</p>
                      </div>
                      <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">
                          <X size={24} />
                      </button>
                  </div>
              </div>
          )}

          {showSplash && (
              <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
                  <div className="w-40 h-40 bg-ecomplete-primary rounded-[3rem] flex items-center justify-center text-white mb-10 shadow-[0_30px_60px_rgba(44,62,80,0.5)] animate-pulse relative border border-slate-700/50">
                      <Activity size={64} className="text-ecomplete-accent" />
                      <div className="absolute inset-0 ring-4 ring-ecomplete-accent rounded-[3rem] animate-ping opacity-30"></div>
                  </div>
                  <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">{progress}</h2>
                  <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-xs mb-10">Intelligence Stream Processing • {elapsedTime}s</p>
                  
                  <div className="w-full max-w-xl bg-slate-800/50 rounded-3xl p-6 font-mono text-xs text-slate-400 h-40 overflow-y-auto border border-slate-700 shadow-inner mb-10">
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700 font-black text-slate-300 uppercase tracking-widest"><Terminal size={14}/> Runtime Logs</div>
                      {debugLogs.map((log, i) => <div key={i} className="mb-2 font-medium opacity-70 leading-relaxed">&gt; {log}</div>)}
                  </div>
                  
                  <button onClick={handleCancel} className="bg-transparent text-red-400 border-2 border-red-500/30 hover:border-red-500 hover:bg-red-500/10 font-black py-4 px-12 rounded-2xl shadow-sm transition-all flex items-center gap-3 uppercase tracking-widest text-xs">
                      <XCircle size={20} /> Abort Operation
                  </button>
              </div>
          )}

          {(!displayMetrics || !isReportVisible) && !isLoading && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-[70vh] flex flex-col pt-20">
                  <div className="max-w-[1600px] mx-auto w-full px-8">
                      {/* Primary Hero: Executive Intelligence Insight */}
                      <div className="bg-gradient-to-br from-slate-900 via-ecomplete-primary to-slate-900 text-white rounded-[2.5rem] p-12 mb-8 shadow-2xl relative overflow-hidden border border-white/10">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20"></div>
                          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                          
                          <div className="relative z-10">
                              <h2 className="text-4xl font-black uppercase tracking-tight mb-6 text-white flex items-center gap-4">
                                  <Zap className="text-ecomplete-accent" size={36} />
                                  EXECUTIVE INTELLIGENCE INSIGHT
                              </h2>
                              <p className="text-xl font-medium leading-relaxed mb-8 text-slate-300 max-w-4xl">
                                  {executiveSummary || "System idle. Initiate Freshdesk Analysis to generate executive insights and audio briefing."}
                              </p>
                              
                              {!isAnalysisComplete ? (
                                  <>
                                      <button 
                                          onClick={handleReadSummary}
                                          disabled={isGeneratingAudio || isLoading}
                                          className={`flex items-center gap-3 px-10 py-5 rounded-2xl transition-all font-black text-sm uppercase tracking-widest relative overflow-hidden shadow-xl ${isGeneratingAudio || isLoading ? 'bg-white/10 text-white/50 cursor-not-allowed' : isPlayingAudio ? 'bg-ecomplete-accent text-slate-900 shadow-ecomplete-accent/20' : 'bg-ecomplete-accent text-slate-900 hover:bg-yellow-400 shadow-ecomplete-accent/20'}`}
                                      >
                                          {isGeneratingAudio || isLoading ? <Loader2 size={20} className="animate-spin" /> : isPlayingAudio ? <PauseCircle size={20} /> : <Volume2 size={20} />}
                                          <span>
                                              {isGeneratingAudio || isLoading ? 'Processing...' : isPlayingAudio ? 'Pause Briefing' : !executiveSummary ? 'Initiate Analysis' : 'Audio Briefing'}
                                          </span>
                                      </button>
                                      {(isGeneratingAudio || isLoading) && synopsisElapsedTime > 30 && (
                                          <div className="text-ecomplete-accent text-[10px] mt-4 font-bold animate-pulse uppercase tracking-widest">Warning: Briefing generation is taking longer than expected.</div>
                                      )}
                                      {(isGeneratingAudio || isLoading) && (
                                          <div className="mt-4 font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                                              {synopsisLogs.map((log, i) => <div key={i}>{log}</div>)}
                                          </div>
                                      )}
                                  </>
                              ) : (
                                  <div className="space-y-8">
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                          {[
                                              { label: 'Total Tickets', value: displayMetrics?.totalTickets || 0 },
                                              { label: 'Avg Response', value: displayMetrics?.avgResponseTime || '0h' },
                                              { label: 'Sentiment', value: displayMetrics?.avgSentiment ? `${displayMetrics.avgSentiment}%` : '0%' },
                                              { label: 'Risk Score', value: displayMetrics?.riskScore ? `${displayMetrics.riskScore}%` : '0%' },
                                              { label: 'Resolved', value: displayMetrics?.resolvedTickets || 0 },
                                              { label: 'Pending', value: displayMetrics?.pendingTickets || 0 },
                                              { label: 'Escalated', value: displayMetrics?.escalatedTickets || 0 },
                                              { label: 'Active', value: displayMetrics?.activeTickets || 0 }
                                          ].map((metric, i) => (
                                              <div key={i} className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-inner backdrop-blur-sm">
                                                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{metric.label}</div>
                                                  <div className="text-3xl font-black text-white">{metric.value}</div>
                                              </div>
                                          ))}
                                      </div>
                                      <div className="flex items-center gap-4">
                                          <button 
                                              onClick={handleReadSummary}
                                              disabled={isGeneratingAudio}
                                              className={`flex items-center gap-3 px-10 py-5 rounded-2xl transition-all font-black text-sm uppercase tracking-widest shadow-xl ${isGeneratingAudio ? 'bg-white/10 text-white/50 cursor-not-allowed' : isPlayingAudio ? 'bg-ecomplete-accent text-slate-900 shadow-ecomplete-accent/20' : 'bg-ecomplete-accent text-slate-900 hover:bg-yellow-400 shadow-ecomplete-accent/20'}`}
                                          >
                                              {isGeneratingAudio ? <Loader2 size={20} className="animate-spin" /> : isPlayingAudio ? <PauseCircle size={20} /> : <Volume2 size={20} />}
                                              <span>{isGeneratingAudio ? 'Processing...' : isPlayingAudio ? 'Pause Briefing' : 'Audio Briefing'}</span>
                                          </button>
                                          <button 
                                              onClick={() => setIsReportVisible(true)}
                                              className="flex-1 py-5 bg-white/10 text-white border border-white/20 font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-white/20 transition-all shadow-lg text-center"
                                          >
                                              Access Detailed eCompleteCommerce Analysis Report
                                          </button>
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Flash Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Queue</div>
                              <div className="text-3xl font-black text-slate-900">{displayMetrics?.activeTickets || 0}</div>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Brand Risk %</div>
                              <div className="text-3xl font-black text-slate-900">2.4%</div>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sentiment %</div>
                              <div className="text-3xl font-black text-slate-900">88%</div>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Avg Response Time</div>
                              <div className="text-3xl font-black text-slate-900">42m</div>
                          </div>
                      </div>

                      {/* Framework (Guide) - Dismissible */}
                      <div className="text-center">
                           <button className="text-slate-400 font-bold uppercase text-xs tracking-widest hover:text-slate-900 transition-colors">
                               View Framework Definitions
                           </button>
                      </div>
                  </div>
              </div>
          )}

          {(displayMetrics && isReportVisible) && (
              <div className="relative">
                  <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-[3rem]">
                      <div className="w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-sweep"></div>
                      <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] animate-float"></div>
                      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-ecomplete-accent/10 rounded-full blur-[150px] animate-float-delayed"></div>
                  </div>
                  <div className={`space-y-8 lg:space-y-12 animate-[fade-in_7s_ease-out_forwards] relative z-20`}>
                  <div className="bg-white rounded-[2.5rem] lg:rounded-[3.5rem] p-6 lg:p-10 shadow-[0_30px_70px_rgba(0,0,0,0.05)] border border-slate-200 relative overflow-hidden group">
                          <div className="absolute top-4 right-4 lg:top-6 lg:right-6 flex flex-col gap-3 z-10">
                              <button 
                                  onClick={handleReadSummary}
                                  disabled={isGeneratingAudio || isLoading}
                                  className={`flex items-center gap-2 px-4 lg:px-6 py-2 lg:py-3 rounded-xl transition-all font-black text-[9px] lg:text-[10px] uppercase tracking-widest shadow-lg h-[38px] lg:h-[42px] ${isPlayingAudio ? 'bg-ecomplete-accent text-slate-900 ring-4 ring-ecomplete-accent/20' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                              >
                                  {isGeneratingAudio ? <Loader2 size={14} className="animate-spin" /> : isPlayingAudio ? <PauseCircle size={14} /> : <Volume2 size={14} />}
                                  <span className="hidden sm:inline">{isGeneratingAudio ? 'Synthesizing...' : isPlayingAudio ? 'Pause Briefing' : !executiveSummary ? 'Initiate Analysis' : 'Audio Briefing'}</span>
                                  <span className="sm:hidden">{isPlayingAudio ? 'Pause' : !executiveSummary ? 'Analyze' : 'Audio'}</span>
                              </button>
                              <button 
                                  onClick={() => setIsLiveConsoleOpen(true)}
                                  title="Interactive real-time AI assistant capable of answering questions about the current dashboard metrics."
                                  className="flex items-center gap-2 px-4 lg:px-6 py-2 lg:py-3 bg-ecomplete-primary text-white rounded-xl hover:bg-slate-800 transition-all font-black text-[9px] lg:text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 h-[38px] lg:h-[42px]"
                              >
                                  <Mic size={14} />
                                  <span className="hidden sm:inline">Start Voice Console</span>
                                  <span className="sm:hidden">Voice</span>
                              </button>
                          </div>
                          <div className="absolute top-0 left-0 w-full h-4 bg-ecomplete-accent"></div>
                          
                          <h2 className="text-sm lg:text-xl font-black text-slate-400 uppercase tracking-[0.4em] mt-8 mb-16 text-center group-hover:text-ecomplete-primary transition-colors w-full">Total Active Ticket Queue</h2>
                          <div className="flex flex-col lg:flex-row items-center justify-center w-full gap-16 lg:gap-24">
                              <div className="flex flex-col items-center text-center">
                                  <div id="section-queue" className={`text-7xl md:text-8xl lg:text-9xl leading-none font-black text-[#FFEB00] tracking-tighter group-hover:scale-105 transition-transform duration-700 drop-shadow-[0_0_15px_rgba(255,235,0,0.3)] ${highlightedSection === 'queue' ? 'ring-8 ring-ecomplete-accent ring-offset-8 rounded-3xl animate-pulse' : ''}`} style={{ WebkitTextStroke: '1px black', textShadow: '2px 2px 0px rgba(0,0,0,0.1)' }}>{displayMetrics.activeTickets}</div>
                                  <div className="text-slate-400 font-black uppercase tracking-[0.2em] mt-6 lg:mt-8 flex flex-col gap-2 items-center justify-center"> 
                                      <span className="text-2xl lg:text-4xl text-slate-900 tracking-tight">{selectedGroup.name}</span> 
                                      <span className="text-xs lg:text-sm text-slate-500 font-black">{format(new Date(), "EEEE dd MMM")}</span> 
                                  </div>
                              </div>
                              
                              {/* Doughnut Chart Section */}
                              {groupActiveCounts.length > 0 && (
                                  <div className="flex flex-col items-center justify-center w-full max-w-md lg:-ml-16">
                                      <div className="h-[250px] w-full relative flex justify-center">
                                          <canvas ref={doughnutChartRef}></canvas>
                                      </div>
                                      {/* Legend */}
                                    <div className="flex flex-wrap items-center justify-center gap-6 mt-6 w-full pb-2">
                                        {groupActiveCounts.map((g, i) => (
                                            <button 
                                                key={g.id} 
                                                className="flex items-center gap-2 shrink-0 hover:bg-slate-50 p-2 rounded-xl transition-all"
                                                onClick={() => {
                                                    setMetricModalTitle(`Active Tickets: ${g.name}`);
                                                    setMetricModalTickets(activities.filter(a => a.ticket.group_id === g.id));
                                                    setMetricModalOpen(true);
                                                }}
                                            >
                                                <div className="w-[1.6cm] h-[0.8cm] rounded-sm shadow-sm" style={{ backgroundColor: getGroupColor(i) }}></div>
                                                <div className="flex flex-col items-start">
                                                    <span className="text-[10px] uppercase font-bold text-slate-500">{g.name.replace(' Online South Africa', '')}</span>
                                                    <span className="text-sm font-black text-slate-800">{g.count}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                  </div>
                              )}
                          </div>

                          <div id="section-backlog" className={`mt-12 pt-8 border-t border-slate-100 max-w-5xl mx-auto text-center transition-all duration-500 ${highlightedSection === 'backlog' ? 'bg-ecomplete-accent/10 rounded-[2rem] p-8 -mx-8 ring-2 ring-ecomplete-accent' : ''}`}>
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.3em] mb-8 flex items-center gap-2 justify-center">Active Queue Volume over time {isFetchingBacklog && <Loader2 size={14} className="animate-spin text-ecomplete-primary" />}</h3>
                              <div className="h-[250px] w-full relative"><canvas ref={agingChartRef}></canvas></div>
                              <p className="text-[10px] text-slate-400 mt-6 uppercase tracking-widest font-bold h-6">{backlogChartSubtitle}</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                          <div className="bg-white p-6 rounded-[3rem] border border-slate-200 shadow-lg flex flex-col hover:shadow-2xl transition-all duration-500">
                              <h3 className="font-black text-slate-800 uppercase text-3xl tracking-tight mb-8 pb-4 border-b border-slate-50">Urgency Profile</h3>
                              <div className="h-[220px] relative w-full overflow-x-auto overflow-y-hidden touch-pan-x">
                                  <canvas 
                                      ref={pieChartRef}
                                      onClick={(e) => {
                                          if (!pieChartInstance.current || !pieChartRef.current) return;
                                          const points = pieChartInstance.current.getElementsAtEventForMode(e.nativeEvent, 'nearest', { intersect: true }, true);
                                          if (points.length > 0) {
                                              const index = points[0].index;
                                              const urgency = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'][index];
                                              setMetricModalTitle(`Tickets: ${urgency} Urgency`);
                                              setMetricModalTickets(activities.filter(a => a.analysis.urgency.toUpperCase() === urgency));
                                              setMetricModalOpen(true);
                                          }
                                      }}
                                  ></canvas>
                              </div>
                              <div className="grid grid-cols-2 gap-2.5 mt-8"> {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(u => { 
                                  const count = getUrgencyCountScaled(u); 
                                  const rawCount = activities.filter(a => a.analysis.urgency.toUpperCase() === u).length;
                                  const totalRaw = activities.length;
                                  const perc = totalRaw > 0 ? Math.round((rawCount / totalRaw) * 100) : 0;
                                  return ( 
                                  <div key={u} className={`flex items-center justify-between px-4 py-4 rounded-2xl border text-[14px] font-black transition-all duration-300 bg-slate-50 border-slate-100`}> 
                                      <span className={u === 'CRITICAL' ? 'text-red-500' : u === 'HIGH' ? 'text-orange-500' : u === 'MEDIUM' ? 'text-yellow-500' : 'text-green-500'}>
                                          {u} <span className="opacity-50 ml-2">[{count}]</span>
                                      </span> 
                                      <div className="flex items-center gap-3">
                                          <span className="text-[10px] opacity-60">{perc}%</span>
                                          <div className={`w-2.5 h-2.5 rounded-full shadow-inner transition-all duration-500 bg-slate-300`}></div> 
                                      </div>
                                  </div> 
                              ); })} </div>
                          </div>
                          <div className="bg-white p-6 rounded-[3rem] border border-slate-200 shadow-lg flex flex-col hover:shadow-2xl transition-all duration-500">
                              <h3 className="font-black text-slate-800 uppercase text-3xl tracking-tight mb-8 pb-4 border-b border-slate-50">Category Matrix</h3>
                              <div className="h-[220px] relative w-full overflow-x-auto overflow-y-hidden touch-pan-x">
                                  <canvas 
                                      ref={barChartRef}
                                      onClick={(e) => {
                                          if (!barChartInstance.current || !barChartRef.current) return;
                                          const points = barChartInstance.current.getElementsAtEventForMode(e.nativeEvent, 'nearest', { intersect: true }, true);
                                          if (points.length > 0) {
                                              const index = points[0].index;
                                              const category = barChartInstance.current.data.labels[index];
                                              setMetricModalTitle(`Tickets: ${category}`);
                                              setMetricModalTickets(activities.filter(a => a.analysis.category === category));
                                              setMetricModalOpen(true);
                                          }
                                      }}
                                  ></canvas>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-8"> {(() => { 
                                  const counts: {[key: string]: number} = {}; 
                                  activities.forEach(a => counts[a.analysis.category] = (counts[a.analysis.category] || 0) + 1); 
                                  const sampleSize = activities.length; 
                                  const scaleFactor = (sampleSize > 0 && displayMetrics.activeTickets > sampleSize) ? displayMetrics.activeTickets / sampleSize : 1;
                                  return Object.keys(counts).sort((a,b) => counts[b] - counts[a]).slice(0, 6).map(cat => { 
                                      const scaledCount = Math.round(counts[cat] * scaleFactor); 
                                      const perc = sampleSize > 0 ? Math.round((counts[cat] / sampleSize) * 100) : 0;
                                      return ( 
                                      <div key={cat} className={`flex items-center justify-between px-4 py-4 rounded-2xl border text-[14px] font-black transition-all duration-300 bg-slate-50 border-slate-100`} style={{ color: getCategoryColor(cat) }}> 
                                          <span>{cat} <span className="opacity-50 ml-2">[{scaledCount}]</span></span> 
                                          <div className="flex items-center gap-3">
                                              <span className="text-[10px] opacity-60">{perc}%</span>
                                              <div className={`w-2.5 h-2.5 rounded-full shadow-inner transition-all duration-500 bg-slate-300`}></div> 
                                          </div>
                                      </div> 
                                  )}); })()} </div>
                          </div>
                      </div>

                      
                      {/* Feature Definitions */}
                      <div className="px-8 -mt-6 mb-6 flex flex-col gap-1">
  
                      </div>

                      {/* Operational Insight Report removed from main dashboard as requested */}
                      
                      {/* KPI Dashboard Strip */}
                      <div id="section-risk" className={`bg-slate-50/50 border border-slate-100 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-2 p-12 gap-12 mb-12 transition-all duration-500 ${highlightedSection === 'risk' ? 'ring-4 ring-ecomplete-accent bg-ecomplete-accent/5' : ''}`}>
                          <div className="flex flex-col gap-6 group">
                              <div className="flex justify-between items-end">
                                  <div>
                                      <span className="font-black text-slate-800 uppercase text-3xl tracking-tighter mb-2 block whitespace-nowrap">Brand Health Risk Threshold</span>
                                      <span className="text-sm font-medium text-slate-400 italic tracking-wide block max-w-sm leading-relaxed">Evaluates the risk of customer attrition based on service failure points</span>
                                  </div>
                                  <span className={`text-6xl font-black ${(() => {
                                      const avgRisk = activities.length > 0 ? Math.round(activities.reduce((acc, curr) => acc + curr.riskScore, 0) / activities.length) : 0;
                                      if (avgRisk >= 75) return 'text-red-500';
                                      if (avgRisk >= 50) return 'text-orange-500';
                                      return 'text-slate-400';
                                  })()} transition-colors`}>{Math.round(activities.reduce((acc, curr) => acc + curr.riskScore, 0) / (activities.length || 1))}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-5 overflow-hidden shadow-inner p-1">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${(() => {
                                      const avgRisk = activities.length > 0 ? Math.round(activities.reduce((acc, curr) => acc + curr.riskScore, 0) / activities.length) : 0;
                                      if (avgRisk >= 75) return 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]';
                                      if (avgRisk >= 50) return 'bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.5)]';
                                      return 'bg-slate-400';
                                  })()}`} style={{ width: `${Math.round(activities.reduce((acc, curr) => acc + curr.riskScore, 0) / (activities.length || 1))}%` }}></div>
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
                                  <span className={`text-6xl font-black ${(() => {
                                      const avgSentiment = activities.length > 0 ? Math.round(activities.reduce((acc, curr) => acc + curr.sentimentScore, 0) / activities.length) : 50;
                                      if (avgSentiment >= 70) return 'text-emerald-500';
                                      if (avgSentiment < 40) return 'text-red-500';
                                      return 'text-slate-400';
                                  })()} transition-colors`}>{Math.round(activities.reduce((acc, curr) => acc + curr.sentimentScore, 0) / (activities.length || 1))}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-5 overflow-hidden shadow-inner p-1">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${(() => {
                                      const avgSentiment = activities.length > 0 ? Math.round(activities.reduce((acc, curr) => acc + curr.sentimentScore, 0) / activities.length) : 50;
                                      if (avgSentiment >= 70) return 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]';
                                      if (avgSentiment < 40) return 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]';
                                      return 'bg-slate-400';
                                  })()}`} style={{ width: `${Math.round(activities.reduce((acc, curr) => acc + curr.sentimentScore, 0) / (activities.length || 1))}%` }}></div>
                              </div>
                              <div className="grid grid-cols-3 gap-1 mt-2 text-xs font-black uppercase tracking-wider text-center opacity-70">
                                  <div className="text-red-500">0-39%<br/>Negative</div>
                                  <div className="text-slate-400">40-69%<br/>Neutral</div>
                                  <div className="text-emerald-600">70%+<br/>Positive</div>
                              </div>
                          </div>
                      </div>

                      <div id="section-metrics" className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 transition-all duration-500 ${highlightedSection === 'metrics' ? 'ring-4 ring-ecomplete-accent rounded-[3rem] p-4 -m-4 bg-ecomplete-accent/5' : ''}`}>
                          <StatBox label="Created Today" value={displayMetrics.createdToday} trend24h={displayMetrics.createdTrend24h} trend7d={displayMetrics.createdTrend7d} onClick={() => handleMetricClick('Created')} chartData={displayMetrics.ticketsByHour} />
                          <StatBox label="Closed Today" value={displayMetrics.closedToday} trend24h={displayMetrics.closedTrend24h} trend7d={displayMetrics.closedTrend7d} onClick={() => handleMetricClick('Closed')} chartData={displayMetrics.closedTicketsByHour} />
                          <StatBox label="Today's activity" value={displayMetrics.workedToday} trend24h={displayMetrics.workedTrend24h} trend7d={displayMetrics.workedTrend7d} onClick={() => handleMetricClick('Worked')} chartData={displayMetrics.workedTicketsByHour} />
                          <StatBox label="Reopened Today" value={displayMetrics.reopenedToday} trend24h={displayMetrics.reopenedTrend24h} trend7d={displayMetrics.reopenedTrend7d} onClick={() => handleMetricClick('Reopened')} />
                          <StatBox label="Creation Freq" value={displayMetrics.createdFrequency} chartData={displayMetrics.ticketsByHour} />
                          <StatBox label="Avg Response" value={displayMetrics.responseFrequency} onClick={() => {}} chartData={displayMetrics.workedTicketsByHour} />
                      </div>

                      <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-[0_15px_40px_rgba(0,0,0,0.03)] group">
                          <div className="flex flex-col gap-4 mb-10">
                              <div className="flex justify-between items-start">
                                  <h3 className="font-black text-slate-800 uppercase text-3xl tracking-tighter flex items-center gap-3 mt-2"> <Activity className="text-ecomplete-primary" size={32} /> Sequential Volume Flow </h3>
                                  <div className="flex flex-col items-end gap-3">
                                      <div className="flex bg-slate-100 p-1.5 rounded-2xl ring-1 ring-slate-200"> {['created','worked','closed'].map(t => ( <button key={t} onClick={() => setTimelineTab(t as any)} className={`px-6 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${timelineTab === t ? 'bg-white shadow-xl text-ecomplete-primary' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button> ))} </div>
                                      <div className="flex justify-end gap-2">
                                          <button onClick={() => toggleDataset(0)} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all duration-300 border ${!hiddenDatasets.includes(0) ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>Today</button>
                                          <button onClick={() => toggleDataset(1)} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all duration-300 border ${!hiddenDatasets.includes(1) ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>Yesterday</button>
                                          <button onClick={() => toggleDataset(2)} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all duration-300 border ${!hiddenDatasets.includes(2) ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>7 Days Ago</button>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div className="h-[300px] overflow-x-auto overflow-y-hidden touch-pan-x"><canvas ref={timelineChartRef}></canvas></div>
                      </div>
                      
                      <div className="space-y-8">
                          <div id="section-pulse" className={`w-full mt-12 mb-12 animate-in fade-in transition-all duration-500 ${highlightedSection === 'pulse' ? 'ring-4 ring-ecomplete-accent rounded-[3rem] p-4 -m-4 bg-ecomplete-accent/5' : ''}`}>
                              <FreshdeskPulse 
                                  activities={pulseActivities} 
                                  onMetricClick={(title, filterFn) => {
                                      setMetricModalTitle(title);
                                      setMetricModalTickets(pulseActivities.filter(filterFn));
                                      setMetricModalOpen(true);
                                  }}
                              />
                          </div>
                          
                          <div className="w-full">
                              <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
                                  <div className="p-10 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/50 gap-6">
                                      <div>
                                          <h3 className="font-black text-3xl text-slate-800 tracking-tight uppercase">ACTIVE TICKET TABLE</h3>
                                          <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-2">Real-time sampling of {activities.length} records</p>
                                      </div>
                                      <div className="flex flex-wrap gap-4 items-center">
                                          <div className="relative"> 
                                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                            <input type="text" placeholder="Search Filter..." value={filterText} onChange={e => setFilterText(e.target.value)} className="bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-xs font-black shadow-sm w-72 text-slate-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-300" /> 
                                          </div>
                                          
                                          <div className="relative">
                                              <button 
                                                onClick={() => setCategoryFilterOpen(!categoryFilterOpen)}
                                                className="bg-white border border-slate-200 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm flex items-center gap-3 hover:border-slate-300 transition-all min-w-[220px]"
                                              >
                                                  {filterCategories.length === 0 ? 'All Categories' : `${filterCategories.length} Selected`}
                                                  {categoryFilterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                              </button>
                                              {categoryFilterOpen && (
                                                  <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setCategoryFilterOpen(false)}></div>
                                                    <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[400px]">
                                                        <div className="space-y-2">
                                                            <button 
                                                                onClick={() => setFilterCategories([])}
                                                                className="w-full text-left text-[10px] font-black text-blue-600 uppercase mb-4 hover:underline"
                                                            >
                                                                Clear All
                                                            </button>
                                                            {CATEGORIES.map(cat => (
                                                                <label key={cat} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="w-4 h-4 rounded border-slate-300 text-ecomplete-primary focus:ring-ecomplete-primary/20"
                                                                        checked={filterCategories.includes(cat)}
                                                                        onChange={() => setFilterCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                                                                    />
                                                                    <span className="text-[11px] font-bold text-slate-700 uppercase group-hover:text-ecomplete-primary" style={{ color: getCategoryColor(cat) }}>{cat}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                  </>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                                  <div className="overflow-x-auto overflow-y-hidden touch-pan-x">
                                      <table className="w-full text-left text-sm">
                                          <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black tracking-[0.2em]">
                                              <tr>
                                                  <th className="px-4 py-3 pl-6 border-b border-slate-100">#</th>
                                                  <th className="px-4 py-3 border-b border-slate-100">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="cursor-pointer hover:text-ecomplete-primary" onClick={() => requestSort('ticket.id')}>ID</span>
                                                        <input type="text" value={tableFilters.id} onChange={e => setTableFilters(prev => ({...prev, id: e.target.value}))} className="bg-white border border-slate-200 rounded-lg px-2 py-1 w-16 text-[8px] font-bold outline-none focus:border-ecomplete-primary" placeholder="ID..." />
                                                    </div>
                                                  </th>
                                                  <th className="px-4 py-3 border-b border-slate-100 w-2/5">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="cursor-pointer hover:text-ecomplete-primary" onClick={() => requestSort('ticket.subject')}>Subject / Summary</span>
                                                        <input type="text" value={tableFilters.subject} onChange={e => setTableFilters(prev => ({...prev, subject: e.target.value}))} className="bg-white border border-slate-200 rounded-lg px-2 py-1 w-full text-[8px] font-bold outline-none focus:border-ecomplete-primary" placeholder="Search subject..." />
                                                    </div>
                                                  </th>
                                                  <th className="px-4 py-3 border-b border-slate-100">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="cursor-pointer hover:text-ecomplete-primary" onClick={() => requestSort('analysis.category')}>Category</span>
                                                        <select value={tableFilters.category} onChange={e => setTableFilters(prev => ({...prev, category: e.target.value}))} className="bg-white border border-slate-200 rounded-lg px-2 py-1 w-24 text-[8px] font-bold outline-none focus:border-ecomplete-primary appearance-none cursor-pointer">
                                                            <option value="">All</option>
                                                            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                        </select>
                                                    </div>
                                                  </th>
                                                  <th className="px-4 py-3 border-b border-slate-100">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="cursor-pointer hover:text-ecomplete-primary" onClick={() => requestSort('brandName')}>Brand</span>
                                                        <select value={tableFilters.brand} onChange={e => setTableFilters(prev => ({...prev, brand: e.target.value}))} className="bg-white border border-slate-200 rounded-lg px-2 py-1 w-24 text-[8px] font-bold outline-none focus:border-ecomplete-primary appearance-none cursor-pointer">
                                                            <option value="">All</option>
                                                            {uniqueBrands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                                                        </select>
                                                    </div>
                                                  </th>
                                                  <th className="px-4 py-3 border-b border-slate-100">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="cursor-pointer hover:text-ecomplete-primary" onClick={() => requestSort('statusName')}>Status</span>
                                                        <select value={tableFilters.status} onChange={e => setTableFilters(prev => ({...prev, status: e.target.value}))} className="bg-white border border-slate-200 rounded-lg px-2 py-1 w-20 text-[8px] font-bold outline-none focus:border-ecomplete-primary appearance-none cursor-pointer">
                                                            <option value="">All</option>
                                                            {uniqueStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                                                        </select>
                                                    </div>
                                                  </th>
                                                  <th className="px-4 py-3 border-b border-slate-100 cursor-pointer hover:text-ecomplete-primary" onClick={() => requestSort('ticket.created_at')}>Created</th>
                                                  <th className="px-4 py-3 border-b border-slate-100">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="cursor-pointer hover:text-ecomplete-primary" onClick={() => requestSort('analysis.urgency')}>Urgency</span>
                                                        <select value={tableFilters.urgency} onChange={e => setTableFilters(prev => ({...prev, urgency: e.target.value}))} className="bg-white border border-slate-200 rounded-lg px-2 py-1 w-20 text-[8px] font-bold outline-none focus:border-ecomplete-primary appearance-none cursor-pointer">
                                                            <option value="">All</option>
                                                            {uniqueUrgencies.map(urg => <option key={urg} value={urg}>{urg}</option>)}
                                                        </select>
                                                    </div>
                                                  </th>
                                                  <th className="px-4 py-3 border-b border-slate-100 text-center cursor-pointer hover:text-ecomplete-primary" onClick={() => requestSort('riskScore')}>Risk</th>
                                                  <th className="px-4 py-3 border-b border-slate-100 text-center cursor-pointer hover:text-ecomplete-primary" onClick={() => requestSort('sentimentScore')}>Sentiment</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                              {!showTable ? (
                                                  <tr>
                                                      <td colSpan={10} className="p-16 text-center">
                                                          <div className="flex flex-col items-center justify-center opacity-40">
                                                              <MousePointerClick size={48} className="mb-4 text-slate-300 animate-bounce"/>
                                                              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Initialisation Required</h3>
                                                              <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Click 'Initialise Analysis' to sync and view the ticket table</p>
                                                          </div>
                                                      </td>
                                                  </tr>
                                              ) : sortedAndFilteredActivities.map((act, idx) => (
                                                  <tr key={act.ticket.id} className="hover:bg-blue-50/50 cursor-pointer transition-all group" onClick={() => { setSelectedTicketActivity(act); setDetailModalOpen(true); }}>
                                                      <td className="px-4 py-2 pl-6 font-bold text-slate-300 text-[10px]">{idx + 1}</td>
                                                      <td className="px-4 py-2 font-black text-blue-600 text-[10px] group-hover:underline">{act.ticket.id}</td>
                                                      <td className="px-4 py-2 min-w-[300px] max-w-[500px]">
                                                          <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-slate-800 text-xs leading-tight group-hover:text-ecomplete-primary transition-colors">{act.ticket.subject}</span>
                                                            <span className="text-[10px] text-slate-400 font-medium opacity-80 italic line-clamp-2">{act.aiSummary}</span>
                                                          </div>
                                                      </td>
                                                      <td className="px-4 py-2"> <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase text-white shadow-sm" style={{ backgroundColor: getCategoryColor(act.analysis.category) }}>{act.analysis.category}</span> </td>
                                                      <td className="px-4 py-2"> <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{act.brandName || 'Unknown'}</span> </td>
                                                      <td className="px-4 py-2"> <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{act.statusName}</span> </td>
                                                      <td className="px-4 py-2"> <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{format(new Date(act.ticket.created_at), 'dd:MM:yyyy')}</span> </td>
                                                      <td className="px-4 py-2"> <span className="px-3 py-0.5 rounded-xl text-[8px] font-black uppercase text-white shadow-sm" style={{ backgroundColor: getUrgencyColor(act.analysis.urgency) }}>{act.analysis.urgency}</span> </td>
                                                      <td className="px-4 py-2 text-center font-black text-[10px] text-slate-700">{act.riskScore}%</td>
                                                      <td className="px-4 py-2 text-center font-black text-[10px] text-slate-700">{act.sentimentScore}%</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="h-20"></div>
                  </div>
              </div>
          )}

          <MetricDetailModal isOpen={metricModalOpen} onClose={() => setMetricModalOpen(false)} title={metricModalTitle} tickets={metricModalTickets} onTicketClick={(t) => { setMetricModalOpen(false); setSelectedTicketActivity(t); setDetailModalOpen(true); }} />
          <TicketDetailModal 
            isOpen={detailModalOpen} 
            onClose={() => setDetailModalOpen(false)} 
            activity={selectedTicketActivity} 
            editCategory={editCategory} 
            setEditCategory={setEditCategory} 
            editType={editType} 
            setEditType={setEditType} 
            editTags={editTags} 
            setEditTags={setEditTags} 
            onSave={() => alert("Update saved.")} 
            onMarkAsSpam={() => alert("Marked as spam.")} 
            onReply={handleReplyTicket} 
          />
          <LinkResultModal isOpen={linkModalOpen} onClose={() => setLinkModalOpen(false)} url={generatedLink} />
          {isLiveConsoleOpen && <LiveVoiceConsole isOpen={isLiveConsoleOpen} onClose={() => setIsLiveConsoleOpen(false)} summary={executiveSummary} metrics={displayMetrics} activities={activities} />}
          
          {/* Floating Scroll Indicator */}
          {scrollDirection && (
              <div className="fixed bottom-10 right-10 z-50 animate-bounce">
                  <div className="bg-ecomplete-accent text-slate-900 p-4 rounded-full shadow-2xl flex items-center justify-center border-4 border-white">
                      {scrollDirection === 'up' ? <ArrowUp size={32} /> : <ArrowDown size={32} />}
                  </div>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap">
                      Scroll to view
                  </div>
              </div>
          )}
      </main>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
          <div className="fixed inset-0 z-[60] animate-in fade-in duration-300">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setMobileMenuOpen(false)}></div>
              <div className="absolute top-0 right-0 w-[85%] h-full bg-white shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col rounded-l-[3rem] overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3">
                          <Settings className="text-slate-400" size={20} />
                          <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-xs">Intelligence Config</h3>
                      </div>
                      <button onClick={() => setMobileMenuOpen(false)} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100"><X size={20} /></button>
                  </div>
                  <div className="p-8 flex-1 overflow-y-auto space-y-10">
                      {appContext === 'admin' && (
                      <div className="space-y-6">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-1">Active Brand Ecosystem</label>
                          <div className="grid grid-cols-1 gap-3">
                              {availableGroups.map(g => (
                                  <button 
                                      key={g.id}
                                      onClick={() => { setSelectedGroup(g); setMobileMenuOpen(false); }}
                                      className={`p-6 rounded-[2rem] text-left font-black text-xs uppercase tracking-widest transition-all border-2 ${selectedGroup.id === g.id ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}
                                  >
                                      {g.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                      )}

                      <div className="space-y-6">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-1">Sample Intensity</label>
                          <div className="grid grid-cols-2 gap-3">
                              {['25','50','75','all'].map(s => (
                                  <button 
                                      key={s}
                                      onClick={() => { setTicketScope(s as any); setMobileMenuOpen(false); }}
                                      className={`p-4 rounded-2xl text-center font-black text-[10px] uppercase tracking-widest transition-all border-2 ${ticketScope === s ? 'bg-ecomplete-primary border-ecomplete-primary text-white' : 'bg-slate-50 border-transparent text-slate-500'}`}
                                  >
                                      {s === 'all' ? 'FULL' : `${s}%`}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white space-y-4 shadow-2xl">
                          <div className="flex items-center gap-3 mb-2">
                              <Zap className="text-ecomplete-accent" size={20} />
                              <span className="text-[10px] font-black uppercase tracking-[0.3em]">System Status</span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest">
                              All intelligence nodes operational. Gemini 3.0 Pro active.
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
