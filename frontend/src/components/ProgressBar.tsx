import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';

export function ProgressBar() {
  const progress = useStore((state) => state.progress);

  // Calculate progress percentage
  const percent = progress.total > 0 
    ? Math.round((progress.completed / progress.total) * 100) 
    : 0;

  const isAutomationActive = progress.status === 'running' || progress.status === 'scanning_qr';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-xl shadow-sm space-y-4 transition-colors duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
            Overall Progress Status
          </h4>
          {progress.currentContact ? (
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mt-1">
              Processing: <span className="text-emerald-500 font-bold">{progress.currentContact.name}</span>{' '}
              <span className="text-slate-400 font-mono text-xs">({progress.currentContact.phone})</span>
            </p>
          ) : (
            <p className="text-[13px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
              No contacts actively queueing
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-slate-800 dark:text-emerald-400 font-mono">
            {percent}%
          </span>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">
            {progress.completed} of {progress.total}
          </p>
        </div>
      </div>

      {/* Modern Progress Bar Track */}
      <div className="w-full bg-slate-100 dark:bg-slate-850 h-2 rounded-full overflow-hidden relative">
        <motion.div
          className="bg-emerald-500 dark:bg-emerald-400 h-full rounded-full relative"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {isAutomationActive && (
            <motion.div 
              className="absolute top-0 right-0 h-full w-2 bg-white/40 blur-xs rounded-full"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          )}
        </motion.div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
        <div>
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">
            Engine State
          </p>
          <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize mt-0.5 inline-block text-[12px]">
            {progress.status.replace('_', ' ')}
          </span>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">
            Active Delay
          </p>
          <span className={`font-semibold mt-0.5 inline-block text-[12px] ${progress.currentDelay > 0 ? 'text-amber-500 font-mono animate-pulse' : 'text-slate-450'}`}>
            {progress.currentDelay > 0 ? `Waiting ${progress.currentDelay}s` : 'None'}
          </span>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">
            Current Batch
          </p>
          <span className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5 inline-block text-[12px]">
            {progress.currentBatch} sent
          </span>
        </div>
      </div>
    </div>
  );
}

export default ProgressBar;
