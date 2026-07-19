import { create } from 'zustand';
import { AutomationProgress, CSVReport } from '../types/index';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface AppStore {
  theme: string;
  activeTab: string;
  wizardStep: number;
  progress: AutomationProgress;
  logs: any[];
  contactsReport: CSVReport | null;
  toasts: ToastMessage[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: number) => void;
  setTheme: (theme: string) => void;
  setActiveTab: (activeTab: string) => void;
  setWizardStep: (wizardStep: number) => void;
  setProgress: (progress: AutomationProgress) => void;
  setContactsReport: (contactsReport: CSVReport | null) => void;
  updateContactStatus: (contactId: string, status: any) => void;
  addLog: (log: any) => void;
  clearLogs: () => void;
}

const getInitialTheme = (): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedPrefs = window.localStorage.getItem('color-theme');
    if (typeof storedPrefs === 'string') {
      return storedPrefs;
    }
    const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
    if (userMedia.matches) {
      return 'dark';
    }
  }
  return 'dark'; // default to dark mode
};

export const useStore = create<AppStore>((set) => ({
  theme: getInitialTheme(),
  activeTab: 'dashboard',
  wizardStep: 1,
  progress: {
    status: 'idle',
    total: 0,
    completed: 0,
    remaining: 0,
    successCount: 0,
    failedCount: 0,
    successRate: 0,
    currentContact: null,
    currentStep: 'Idle',
    currentDelay: 0,
    currentBatch: 0,
    elapsedTime: 0,
    eta: 0,
    qrCodeUrl: null,
    contacts: []
  },
  logs: [],
  contactsReport: null,
  toasts: [],

  addToast: (message, type = 'success') => {
    // Dynamically trigger sonner toast for modern SaaS alert look
    import('sonner').then(({ toast }) => {
      if (type === 'success') toast.success(message);
      else if (type === 'error') toast.error(message);
      else if (type === 'warning') toast.warning(message);
      else toast.info(message);
    });

    const id = Date.now();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setTheme: (theme) => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('color-theme', theme);
    set({ theme });
  },

  setActiveTab: (activeTab) => set({ activeTab }),

  setWizardStep: (wizardStep) => set({ wizardStep }),

  setProgress: (progress) => set({ progress }),

  setContactsReport: (contactsReport) => set({ contactsReport }),

  updateContactStatus: (contactId, status) => set((state) => {
    if (!state.contactsReport) return {};
    const updatedContacts = state.contactsReport.contacts.map((c) =>
      c.id === contactId ? { ...c, status } : c
    );
    return {
      contactsReport: {
        ...state.contactsReport,
        contacts: updatedContacts
      }
    };
  }),

  addLog: (log) => set((state) => {
    // Limit to last 300 logs for memory performance
    const newLogs = [...state.logs, log].slice(-300);
    return { logs: newLogs };
  }),

  clearLogs: () => set({ logs: [] })
}));
