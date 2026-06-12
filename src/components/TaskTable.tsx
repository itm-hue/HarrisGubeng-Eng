import React, { useState, useEffect } from 'react';
import { Task, TaskFilter, AreaMaster, CategoryMaster, User } from '../types';
import { Search, Eye, Edit3, Trash2, AlertCircle, RefreshCw, Smile, ArrowUpDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PdfExportButton from './PdfExportButton';
import CsvExportButton from './CsvExportButton';
import { getThumbnailUrl, parseImageUrls } from '../lib/imageUtils';
import SafeImage from './SafeImage';

interface TaskTableProps {
  tasks: Task[];
  areas: AreaMaster[];
  categories: CategoryMaster[];
  currentUser: User;
  onEditTask: (t: Task) => void;
  onDeleteTask: (tId: string) => Promise<void>;
  onViewDetails: (t: Task) => void;
  onApplyFilters: (f: TaskFilter) => void;
  loading: boolean;
}

const getCleanShortName = (imageUrlStr: string | null | undefined): string => {
  if (!imageUrlStr) return '';
  const parts = parseImageUrls(imageUrlStr);
  const firstPart = parts[0] || '';
  
  if (firstPart.includes('?file=')) {
    return firstPart.split('?file=')[1] || firstPart;
  }
  if (firstPart.includes('file=')) {
    return firstPart.split('file=')[1] || firstPart;
  }
  if (firstPart.startsWith('http')) {
    try {
      const url = new URL(firstPart);
      const fileParam = url.searchParams.get('file');
      if (fileParam) return fileParam;
      
      const fileIdParam = url.searchParams.get('id');
      if (fileIdParam) return fileIdParam;
    } catch {
      // Ignore
    }
    const slashParts = firstPart.split('/');
    return slashParts[slashParts.length - 1] || firstPart;
  }
  return firstPart;
};

const checkIfPendingToComplete = (task: Task): boolean => {
  if (task.status !== 'Complete') return false;
  const historyArray = Array.isArray(task.history) ? task.history : [];
  if (historyArray.length === 0) return false;
  
  // Check if any history entry has 'Pending' status
  return historyArray.some(h => h && h.status === 'Pending');
};

const gDriveFolderId = "1pGCKZQo45p7ZsFZiaEvknP8hyFsYtnhe";

export default function TaskTable({
  tasks,
  areas,
  categories,
  currentUser,
  onEditTask,
  onDeleteTask,
  onViewDetails,
  onApplyFilters,
  loading
}: TaskTableProps) {
  const [searchQuery, setSearchQuery] = useState(() => {
    return currentUser?.role?.toUpperCase() === 'USER' ? currentUser.fullname : '';
  });

  useEffect(() => {
    if (currentUser?.role?.toUpperCase() === 'USER') {
      setSearchQuery(currentUser.fullname);
    }
  }, [currentUser]);

  const [startDate, setStartDate] = useState(() => {
    // Default to today as set in parent App.tsx activeFilters
    return new Date().toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().substring(0, 10);
  });
  const [status, setStatus] = useState('All');
  const [area, setArea] = useState('All');
  const [category, setCategory] = useState('All');
  const [dateWarning, setDateWarning] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'tech'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const tasksPerPage = 7;
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isUserAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  useEffect(() => {
    const hasSearchOrAreaCat = searchQuery.trim() !== '' || area !== 'All' || category !== 'All';
    if (startDate && endDate && hasSearchOrAreaCat) {
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 31) {
        setDateWarning(true);
      } else {
        setDateWarning(false);
      }
    } else {
      setDateWarning(false);
    }
  }, [startDate, endDate, searchQuery, area, category]);

  const handleSearchTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyFilters({ searchQuery, startDate, endDate, status, area, category });
    setPage(1);
  };

  const handleMobileFormSubmit = (e: React.FormEvent) => {
    handleSearchTrigger(e);
    setIsMobileFilterOpen(false);
  };

  const resetFilters = () => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const defaultSearch = currentUser?.role?.toUpperCase() === 'USER' ? currentUser.fullname : '';
    setSearchQuery(defaultSearch);
    setStartDate(todayStr);
    setEndDate(todayStr);
    setStatus('All');
    setArea('All');
    setCategory('All');
    setDateWarning(false);
    onApplyFilters({
      searchQuery: defaultSearch,
      startDate: todayStr,
      endDate: todayStr,
      status: 'All',
      area: 'All',
      category: 'All'
    });
    setPage(1);
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(`${a.date}T${a.start_time}`).getTime();
      const dateB = new Date(`${b.date}T${b.start_time}`).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    } else {
      const nameA = (a.technician_name || '').toLowerCase();
      const nameB = (b.technician_name || '').toLowerCase();
      if (nameA < nameB) return sortOrder === 'desc' ? 1 : -1;
      if (nameA > nameB) return sortOrder === 'desc' ? -1 : 1;
      return 0;
    }
  });

  const totalTasks = sortedTasks.length;
  const totalPages = Math.ceil(totalTasks / tasksPerPage);
  const startIndex = (page - 1) * tasksPerPage;
  const paginatedTasks = sortedTasks.slice(startIndex, startIndex + tasksPerPage);

  const toggleSort = (field: 'date' | 'tech') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6" id="tasks_riwayat_directory">
      {/* FILTER PANEL DESKTOP */}
      <div className="hidden lg:block bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg shadow-black/10 relative overflow-hidden" id="desktop_filters_deck">
        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-full pointer-events-none" />
        <form onSubmit={handleSearchTrigger} className="space-y-5" id="task_filter_form">
          <div className="border-b border-slate-800/80 pb-3 flex justify-between items-center text-left">
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-wide">Cari data pekerjaan</h3>
              <p className="text-[11px] text-slate-400">Sesuaikan rentang tanggal, wilayah/kategori kerja, atau operator teknisi.</p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="text-[10px] text-orange-400 hover:text-orange-350 underline font-mono cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="filters_input_deck">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kata Kunci / Pencarian</label>
              <input
                type="text"
                value={searchQuery}
                disabled={currentUser?.role?.toUpperCase() === 'USER'}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Nama Teknisi / Kerusakan..."
                className={`w-full bg-slate-950/50 border border-slate-800 text-white rounded-xl py-2 px-4 text-xs focus:outline-none focus:border-orange-500 placeholder:text-slate-600 font-sans transition-all duration-150 ${
                  currentUser?.role?.toUpperCase() === 'USER' ? 'opacity-55 cursor-not-allowed select-none border-orange-500/20 text-orange-400 font-bold bg-slate-950/80' : ''
                }`}
                title={currentUser?.role?.toUpperCase() === 'USER' ? "Pencarian dikunci untuk hanya melihat pekerjaan Anda sendiri" : undefined}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tanggal Mulai</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 text-slate-300 font-mono rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tanggal Akhir</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 text-slate-300 font-mono rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kawasan Wilayah</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 text-slate-300 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="All" className="bg-slate-900 text-white">Semua Area</option>
                {areas?.map((a) => (
                  <option key={a.id} value={a.name} className="bg-slate-900 text-white">{a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kategori Kerja</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 text-slate-300 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="All" className="bg-slate-900 text-white">Semua Kategori</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.name} className="bg-slate-900 text-white">{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 text-slate-300 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="All" className="bg-slate-900 text-white">Semua Status</option>
                <option value="Pending" className="bg-slate-900 text-white">Pending</option>
                <option value="Complete" className="bg-slate-900 text-white">Selesai</option>
              </select>
            </div>
          </div>
          
          {dateWarning && (
            <div className="flex items-center gap-2 text-amber-500 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
              <span>Rentang pencarian lebih dari 31 hari berpotensi memperlambat pemuatan database.</span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800/60 flex justify-end gap-3.5">
            <button
              type="submit"
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 font-bold text-white text-xs py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Cari Sekarang</span>
            </button>
          </div>
        </form>
      </div>

      {/* FILTER PANEL MOBILE */}
      <div className="lg:hidden flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
        <div className="text-left">
          <h4 className="text-xs font-bold text-white tracking-widest uppercase font-mono">Pencarian & Filter</h4>
        </div>
        <button
          onClick={() => setIsMobileFilterOpen(true)}
          className="w-10 h-10 bg-[#0F1E36] text-orange-500 border border-slate-800 rounded-xl flex items-center justify-center shadow-md cursor-pointer"
        >
          <Search className="w-4 h-4 text-orange-500" />
        </button>
      </div>

      {/* TABLE DATA CONTAINER */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-3xl overflow-hidden shadow-lg shadow-black/15">
        <div className="p-3 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row gap-2.5 sm:gap-4 justify-between items-center bg-slate-950/20">
          <div className="text-left w-full sm:w-auto">
            <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase">HISTORY PEKERJAAN</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end">
            <div className="flex bg-slate-950 border border-slate-850 p-0.5 rounded-lg">
              <button
                onClick={() => toggleSort('date')}
                className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded text-[8.5px] sm:text-[10px] font-bold cursor-pointer ${
                  sortBy === 'date' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Tanggal</span>
                <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </button>
              <button
                onClick={() => toggleSort('tech')}
                className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded text-[8.5px] sm:text-[10px] font-bold cursor-pointer ${
                  sortBy === 'tech' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Teknisi</span>
                <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </button>
            </div>
            {isUserAdmin && (
              <div className="flex items-center gap-1">
                <PdfExportButton filteredTasks={sortedTasks} />
                <CsvExportButton filteredTasks={sortedTasks} />
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm font-bold text-slate-200">Menarik Data Realtime Database...</p>
          </div>
        ) : paginatedTasks.length === 0 ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
            <Smile className="w-7 h-7 text-slate-600" />
            <p className="text-sm font-bold text-slate-400">Belum Ada Task Terdaftar</p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE LAYOUT */}
            <div className="hidden lg:block overflow-x-auto font-sans">
              <table className="w-full text-left text-xs table-fixed min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-bold tracking-wider text-[10px]">
                    <th className="p-4 w-12 text-center">No</th>
                    <th className="p-4 w-36 font-medium">Tanggal / Jam</th>
                    <th className="p-4 w-44 font-medium">Area & Lokasi</th>
                    <th className="p-4 font-medium text-left">Deskripsi Kerja</th>
                    <th className="p-4 w-40 font-medium text-left">Specialty & Tipe</th>
                    <th className="p-4 w-36 font-medium">Teknisi</th>
                    <th className="p-4 w-24 text-center font-medium">Status</th>
                    <th className="p-4 w-32 text-center font-medium">Dokumentasi Foto</th>
                    <th className="p-4 w-28 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-300">
                  {paginatedTasks.map((t, idx) => {
                    const taskIndex = startIndex + idx + 1;
                    const isEditable = isUserAdmin || t.status === 'Pending';
                    const isPendingToComplete = checkIfPendingToComplete(t);
                    const rowClass = isPendingToComplete
                      ? "group border-b border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all duration-150"
                      : "group border-b border-slate-850/40 transition-all hover:bg-slate-950/15";
                    return (
                      <tr key={t.id} className={rowClass}>
                        <td className="p-4 text-center font-mono text-slate-400 text-xs">
                          {taskIndex}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <p className="font-bold font-mono text-slate-200 text-xs">{t.date}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5 flex flex-wrap gap-1.5 items-center">
                            <span>{t.start_time}-{t.end_time}</span>
                            <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/15 text-[9px] font-bold">Shift {t.shift}</span>
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-slate-200 break-words">{t.area_type}</p>
                          {t.area_detail && (
                            <p className="text-[10px] text-orange-400 font-mono font-bold break-words" title={t.area_detail}>
                              [{t.area_detail}]
                            </p>
                          )}
                        </td>
                        <td className="p-4 font-sans leading-relaxed text-slate-300 select-text">
                          <p className="whitespace-pre-wrap break-words text-xs leading-normal font-medium">
                            {t.description}
                          </p>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/15 max-w-full truncate" title={t.specialty || ''}>
                              {t.specialty || '-'}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 max-w-full truncate" title={t.maintenance_type || ''}>
                              {t.maintenance_type || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-300 font-medium whitespace-pre-wrap break-words">
                          {t.technician_name}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-[10px] ${
                                t.status === 'Complete'
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-orange-500/15 text-orange-400 border border-orange-500/15'
                              }`}
                            >
                              {t.status === 'Complete' ? 'Selesai' : 'Pending'}
                            </span>
                            {isPendingToComplete && (
                              <span className="text-[9px] font-extrabold text-amber-500 uppercase tracking-wider font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 text-center leading-none" title="Pekerjaan dimulai dari status Pending kemudian diperbarui menjadi Selesai.">
                                Update Selesai
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {t.image_url ? (
                            <div
                              onClick={() => onViewDetails(t)}
                              className="w-12 h-12 rounded-lg overflow-hidden border border-slate-800 mx-auto bg-black relative cursor-pointer hover:border-orange-500 duration-150 shrink-0 group animate-fade-in"
                              title="Klik untuk detail & foto lengkap"
                            >
                              <SafeImage
                                src={getThumbnailUrl(t.image_url)}
                                alt="Task Asset"
                                className="w-full h-full object-cover group-hover:scale-110 duration-200"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-slate-800/80 mx-auto bg-slate-950/50 flex items-center justify-center text-slate-600 shrink-0 select-none">
                              <span className="text-[9px] font-bold opacity-30 font-sans">NO PHOTO</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end items-center">
                            <button
                              onClick={() => onViewDetails(t)}
                              className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                              title="Tinjau Detail"
                            >
                              <Eye className="w-3.5 h-3.5 text-orange-500" />
                            </button>
                            <button
                              onClick={() => onEditTask(t)}
                              disabled={!isEditable}
                              className={`p-1.5 border rounded-xl ${
                                isEditable
                                  ? 'bg-slate-950 border-slate-850 text-slate-450 text-slate-400 hover:text-white cursor-pointer'
                                  : 'opacity-25 cursor-not-allowed border-slate-900 bg-slate-950/20'
                              }`}
                              title="Edit Pekerjaan"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {isUserAdmin && (
                              <button
                                onClick={() => setTaskToDelete(t)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-500 hover:text-red-400 rounded-xl cursor-pointer"
                                title="Hapus Permanen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE LAYOUT */}
            <div className="lg:hidden p-2.5 space-y-2.5" id="mobile_tasks_list">
              {paginatedTasks.map((t) => {
                const isEditable = isUserAdmin || t.status === 'Pending';
                const isPendingToComplete = checkIfPendingToComplete(t);
                const cardClass = isPendingToComplete
                  ? "p-3 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-2.5 flex flex-col justify-between text-left shadow-lg shadow-amber-500/5 pending-to-complete-card animate-fade-in"
                  : "p-3 rounded-xl bg-slate-950/40 border border-slate-850 space-y-2.5 flex flex-col justify-between text-left";
                return (
                  <div
                    key={t.id}
                    className={cardClass}
                  >
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-orange-500 font-mono tracking-tight block">LOG ID: {t.id}</span>
                        <p className="text-[10px] font-mono text-slate-400 font-semibold mt-0.5 flex flex-wrap gap-1 items-center">
                          <span>{t.date}</span>
                          <span className="text-[9px] text-slate-500">({t.start_time}-{t.end_time})</span>
                          <span className="px-1 py-0.2 rounded bg-orange-500/10 text-orange-400 border border-orange-500/15 text-[8px] font-bold">Shift {t.shift}</span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[9px] ${
                            t.status === 'Complete'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                              : 'bg-orange-500/10 text-orange-400 border border-orange-500/15'
                          }`}
                        >
                          {t.status === 'Complete' ? 'Selesai' : 'Pending'}
                        </span>
                        {isPendingToComplete && (
                          <span className="text-[8px] font-extrabold text-amber-500 uppercase tracking-wider font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/15">
                            Update Selesai
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      {t.image_url ? (
                        <div
                          onClick={() => onViewDetails(t)}
                          className="w-10 h-10 rounded overflow-hidden border border-slate-800 bg-black relative cursor-pointer hover:border-orange-500 duration-150 shrink-0 group animate-fade-in"
                          title="Klik untuk detail & foto lengkap"
                        >
                          <SafeImage
                            src={getThumbnailUrl(t.image_url)}
                            alt="Task Asset"
                            className="w-full h-full object-cover group-hover:scale-110 duration-200"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded border border-slate-800 bg-slate-950/50 flex items-center justify-center text-slate-600 shrink-0 select-none">
                          <span className="text-[8px] font-bold opacity-35 font-sans">NO</span>
                        </div>
                      )}
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex flex-wrap gap-1 mb-0.5 bg-[#091526]/40 p-1 rounded border border-slate-850/40 w-fit">
                          <span className="inline-block px-1 py-0.2 rounded text-[8px] font-bold bg-amber-500/10 text-amber-550 border border-amber-500/15">
                            Kategori: {t.specialty || '-'}
                          </span>
                          <span className="inline-block px-1 py-0.2 rounded text-[8px] font-bold bg-cyan-500/10 text-cyan-450 border border-cyan-500/15">
                            Tipe: {t.maintenance_type?.replace(' Maintenance', '') || '-'}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-100 truncate">
                          {t.area_type} <span className="text-[9.5px] text-slate-400 font-mono font-medium">({t.area_detail || '-'})</span>
                        </p>
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-normal">
                          {t.description}
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-850 flex justify-between items-center bg-[#0d1624]/20 -mx-3 -mb-3 p-2 sm:p-2.5 rounded-b-xl">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-[8px] font-bold text-slate-550 font-mono tracking-wider">TEKNISI:</span>
                        <span className="text-[9.5px] font-extrabold text-slate-300 truncate">{t.technician_name || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onViewDetails(t)}
                          className="w-7.5 h-7.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-lg flex items-center justify-center hover:border-orange-500 duration-150 cursor-pointer shadow-sm active:scale-95"
                          title="Tinjau Detail"
                        >
                          <Eye className="w-3.5 h-3.5 text-orange-500" />
                        </button>
                        <button
                          onClick={() => onEditTask(t)}
                          disabled={!isEditable}
                          className={`w-7.5 h-7.5 border rounded-lg flex items-center justify-center cursor-pointer shadow-sm active:scale-95 duration-100 ${
                            isEditable
                              ? 'bg-slate-900 border-slate-855 text-slate-300 hover:border-orange-500 hover:text-white'
                              : 'opacity-20 cursor-not-allowed border-slate-900 bg-slate-950/20 text-slate-550'
                          }`}
                          title="Edit Pekerjaan"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-orange-400" />
                        </button>
                        {isUserAdmin && (
                          <button
                            onClick={() => setTaskToDelete(t)}
                            className="w-7.5 h-7.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/30 rounded-lg flex items-center justify-center cursor-pointer active:scale-95 duration-100"
                            title="Hapus Permanen"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CONTROL PAGINATION */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 bg-slate-950/20 flex justify-between items-center text-xs">
                <span className="text-[11px] text-slate-500">Halaman {page} dari {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="p-1 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-400 disabled:opacity-30 cursor-pointer"
                  >
                    BACK
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="p-1 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-400 disabled:opacity-30 cursor-pointer"
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MOBILE FILTER DRAWER */}
      <AnimatePresence>
        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex justify-end bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="w-80 bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between"
            >
              <div className="space-y-6 text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Filter Pencarian</h3>
                  <button onClick={() => setIsMobileFilterOpen(false)} className="p-1 text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleMobileFormSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Kata Kunci</label>
                    <input
                      type="text"
                      value={searchQuery}
                      disabled={currentUser?.role?.toUpperCase() === 'USER'}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Nama teknisi / kerusakan..."
                      className={`w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs transition-all duration-150 ${
                        currentUser?.role?.toUpperCase() === 'USER' ? 'opacity-55 cursor-not-allowed select-none border-orange-500/20 text-orange-400 font-bold bg-slate-950/80' : ''
                      }`}
                      title={currentUser?.role?.toUpperCase() === 'USER' ? "Pencarian dikunci untuk hanya melihat pekerjaan Anda sendiri" : undefined}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tanggal Mulai</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2 px-3 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tanggal Akhir</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2 px-3 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Kawasan Wilayah</label>
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2 px-3 text-xs"
                    >
                      <option value="All">Semua Area</option>
                      {areas?.map((a) => (
                        <option key={a.id} value={a.name}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Kategori Kerja</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2 px-3 text-xs"
                    >
                      <option value="All">Semua Kategori</option>
                      {categories?.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2 px-3 text-xs"
                    >
                      <option value="All">Semua Status</option>
                      <option value="Pending">Pending</option>
                      <option value="Complete">Selesai</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-orange-500 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 mt-4 cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                    <span>Terapkan Filter</span>
                  </button>
                </form>
              </div>
              <button
                onClick={resetFilters}
                className="w-full py-2.5 border border-slate-800 text-slate-400 text-xs font-bold rounded-xl bg-slate-950 cursor-pointer"
              >
                Reset Semua Filter
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION DELETION MODAL */}
      <AnimatePresence>
        {taskToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-left space-y-4">
              <h3 className="text-sm font-bold text-slate-200">Konfirmasi Hapus</h3>
              <p className="text-xs text-slate-400">Apakah Anda yakin ingin menghapus permanen data task ini? Tindakan ini tidak dapat dibatalkan.</p>
              <div className="flex gap-2 pt-1 text-xs font-bold">
                <button
                  onClick={() => setTaskToDelete(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-slate-950 border border-slate-805 text-slate-400 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await onDeleteTask(taskToDelete.id);
                    } catch (e: any) {
                      alert(e?.message || e);
                    } finally {
                      setDeleting(false);
                      setTaskToDelete(null);
                    }
                  }}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
