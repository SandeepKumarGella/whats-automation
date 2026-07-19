import { useStore } from '../store/useStore';
import { QrCode, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function QRModal() {
  const progress = useStore((state) => state.progress);

  const isOpen = progress.status === 'scanning_qr' && !!progress.qrCodeUrl;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-6 text-center shadow-2xl space-y-5 relative z-10"
          >
            {/* Header */}
            <div className="flex flex-col items-center gap-2">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg">
                <QrCode size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                Scan WhatsApp QR Code
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                Open WhatsApp on your phone, navigate to Linked Devices, and link a device.
              </p>
            </div>

            {/* QR Code Container */}
            <div className="flex items-center justify-center p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-850 w-fit mx-auto relative group shadow-inner">
              <img
                src={progress.qrCodeUrl!}
                alt="WhatsApp Web QR Code"
                className="w-56 h-56 object-contain rounded-md select-none pointer-events-none"
              />
              {/* Spinning loading frame border */}
              <div className="absolute inset-0 border-2 border-emerald-500/35 dark:border-emerald-555/20 rounded-lg pointer-events-none animate-pulse" />
            </div>

            {/* Status alert */}
            <div className="flex items-center justify-center gap-2 text-xs text-amber-500 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg font-semibold">
              <ShieldAlert size={13} className="shrink-0" />
              Awaiting device registration...
            </div>

            <p className="text-[10px] text-slate-450 dark:text-slate-500">
              The dialog will close automatically once the session is successfully authenticated.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default QRModal;
