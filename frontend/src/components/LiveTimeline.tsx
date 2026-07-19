import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Trash2, Download, Terminal, Search } from 'lucide-react';
import { api } from '../services/api';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export function LiveTimeline() {
  const progress = useStore((state) => state.progress);
  const logs = useStore((state) => state.logs);
  const clearLogs = useStore((state) => state.clearLogs);
  
  const [logSearch, setLogSearch] = useState('');
  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll logs console to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleDownloadLogs = () => {
    window.open(api.downloadReportUrl('logs'), '_blank');
  };

  // Recharts campaign breakdown data
  const chartData = [
    { name: 'Delivered', value: progress.successCount, color: '#10b981' },
    { name: 'Failed', value: progress.failedCount, color: '#f43f5e' },
    { name: 'Remaining', value: progress.remaining, color: '#64748b' }
  ].filter(item => item.value > 0 || (progress.total === 0 && item.name === 'Remaining'));

  // Fallback data when everything is empty
  const displayChartData = chartData.length > 0 ? chartData : [{ name: 'Queue Empty', value: 1, color: '#334155' }];

  const filteredLogs = logs.filter(log => 
    log.message.toLowerCase().includes(logSearch.toLowerCase())
  );

  const getStepClass = () => {
    if (progress.status === 'running' || progress.status === 'scanning_qr') {
      return 'border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/[0.01] text-emerald-500';
    }
    if (progress.status === 'paused') {
      return 'border-amber-500/30 dark:border-amber-500/20 bg-amber-500/[0.01] text-amber-500';
    }
    return 'border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10 text-slate-500';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Column: Terminal Console */}
      <div className="lg:col-span-2 bg-slate-950 border border-slate-900 rounded-xl p-5 flex flex-col h-[360px] shadow-lg relative overflow-hidden group">
        
        {/* Terminal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-3.5 mb-3 shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
              <Terminal size={13} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider">
                Live Timeline Console
              </h3>
              <p className="text-[9px] text-slate-500 font-medium">
                Auto-scrolling execution shell logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search filter inside console */}
            <div className="relative">
              <Search size={10} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-32 pl-7 pr-2 py-1.5 bg-slate-900/60 text-[10px] border border-slate-850 rounded-md focus:outline-none focus:border-emerald-500 text-slate-300 font-mono"
              />
            </div>
            
            <button
              onClick={handleDownloadLogs}
              className="p-2 border border-slate-850 bg-slate-900/40 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors active:scale-95"
              title="Download full log file"
            >
              <Download size={12} />
            </button>
            <button
              onClick={clearLogs}
              className="p-2 border border-slate-850 bg-slate-900/40 hover:bg-slate-900 text-slate-400 hover:text-rose-400 rounded-lg transition-colors active:scale-95"
              title="Clear screen buffer"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Console scrollbox */}
        <div className="flex-1 overflow-y-auto font-mono text-[10px] leading-relaxed text-emerald-450/90 space-y-1.5 pr-2 custom-scrollbar">
          {filteredLogs.length === 0 ? (
            <p className="text-slate-650 italic">
              {logSearch ? 'No logs match search filter.' : 'Console buffer empty. Initiate campaign to stream logs...'}
            </p>
          ) : (
            filteredLogs.map((log, idx) => {
              const isError = log.level === 'error';
              const isWarn = log.level === 'warn';
              const timestamp = new Date().toLocaleTimeString([], { hour12: false });
              return (
                <div 
                  key={idx} 
                  className={`flex items-start gap-2 ${
                    isError ? 'text-rose-400' : isWarn ? 'text-yellow-400' : 'text-emerald-400/90'
                  }`}
                >
                  <span className="text-slate-700 select-none">[{timestamp}]</span>
                  <span className="flex-1 break-all">{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>

      {/* Right Column: Mini Charts & Active step info */}
      <div className="lg:col-span-1 flex flex-col gap-5">
        
        {/* Connection/Step Box */}
        <div className={`border rounded-xl p-4 flex flex-col gap-3.5 transition-all shadow-sm ${getStepClass()}`}>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">
              Active Sub-Step
            </h4>
            <h2 className="text-lg font-bold leading-tight mt-1.5 tracking-tight">
              {progress.currentStep}
            </h2>
          </div>

          {progress.currentContact && (
            <div className="p-3 bg-white/40 dark:bg-slate-900/30 border border-current/10 rounded-lg text-xs space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                Contact Node:
              </p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <span>Name: {progress.currentContact.name}</span>
                <span className="font-mono">Phone: {progress.currentContact.phone}</span>
                <span>Retries: {progress.currentContact.retries}</span>
                <span>Status: {progress.currentContact.status}</span>
              </div>
            </div>
          )}
        </div>

        {/* Recharts Analytics Chart Box */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 shadow-sm flex flex-col items-center justify-center min-h-[160px]">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500 w-full mb-2">
            Delivery Breakdown
          </h4>
          
          <div className="w-full flex items-center justify-between gap-4">
            <div className="w-24 h-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={38}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {displayChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      fontSize: '10px', 
                      fontFamily: 'monospace', 
                      borderRadius: '8px',
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Chart Legend */}
            <div className="flex-1 space-y-1.5 text-[10px] font-bold">
              {displayChartData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-500 dark:text-slate-400 capitalize">{item.name}:</span>
                  <span className="text-slate-850 dark:text-white font-mono ml-auto">
                    {progress.total > 0 && item.name !== 'Queue Empty' ? item.value : 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default LiveTimeline;
