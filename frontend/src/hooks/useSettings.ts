import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { AutomationSettings } from '../types/index';
import { useStore } from '../store/useStore';

export const useSettings = () => {
  const queryClient = useQueryClient();
  const addToast = useStore((state) => state.addToast);
  const setTheme = useStore((state) => state.setTheme);

  const { data: settings, isLoading, error } = useQuery<AutomationSettings>({
    queryKey: ['settings'],
    queryFn: api.getSettings
  });

  const saveSettingsMutation = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data.settings);
      setTheme(data.settings.theme);
      addToast('Configurations saved successfully', 'success');
    },
    onError: () => {
      addToast('Failed to save settings configurations', 'error');
    }
  });

  const restoreSettingsMutation = useMutation({
    mutationFn: api.restoreSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data.settings);
      setTheme(data.settings.theme);
      addToast('Settings configurations restored successfully', 'success');
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.error || 'Failed to restore configuration settings.';
      addToast(errMsg, 'error');
    }
  });

  return {
    settings,
    isLoading,
    error,
    saveSettings: saveSettingsMutation.mutate,
    isSaving: saveSettingsMutation.isPending,
    restoreSettings: restoreSettingsMutation.mutate,
    isRestoring: restoreSettingsMutation.isPending
  };
};
