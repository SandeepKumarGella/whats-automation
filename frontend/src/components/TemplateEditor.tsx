import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSettings } from '../hooks/useSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { Save, Send, Trash2, Plus } from 'lucide-react';
import { SavedTemplate } from '../types/index';

interface TemplateFormValues {
  messageTemplate: string;
}

export function TemplateEditor() {
  const { settings, saveSettings, isSaving, isLoading } = useSettings();
  const addToast = useStore((state) => state.addToast);
  const setWizardStep = useStore((state) => state.setWizardStep);
  const setActiveTab = useStore((state) => state.setActiveTab);
  const queryClient = useQueryClient();

  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');

  // Fetch saved templates library from backend
  const { data: savedTemplates = [] } = useQuery<SavedTemplate[]>({
    queryKey: ['savedTemplates'],
    queryFn: api.getSavedTemplates
  });

  const { register, handleSubmit, watch, setValue, getValues } = useForm<TemplateFormValues>({
    defaultValues: {
      messageTemplate: ''
    }
  });

  const template = watch('messageTemplate') || '';

  // Synchronize when settings are loaded
  useEffect(() => {
    if (settings) {
      setValue('messageTemplate', settings.messageTemplate || '');
    }
  }, [settings, setValue]);

  // Mutation to save active template
  const onSubmitActive = (data: TemplateFormValues) => {
    if (!settings) return;
    saveSettings({
      ...settings,
      messageTemplate: data.messageTemplate
    });
  };

  // Mutation to save a new template in the library
  const saveNewTemplateMutation = useMutation({
    mutationFn: ({ name, templateContent }: { name: string; templateContent: string }) => 
      api.saveTemplate(name, templateContent),
    onSuccess: (data) => {
      addToast(`Template "${data.name}" saved to library`, 'success');
      setNewTemplateName('');
      queryClient.invalidateQueries({ queryKey: ['savedTemplates'] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error || 'Failed to save template', 'error');
    }
  });

  // Mutation to delete a template from the library
  const deleteTemplateMutation = useMutation({
    mutationFn: (name: string) => api.deleteTemplate(name),
    onSuccess: (data) => {
      addToast(`Template "${data.name}" deleted`, 'info');
      setSelectedTemplateName('');
      queryClient.invalidateQueries({ queryKey: ['savedTemplates'] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error || 'Failed to delete template', 'error');
    }
  });

  const handleSaveAsNew = () => {
    const name = newTemplateName.trim();
    if (!name) {
      addToast('Please enter a template name', 'error');
      return;
    }
    const templateContent = getValues('messageTemplate') || '';
    saveNewTemplateMutation.mutate({ name, templateContent });
  };

  const handleLoadTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedTemplateName(name);
    if (!name) return;

    const matched = savedTemplates.find((t) => t.name === name);
    if (matched) {
      setValue('messageTemplate', matched.template);
      addToast(`Template "${name}" loaded`, 'info');
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedTemplateName) {
      addToast('Please select a template to delete', 'error');
      return;
    }
    if (window.confirm(`Are you sure you want to delete template "${selectedTemplateName}"?`)) {
      deleteTemplateMutation.mutate(selectedTemplateName);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = getValues('messageTemplate') || '';
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newText = before + variable + after;
    setValue('messageTemplate', newText);
    
    // Reset focus and cursor position after insert
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    }, 0);
  };

  // Compile preview by substituting placeholders
  const getCompiledPreview = () => {
    return template
      .replace(/{{name}}/g, 'Ravi Teja')
      .replace(/{{phone}}/g, '+919998776655')
      .replace(/{{websiteUrl}}/g, settings?.websiteUrl || 'https://sandeepweds.com');
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
      
      {/* Dual Column Workspace grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Editor Box */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-6 rounded-2xl shadow-sm flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Message Editor
            </h3>
          </div>

          {/* Variable Badges */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
              Insert Variables
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => insertVariable('{{name}}')}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {"{"}{"{"}name{"}"}{"}"}
              </button>
              <button
                type="button"
                onClick={() => insertVariable('{{phone}}')}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {"{"}{"{"}phone{"}"}{"}"}
              </button>
              <button
                type="button"
                onClick={() => insertVariable('{{websiteUrl}}')}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {"{"}{"{"}websiteUrl{"}"}{"}"}
              </button>
            </div>
          </div>

          {/* Text Area Template Editor */}
          <div className="space-y-1 relative">
            <textarea
              id="template-textarea"
              rows={8}
              placeholder="Compose your invitation details..."
              {...register('messageTemplate')}
              className="w-full p-4 bg-slate-50 dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl focus:outline-none leading-relaxed text-slate-800 dark:text-white"
            />
            <div className="absolute bottom-3 right-3 text-[10px] text-slate-450 dark:text-slate-500 font-mono font-bold uppercase select-none">
              Characters: {template.length}
            </div>
          </div>

          {/* Saved Template Selector and Save Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            
            {/* Library Selector */}
            <div className="flex items-center gap-1.5 max-w-[200px] w-full">
              <select
                value={selectedTemplateName}
                onChange={handleLoadTemplate}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 text-[11px] border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-750 dark:text-white"
              >
                <option value="">Load Template</option>
                {savedTemplates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              {selectedTemplateName && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={deleteTemplateMutation.isPending}
                  className="p-1.5 border border-rose-200 dark:border-rose-950/20 text-rose-500 hover:bg-rose-50 rounded-lg"
                  title="Delete Template"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {/* Save Template controls */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Template name..."
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 text-[11px] border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-800 dark:text-white w-28"
              />
              <button
                type="button"
                onClick={handleSaveAsNew}
                disabled={saveNewTemplateMutation.isPending}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg shrink-0 flex items-center gap-1"
              >
                <Plus size={10} />
                Save As New
              </button>
              <button
                type="button"
                onClick={handleSubmit(onSubmitActive)}
                disabled={isSaving}
                className="px-3.5 py-1.5 bg-emerald-555 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm"
              >
                <Save size={11} />
                Save Template
              </button>
            </div>

          </div>
        </div>

        {/* Right Column: Live Mockup Viewport */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-[300px] h-[520px] bg-slate-900 border-[8px] border-slate-950 rounded-[35px] shadow-2xl relative overflow-hidden flex flex-col">
            
            {/* Camera speaker notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-950 rounded-b-xl z-20 flex items-center justify-center">
              <span className="w-10 h-0.5 bg-slate-800 rounded-full" />
            </div>

            {/* Smartphone screen header */}
            <div className="bg-[#075e54] dark:bg-slate-850 text-white pt-6 pb-2.5 px-4 flex items-center gap-2.5 shrink-0 z-10 select-none">
              <div className="w-7 h-7 rounded-full bg-slate-200/20 text-slate-200 flex items-center justify-center font-bold text-xs uppercase">
                Rt
              </div>
              <div>
                <h4 className="text-[11px] font-bold">Ravi Teja</h4>
                <p className="text-[8px] opacity-75">online</p>
              </div>
            </div>

            {/* Chat bubble screen body */}
            <div 
              className="flex-1 p-3 overflow-y-auto space-y-3 flex flex-col justify-end bg-repeat"
              style={{ 
                backgroundColor: '#efeae2',
                backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                backgroundSize: '150px'
              }}
            >
              <div className="max-w-[90%] bg-white text-slate-850 text-[10px] p-2.5 rounded-xl rounded-tr-none shadow-sm ml-auto border-l-4 border-emerald-500 relative flex flex-col self-end">
                <span className="whitespace-pre-line leading-relaxed">
                  {template ? getCompiledPreview() : 'Compose message to preview.'}
                </span>
                <span className="text-[7px] text-slate-400 font-bold self-end mt-1">
                  10:20 AM
                </span>
              </div>
            </div>

            {/* Footer input mock */}
            <div className="p-2 bg-[#f0f2f5] dark:bg-slate-950 flex items-center gap-2 border-t border-slate-200/80 dark:border-slate-850 shrink-0 select-none">
              <div className="flex-1 bg-white dark:bg-slate-900 rounded-full py-1 px-3 text-[9px] text-slate-400 border border-slate-200 dark:border-slate-850">
                Type a message
              </div>
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Send size={10} />
              </div>
            </div>

          </div>
          <p className="text-[11px] text-slate-450 font-bold mt-4">
            Live Preview
          </p>
        </div>

      </div>

      {/* Stepper Wizard navigator bar */}
      <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
        <button
          onClick={() => {
            setWizardStep(2);
            setActiveTab('campaigns');
          }}
          className="px-4 py-2 border border-slate-250 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors active:scale-95"
        >
          ← Back
        </button>

        <button
          onClick={() => {
            setWizardStep(4);
            setActiveTab('settings');
          }}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-sm"
        >
          Next: Review Settings →
        </button>
      </div>

    </div>
  );
}

export default TemplateEditor;
