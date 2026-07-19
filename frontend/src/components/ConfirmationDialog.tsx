import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'warning' | 'danger';
}

export function ConfirmationDialog({ 
  isOpen, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  onConfirm, 
  onCancel,
  type = 'warning'
}: ConfirmationDialogProps) {
  const isDanger = type === 'danger';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 shadow-2xl space-y-5 relative z-10"
          >
            {/* Warning Icon and Header */}
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 border rounded-lg shrink-0 ${
                isDanger 
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              }`}>
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-850 pt-4">
              <button
                onClick={onCancel}
                className="px-3 py-2 border border-slate-200 dark:border-slate-750 text-xs font-bold rounded-lg text-slate-600 dark:text-slate-350 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg text-white shadow-sm active:scale-95 transition-all ${
                  isDanger
                    ? 'bg-rose-550 hover:bg-rose-600'
                    : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default ConfirmationDialog;
