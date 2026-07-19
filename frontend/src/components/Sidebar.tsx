import { useStore } from '../store/useStore';
import { 
  LayoutDashboard,
  Rocket,
  FileCode2,
  History,
  Settings,
  MessageSquare,
  Sun,
  Moon
} from 'lucide-react';

export function Sidebar() {
  const activeTab = useStore((state) => state.activeTab);
  const setActiveTab = useStore((state) => state.setActiveTab);
  const wizardStep = useStore((state) => state.wizardStep);
  const setWizardStep = useStore((state) => state.setWizardStep);
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const progress = useStore((state) => state.progress);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'campaigns', label: 'Campaigns', icon: Rocket },
    { id: 'templates', label: 'Templates', icon: FileCode2 },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleTabClick = (tabId: string) => {
    // If campaign is active, prevent switching to avoid losing state
    const isRunning = progress.status === 'running' || progress.status === 'scanning_qr' || progress.status === 'paused';
    if (isRunning && tabId !== 'campaigns') {
      return;
    }

    setActiveTab(tabId);
    
    // Map tabs to corresponding stepper steps
    if (tabId === 'campaigns') {
      if (wizardStep === 3 || wizardStep === 4) {
        setWizardStep(1); // Reset to Step 1/2 campaigns flow
      }
    } else if (tabId === 'templates') {
      setWizardStep(3); // Message Editor
    } else if (tabId === 'settings') {
      setWizardStep(4); // Configurations
    }
  };

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <aside className="w-56 bg-[#0f172a] dark:bg-slate-950 text-slate-400 flex flex-col h-screen shrink-0 transition-all select-none">
      
      {/* Brand Header matching WA Automator logo */}
      <div className="p-5 flex items-center gap-2.5 border-b border-slate-800/50">
        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-[0_0_8px_rgba(16,185,129,0.3)]">
          <MessageSquare size={13} />
        </div>
        <div>
          <h1 className="font-bold text-xs text-white leading-none tracking-wide">
            WA Automator
          </h1>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          const isRunning = progress.status === 'running' || progress.status === 'scanning_qr' || progress.status === 'paused';
          const isDisabled = isRunning && tab.id !== 'campaigns';

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              disabled={isDisabled}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                isSelected
                  ? 'text-white bg-slate-800/60 border border-slate-700/30'
                  : isDisabled
                  ? 'text-slate-650 cursor-not-allowed opacity-30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              {isSelected && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-emerald-500 rounded-r-md transition-all duration-200" />
              )}
              
              <Icon size={14} className={isSelected ? 'text-emerald-450' : 'text-slate-450'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Theme Settings Toggle & User profile */}
      <div className="p-4 border-t border-slate-800/50 space-y-4">
        
        {/* Toggle Theme buttons */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span>Appearance</span>
          <button
            onClick={handleThemeToggle}
            className="p-1 border border-slate-800 hover:border-slate-750 bg-slate-900 rounded-lg hover:text-slate-200 transition-colors"
          >
            {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
          </button>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/30">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-350 border border-slate-750 shrink-0 font-bold text-xs">
            S
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-white truncate leading-none">
              Sandeep
            </p>
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block mt-1">
              Premium Plan
            </span>
          </div>
        </div>

      </div>
    </aside>
  );
}

export default Sidebar;
