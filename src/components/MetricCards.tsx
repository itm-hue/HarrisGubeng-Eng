/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, UserRole } from '../types';
import { ClipboardList, CheckCircle2, AlertCircle, TrendingUp, Users, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

interface MetricCardsProps {
  tasks: Task[];
  currentUserRole: UserRole;
}

export default function MetricCards({ tasks, currentUserRole }: MetricCardsProps) {
  const totalCards = tasks.length;
  const completeCards = tasks.filter(t => {
    const s = (t.status || '').trim().toLowerCase();
    return s === 'complete' || s === 'selesai' || s === 'done';
  }).length;
  const pendingCards = tasks.filter(t => {
    const s = (t.status || '').trim().toLowerCase();
    return s === 'pending';
  }).length;

  const cardsSchema = [
    {
      id: 'total_logs_metric',
      title: 'TOTAL TASK LOGS',
      value: totalCards,
      subtitle: currentUserRole === 'USER' 
        ? 'Tugas terdaftar buatan Anda' 
        : currentUserRole === 'TEKNISI' 
          ? 'Semua tugas terdaftar Anda' 
          : 'Seluruh tugas hotel terdaftar',
      icon: ClipboardList,
      color: 'from-blue-600/10 to-blue-500/5 text-blue-400 border-blue-900/30'
    },
    {
      id: 'complete_logs_metric',
      title: 'TASK COMPLETE',
      value: completeCards,
      subtitle: 'Tugas diselesaikan / verified',
      icon: CheckCircle2,
      color: 'from-emerald-600/10 to-emerald-500/5 text-emerald-400 border-emerald-900/30'
    },
    {
      id: 'pending_logs_metric',
      title: 'LOGS PENDING',
      value: pendingCards,
      subtitle: 'Butuh tindakan perbaikan lanjutan',
      icon: AlertCircle,
      color: 'from-orange-600/15 to-orange-500/5 text-orange-400 border-orange-950/40'
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-5 mb-4 sm:mb-8" id="metric_cards_grid">
      {cardsSchema.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
            className={`p-2 sm:p-5.5 bg-slate-900/50 backdrop-blur-md border rounded-lg sm:rounded-2xl flex items-center justify-between shadow-lg shadow-black/10 relative overflow-hidden group ${card.color}`}
            id={card.id}
          >
            {/* Visual shine element */}
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-tr from-white/5 to-transparent rounded-full pointer-events-none group-hover:scale-125 transition-transform duration-500" />
            
            <div className="space-y-0.5 text-left min-w-0">
              <span className="text-[7.5px] xs:text-[9.5px] sm:text-[10px] font-bold tracking-wider xs:tracking-widest uppercase opacity-75 font-mono block truncate">
                {card.title.replace('TASK ', '')}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-base xs:text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {card.value}
                </span>
                <span className="text-[8px] sm:text-xs font-mono opacity-60">task</span>
              </div>
              <p className="text-[8px] sm:text-xs text-slate-400 line-clamp-1 hidden xs:block">
                {card.subtitle}
              </p>
            </div>

            <div className="p-1 sm:p-3.5 bg-slate-950/60 rounded sm:rounded-xl border border-slate-800/80 group-hover:bg-slate-950 transition-colors hidden xs:block shrink-0">
              <IconComponent className="w-3.5 h-3.5 sm:w-6 sm:h-6" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
