import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSettings } from '../hooks/useSettings';
import { useStore } from '../store/useStore';
import { 
  Settings as SettingsIcon, 
  Gauge,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import { AutomationSettings } from '../types/index';

export function SettingsForm() {
  const { 
    settings, 
    isLoading, 
    saveSettings, 
    isSaving 
  } = useSettings();

  const setWizardStep = useStore((state) => state.setWizardStep);
  const setActiveTab = useStore((state) => state.setActiveTab);

  const { register, handleSubmit, reset, setValue, watch } = useForm<AutomationSettings>();

  const currentTestMode = watch('testMode');
  const currentDryRunMode = watch('dryRunMode');
  const currentDebugMode = watch('debugMode');

  // Sync form inputs when settings are loaded/refetched
  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [settings, reset]);

  const onSubmit = (data: AutomationSettings) => {
    saveSettings(data);
    addToast('Settings configuration saved locally', 'success');
  };

  const addToast = useStore((state) => state.addToast);

  const handleToggle = (key: keyof AutomationSettings, currentValue: boolean) => {
    const newValue = !currentValue;
    setValue(key, newValue as any);
    const updatedData = { ...watch(), [key]: newValue };
    saveSettings(updatedData);
    const label = key === 'testMode' ? 'Test Mode' : key === 'dryRunMode' ? 'Dry Run Mode' : 'Debug Mode';
    addToast(`${label} ${newValue ? 'Enabled' : 'Disabled'}`, 'info');
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 2-Column Grid Layout matching Step 4 reference */}
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: General & Safety Settings */}
        <div className="space-y-6">
          
          {/* Card 1: General Settings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
              <Sliders size={14} className="text-emerald-500" />
              General Settings
            </h4>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                  Website URL
                </label>
                <input
                  type="url"
                  placeholder="https://sandeepweds.com"
                  {...register('websiteUrl')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                  Campaign Name
                </label>
                <input
                  type="text"
                  placeholder="Wedding Invitation"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Safety Settings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-805 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              Safety Settings
            </h4>

            <div className="space-y-4">
              
              {/* Test Mode */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Test Mode (First 3 Contacts)
                  </p>
                  <p className="text-[9px] text-slate-450 leading-relaxed">
                    Constrain dispatches to only the first 3 queue entries
                  </p>
                </div>
                
                {/* Switch Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggle('testMode', !!currentTestMode)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                    currentTestMode ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  <span className={`bg-white w-4 h-4 rounded-full shadow-sm transform duration-200 ${
                    currentTestMode ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Dry Run Mode */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Dry Run Mode (Do not send)
                  </p>
                  <p className="text-[9px] text-slate-450 leading-relaxed">
                    Simulates chats loading and typing text without clicking send
                  </p>
                </div>
                
                {/* Switch Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggle('dryRunMode', !!currentDryRunMode)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                    currentDryRunMode ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  <span className={`bg-white w-4 h-4 rounded-full shadow-sm transform duration-200 ${
                    currentDryRunMode ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Debug Mode */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Debug Mode (Tracing & Visual Inspection)
                  </p>
                  <p className="text-[9px] text-slate-450 leading-relaxed">
                    Generates Playwright traces, highlights elements, and saves diagnostic screenshots
                  </p>
                </div>
                
                {/* Switch Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggle('debugMode', !!currentDebugMode)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                    currentDebugMode ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  <span className={`bg-white w-4 h-4 rounded-full shadow-sm transform duration-200 ${
                    currentDebugMode ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Auto Retry Failed */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Auto Retry Failed
                  </p>
                  <p className="text-[9px] text-slate-450 leading-relaxed">
                    Automatically retries failed contacts before proceeding
                  </p>
                </div>
                
                {/* Switch Toggle */}
                <button
                  type="button"
                  className="w-9 h-5 flex items-center rounded-full p-0.5 bg-emerald-500 shrink-0"
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-sm transform translate-x-4" />
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Right Column: Timing & Other Settings */}
        <div className="space-y-6">
          
          {/* Card 3: Timing Settings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
              <Gauge size={14} className="text-emerald-500" />
              Timing Settings
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                  Min Delay (Seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  {...register('delayMin', { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                  Max Delay (Seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  {...register('delayMax', { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                  Batch Size (After N messages)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  {...register('batchSize', { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                  Batch Delay (Seconds)
                </label>
                <input
                  type="number"
                  min="10"
                  max="600"
                  {...register('batchDelayMin', { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Other Settings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-805 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
              <SettingsIcon size={14} className="text-emerald-500" />
              Other Settings
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                  Retry Failed Contacts
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  {...register('retryCount', { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-850 dark:text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                  Timeout (Seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  {...register('pauseDuration', { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-850 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

        </div>

      </form>

      {/* Stepper Wizard navigator bar */}
      <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
        <button
          onClick={() => {
            setWizardStep(3);
            setActiveTab('templates');
          }}
          className="px-4 py-2 border border-slate-250 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-805 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors active:scale-95"
        >
          ← Back
        </button>

        <div className="flex items-center gap-2">
          {/* Export / Import options can live here, or standard saves */}
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSaving}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-all"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
          
          <button
            onClick={() => {
              setWizardStep(5);
              setActiveTab('campaigns');
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-sm"
          >
            Next: Authenticate Session →
          </button>
        </div>
      </div>

    </div>
  );
}

export default SettingsForm;
