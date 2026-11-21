import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AdkawyLogo } from './AdkawyLogo';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { APP_VERSION } from '../utils/version';

interface EdkawySplashScreenProps {
  isLoading: boolean;
  statusText?: string;
  onAnimationComplete?: () => void;
}

export const EdkawySplashScreen: React.FC<EdkawySplashScreenProps> = ({
  isLoading,
  statusText = 'جارٍ التحقق من الجلسة ومزامنة البيانات الحية...',
  onAnimationComplete,
}) => {
  const [progress, setProgress] = useState(15);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      // Simulate smooth progress up to 90% while loading
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 88) return prev;
          const jump = Math.floor(Math.random() * 8) + 4;
          return Math.min(prev + jump, 88);
        });
      }, 250);
    } else {
      // Complete to 100% and finish
      setProgress(100);
      const finishTimer = setTimeout(() => {
        setIsFinishing(true);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }, 400);
      return () => clearTimeout(finishTimer);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLoading, onAnimationComplete]);

  return (
    <AnimatePresence>
      {!isFinishing && (
        <motion.div
          key="edkawy-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 sm:p-10 select-none overflow-hidden bg-gradient-to-b from-[#0F172A] via-[#1E293B] to-[#0A0F1D] text-white"
          dir="rtl"
        >
          {/* Ambient Glowing Orbs */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/4 -right-24 w-96 h-96 rounded-full bg-[#FF6B00]/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1/4 -left-24 w-96 h-96 rounded-full bg-[#FF6B00]/10 blur-3xl"
          />

          {/* Top Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="pt-4 flex items-center gap-2"
          >
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-orange-200 backdrop-blur-md shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>منصة مدينة إدكو الرقمية الموحدة</span>
            </span>
          </motion.div>

          {/* Center Brand Identity with Motion Animation */}
          <div className="flex flex-col items-center text-center space-y-6 max-w-sm px-4">
            <motion.div
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 20,
                delay: 0.1,
              }}
              className="relative p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-[0_0_50px_rgba(255,107,0,0.25)]"
            >
              <AdkawyLogo variant="stacked" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="space-y-1.5"
            >
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                أهلاً بك في تطبيق إدكاوي
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                مطاعم، صيدليات، متاجر، وتوصيل فوري لجميع أحياء إدكو
              </p>
            </motion.div>

            {/* Synchronized Progress Bar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="w-full space-y-2.5 pt-2"
            >
              <div className="w-full h-2.5 rounded-full bg-slate-800/80 p-0.5 overflow-hidden border border-white/10 shadow-inner">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF6B00] via-[#FF8533] to-[#FFA066] shadow-[0_0_12px_#FF6B00]"
                  initial={{ width: '10%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.3 }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
                <span className="truncate">{statusText}</span>
                <span className="font-mono tabular-nums text-orange-300 font-bold">
                  {progress}%
                </span>
              </div>
            </motion.div>
          </div>

          {/* Bottom Security & Version Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="pb-4 flex flex-col items-center gap-1 text-[11px] text-slate-400"
          >
            <div className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>اتصال سحابي آمن ومشفر بواسطة Firebase</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              إصدار التطبيق v{APP_VERSION} · موسم 1
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
