import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  Clock, 
  Hourglass,
  Layers
} from 'lucide-react';

const formatSeconds = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [
    hrs.toString().padStart(2, '0'),
    mins.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
};

export function DashboardStats() {
  const progress = useStore((state) => state.progress);
  const wizardStep = useStore((state) => state.wizardStep);

  // If in step 7, render the 5 core cards as shown in the reference image (Frame 7)
  const isStep7 = wizardStep === 7;

  const stats = isStep7 
    ? [
        {
          title: 'Total Contacts',
          value: progress.total,
          subtitle: 'Active list size',
          icon: Users,
          borderClass: 'hover:border-slate-350 dark:hover:border-slate-800'
        },
        {
          title: 'Sent',
          value: progress.successCount,
          subtitle: 'Dispatched successfully',
          icon: CheckCircle2,
          borderClass: 'hover:border-emerald-500/30 dark:hover:border-emerald-500/20'
        },
        {
          title: 'Failed',
          value: progress.failedCount,
          subtitle: 'Dispatch errors',
          icon: XCircle,
          borderClass: 'hover:border-rose-500/30 dark:hover:border-rose-500/20'
        },
        {
          title: 'Remaining',
          value: progress.remaining,
          subtitle: 'Contacts left in queue',
          icon: Layers,
          borderClass: 'hover:border-slate-350 dark:hover:border-slate-800'
        },
        {
          title: 'Progress',
          value: `${progress.successRate}%`,
          subtitle: 'Completion percentage',
          icon: Percent,
          borderClass: 'hover:border-emerald-500/30 dark:hover:border-emerald-500/20'
        }
      ]
    : [
        {
          title: 'Total Contacts',
          value: progress.total,
          subtitle: `${progress.completed} processed, ${progress.remaining} left`,
          icon: Users,
          borderClass: 'hover:border-slate-300 dark:hover:border-slate-800'
        },
        {
          title: 'Delivered',
          value: progress.successCount,
          subtitle: 'Successful messages sent',
          icon: CheckCircle2,
          borderClass: 'hover:border-emerald-500/30 dark:hover:border-emerald-500/20'
        },
        {
          title: 'Failed',
          value: progress.failedCount,
          subtitle: 'Delivery failures',
          icon: XCircle,
          borderClass: 'hover:border-rose-500/30 dark:hover:border-rose-500/20'
        },
        {
          title: 'Success Rate',
          value: `${progress.successRate}%`,
          subtitle: 'Delivered / Processed',
          icon: Percent,
          borderClass: 'hover:border-teal-500/30 dark:hover:border-teal-500/20'
        },
        {
          title: 'Elapsed Time',
          value: formatSeconds(progress.elapsedTime),
          subtitle: 'Automation run time',
          icon: Clock,
          borderClass: 'hover:border-amber-500/30 dark:hover:border-amber-500/20'
        },
        {
          title: 'Time Remaining (ETA)',
          value: formatSeconds(progress.eta),
          subtitle: 'Estimated completion',
          icon: Hourglass,
          borderClass: 'hover:border-sky-500/30 dark:hover:border-sky-500/20'
        }
      ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 20 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={`grid gap-5 ${
        isStep7 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}
    >
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div 
            key={index}
            variants={itemVariants}
            className={`p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-start gap-4 transition-all duration-300 relative overflow-hidden group ${stat.borderClass}`}
          >
            {/* Minimal glowing top line on hover */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-slate-105 dark:bg-slate-800 group-hover:bg-emerald-500/40 transition-colors" />

            <div className="p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-805 bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 group-hover:text-slate-850 dark:group-hover:text-white transition-all shrink-0">
              <Icon size={16} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                {stat.title}
              </p>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 leading-none">
                {stat.value}
              </h3>
              <p className="text-[11px] text-slate-550 dark:text-slate-450 mt-1.5 font-medium leading-none">
                {stat.subtitle}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export { formatSeconds };
export default DashboardStats;
