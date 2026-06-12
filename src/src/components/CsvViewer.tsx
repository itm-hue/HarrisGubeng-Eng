/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Upload, FileCode, Search, ChevronLeft, ChevronRight, X, AlertTriangle, TableProperties } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CsvViewer() {
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse standard CSV with quotes and commas support
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
          // Escaped quote
          currentValue += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentValue.trim());
        currentValue = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n in \r\n
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
    
    // Add final column/row if any residuals remain
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
      setError('File yang diunggah wajib berformat .csv saja.');
      return;
    }

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setError('File kosong atau rusak.');
          return;
        }

        const rows = parseCSV(text);
        if (rows.length < 2) {
          setError('CSV minimal harus memiliki 1 baris header dan 1 baris data.');
          return;
        }

        // Split head and content
        setHeaders(rows[0]);
        setCsvData(rows.slice(1));
        setCurrentPage(1);
      } catch (err) {
        setError('Gagal mengurai file CSV. Format text mungkin rusak.');
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

  // Find date column index
  const dateColIdx = headers.findIndex(h => h.toLowerCase().includes('tanggal') || h.toLowerCase().includes('date') || h.toLowerCase() === 'tgl');

  // Filter csv lines support date range and text search query
  const filteredRows = csvData.filter((row) => {
    // 1. Text Search query filter
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      matchesSearch = row.some((col) => col.toLowerCase().includes(query));
    }

    // 2. Date Range filter (using Detected date column or default index 1)
    let matchesDateRange = true;
    const targetIdx = dateColIdx >= 0 ? dateColIdx : 1;
    const rowDateValue = row[targetIdx];

    if (rowDateValue) {
      const cleanedDate = rowDateValue.trim(); // Expecting YYYY-MM-DD
      if (startDate) {
        if (cleanedDate < startDate) matchesDateRange = false;
      }
      if (endDate) {
        if (cleanedDate > endDate) matchesDateRange = false;
      }
    }

    return matchesSearch && matchesDateRange;
  });

  // Paginated elements
  const totalRows = filteredRows.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  // Create demo data for quick review
  const loadDemoCsv = () => {
    const demoText = `ID Task,Tanggal,Waktu / Shift,Status,Area Kerja,Detail Lokasi,Keterangan Kerusakan,Tipe Maintenance,Specialty Kategori,Nama Teknisi,Link Foto / Bukti Gambar
125,2026-06-08,08:00 - 11:30 (Shift 1),Complete,Lobby Utama,Area Resepsionis,Kerusakan AC Bocor,Corrective Maintenance,AC & Pendingin,Budi Santoso,https://lh3.googleusercontent.com/d/1demo
126,2026-06-08,13:00 - 14:00 (Shift 2),Pending,Restaurant,Dapur Belakang,Penggantian MCB Trip,Corrective Maintenance,Kelistrikan,Adi Wijaya,https://lh3.googleusercontent.com/d/2demo
127,2026-06-15,09:15 - 10:30 (Shift 1),Complete,Ballroom 1,Ubud Lounge,Penggantian bohlam LED spot,Preventive Maintenance,Kelisitirkan,Budi Santoso,
128,2026-06-20,14:20 - 16:15 (Shift 2),Complete,Public Toilet,Toilet Lobby,Wastafel tersumbat kotoran rambut,Corrective Maintenance,Plumbing,Adi Wijaya,
129,2026-06-25,21:00 - 22:30 (Shift 3),Complete,Sky Lounge,Area Bar,Pembersihan filter Grease,Preventive Maintenance,Sipil,Adi Wijaya,`;
    
    const rows = parseCSV(demoText);
    setHeaders(rows[0]);
    setCsvData(rows.slice(1));
    setFileName('Arsip_Task_Harris_Gubeng_Backup.csv');
    setError('');
    setCurrentPage(1);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl" id="historical_csv_viewer">
      <div className="p-6 border-b border-slate-800 bg-slate-900">
        <div className="text-left">
          <h2 className="text-lg font-extrabold text-white tracking-wide">
            CSV WORK ORDER HISTORIC VIEWER
          </h2>
          <p className="text-xs text-slate-400">
            Unggah dan jelajahi arsip riwayat lama berformat .csv (koma terpisah) untuk analisa log masa lalu.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-850/40 text-red-300 rounded-2xl flex items-start gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Drop zone / Loader option */}
        {csvData.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Uploader Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-slate-800 hover:border-orange-500/40 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all text-center space-y-3"
              id="csv_drop_area"
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
              <div>
                <p className="text-xs font-bold text-slate-200">Klik untuk Pilih File CSV</p>
                <p className="text-[10px] text-slate-500 mt-1">Hanya mendukung format tabel berekstensi .csv</p>
              </div>
            </div>

            {/* Quick Demo loader box */}
            <div className="p-8 border border-slate-800 bg-slate-950/20 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-1.5 text-left">
                <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400 font-mono">
                  <TableProperties className="w-4 h-4" />
                  <span>PREVIEW DEMO ARSIP</span>
                </div>
                <p className="text-xs text-slate-300">
                  Belum memiliki file CSV siap pakai? Klik tombol di bawah untuk memuat simulasi data arsip kerja Hotel Harris Gubeng bulan lalu.
                </p>
              </div>
              <button
                type="button"
                onClick={loadDemoCsv}
                className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-750 text-slate-300 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                id="load_demo_csv_btn"
              >
                Muat Simulasi Arsip CSV
              </button>
            </div>
          </div>
        ) : (
          /* Active Spreadsheet Viewer */
          <div className="space-y-4" id="active_csv_grid">
            {/* Header info bar and search */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                  <FileCode className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs">{fileName}</h4>
                  <p className="text-[10px] text-slate-500">{totalRows} Baris logs terdeteksi</p>
                </div>
                <button
                  onClick={clearCsv}
                  className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg shrink-0 ml-1 cursor-pointer"
                  title="Tutup lembar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search filter input + Date Range filters */}
              <div className="flex flex-col md:flex-row items-center gap-3 w-full sm:w-auto">
                {/* Text search */}
                <div className="relative w-full sm:w-56">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Cari kata kunci..."
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-orange-500 text-white rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none placeholder-slate-500"
                    id="csv_internal_search"
                  />
                </div>

                {/* Date range filters */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-auto">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-slate-950/60 border border-slate-800 text-white text-[11px] rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500"
                      title="Rentang Tanggal Awal"
                    />
                  </div>
                  <span className="text-slate-550 text-xs text-slate-500 font-bold font-sans">s/d</span>
                  <div className="relative w-full sm:w-auto">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-slate-950/60 border border-slate-800 text-white text-[11px] rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500"
                      title="Rentang Tanggal Akhir"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        setCurrentPage(1);
                      }}
                      className="p-1 px-2.5 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-900/30 text-[10px] uppercase font-mono font-bold rounded-lg cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable grid representation */}
            <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/40">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="p-3.5 font-bold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-300">
                  {paginatedRows.length > 0 ? (
                    paginatedRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/45">
                        {row.map((col, cIdx) => (
                          <td key={cIdx} className="p-3.5 max-w-xs truncate font-sans">{col}</td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={headers.length} className="p-8 text-center text-slate-500">
                        Tidak ada log arsip yang cocok dengan kata kunci "{searchQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* CSV Pagination bar */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center bg-slate-950/20 p-3 rounded-xl border border-slate-850">
                <span className="text-[11px] text-slate-500">
                  Menampilkan {startIndex + 1} - {Math.min(startIndex + pageSize, totalRows)} dari {totalRows} records
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="p-1 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-450 text-[11px] disabled:opacity-40 cursor-pointer flex items-center gap-0.5"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                  <span className="text-[11px] text-slate-450 font-mono font-bold px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="p-1 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-450 text-[11px] disabled:opacity-40 cursor-pointer flex items-center gap-0.5"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
