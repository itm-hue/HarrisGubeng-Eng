/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useState } from 'react';
import { Task } from '../types';
import { jsPDF } from 'jspdf';
import { FileDown, Image as ImageIcon, Loader2 } from 'lucide-react';
import { parseImageUrls, getDirectDriveUrl } from '../lib/imageUtils';

interface PdfExportButtonProps {
  filteredTasks: Task[];
}

export default function PdfExportButton({ filteredTasks }: PdfExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  // Helper to convert an image URL or Base64 string into a base64 string and its dimensions that jsPDF can insert
  const getCleanBase64Image = (url: string): Promise<{ dataUrl: string; width: number; height: number; } | null> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }

      // Pre-process via getDirectDriveUrl which handles TASK_, base64, raw base64, Google Drive, and standard URLs beautifully
      const directUrl = getDirectDriveUrl(url);

      if (!directUrl) {
        resolve(null);
        return;
      }

      // 1. If already a base64 data URL, resolve immediately without redundant canvas steps
      if (directUrl.startsWith('data:')) {
        const img = new Image();
        img.onload = () => {
          resolve({
            dataUrl: directUrl,
            width: img.naturalWidth || img.width || 300,
            height: img.naturalHeight || img.height || 300
          });
        };
        img.onerror = () => {
          resolve({
            dataUrl: directUrl,
            width: 300,
            height: 300
          });
        };
        img.src = directUrl;
        return;
      }

      // 2. Normalize raw base64 format (if mime prefix is missing)
      const stripped = directUrl.trim();
      const isRawBase64 = stripped.startsWith('/9j/') || 
                          stripped.startsWith('iVBORw0K') || 
                          stripped.startsWith('R0lGOD') || 
                          (stripped.length > 500 && !stripped.includes(' ') && !stripped.includes('http') && !stripped.includes('.'));
      
      if (isRawBase64) {
        const mime = stripped.startsWith('iVBORw0K') ? 'image/png' : 'image/jpeg';
        const formatted = `data:${mime};base64,${stripped}`;
        resolve({
          dataUrl: formatted,
          width: 300,
          height: 300
        });
        return;
      }

      // 3. Robust HTTP/HTTPS url loading with multi-tier failover fallbacks
      let isResolved = false;
      
      // Safety timeout window
      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.warn('Image processing timed out for:', directUrl);
          resolve(null);
        }
      }, 10000);

      const handleSuccessBlob = (blob: Blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (isResolved) return;
          clearTimeout(timer);
          isResolved = true;
          
          const testImg = new Image();
          testImg.onload = () => {
            resolve({
              dataUrl: reader.result as string,
              width: testImg.naturalWidth || testImg.width || 300,
              height: testImg.naturalHeight || testImg.height || 300
            });
          };
          testImg.onerror = () => {
            resolve({
              dataUrl: reader.result as string,
              width: 300,
              height: 300
            });
          };
          testImg.src = reader.result as string;
        };
        reader.readAsDataURL(blob);
      };

      const tryMethodC = () => {
        if (isResolved) return;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          if (isResolved) return;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 300;
            canvas.height = img.naturalHeight || img.height || 300;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              clearTimeout(timer);
              isResolved = true;
              resolve({
                dataUrl,
                width: img.naturalWidth || img.width || 300,
                height: img.naturalHeight || img.height || 300
              });
            } else {
              throw new Error('Canvas 2D context is null');
            }
          } catch (canvasErr) {
            console.warn('Method C canvas failed, resolving null:', canvasErr);
            clearTimeout(timer);
            isResolved = true;
            resolve(null);
          }
        };

        img.onerror = () => {
          if (isResolved) return;
          console.warn('Method C image load failed, resolving null');
          clearTimeout(timer);
          isResolved = true;
          resolve(null);
        };

        img.src = directUrl;
      };

      const tryMethodB = () => {
        if (isResolved) return;
        const proxiedUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(directUrl)}`;
        
        fetch(proxiedUrl)
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP proxy returned ${response.status}`);
            return response.blob();
          })
          .then(handleSuccessBlob)
          .catch((err) => {
            console.warn('Method B fetch failed, trying Method C canvas fallback:', err);
            tryMethodC();
          });
      };

      // Method A: Direct Fetch (Great for CORS-friendly Google CDN 'lh3.googleusercontent.com')
      fetch(directUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP direct returned ${response.status}`);
          return response.blob();
        })
        .then(handleSuccessBlob)
        .catch((err) => {
          console.warn('Method A direct fetch failed, trying Method B proxy fallback:', err);
          tryMethodB();
        });
    });
  };

  const generatePdf = async () => {
    if (filteredTasks.length === 0) {
      alert('Tidak ada data task yang tersedia untuk diexport.');
      return;
    }

    setExporting(true);

    try {
      // Create new PDF (A4 Format Landscape: 297mm x 210mm)
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const itemsPerPage = 10;
      const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);

      // Loop over chunks of 10 tasks
      for (let pIdx = 0; pIdx < totalPages; pIdx++) {
        if (pIdx > 0) {
          doc.addPage();
        }

        const pageTasks = filteredTasks.slice(pIdx * itemsPerPage, (pIdx + 1) * itemsPerPage);

        // --- DRAW HEADER ---
        // Navy Blue Bar Top (width: 297mm for Landscape A4)
        doc.setFillColor(15, 30, 54); // #0F1E36 (Harris Navy)
        doc.rect(0, 0, 297, 26, 'F');

        // Header Title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('HARRIS GUBENG - MAINTENANCE TASK REPORT', 14, 11);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(255, 85, 0); // Harris Orange color
        doc.text('WORK ORDER DOCUMENTATION SUMMARY', 14, 16);

        doc.setTextColor(240, 240, 240);
        doc.setFontSize(8);
        const currentDate = new Date().toLocaleDateString('id-ID', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        doc.text(`Waktu Cetak: ${currentDate}`, 215, 11);
        doc.text(`Total Tasks: ${filteredTasks.length} record(s)`, 215, 16);

        // --- DRAW TABLE OF REC ---
        // Header Row
        let currentY = 32;
        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(10, currentY, 277, 8, 'F');
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.rect(10, currentY, 277, 8, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 30, 54);
        doc.text('No', 14.5, currentY + 5.5, { align: 'center' });
        doc.text('Tanggal/Jam', 19, currentY + 5.5);
        doc.text('Area & Lokasi', 51, currentY + 5.5);
        doc.text('Deskripsi Kerja', 82, currentY + 5.5);
        doc.text('Specialty & Tipe', 164, currentY + 5.5);
        doc.text('Teknisi', 211, currentY + 5.5, { align: 'center' });
        doc.text('Status', 237, currentY + 5.5, { align: 'center' });
        doc.text('Dokumentasi Foto', 267.5, currentY + 5.5, { align: 'center' });

        currentY += 8;

        // Rows content (max 10 rows, height 15mm per row)
        for (let i = 0; i < pageTasks.length; i++) {
          const task = pageTasks[i];
          const taskIndex = pIdx * itemsPerPage + i + 1;

          // Alt row colors
          if (i % 2 === 1) {
            doc.setFillColor(248, 250, 252); // slate-50
            doc.rect(10, currentY, 277, 15, 'F');
          }
          doc.setDrawColor(241, 245, 249);
          doc.rect(10, currentY, 277, 15, 'S');

          // Print text columns
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85); // slate-700

          // Number
          doc.text(taskIndex.toString(), 14.5, currentY + 8.5, { align: 'center' });

          // Date / Time / Shift
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(task.date || '', 19, currentY + 5.5);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139); // slate-500
          doc.text(`${task.start_time}-${task.end_time}`, 19, currentY + 9.5);
          doc.text(`Shift ${task.shift || '1'}`, 19, currentY + 13.0);
          doc.setTextColor(51, 65, 85);

          // Area & Lokasi
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(task.area_type || '', 51, currentY + 5.5);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          let detail = task.area_detail || '';
          if (detail.length > 22) detail = detail.substring(0, 19) + '...';
          doc.text(`[${detail}]`, 51, currentY + 9.5);
          doc.setTextColor(51, 65, 85);

          // Deskripsi Kerja (separated into its own spacious column with word wrap)
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          const desc = task.description || '';
          const descLines: string[] = doc.splitTextToSize(desc, 76);
          if (descLines.length > 1) {
            doc.text(descLines[0] || '', 82, currentY + 6.0);
            let line2 = descLines[1] || '';
            if (descLines.length > 2) {
              if (line2.length > 45) {
                line2 = line2.substring(0, 42) + '...';
              } else {
                line2 = line2 + '...';
              }
            }
            doc.text(line2, 82, currentY + 10.5);
          } else if (descLines.length === 1) {
            doc.text(descLines[0] || '', 82, currentY + 8.5);
          }

          // Specialty & Tipe Maintenance (with word wrap / clipping protection)
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          const specialtyText = task.specialty || '';
          const specLines: string[] = doc.splitTextToSize(specialtyText, 28);
          let specLine = specLines[0] || '';
          if (specLines.length > 1) {
            specLine = specLine.substring(0, Math.max(0, specLine.length - 3)) + '...';
          }
          doc.text(specLine, 164, currentY + 5.5);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(115, 115, 115);
          const mTypeText = task.maintenance_type || 'Corrective';
          const mTypeLines: string[] = doc.splitTextToSize(mTypeText, 28);
          let mTypeLine = mTypeLines[0] || '';
          if (mTypeLines.length > 1) {
            mTypeLine = mTypeLine.substring(0, Math.max(0, mTypeLine.length - 3)) + '...';
          }
          doc.text(mTypeLine, 164, currentY + 9.5);
          doc.setTextColor(51, 65, 85);

          // Technician (separated into its own spacious column with word wrap)
          doc.setFontSize(7.5);
          const techName = task.technician_name || '';
          const techLines: string[] = doc.splitTextToSize(techName, 26);
          if (techLines.length > 1) {
            doc.text(techLines[0] || '', 211, currentY + 6.0, { align: 'center' });
            doc.text(techLines[1] || '', 211, currentY + 10.5, { align: 'center' });
          } else if (techLines.length === 1) {
            doc.text(techLines[0] || '', 211, currentY + 8.5, { align: 'center' });
          }

          // Status (separated into its own spacious column)
          if (task.status === 'Complete') {
            doc.setTextColor(22, 101, 52); // solid green
            doc.setFont('helvetica', 'bold');
            doc.text('[DONE]', 237, currentY + 8.5, { align: 'center' });
          } else {
            doc.setTextColor(154, 52, 18); // solid orange/red pending
            doc.setFont('helvetica', 'bold');
            doc.text('[PENDING]', 237, currentY + 8.5, { align: 'center' });
          }
          doc.setTextColor(51, 65, 85);

          // --- MULTI-FOTO PROPORTIONAL DOCUMENTATION SUMMARY EMBED ---
          const urls = parseImageUrls(task.image_url);

          if (urls.length > 0) {
            const numImages = Math.min(urls.length, 3);
            const totalGalleryWidth = 36;
            const gap = 1.0;
            const maxW = (totalGalleryWidth - (numImages - 1) * gap) / numImages;
            const maxH = 12;

            for (let imgIdx = 0; imgIdx < numImages; imgIdx++) {
              const url = urls[imgIdx];
              const xSlot = 249.5 + imgIdx * (maxW + gap);
              const base64PicData = await getCleanBase64Image(url);

              if (base64PicData) {
                try {
                  const ratio = base64PicData.width / base64PicData.height;
                  let w = maxH * ratio;
                  let h = maxH;
                  if (w > maxW) {
                    w = maxW;
                    h = maxW / ratio;
                  }
                  // Center the proportional image within the current maxW x maxH slot box
                  const drawX = xSlot + (maxW - w) / 2;
                  const drawY = currentY + 1.5 + (maxH - h) / 2;

                  const imgFormat = base64PicData.dataUrl.toLowerCase().includes('image/png') ? 'PNG' : 'JPEG';
                  doc.addImage(base64PicData.dataUrl, imgFormat, drawX, drawY, w, h);
                } catch (err) {
                  // Fallback: draw fine warning rectangle
                  const emptyW = Math.min(maxW, 9);
                  const emptyH = Math.min(maxH, 10);
                  const drawX = xSlot + (maxW - emptyW) / 2;
                  const drawY = currentY + 1.5 + (maxH - emptyH) / 2;
                  doc.setDrawColor(249, 115, 22);
                  doc.rect(drawX, drawY, emptyW, emptyH, 'S');
                }
              } else {
                // Image not accessible / pending: draw placeholder
                const emptyW = Math.min(maxW, 9);
                const emptyH = Math.min(maxH, 10);
                const drawX = xSlot + (maxW - emptyW) / 2;
                const drawY = currentY + 1.5 + (maxH - emptyH) / 2;

                doc.setDrawColor(148, 163, 184); // slate-400
                doc.rect(drawX, drawY, emptyW, emptyH, 'S');
                doc.setFontSize(5);
                doc.setTextColor(148, 163, 184);
                doc.text(`[D${imgIdx + 1}]`, drawX + (emptyW - 4) / 2, drawY + emptyH / 2 + 1);
              }
            }
          } else {
            doc.setFontSize(7.5);
            doc.setTextColor(203, 213, 225); // slate-300
            doc.text('No Photo', 267.5, currentY + 8.5, { align: 'center' });
          }

          currentY += 15;
        }

        // --- DRAW FOOTER ---
        doc.setDrawColor(226, 232, 240);
        doc.line(10, 193, 287, 193);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Hotel Harris Gubeng • Jl. Bangka No.8-18, Gubeng, Surabaya', 10, 199);
        doc.text(`Halaman ${pIdx + 1} dari ${totalPages}`, 260, 199);
      }

      // Save the generated document
      doc.save(`Laporan_Task_Harris_Gubeng_${Date.now()}.pdf`);
    } catch (e) {
      console.error('Error generating tasks export PDF', e);
      alert('Terjadi error saat menghasilkan PDF. Silakan coba kembali.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={generatePdf}
      disabled={exporting}
      id="export_pdf_button"
      className="flex items-center gap-2 bg-[#0F1E36] hover:bg-[#183054] text-white hover:text-orange-400 active:bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-semibold cursor-pointer transition-all disabled:opacity-65"
    >
      {exporting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
          <span>Generating PDF Dokumentasi...</span>
        </>
      ) : (
        <>
          <FileDown className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
          <span>EXPORT TO PDF</span>
        </>
      )}
    </button>
  );
}
