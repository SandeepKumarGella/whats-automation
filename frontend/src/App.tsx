import { useEffect, useRef, useState } from 'react';
import { useStore } from './store/useStore';
import { api } from './services/api';
import { 
  requestNotificationPermission, 
  showDesktopNotification, 
  playNotificationSound 
} from './utils/notifications';
import Sidebar from './components/Sidebar';
import DashboardStats from './components/DashboardStats';
import ProgressBar from './components/ProgressBar';
import LiveTimeline from './components/LiveTimeline';
import ContactsTable from './components/ContactsTable';
import TemplateEditor from './components/TemplateEditor';
import SettingsForm from './components/SettingsForm';
import QRModal from './components/QRModal';
import ConfirmationDialog from './components/ConfirmationDialog';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettings } from './hooks/useSettings';
import { 
  Download, 
  AlertTriangle,
  ShieldCheck,
  Check,
  Calendar,
  ChevronRightSquare
} from 'lucide-react';
import { CampaignHistoryItem } from './types/index';

export function App() {
  const activeTab = useStore((state) => state.activeTab);
  const setActiveTab = useStore((state) => state.setActiveTab);
  const wizardStep = useStore((state) => state.wizardStep);
  const setWizardStep = useStore((state) => state.setWizardStep);
  const { settings } = useSettings();
  const progress = useStore((state) => state.progress);
  const setProgress = useStore((state) => state.setProgress);
  const contactsReport = useStore((state) => state.contactsReport);
  const setContactsReport = useStore((state) => state.setContactsReport);
  const addLog = useStore((state) => state.addLog);
  const addToast = useStore((state) => state.addToast);
  const theme = useStore((state) => state.theme);
  const queryClient = useQueryClient();

  const [resumeState, setResumeState] = useState<any>(null);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const prevStatusRef = useRef('idle');
  const hasToastedConnectedRef = useRef(false);

  // Request notifications and query backend resume capabilities on mount
  useEffect(() => {
    requestNotificationPermission();
    checkResumeState();
  }, []);

  // Sync HTML root element class with theme state
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  // Fetch campaign histories for Dashboard & History tabs
  const { data: campaignHistory = [] } = useQuery<CampaignHistoryItem[]>({
    queryKey: ['campaignHistory'],
    queryFn: api.getCampaignHistoryIndex
  });

  const checkResumeState = async () => {
    try {
      const data = await api.getResumeState();
      if (data.hasResumeState && data.state) {
        setResumeState(data.state);
        setContactsReport({
          isValid: true,
          totalRows: data.state.contacts.length,
          validCount: data.state.contacts.filter((c: any) => c.status === 'pending').length,
          invalidCount: 0,
          duplicateCount: 0,
          contacts: data.state.contacts,
          errors: []
        });
        setWizardStep(7);
        setActiveTab('campaigns');
      }
    } catch (err) {
      console.error('Failed to query resume state: ', err);
    }
  };

  // Connect to SSE status stream safely
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
    const sseUrl = `${apiBase}/automation/status/stream`;
    let eventSource: EventSource | null = null;
    let errCount = 0;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        errCount = 0;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'status') {
            setProgress(payload.data);
            
            const prevStatus = prevStatusRef.current;
            const currentStatus = payload.data.status;
            
            if (currentStatus === 'completed' && prevStatus === 'running') {
              playNotificationSound();
              showDesktopNotification('Campaign Completed! 🎉', {
                body: 'All WhatsApp messages in your queue have been processed.'
              });
              addToast('WhatsApp Campaign Finished successfully!', 'success');
              setResumeState(null);
              setWizardStep(8);
              setActiveTab('campaigns');
              queryClient.invalidateQueries({ queryKey: ['campaignHistory'] });
            }

            prevStatusRef.current = currentStatus;
          } else if (payload.type === 'log') {
            addLog(payload.data);
          }
        } catch (err) {
          console.error('Failed to parse SSE line: ', err);
        }
      };

      eventSource.onerror = () => {
        errCount++;
        if (errCount >= 3 && eventSource) {
          eventSource.close();
        }
      };
    } catch (err) {
      console.warn('SSE stream init skipped.', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [setProgress, addLog, addToast, setWizardStep, setActiveTab, queryClient]);

  // Stepper jumps automatically when a csv file is parsed
  useEffect(() => {
    if (contactsReport && wizardStep === 1 && activeTab === 'campaigns') {
      setWizardStep(2);
    }
  }, [contactsReport, wizardStep, activeTab, setWizardStep]);

  // Trigger WhatsApp connection when landing on Step 5
  useEffect(() => {
    if (activeTab === 'campaigns' && wizardStep === 5) {
      hasToastedConnectedRef.current = false;
      api.connectAutomation().catch((err) => {
        console.error('Failed to initiate connection:', err);
      });
    }
  }, [wizardStep, activeTab]);

  // Automatically advance from Step 5 to Step 6 when WhatsApp is authenticated
  useEffect(() => {
    if (activeTab === 'campaigns' && wizardStep === 5 && progress.status === 'connected') {
      if (!hasToastedConnectedRef.current) {
        hasToastedConnectedRef.current = true;
        addToast('WhatsApp authenticated successfully!', 'success');
      }
      const timer = setTimeout(() => {
        setWizardStep(6);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [progress.status, wizardStep, activeTab, setWizardStep, addToast]);

  // Automatic active tab highlighting based on active wizard step
  useEffect(() => {
    if (activeTab === 'campaigns') {
      if (wizardStep === 3) {
        setActiveTab('templates');
      } else if (wizardStep === 4) {
        setActiveTab('settings');
      }
    }
  }, [wizardStep, activeTab, setActiveTab]);

  // Launch campaign runner
  const handleStart = async () => {
    if (!contactsReport || contactsReport.contacts.length === 0) {
      addToast('Please upload and validate a CSV contact queue first.', 'error');
      return;
    }

    try {
      const settings = await api.getSettings();
      const hasPending = contactsReport.contacts.some(c => c.status === 'pending');
      if (!hasPending) {
        addToast('No contacts are set as pending! Reset failed or skipped contacts.', 'error');
        return;
      }

      await api.startAutomation(contactsReport.contacts, settings);
      setResumeState(null);
      addToast('WhatsApp Automation initiated', 'success');
      setWizardStep(7);
      setActiveTab('campaigns');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to start automation.', 'error');
    }
  };

  const handlePause = async () => {
    try {
      await api.pauseAutomation();
      addToast('Automation paused', 'info');
    } catch (err) {
      addToast('Failed to pause automation', 'error');
    }
  };

  const handleResume = async () => {
    try {
      await api.resumeAutomation();
      addToast('Automation resumed', 'success');
    } catch (err) {
      addToast('Failed to resume automation', 'error');
    }
  };

  const handleStop = async () => {
    setConfirmStopOpen(true);
  };

  const handleConfirmStop = async () => {
    setConfirmStopOpen(false);
    try {
      await api.stopAutomation();
      addToast('Automation stopped and session closed', 'warning');
      setResumeState(null);
      setWizardStep(8);
      setActiveTab('campaigns');
    } catch (err) {
      addToast('Failed to stop automation', 'error');
    }
  };

  const handleResumeFromCrash = async () => {
    try {
      await api.resumeAutomation();
      setResumeState(null);
      addToast('Resumed Campaign from crash log', 'success');
      setWizardStep(7);
      setActiveTab('campaigns');
    } catch (err) {
      addToast('Failed to resume campaign', 'error');
    }
  };

  const handleDiscardCrashState = async () => {
    try {
      await api.stopAutomation();
      setResumeState(null);
      addToast('Interrupted campaign discarded', 'info');
      setWizardStep(1);
      setActiveTab('campaigns');
    } catch (err) {
      addToast('Failed to discard campaign state', 'error');
    }
  };

  const handleResetForNewRun = () => {
    setContactsReport(null);
    setWizardStep(1);
    setActiveTab('campaigns');
  };

  const isIdle = progress.status === 'idle' || progress.status === 'completed' || progress.status === 'stopped';
  const isRunning = progress.status === 'running';
  const isPausedState = progress.status === 'paused';

  // Horizontal Stepper steps metadata
  const stepsList = [
    { id: 1, label: 'Import CSV' },
    { id: 2, label: 'Validate Contacts' },
    { id: 3, label: 'Compose Message' },
    { id: 4, label: 'Review Settings' },
    { id: 5, label: 'Connect WhatsApp Web' },
    { id: 6, label: 'Review Campaign' },
    { id: 7, label: 'Live Campaign Progress' },
    { id: 8, label: 'Campaign Completed & Reports' },
  ];

  const isStepUnlocked = (stepId: number) => {
    const isRunningState = progress.status === 'running' || progress.status === 'scanning_qr' || progress.status === 'paused';
    if (isRunningState) return stepId === 7;
    
    if (stepId === 1) return true;
    if (stepId === 2) return !!contactsReport;
    if (stepId <= 6) return !!contactsReport;
    if (stepId === 7) return progress.completed > 0 || progress.status === 'completed';
    if (stepId === 8) return progress.status === 'completed';
    return false;
  };

  const handleHorizontalStepClick = (stepId: number) => {
    if (isStepUnlocked(stepId)) {
      setWizardStep(stepId);
      if (stepId === 3) setActiveTab('templates');
      else if (stepId === 4) setActiveTab('settings');
      else setActiveTab('campaigns');
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0f172a] dark:bg-slate-950 transition-colors duration-300 overflow-hidden font-sans">
      
      {/* 1. Left Sidebar Navigation */}
      <Sidebar />

      {/* 2. Main Content viewport */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        
        {/* Header Bar matching Reference Dashboard titles */}
        <header className="h-16 border-b border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-bold text-slate-850 dark:text-white tracking-wide uppercase">
              {activeTab === 'campaigns' 
                ? 'WhatsApp Automation – 8 Step Campaign Flow' 
                : activeTab === 'templates' 
                ? 'Message Compose Template Editor' 
                : activeTab === 'settings' 
                ? 'Automation System Configurations' 
                : activeTab === 'dashboard' 
                ? 'SaaS Automation Control Panel'
                : 'Recent Campaigns History logs'}
            </h2>
          </div>

        </header>

        {/* 3. Horizontal Stepper Wizard Bar (shown for campaigns/templates/settings related flow) */}
        {activeTab !== 'dashboard' && activeTab !== 'history' && (
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 px-6 py-3 overflow-x-auto scrollbar-none shrink-0 select-none">
            <div className="flex items-center gap-5 min-w-[900px] justify-between">
              {stepsList.map((step, idx) => {
                const isActive = wizardStep === step.id;
                const isCompleted = step.id < wizardStep;
                const isUnlocked = isStepUnlocked(step.id);

                return (
                  <div key={step.id} className="flex items-center gap-2 relative">
                    <button
                      onClick={() => handleHorizontalStepClick(step.id)}
                      disabled={!isUnlocked}
                      className={`flex items-center gap-1.5 transition-all text-[11px] font-bold ${
                        isActive 
                          ? 'text-emerald-500' 
                          : isCompleted 
                          ? 'text-slate-700 dark:text-slate-300' 
                          : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border transition-colors ${
                        isActive 
                          ? 'bg-emerald-500 border-transparent text-white shadow-sm'
                          : isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400'
                      }`}>
                        {isCompleted ? <Check size={10} /> : step.id}
                      </span>
                      <span>{step.label}</span>
                    </button>
                    {idx < stepsList.length - 1 && (
                      <span className="text-slate-300 dark:text-slate-800 font-mono text-[9px] pointer-events-none select-none ml-2">→</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Wizard Content Body Frame */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-thin">
          
          {/* Recovery Banner for Crashes */}
          {resumeState && isIdle && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">
                    Crash Recovery Detected!
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    An incomplete campaign session was recovered on disk. Next contact in queue: <span className="font-bold text-emerald-500">{resumeState.contacts[resumeState.currentIndex]?.name}</span>. Do you want to resume?
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleDiscardCrashState}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-[10px] font-bold rounded-lg text-slate-650 dark:text-slate-350 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Discard Run
                </button>
                <button
                  onClick={handleResumeFromCrash}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-[10px] font-bold rounded-lg text-white shadow-md shadow-amber-500/10"
                >
                  Resume Campaign
                </button>
              </div>
            </motion.div>
          )}

          {/* Stepper Slide Transitions based on active sidebar tab */}
          <AnimatePresence mode="wait">
            
            {/* -------------------- GENERAL DASHBOARD VIEW -------------------- */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 max-w-4xl"
              >
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-6 rounded-2xl shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Campaign Launchpad
                  </h3>
                  <p className="text-xs text-slate-500 max-w-lg leading-relaxed">
                    Welcome to WA Automator. Upload your contact list to initiate highly personalized invitation dispatches using Playwright automated WhatsApp Web loops.
                  </p>
                  <button
                    onClick={() => {
                      setWizardStep(1);
                      setActiveTab('campaigns');
                    }}
                    className="px-5 py-2.5 bg-emerald-555 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    Initiate New Campaign Flow
                    <ChevronRightSquare size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl">
                    <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Past Runs</p>
                    <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white font-mono">{campaignHistory.length}</h3>
                  </div>
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl">
                    <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider">Total Dispatched</p>
                    <h3 className="text-2xl font-bold mt-1 text-emerald-500 font-mono">
                      {campaignHistory.reduce((acc, curr) => acc + curr.success, 0)}
                    </h3>
                  </div>
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl">
                    <p className="text-[10px] text-rose-500 uppercase font-bold tracking-wider">Delivery Errors</p>
                    <h3 className="text-2xl font-bold mt-1 text-rose-500 font-mono">
                      {campaignHistory.reduce((acc, curr) => acc + curr.failed, 0)}
                    </h3>
                  </div>
                </div>
              </motion.div>
            )}

            {/* -------------------- CAMPAIGNS WIZARD STEPPER VIEW -------------------- */}
            {activeTab === 'campaigns' && (
              <motion.div
                key={`campaign-step-${wizardStep}`}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                {/* Step 1 & 2: Contacts CSV Upload & Queue Grid */}
                {(wizardStep === 1 || wizardStep === 2) && <ContactsTable />}

                {/* Step 5: Connect WhatsApp Web (QR CODE SCAN) */}
                {wizardStep === 5 && (
                  <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden p-6 space-y-6">
                    <div className="flex flex-col items-center gap-1.5 text-center border-b border-slate-100 dark:border-slate-800 pb-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Scan QR Code
                      </h3>
                      <p className="text-xs text-slate-455">
                        Open WhatsApp on your phone and scan the QR code to connect.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-2">
                      {/* Left: Text instruction numbers list */}
                      <div className="space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                          <p className="leading-relaxed mt-0.5">Open WhatsApp on your phone</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                          <p className="leading-relaxed mt-0.5">Tap Menu or Settings and select Linked Devices</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                          <p className="leading-relaxed mt-0.5">Tap on Link a Device</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0">4</span>
                          <p className="leading-relaxed mt-0.5">Scan this QR code</p>
                        </div>

                        {/* Status notification info */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] font-bold flex items-center gap-1.5 uppercase">
                          {progress.status === 'connected' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400">Device linked successfully</span>
                            </>
                          ) : progress.status === 'scanning_qr' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span className="text-slate-450">Waiting for QR scan...</span>
                            </>
                          ) : progress.status === 'connecting' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                              <span className="text-slate-450">Launching browser...</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              <span className="text-slate-450">Waiting for device scan...</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: QR Code Canvas box */}
                      <div className="flex flex-col items-center justify-center gap-3">
                        {progress.status === 'connected' ? (
                          <div className="p-5 border border-emerald-500/30 bg-emerald-500/[0.05] rounded-xl flex flex-col items-center gap-2 max-w-[200px] text-center select-none">
                            <ShieldCheck size={32} className="text-emerald-500" />
                            <p className="text-xs font-bold text-slate-850 dark:text-slate-200">
                              Linked Device Active
                            </p>
                            <p className="text-[9px] text-slate-450 leading-relaxed mt-0.5">
                              WhatsApp authenticated. Advancing to campaign review...
                            </p>
                          </div>
                        ) : progress.qrCodeUrl ? (
                          <div className="p-3 bg-white border border-slate-200/80 dark:border-slate-850 rounded-xl shadow-inner relative group select-none">
                            <img
                              src={progress.qrCodeUrl}
                              alt="WhatsApp Web QR Code"
                              className="w-48 h-48 object-contain rounded-md"
                            />
                            <div className="absolute inset-0 border border-emerald-500/20 rounded-xl pointer-events-none animate-pulse" />
                          </div>
                        ) : (
                          <div className="py-6 flex flex-col items-center justify-center gap-3 text-center">
                            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">
                              {progress.currentStep || 'Spawning Playwright Chromium...'}
                            </p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            api.connectAutomation().then(() => {
                              addToast('Initiated WhatsApp browser connection', 'info');
                            }).catch((err: any) => {
                              addToast(err.message || 'Connection failed', 'error');
                            });
                          }}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          🔄 Re-trigger QR Code Scan / Launch Browser
                        </button>
                      </div>
                    </div>

                    {/* Stepper Wizard navigator bar */}
                    <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
                      <button
                        onClick={() => {
                          setWizardStep(4);
                          setActiveTab('settings');
                        }}
                        className="px-4 py-2 border border-slate-250 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-805 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors active:scale-95"
                      >
                        ← Back
                      </button>

                      <button
                        onClick={() => setWizardStep(6)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                      >
                        Next: Review Campaign →
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 6: Review Campaign Summary checklist */}
                {wizardStep === 6 && (
                  <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Campaign Summary
                        </h3>
                        <p className="text-xs text-slate-450 mt-1">
                          Review all parameters before initiating automation.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setWizardStep(4);
                          setActiveTab('settings');
                        }}
                        className="text-xs text-emerald-500 hover:underline font-semibold"
                      >
                        Edit Settings
                      </button>
                    </div>

                    {/* Summary attributes table list */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-550 font-medium">Campaign Name:</span>
                        <span className="font-bold text-slate-850 dark:text-white font-mono">Wedding Invitation</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-550 font-medium">Total Contacts:</span>
                        <span className="font-bold text-slate-850 dark:text-white font-mono">{contactsReport?.totalRows || 0}</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-550 font-medium">Ready to Send:</span>
                        <span className="font-bold text-emerald-500 font-mono">{contactsReport?.validCount || 0}</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-550 font-medium">Invalid Contacts:</span>
                        <span className="font-bold text-amber-500 font-mono">{contactsReport?.invalidCount || 0}</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-550 font-medium">Website URL:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono truncate max-w-[200px]">
                          {settings?.websiteUrl || 'https://sandeepweds.com'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-550 font-medium">Min - Max Delay:</span>
                        <span className="font-bold text-slate-850 dark:text-white">
                          {settings?.delayMin || 5} - {settings?.delayMax || 10} Seconds
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-550 font-medium">Batch Size Settings:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          After {settings?.batchSize || 20} messages, pause {settings?.batchDelayMin || 60} - {settings?.batchDelayMax || 120} sec
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-550 font-medium">Safety Modes:</span>
                        <span className="font-bold text-slate-850 dark:text-white">
                          Test Mode: {settings?.testMode ? 'ON' : 'OFF'}, Dry Run: {settings?.dryRunMode ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </div>

                    {/* Stepper Wizard navigator bar */}
                    <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
                      <button
                        onClick={() => setWizardStep(5)}
                        className="px-4 py-2 border border-slate-250 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-805 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors active:scale-95"
                      >
                        ← Back
                      </button>

                      <button
                        onClick={handleStart}
                        className="px-5 py-2.5 bg-emerald-555 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                      >
                        Launch Campaign 🚀
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 7: Live Campaign Progress dashboard */}
                {wizardStep === 7 && (
                  <div className="space-y-6">
                    {/* Live Campaign running dashboard bar controls */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-850 dark:text-white uppercase tracking-wider">
                          Campaign Progress Dashboard
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {isRunning && (
                          <button
                            onClick={handlePause}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg active:scale-95 transition-all shadow-sm"
                          >
                            Pause Campaign
                          </button>
                        )}
                        {isPausedState && (
                          <button
                            onClick={handleResume}
                            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg active:scale-95 transition-all shadow-sm"
                          >
                            Resume Campaign
                          </button>
                        )}
                        <button
                          onClick={handleStop}
                          className="px-3.5 py-1.5 border border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-rose-500 text-[11px] font-bold rounded-lg transition-all"
                        >
                          Stop Campaign
                        </button>
                      </div>
                    </div>

                    <DashboardStats />
                    <ProgressBar />
                    <LiveTimeline />
                  </div>
                )}

                {/* Step 8: Campaign Completed & Download Reports */}
                {wizardStep === 8 && (
                  <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm p-8 space-y-8 select-none">
                    
                    {/* Centered success notification bubble */}
                    <div className="flex flex-col items-center gap-3 text-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-sm animate-bounce">
                        <Check size={24} className="stroke-[3px]" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Campaign Completed!
                      </h3>
                      <p className="text-xs text-slate-455 leading-relaxed">
                        Your campaign has been completed successfully. Spreadsheet logs have been saved on local machine.
                      </p>
                    </div>

                    {/* Horizontal statistics cards list */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 rounded-xl text-center">
                        <p className="text-[9px] text-slate-450 uppercase font-bold tracking-wider">Total</p>
                        <p className="text-base font-bold text-slate-800 dark:text-white font-mono mt-0.5">{progress.total}</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 rounded-xl text-center">
                        <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Sent</p>
                        <p className="text-base font-bold text-emerald-500 font-mono mt-0.5">{progress.successCount}</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 rounded-xl text-center">
                        <p className="text-[9px] text-rose-500 uppercase font-bold tracking-wider">Failed</p>
                        <p className="text-base font-bold text-rose-500 font-mono mt-0.5">{progress.failedCount}</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 rounded-xl text-center">
                        <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Success Rate</p>
                        <p className="text-base font-bold text-emerald-500 font-mono mt-0.5">{progress.successRate}%</p>
                      </div>
                    </div>

                    {/* Download spreadsheet reports segments */}
                    <div className="space-y-4 max-w-2xl mx-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider text-center">
                        Download Reports
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <a
                          href={api.downloadReportUrl('sent')}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-555 bg-emerald-500/[0.01] flex items-center justify-center gap-2 font-bold text-xs text-emerald-500 transition-all hover:scale-[1.01]"
                        >
                          <Download size={14} className="shrink-0" />
                          Delivered (CSV)
                        </a>
                        <a
                          href={api.downloadReportUrl('failed')}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-rose-555 bg-rose-500/[0.01] flex items-center justify-center gap-2 font-bold text-xs text-rose-500 transition-all hover:scale-[1.01]"
                        >
                          <Download size={14} className="shrink-0" />
                          Failed (CSV)
                        </a>
                        <a
                          href={api.downloadReportUrl('summary')}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-555 bg-indigo-500/[0.01] flex items-center justify-center gap-2 font-bold text-xs text-indigo-500 transition-all hover:scale-[1.01]"
                        >
                          <Download size={14} className="shrink-0" />
                          Summary (JSON)
                        </a>
                        <a
                          href={api.downloadReportUrl('logs')}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-555 bg-slate-900 flex items-center justify-center gap-2 font-bold text-xs text-slate-350 transition-all hover:scale-[1.01]"
                        >
                          <Download size={14} className="shrink-0" />
                          Logs (TXT)
                        </a>
                      </div>
                    </div>

                    <div className="flex justify-center pt-4">
                      <button
                        onClick={handleResetForNewRun}
                        className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                      >
                        Start New Campaign ⭐️
                      </button>
                    </div>

                  </div>
                )}
              </motion.div>
            )}

            {/* -------------------- TEMPLATE EDITOR TAB VIEW -------------------- */}
            {activeTab === 'templates' && (
              <motion.div
                key="templates-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <TemplateEditor />
              </motion.div>
            )}

            {/* -------------------- SETTINGS FORM TAB VIEW -------------------- */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SettingsForm />
              </motion.div>
            )}

            {/* -------------------- RECENT CAMPAIGNS HISTORY TAB VIEW -------------------- */}
            {activeTab === 'history' && (
              <motion.div
                key="history-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 max-w-4xl"
              >
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Recent Campaigns History Logs
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-900 text-slate-450 text-[10px] font-bold uppercase border-b border-slate-200/80 dark:border-slate-800/80 select-none">
                          <th className="px-5 py-3">Date / Time</th>
                          <th className="px-5 py-3">Total contacts</th>
                          <th className="px-5 py-3">Delivered</th>
                          <th className="px-5 py-3">Failed</th>
                          <th className="px-5 py-3">Success Rate</th>
                          <th className="px-5 py-3 text-right">Reports</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60 text-xs font-semibold">
                        {campaignHistory.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-xs text-slate-400 italic">
                              No past campaigns recorded yet.
                            </td>
                          </tr>
                        ) : (
                          campaignHistory.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30">
                              <td className="px-5 py-3.5 text-slate-850 dark:text-slate-200 flex items-center gap-2">
                                <Calendar size={13} className="text-slate-400" />
                                {new Date(item.timestamp).toLocaleString()}
                              </td>
                              <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-slate-400">{item.total}</td>
                              <td className="px-5 py-3.5 text-emerald-500 font-mono">{item.success}</td>
                              <td className="px-5 py-3.5 text-rose-500 font-mono">{item.failed}</td>
                              <td className="px-5 py-3.5 font-mono text-slate-850 dark:text-white">{item.total > 0 ? Math.round((item.success / item.total) * 100) : 0}%</td>
                              <td className="px-5 py-3.5 text-right space-x-2">
                                <a
                                  href={api.downloadReportUrl('sent')}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-emerald-500 hover:underline"
                                >
                                  Delivered (CSV)
                                </a>
                                <a
                                  href={api.downloadReportUrl('failed')}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-rose-500 hover:underline font-semibold"
                                >
                                  Failed (CSV)
                                </a>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </div>

      </main>

      {/* Modals & Dialogs */}
      <QRModal />
      <Toaster position="bottom-right" richColors theme={theme === 'dark' ? 'dark' : 'light'} />
      
      <ConfirmationDialog
        isOpen={confirmStopOpen}
        title="Force Abort Campaign?"
        message="This immediately stops the automation run loop, destroys the running browser instance, and wipes active resume states. Proceed?"
        confirmText="Yes, Force Stop"
        cancelText="No, Keep Running"
        onConfirm={handleConfirmStop}
        onCancel={() => setConfirmStopOpen(false)}
        type="danger"
      />
    </div>
  );
}

export default App;
