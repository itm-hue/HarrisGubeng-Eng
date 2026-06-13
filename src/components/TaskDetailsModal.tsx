/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Task } from '../types';
import { X, Calendar, Clock, MapPin, Hammer, RefreshCw, ZoomIn, User, CircleDot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseImageUrls, getDirectDriveUrl } from '../lib/imageUtils';
import SafeImage from './SafeImage';

interface TaskDetailsModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
}

export default function TaskDetailsModal({ isOpen, task, onClose }: TaskDetailsModalProps) {
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);

  if (!isOpen || !task) return null;

  const rawParts = parseImageUrls(task.image_url);

  const imageUrls = Array.from(new Set(
    rawParts.map(getDirectDriveUrl)
  )).filter(url => url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/') || url.startsWith('blob:')));

  const history = Array.isArray(task.history) ? task.history.filter(Boolean) : [];

  let firstState: any = null;
  let lastState: any = null;

  // Point A: Initial pending creation
  if (history.length > 0) {
    firstState = history[0];
  } else {
    firstState = {
      status: 'Pending',
      updated_at: task.created_at || new Date().toISOString(),
      updated_by_nama: task.technician_name || 'Teknisi Awal',
      description: task.description,
      image_url: task.image_url,
      maintenance_type: task.maintenance_type,
      area_type: task.area_type,
      area_detail: task.area_detail,
      specialty: task.specialty,
      shift: task.shift,
      date: task.date,
      start_time: task.start_time,
      end_time: task.end_time
    };
  }

  // Point B: Last modification state (if edited or completed)
  if (history.length > 1) {
    lastState = history[history.length - 1];
  } else if (task.status === 'Complete') {
    lastState = {
      status: 'Complete',
      updated_at: task.created_at || new Date().toISOString(),
      updated_by_nama: task.technician_name || 'Teknisi',
      description: task.description,
      image_url: task.image_url,
      maintenance_type: task.maintenance_type,
      area_type: task.area_type,
      area_detail: task.area_detail,
      specialty: task.specialty,
      shift: task.shift,
      date: task.date,
      start_time: task.start_time,
      end_time: task.end_time
    };
  }

  const firstStatePhotos = firstState ? parseImageUrls(firstState.image_url).length : 0;
  const lastStatePhotos = lastState ? parseImageUrls(lastState.image_url).length : parseImageUrls(task.image_url).length;
  const addedPhotosCount = lastStatePhotos > firstStatePhotos ? (lastStatePhotos - firstStatePhotos) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-8"
        id="task_detail_modal_container"
      >
        {/* Header Ribbon */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-900 flex justify-between items-center bg-gradient-to-r from-slate-900 via-slate-900 to-orange-950/20">
          <div className="flex items-center gap-3">
            <span className={`w-3.5 h-3.5 rounded-full ring-4 ${
              task.status === 'Complete'
                ? 'bg-emerald-500 ring-emerald-500/20'
                : 'bg-orange-500 ring-orange-500/20'
            }`} />
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                DETAIL LAPORAN WORK ORDER
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Log ID: {task.id} • Status: {task.status === 'Complete' ? 'Selesai (Verifikasi)' : 'Dalam Antrean Pending'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full cursor-pointer transition-colors"
            id="close_detail_btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal content area */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]" id="detail_modal_body">
          {/* Main Visual Image Documentation with Zoom feature */}
          {imageUrls.length > 0 ? (
            <div className="space-y-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                Dokumentasi Lapangan ({imageUrls.length} Foto Lampiran)
              </span>
              <div className="grid grid-cols-3 gap-3">
                {imageUrls.map((url, index) => (
                  <div
                    key={index}
                    className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 h-24 group cursor-pointer"
                    onClick={() => setZoomIdx(zoomIdx === index ? null : index)}
                  >
                    <SafeImage
                      src={url}
                      alt={`Dokumentasi ${index + 1}`}
                      className="w-full h-full object-cover transition-all group-hover:scale-105"
                    />
                    <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-mono text-orange-400 border border-slate-800 flex items-center gap-1">
                      <ZoomIn className="w-2.5 h-2.5" />
                      <span>#{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Expanded zoom view if any is selected */}
              {zoomIdx !== null && imageUrls[zoomIdx] && (
                <div className="relative rounded-2xl overflow-hidden border border-slate-805 bg-black p-2 mt-2">
                  <SafeImage
                    src={imageUrls[zoomIdx]}
                    alt={`Zoom Dokumentasi ${zoomIdx + 1}`}
                    className="w-full max-h-96 object-contain"
                  />
                  <div className="absolute top-4 left-4 bg-black/75 px-3 py-1 rounded-lg text-[10px] text-orange-400 font-mono border border-slate-800">
                    Foto #{zoomIdx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => setZoomIdx(null)}
                    className="absolute top-4 right-4 bg-black/85 hover:bg-slate-900 border border-slate-800 p-1.5 rounded-full text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-950/30 flex flex-col items-center justify-center space-y-2">
              <CircleDot className="w-7 h-7 text-slate-600 animate-pulse" />
              <div>
                <p className="text-xs font-semibold text-slate-400">Tidak Ada Foto Terlampir</p>
                <p className="text-[10px] text-slate-600">Teknisi tidak menyertakan foto dokumentasi saat mengerjakan task.</p>
              </div>
            </div>
          )}

          {/* Gridded Info Deck */}
          <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
            {/* Date */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                <span>Tanggal</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">{task.date}</p>
            </div>

            {/* Time Frame */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                <Clock className="w-3.5 h-3.5 text-orange-500" />
                <span>Durasi Kerja</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">
                {task.start_time} - {task.end_time} <span className="text-[10px] text-slate-400">(Shift {task.shift})</span>
              </p>
            </div>

            {/* Area */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                <span>Lokasi Area</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">
                {task.area_type} <span className="text-[10px] text-orange-400 font-mono font-bold">[{task.area_detail || 'Umum'}]</span>
              </p>
            </div>

            {/* Specialty Kategori */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                <Hammer className="w-3.5 h-3.5 text-orange-500" />
                <span>Specialty Kategori</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">{task.specialty}</p>
            </div>

            {/* Maintenance Type */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                <RefreshCw className="w-3.5 h-3.5 text-orange-500" />
                <span>Tipe Maintenance</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">{task.maintenance_type || 'Corrective'}</p>
            </div>

            {/* Operator Team */}
            <div className="space-y-1" id="details_operator_box">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                <User className="w-3.5 h-3.5 text-orange-500" />
                <span>Dikerjakan Oleh</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">
                {task.technician_name}
              </p>
              {task.co_technicians && (
                <div className="pt-0.5" id="details_co_technicians_sub">
                  <span className="text-[9.5px] font-bold text-orange-400/90 bg-orange-500/10 border border-orange-500/15 py-0.5 px-1.5 rounded-md inline-block">
                    Bersama: {task.co_technicians}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline / Chronology Section */}
          <div className="space-y-3 pt-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
              Kronologi & Riwayat Tindakan (Timeline)
            </span>
            
            <div className="relative pl-5 border-l-2 border-slate-800 space-y-6">
              {/* Point 1: Pertama kali dibuat (Kondisi Awal) */}
              {firstState && (
                <div className="relative">
                  {/* Bubble Point Indicator icon */}
                  <span className="absolute -left-[27px] top-1 w-3 h-3 bg-slate-900 border-2 border-orange-500 rounded-full z-10" />
                  
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-extrabold text-white">1. KONDISI AWAL (PENDING CREATION)</span>
                      <span className="bg-orange-500/10 text-orange-400 border border-orange-950/40 text-[9px] uppercase px-1.5 py-0.5 rounded font-bold">
                        {firstState.status || 'Pending'}
                      </span>
                    </div>
                    
                    <p className="text-[10px] text-slate-400 font-mono">
                      Tanggal: {firstState.date || task.date} • {firstState.start_time || task.start_time} - {firstState.end_time || task.end_time} ({firstState.shift ? `Shift ${firstState.shift}` : `Shift ${task.shift}`})
                    </p>
                    
                    <div className="p-3 bg-slate-950/60 border border-slate-850/80 rounded-xl text-xs text-slate-300 whitespace-pre-wrap break-all break-words leading-relaxed font-sans shadow-inner overflow-hidden">
                      {firstState.description || task.description}
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                      <User className="w-3 h-3 text-orange-500/75" />
                      <span>Dibuat Oleh: <strong className="text-slate-300">{firstState.updated_by_nama || task.technician_name}</strong></span>
                      {firstState.updated_at && (
                        <span> pada {new Date(firstState.updated_at).toLocaleString('id-ID')}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Point 2: Terakhir diedit (Kondisi Akhir / Terkini) */}
              {lastState ? (
                <div className="relative pt-2">
                  <span className="absolute -left-[27px] top-3 w-3.5 h-3.5 bg-emerald-505 bg-emerald-500 rounded-full border-2 border-slate-900 ring-4 ring-emerald-500/25 z-10 animate-pulse" />
                  
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-extrabold text-white uppercase">2. TIPE PROSES AKHIR (LAST UPDATE)</span>
                      <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                        lastState.status === 'Complete'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-900/30'
                          : 'bg-orange-500/15 text-orange-400 border border-orange-950/30'
                      }`}>
                        {lastState.status}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 font-mono">
                      Tanggal Edit: {lastState.date || task.date} • {lastState.start_time || task.start_time} - {lastState.end_time || task.end_time} ({lastState.shift ? `Shift ${lastState.shift}` : `Shift ${task.shift}`})
                    </p>

                    <div className="p-3 bg-slate-950/60 border border-slate-850/80 rounded-xl text-xs text-slate-300 whitespace-pre-wrap break-all break-words leading-relaxed font-sans shadow-inner overflow-hidden">
                      {lastState.description}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                      <User className="w-3 h-3 text-emerald-500/75" />
                      <span>Terakhir Diedit Oleh: <strong className="text-slate-300">{lastState.updated_by_nama}</strong></span>
                      {lastState.updated_at && (
                        <span> pada {new Date(lastState.updated_at).toLocaleString('id-ID')}</span>
                      )}
                    </div>

                    {addedPhotosCount > 0 && (
                      <div className="mt-2 p-2.5 bg-sky-950/40 border border-sky-800/40 text-sky-450 rounded-xl flex flex-col gap-0.5 shadow-inner">
                        <span className="text-[10px] font-extrabold text-sky-400 font-mono">
                          ➕ Ada Penambahan Foto Lampiran pada Dokumentasi #2 / #3
                        </span>
                        {lastState.updated_at && (
                          <span className="text-[9px] text-slate-500 font-mono">
                            Diedit pukul {new Date(lastState.updated_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})} WIB
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative pt-2">
                  {/* Placeholder dotted point */}
                  <span className="absolute -left-[27px] top-3 w-3 h-3 bg-slate-900 border-2 border-slate-700 border-dotted rounded-full z-10" />
                  
                  <div className="p-3.5 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl text-left">
                    <p className="text-[11px] font-bold text-slate-400">Belum Ada Tindakan Kelanjutan</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Task ini masih berada dalam status orisinal sejak pertama kali dilaporkan.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal footer back actions */}
        <div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="py-2.5 px-6 bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold rounded-xl cursor-pointer shadow transition-all active:scale-95"
            id="close_details_footer_btn"
          >
            Selesai Meninjau
          </button>
        </div>
      </motion.div>
    </div>
  );
}
