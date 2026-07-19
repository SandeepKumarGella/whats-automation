export interface Contact {
  id: string;
  name: string;
  phone: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
  errorReason: string | null;
  retries: number;
  duration: number | null;
}

export interface AutomationSettings {
  websiteUrl: string;
  delayMin: number;
  delayMax: number;
  batchSize: number;
  batchDelayMin: number;
  batchDelayMax: number;
  retryCount: number;
  pauseDuration: number;
  theme: 'light' | 'dark';
  messageTemplate: string;
  testMode: boolean;
  dryRunMode: boolean;
  debugMode?: boolean;
}

export interface AutomationProgress {
  status: 'idle' | 'connecting' | 'scanning_qr' | 'connected' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';
  total: number;
  completed: number;
  remaining: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  currentContact: Contact | null;
  currentStep: string;
  currentDelay: number;
  currentBatch: number;
  elapsedTime: number;
  eta: number;
  qrCodeUrl: string | null;
  contacts: Contact[];
}

export interface CSVValidationError {
  row: number;
  name: string;
  phone: string;
  reasons: string[];
}

export interface CSVReport {
  isValid: boolean;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  contacts: Contact[];
  errors: CSVValidationError[];
}

export interface CampaignHistoryItem {
  id: string;
  timestamp: string;
  filename: string;
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

export interface SavedTemplate {
  name: string;
  template: string;
}
