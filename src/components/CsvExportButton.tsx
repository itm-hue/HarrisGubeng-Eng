/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Task } from '../types';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { parseImageUrls, getDirectDriveUrl } from '../lib/imageUtils';

interface CsvExportButtonProps {
  filteredTasks: Task[];
}

export default function CsvExportButton({ filteredTasks }: CsvExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const generateCsv = () => {
    if (filteredTasks.length === 0) {
      alert('Tidak ada data task yang tersedia untuk diexport.');
      return;
    }

    setExporting(true);

    try {
      const headers = [
        'No',
        'Tanggal',
        'Waktu / Shift',
        'Status',
        'Area Kerja',
        'Detail Lokasi',
        'Keterangan Kerusakan',
        'Tipe Maintenance',
        'Specialty Kategori',
        'Nama Teknisi',
        'Link Foto / Bukti Gambar'
      ];

      const csvRows = [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')];

      filteredTasks.forEach((task, idx) => {
        const timeStr = `${task.start_time || ''} - ${task.end_time || ''} (Shift ${task.shift || '1'})`;
        const imageUrlsString = parseImageUrls(task.image_url)
          .map(url => {
            const resolved = getDirectDriveUrl(url);
            if (resolved.startsWith('data:image/') || (resolved.length > 500 && !resolved.includes(' ') && !resolved.includes('http') && !resolved.includes('.'))) {
              return '[Foto Terkompresi di Database]';
            }
            return resolved;
          })
          .join(' ; ');
        const techName = task.co_technicians
          ? `${task.technician_name} (+ ${task.co_technicians})`
          : (task.technician_name || '');
        const row = [
          (idx + 1).toString(),
          task.date || '',
          timeStr,
          task.status || 'Pending',
          task.area_type || '',
          task.area_detail || '',
          task.description || '',
          task.maintenance_type || 'Corrective',
          task.specialty || '',
          techName,
          imageUrlsString
        ];

        const escapedRow = row.map(val => {
          const text = String(val);
          return `"${text.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        });

        csvRows.push(escapedRow.join(','));
      });

      const csvContent = '\uFEFF' + csvRows.join('\r\n'); // Add BOM for proper UTF-8 Excel parsing
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Task_Harris_Gubeng_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error generating CSV:', e);
      alert('Terjadi kesalahan saat mengekspor ke format CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={generateCsv}
      disabled={exporting}
      id="export_csv_button"
      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-emerald-700 text-[9px] sm:text-xs font-bold cursor-pointer transition-all disabled:opacity-65 active:scale-95 shadow-sm"
    >
      {exporting ? (
        <>
          <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin text-white" />
          <span className="text-[8.5px] sm:text-xs">CSV...</span>
        </>
      ) : (
        <>
          <FileSpreadsheet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
          <span>EXPORT CSV</span>
        </>
      )}
    </button>
  );
}
