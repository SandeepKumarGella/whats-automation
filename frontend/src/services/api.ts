import axios from 'axios';
import { Contact, AutomationSettings, CSVReport, CampaignHistoryItem, SavedTemplate } from '../types/index';

const API_BASE = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const api = {
  // Settings endpoints
  getSettings: async (): Promise<AutomationSettings> => {
    const response = await apiClient.get<AutomationSettings>('/settings');
    return response.data;
  },

  saveSettings: async (settings: AutomationSettings): Promise<{ success: boolean; settings: AutomationSettings }> => {
    const response = await apiClient.post<{ success: boolean; settings: AutomationSettings }>('/settings', settings);
    return response.data;
  },

  backupSettingsUrl: () => `${API_BASE}/settings/backup`,

  restoreSettings: async (file: File): Promise<{ success: boolean; settings: AutomationSettings }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post<{ success: boolean; settings: AutomationSettings }>(
      `${API_BASE}/settings/restore`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  },

  // CSV endpoints
  uploadCSV: async (file: File): Promise<CSVReport> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post<CSVReport>(`${API_BASE}/csv/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Campaign History endpoints
  getCampaignHistoryIndex: async (): Promise<CampaignHistoryItem[]> => {
    const response = await apiClient.get<CampaignHistoryItem[]>('/history');
    return response.data;
  },

  getCampaignContacts: async (campaignId: string): Promise<Contact[]> => {
    const response = await apiClient.get<Contact[]>(`/history/${campaignId}`);
    return response.data;
  },

  // Automation controls
  startAutomation: async (contacts: Contact[], settings: AutomationSettings): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/automation/start', { contacts, settings });
    return response.data;
  },

  pauseAutomation: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/automation/pause');
    return response.data;
  },

  resumeAutomation: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/automation/resume');
    return response.data;
  },

  stopAutomation: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/automation/stop');
    return response.data;
  },

  connectAutomation: async (settings?: AutomationSettings): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/automation/connect', { settings });
    return response.data;
  },

  getResumeState: async (): Promise<{ hasResumeState: boolean; state: any }> => {
    const response = await apiClient.get<{ hasResumeState: boolean; state: any }>('/automation/resume-state');
    return response.data;
  },

  // Template Library Endpoints
  getSavedTemplates: async (): Promise<SavedTemplate[]> => {
    const response = await apiClient.get<SavedTemplate[]>('/templates');
    return response.data;
  },

  saveTemplate: async (name: string, template: string): Promise<{ success: boolean; name: string }> => {
    const response = await apiClient.post<{ success: boolean; name: string }>('/templates', { name, template });
    return response.data;
  },

  deleteTemplate: async (name: string): Promise<{ success: boolean; name: string }> => {
    const response = await apiClient.delete<{ success: boolean; name: string }>(`/templates/${name}`);
    return response.data;
  },

  // Report downloads helper url
  downloadReportUrl: (type: 'sent' | 'failed' | 'summary' | 'logs') => `${API_BASE}/reports/download/${type}`
};
