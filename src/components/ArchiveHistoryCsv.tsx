/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Search, ChevronLeft, ChevronRight, X, AlertTriangle, ExternalLink, Calendar, Trash2, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SafeImage from './SafeImage';
import { parseImageUrls, getDirectDriveUrl } from '../lib/imageUtils';

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzgygKvfwKLM6CU4FEe0tIxwupi9Aw_K-LtEjSS2SrbFWgFkK-5IPD0oHeAS_Emfsrr_Q/exec';

export default function ArchiveHistoryCsv() {
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDirectLink, setSelectedDirectLink] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to parse standard CSV rows correctly (supporting quotation nesting & commas)
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentValue = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"';
          i++; // Skip the next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentValue.trim());
        currentValue = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n in \r\n linebreaks
        }
        row.push(currentValue.trim());
        if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
          lines.push(row);
        }
        row = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    if (currentValue || row.length > 0) {
      row.push(currentValue.trim());
      lines.push(row);
    }

    return lines;
  };

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Format tidak sesuai. Silakan unggah berkas backup dalam format berekstensi .csv.');
      return;
    }

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setError('Berkas CSV kosong atau tidak terbaca.');
          return;
        }

        const rows = parseCSV(text);
        if (rows.length < 2) {
          setError('CSV minimal harus mempunyai baris header kolom dan minimal satu baris data.');
          return;
        }

        setHeaders(rows[0]);
        setCsvData(rows.slice(1));
        setCurrentPage(1);
      } catch (err) {
        setError('Gagal membaca format CSV. Coba periksa kesesuaian separator koma.');
      }
    };
    reader.readAsText(file);
  };

  const clearCsv = () => {
    setCsvData([]);
    setHeaders([]);
    setFileName('');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Dynamically spot column indexes for Date & Photo based on name aliases
  const dateColIdx = headers.findIndex((h) => {
    const lower = h.toLowerCase();
    return lower.includes('tanggal') || lower.includes('date') || lower === 'tgl';
  });

  const photoColIdx = headers.findIndex((h) => {
    const lower = h.toLowerCase();
    return lower.includes('foto') || lower.includes('gambar') || lower.includes('image') || lower.includes('bukti') || lower.includes('photo') || lower.includes('url');
  });

  // Extract a short filename from a database cell string
  const extractShortFilename = (val: string): string => {
    if (!val) return '';
    const parts = parseImageUrls(val);
    const firstVal = parts[0] || '';
    
    if (firstVal.includes('?file=')) {
      const part = firstVal.split('?file=')[1];
      if (part) return part.trim();
    }
    
    if (firstVal.startsWith('http')) {
      try {
        const urlObj = new URL(firstVal);
        const idParam = urlObj.searchParams.get('id');
        if (idParam) return idParam;
        return firstVal.substring(firstVal.lastIndexOf('/') + 1);
      } catch (e) {
        return firstVal.substring(firstVal.lastIndexOf('/') + 1);
      }
    }
    
    return firstVal;
  };

  // Helper to resolve cell strings to preview images and direct hotlinks
  const getBestImageUrlAndLink = (val: string) => {
    if (!val) return { imgUrl: '', directLink: '' };
    
    // Parse comma-separated URLs safely, keeping base64 commas intact
    const urls = parseImageUrls(val);
    const firstVal = urls[0]?.trim() || '';
    if (!firstVal) return { imgUrl: '', directLink: '' };

    const directUrl = getDirectDriveUrl(firstVal);
    
    // Base64 handling
    if (directUrl.startsWith('data:') || (directUrl.length > 500 && !directUrl.includes(' ') && !directUrl.includes('http') && !directUrl.includes('.'))) {
      const formatted = directUrl.startsWith('data:') ? directUrl : `data:image/jpeg;base64,${directUrl}`;
      return { imgUrl: formatted, directLink: '' }; // Keep directLink empty for base64 to avoid ERR_INVALID_URL
    }

    // Google Drive URL ID parsing via lh3 cdn
    if (directUrl.includes('lh3.googleusercontent.com/d/')) {
      const fileId = directUrl.split('/d/')[1]?.split('?')[0] || '';
      return {
        imgUrl: directUrl,
        directLink: fileId ? `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk` : directUrl
      };
    }

    // HTTP website link
    if (directUrl.startsWith('http://') || directUrl.startsWith('https://')) {
      return { imgUrl: directUrl, directLink: directUrl };
    }

    // Local TASK_ key format from offline storage fallback or App Scripts
    if (directUrl.startsWith('TASK_')) {
      if (typeof window !== 'undefined') {
        const cached = window.localStorage?.getItem('local_img_' + directUrl);
        if (cached) {
          return { imgUrl: cached, directLink: '' };
        }
      }
      const proxyUrl = `${GOOGLE_APPS_SCRIPT_URL}?file=${directUrl}`;
      return { imgUrl: proxyUrl, directLink: proxyUrl };
    }

    return { imgUrl: '', directLink: '' };
  };

  // Perform client-side text query filters & date bounds matching
  const filteredRows = csvData.filter((row) => {
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      matchesSearch = row.some((col) => col.toLowerCase().includes(query));
    }

    let matchesDateRange = true;
    const targetIdx = dateColIdx >= 0 ? dateColIdx : 1;
    const rowDateValue = row[targetIdx];

    if (rowDateValue && (startDate || endDate)) {
      const cleanedDate = rowDateValue.trim().substring(0, 10); // Handle full timestamp strings gracefully
      if (startDate && cleanedDate < startDate) matchesDateRange = false;
      if (endDate && cleanedDate > endDate) matchesDateRange = false;
    }

    return matchesSearch && matchesDateRange;
  });

  const totalRows = filteredRows.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  // Load standard Harris Gubeng demo database for demonstration/testing
  const loadDemoCsv = () => {
    const demoText = `ID Task,Tanggal,Waktu,Status,Area Kerja,Detail Lokasi,Keterangan Kerusakan,Tipe Maintenance,Kategori,Nama Teknisi,Foto / Bukti Gambar
101,2026-06-05,08:30 - 09:15,Complete,Lobby Utama,Area Lift,Bohlam LED Koridor mati,Corrective Maintenance,Kelistrikan,Budi Santoso,TASK_101_foto1_mainscreen.png
102,2026-06-05,10:00 - 11:15,Complete,Restaurant,Kran Wastafel,Kran air bocor halus,Corrective Maintenance,Plumbing,Adi Wijaya,TASK_102_foto1_kran.jpg
103,2026-06-12,13:30 - 15:00,Pending,Guest Room,Kamar 1024,AC panas hembusan angin lemah,Corrective Maintenance,AC & Pendingin,Budi Santoso,https://docs.google.com/uc?export=view&id=1pGCKZQo45p7ZsFZiaEvknP8hyFsYtnhe
104,2026-06-15,09:00 - 10:30,Complete,Meeting Room,Ubud Room,Pemetaan jalur stopkontak baru,Installation,Kelistrikan,Adi Wijaya,TASK_104_foto1_power.png
105,2026-06-18,14:00 - 16:30,Complete,Public Toilet,Toilet Lobby,Lubang floor drain mampet kotoran,Corrective Maintenance,Plumbing,Budi Santoso,`;
    
    const rows = parseCSV(demoText);
    setHeaders(rows[0]);
    setCsvData(rows.slice(1));
    setFileName('Arsip_Task_HarrisGubeng_Backup_Juni2026.csv');
    setError('');
    setCurrentPage(1);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl" id="archive_history_csv_root">
      {/* Header Info Banner */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-orange-500" />
            <span>ARSIP RIWAYAT LOGS (CSV VIEWER)</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Muat file backup .csv hasil ekspor sebelumnya. Proses penguraian aman berjalan murni pada memori browser (sisi klien).
          </p>
        </div>
        {csvData.length > 0 && (
          <button
            type="button"
            onClick={clearCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 rounded-xl text-[10px] font-mono font-bold uppercase cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Lembar</span>
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-950/30 border border-red-900/30 text-red-300 rounded-2xl flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {csvData.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Dragg Uploader zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-slate-800 hover:border-orange-500/30 bg-slate-950/35 hover:bg-slate-950/60 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all text-center space-y-3 shrink-0"
              id="csv_select_dropbox"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileLoad}
                accept=".csv"
                className="hidden"
              />
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 border border-slate-800">
                <Upload className="w-5 h-5 text-orange-500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-200">Pilih Berkas CSV Backup</p>
                <p className="text-[10px] text-slate-500">Ekstensi file yang didukung hanya berformat .csv saja</p>
              </div>
            </div>

            {/* Simulated Demo loader */}
            <div className="p-8 border border-slate-800 bg-slate-950/15 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-1.5 text-left">
                <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400 font-mono uppercase">
                  <Database className="w-4 h-4" />
                  <span>SIMULATOR DATA ARSIP</span>
                </div>
                <p className="text-xs text-slate-350 leading-relaxed font-sans">
                  Belum memiliki berkas hasil ekspor lokal? Klik tombol pratinjau acak di bawah ini untuk mensimulasikan file CSV riwayat perbaikan Harris Gubeng.
                </p>
              </div>
              <button
                type="button"
                onClick={loadDemoCsv}
                className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-750 text-slate-350 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                id="load_archives_demo_btn"
              >
                Muat Simulasi Log Masalalu
              </button>
            </div>
          </div>
        ) : (
          /* Active Spreadsheet Viewer Grid */
          <div className="space-y-5" id="active_historical_sheet">
            {/* Internal search filter and range */}
            <form onSubmit={(e) => e.preventDefault()} className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
              <div className="flex items-center gap-3 w-full xl:w-auto text-left">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs">{fileName}</h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{totalRows} Baris log berhasil difilter</p>
                </div>
              </div>

              {/* Filtering Deck */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-auto">
                {/* Free keywords search */}
                <div className="relative w-full">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Kata kunci filter..."
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-orange-500 text-white rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none placeholder-slate-600"
                  />
                </div>

                {/* Date Awal */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full bg-slate-950/50 border border-slate-800 text-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none font-mono focus:border-orange-500"
                    title="Tanggal Mulai"
                  />
                </div>

                {/* Date Akhir */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full bg-slate-950/50 border border-slate-800 text-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none font-mono focus:border-orange-500"
                    title="Tanggal Selesai"
                  />
                </div>
              </div>
            </form>

            {/* Scrollable grid Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/20">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] font-bold">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className={`p-4 ${hIdx === photoColIdx ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50 text-slate-300">
                  {paginatedRows.length > 0 ? (
                    paginatedRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-950/20 border-b border-slate-900 last:border-0">
                        {row.map((col, cIdx) => {
                          const isPhotoColumn = cIdx === photoColIdx;

                          if (isPhotoColumn) {
                            const { imgUrl, directLink } = getBestImageUrlAndLink(col);
                            if (imgUrl) {
                              return (
                                <td key={cIdx} className="p-4 text-center font-sans">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setSelectedImage(imgUrl);
                                      setSelectedDirectLink(directLink);
                                    }}
                                    className="inline-flex items-center gap-1 bg-orange-500/10 hover:bg-[#F50] text-[#FF5500] hover:text-white border border-orange-500/15 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase transition-all cursor-pointer focus:outline-none"
                                  >
                                    <span>Lihat Foto</span>
                                    <ExternalLink className="w-3 h-3 animate-pulse" />
                                  </button>
                                </td>
                              );
                            } else {
                              return (
                                <td key={cIdx} className="p-4 text-center text-slate-600 font-mono text-[10px] select-none">
                                  <span>- TIADA -</span>
                                </td>
                              );
                            }
                          }

                          return (
                            <td key={cIdx} className="p-4 max-w-xs truncate font-sans text-slate-300 font-medium">
                              {col || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={headers.length} className="p-16 text-center text-slate-500 font-medium italic">
                        Tidak ada log arsip backup yang memuaskan kriteria filter pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls footer */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center bg-slate-950/20 p-4 rounded-2xl border border-slate-850">
                <span className="text-[11px] text-slate-500 font-mono font-medium">
                  Menampilkan {startIndex + 1} - {Math.min(startIndex + pageSize, totalRows)} dari {totalRows} records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="p-1 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-bold disabled:opacity-30 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Sebelumnya</span>
                  </button>
                  <span className="text-[11px] text-slate-404 text-slate-400 font-mono font-bold px-1.5">
                    Halaman {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="p-1 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-bold disabled:opacity-30 cursor-pointer flex items-center gap-1"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lightbox / Image Preview Modal */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
              onClick={() => setSelectedImage(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-3.5 right-3.5 z-10">
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="p-2 rounded-full bg-slate-950/80 hover:bg-orange-600 text-slate-300 hover:text-white transition-all shadow-md cursor-pointer border border-slate-800/50 focus:outline-none"
                    title="Tutup"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider">Preview Bukti Gambar (Arsip)</span>
                  </div>
                  <div className="flex items-center gap-2 mr-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const urlToDownload = selectedDirectLink || selectedImage;
                        if (!urlToDownload) return;
                        
                        if (urlToDownload.startsWith('data:')) {
                          try {
                            const parts = urlToDownload.split(',');
                            const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
                            const bstr = atob(parts[1]);
                            let n = bstr.length;
                            const u8arr = new Uint8Array(n);
                            while (n--) {
                              u8arr[n] = bstr.charCodeAt(n);
                            }
                            const blob = new Blob([u8arr], { type: mime });
                            const blobUrl = URL.createObjectURL(blob);
                            
                            const link = document.createElement('a');
                            link.href = blobUrl;
                            link.download = `bukti_gambar_${Date.now()}.${mime.split('/')[1] || 'jpg'}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(blobUrl);
                          } catch (err) {
                            console.error('Failed to trigger base64 download:', err);
                            const link = document.createElement('a');
                            link.href = urlToDownload;
                            link.download = `bukti_gambar_${Date.now()}.jpg`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        } else {
                          window.open(urlToDownload, '_blank');
                        }
                      }}
                      className="px-3 py-1 text-[10px] uppercase font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 focus:outline-none"
                    >
                      <span>Download / Buka Baru</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="p-6 flex items-center justify-center bg-slate-950/40 min-h-[300px] max-h-[70vh] overflow-y-auto">
                  <SafeImage
                    src={selectedImage || ''}
                    alt="Detail Bukti Gambar"
                    className="max-w-full max-h-[60vh] object-contain rounded-lg border border-slate-850 shadow-inner"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
