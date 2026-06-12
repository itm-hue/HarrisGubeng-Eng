/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, AreaMaster, CategoryMaster, MaintenanceTypeMaster, User, ImageAttachment } from '../types';
import { dbService } from '../lib/supabase';
import { X, Upload, Camera, FileImage, ClipboardCheck, Clock, Loader2, RefreshCw, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseImageUrls } from '../lib/imageUtils';
import SafeImage from './SafeImage';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Omit<Task, 'id' | 'created_at'> & { id?: string }, imageAttachments: ImageAttachment[]) => Promise<void>;
  taskToEdit?: Task | null;
  areas: AreaMaster[];
  categories: CategoryMaster[];
  maintenanceTypes?: MaintenanceTypeMaster[];
  currentUser: User;
}

export default function TaskFormModal({
  isOpen,
  onClose,
  onSave,
  taskToEdit,
  areas,
  categories,
  maintenanceTypes = [],
  currentUser
}: TaskFormModalProps) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [areaType, setAreaType] = useState('');
  const [areaDetail, setAreaDetail] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [shift, setShift] = useState<'1' | '2' | '3'>('1');
  const [maintenanceType, setMaintenanceType] = useState('Corrective');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Pending');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Multi-image attachments structures
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);

  // Image Uploading specific states
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Cache to store heavy Base64 image strings off React state to prevent slow render and hangs
  const base64CacheRef = useRef<Record<string, string>>({});

  // Real WebRTC Live Camera configuration states & refs
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async (facing: 'environment' | 'user' = 'environment') => {
    setCameraLoading(true);
    setCameraError(null);
    
    // Stop any existing stream before request
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
      setCameraStream(null);
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1024 },
          height: { ideal: 768 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        "Gagal mengakses Kamera Live secara langsung. Silakan berikan izin akses kamera pada browser Anda, atau gunakan file input fallback."
      );
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
      setCameraStream(null);
    }
    setIsLiveCameraOpen(false);
  };

  // Sync stream lifecycle with open/close state
  useEffect(() => {
    if (isLiveCameraOpen) {
      startCamera(cameraFacingMode);
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
          try { track.stop(); } catch(e) {}
        });
        setCameraStream(null);
      }
    }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
          try { track.stop(); } catch(e) {}
        });
      }
    };
  }, [isLiveCameraOpen, cameraFacingMode]);

  // Prefill dates or edit item
  useEffect(() => {
    if (taskToEdit) {
      // In Edit Mode
      setDate(taskToEdit.date);
      setStartTime(taskToEdit.start_time);
      setEndTime(taskToEdit.end_time);
      setAreaType(taskToEdit.area_type);
      setAreaDetail(taskToEdit.area_detail || '');
      setSpecialty(taskToEdit.specialty);
      setShift(taskToEdit.shift || '1');
      setMaintenanceType(taskToEdit.maintenance_type || 'Corrective');
      setDescription(taskToEdit.description);
      setImageUrl(taskToEdit.image_url || '');
      setStatus(currentUser?.role?.toUpperCase() === 'USER' ? 'Pending' : taskToEdit.status);

      const urls = parseImageUrls(taskToEdit.image_url);
      const loadedAttachments = urls.map((url, i) => ({
        url,
        fileName: url.startsWith('http') ? `Foto_Drive_${i + 1}.jpg` : `Foto_${i + 1}.jpg`
      }));
      setImageAttachments(loadedAttachments);
      base64CacheRef.current = {};
    } else {
      // In Add Mode: Date is auto/readonly as requested!
      const todayString = new Date().toISOString().substring(0, 10);
      setDate(todayString);
      
      // Get current hours + minutes rounded
      const now = new Date();
      const formatTime = (d: Date) => {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      };
      
      setStartTime(formatTime(now));
      
      // End hour is +1 hour by default
      const endNow = new Date(now.getTime() + 60 * 60 * 1000);
      setEndTime(formatTime(endNow));

      // Reset fields
      setAreaType(areas[0]?.name || 'Guest Room');
      setAreaDetail('');
      setSpecialty(categories[0]?.name || 'AC');
      setShift('1');
      setMaintenanceType(maintenanceTypes[0]?.name || 'Corrective');
      setDescription('');
      setImageUrl('');
      setStatus('Pending');
      setImageAttachments([]);
      base64CacheRef.current = {};
    }
  }, [taskToEdit, isOpen, areas, categories, maintenanceTypes, currentUser]);

  if (!isOpen) return null;

  // Handles drag-and-drop upload zone
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const compressImageFile = (file: File): Promise<{ base64Url: string; objectUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Limit to max 800px dimension for lightweight payload (< 400KB)
            const MAX_SIZE = 800;
            if (width > MAX_SIZE || height > MAX_SIZE) {
              if (width > height) {
                height = Math.round((height * MAX_SIZE) / width);
                width = MAX_SIZE;
              } else {
                width = Math.round((width * MAX_SIZE) / height);
                height = MAX_SIZE;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              const originalBase64 = e.target?.result as string;
              resolve({ base64Url: originalBase64, objectUrl: URL.createObjectURL(file) });
              return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Quality 70% (0.7) as requested to produce < 400KB files
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            
            // Generate a compressed blob URL for instant lightweight UI rendering
            canvas.toBlob((blob) => {
              if (blob) {
                const compressedBlobUrl = URL.createObjectURL(blob);
                resolve({ base64Url: compressedBase64, objectUrl: compressedBlobUrl });
              } else {
                resolve({ base64Url: compressedBase64, objectUrl: URL.createObjectURL(file) });
              }
            }, 'image/jpeg', 0.7);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Gagal membaca data berkas.'));
      reader.readAsDataURL(file);
    });
  };

  const processFile = async (file: File) => {
    if (!file) return;

    if (imageAttachments.length >= 3) {
      alert('Batas maksimal 3 foto tercapai! Harap hapus foto lama sebelum mengunggah foto baru.');
      return;
    }
    
    // Check if image
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa format Gambar (JPEG, PNG, WEBP, dll).');
      return;
    }

    setUploading(true);

    try {
      console.log('Mengompresi gambar ke kualitas 70% (< 500KB)...');
      const { base64Url, objectUrl } = await compressImageFile(file);
      
      // Cache Base64 string off state
      base64CacheRef.current[objectUrl] = base64Url;

      setImageAttachments(prev => {
        if (prev.length >= 3) {
          return prev;
        }
        return [
          ...prev,
          {
            url: objectUrl,
            fileName: file.name
          }
        ];
      });
      setUploading(false);
    } catch (e: any) {
      console.error('File reading and compression failed:', e);
      alert('Gagal memproses dan memperkecil gambar. Silakan coba file lain.');
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (imageAttachments.length >= 3) {
      alert('Batas maksimal 3 foto tercapai! Harap hapus foto lama sebelum mengunggah foto baru.');
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (imageAttachments.length >= 3) {
      alert('Batas maksimal 3 foto tercapai! Harap hapus foto lama sebelum mengunggah foto baru.');
      e.target.value = '';
      return;
    }

    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
    
    // Reset file input value so same file/photo can be triggered/uploaded again if needed
    e.target.value = '';
  };

  const clickCameraArea = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageAttachments.length >= 3) {
      alert('Batas maksimal 3 foto tercapai! Harap hapus foto lama sebelum mengunggah foto baru.');
      return;
    }
    // Directly target the capture-enabled native camera input for flawless compatibility on all brands (Vivo, OPPO, iOS, Samsung)
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const capturePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      // Get the true video layout parameters
      const width = video.videoWidth || 1024;
      const height = video.videoHeight || 768;
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Draw live video frame beautifully onto canvas
      ctx.drawImage(video, 0, 0, width, height);
      
      // Compress frame directly to JPEG Blob
      canvas.toBlob(async (blob) => {
        if (blob) {
          const timestamp = new Date().getTime();
          const file = new File([blob], `Kamera_LiveTask_${timestamp}.jpg`, { type: 'image/jpeg' });
          await processFile(file);
          stopCamera();
        } else {
          // Robust fallback base64
          const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
          const timestamp = new Date().getTime();
          const objectUrl = URL.createObjectURL(new Blob([], { type: 'image/jpeg' }));
          
          base64CacheRef.current[objectUrl] = dataUrl;
          setImageAttachments(prev => {
            if (prev.length >= 3) return prev;
            return [...prev, { url: objectUrl, fileName: `Kamera_LiveTask_${timestamp}.jpg` }];
          });
          stopCamera();
        }
      }, 'image/jpeg', 0.80);
    } catch (err) {
      console.error("Capture direct frame failed:", err);
      alert("Gagal menangkap foto dari kamera live. Silakan coba kembali.");
    }
  };

  const toggleCameraFacing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCameraFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const clickGalleryArea = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageAttachments.length >= 3) {
      alert('Batas maksimal 3 foto tercapai! Harap hapus foto lama sebelum mengunggah foto baru.');
      return;
    }
    fileInputRef.current?.click();
  };

  const clickUploadArea = (e: React.MouseEvent) => {
    // Stop bubbling immediately if clicking buttons/triggers to prevent double triggering (gallery + camera trigger)
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      return;
    }
    
    if (imageAttachments.length >= 3) {
      alert('Batas maksimal 3 foto tercapai! Harap hapus foto lama sebelum mengunggah foto baru.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleRemoveImage = (index: number) => {
    const item = imageAttachments[index];
    if (item.url) {
      if (item.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.url);
        } catch (err) {
          console.error('Failed to revoke previous Object URL:', err);
        }
      }
      delete base64CacheRef.current[item.url];
    }
    setImageAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handlePreSubmitCheck = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Strict validation - If any property is empty/undefined, show simple alert
    if (!date || !startTime || !endTime || !areaType || !specialty || !shift || !maintenanceType || !description.trim()) {
      alert('Harap isi semua kolom!');
      return;
    }

    // 2. Open confirmation modal state independently
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    // Hide confirm modal immediately
    setShowConfirmModal(false);
    setUploading(true); // general loading indicator inside form modal

    // Build state object matching Singapore database structure schema
    const payload = {
      date,
      start_time: startTime,
      end_time: endTime,
      area_type: areaType || '',
      area_detail: areaDetail ? areaDetail.trim() : '',
      specialty: specialty || '',
      shift,
      maintenance_type: maintenanceType || 'Corrective',
      description: description.trim(),
      image_url: '', // Will be updated within onSave callback
      status,
      technician_name: taskToEdit ? taskToEdit.technician_name : currentUser.fullname,
      technician_id: taskToEdit ? taskToEdit.technician_id : currentUser.id,
      id: taskToEdit ? taskToEdit.id : undefined
    };

    try {
      // Lazily map and append Base64 strings from cache right before execution
      const attachmentsWithBase64 = imageAttachments.map(item => ({
        ...item,
        base64Url: base64CacheRef.current[item.url] || item.base64Url
      }));
      console.log('Sending task payload for processing and uploading in App layer...', payload);
      await onSave(payload, attachmentsWithBase64);
      setUploading(false);
      onClose();
    } catch (saveError: any) {
      console.error("Gagal menyimpan tugas:", saveError);
      setUploading(false);
      alert(`Gagal menyimpan tugas ke database. Error asli:\n\n${saveError?.message || JSON.stringify(saveError)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col my-3 sm:my-8"
        id="task_form_modal_container"
      >
        {/* Dynamic header branding */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800/80 bg-slate-900 flex justify-between items-center bg-gradient-to-r from-slate-900 via-slate-900 to-orange-950/20">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500/10 rounded-lg sm:rounded-xl flex items-center justify-center border border-orange-500/20 shrink-0">
              <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-base font-extrabold text-white tracking-wide truncate">
                {taskToEdit ? 'EDIT WORK ORDER TASK' : 'TAMBAH WORK ORDER TASK'}
              </h3>
              <p className="text-[9px] sm:text-[11px] text-slate-400 font-mono truncate">
                {taskToEdit ? `Form ID: ${taskToEdit.id} (${taskToEdit.technician_name})` : `Hotel Harris Gubeng • Operator: ${currentUser.fullname}`}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-1 sm:p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer shrink-0"
            id="close_form_btn"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Modal Form Scroll Area */}
        <form onSubmit={handlePreSubmitCheck} className="p-3.5 sm:p-6 space-y-3 sm:space-y-5 overflow-y-auto max-h-[82vh] sm:max-h-[75vh]" id="work_order_form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
            {/* Read-Only Date */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Tanggal Operasional (Read-Only)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="date"
                  required
                  readOnly
                  value={date}
                  className="w-full bg-slate-950/60 border border-slate-800 block text-slate-400 rounded-lg sm:rounded-xl py-1.5 pl-9 pr-3 sm:py-2 sm:pl-11 sm:pr-4 text-xs font-mono outline-none cursor-not-allowed"
                  id="form_readonly_date"
                />
              </div>
            </div>

            {/* Operational Shift Picker */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Shift Operasional
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['1', '2', '3'] as const).map((sNum) => (
                  <button
                    type="button"
                    key={sNum}
                    onClick={() => setShift(sNum)}
                    className={`py-1.5 sm:py-2 text-[10.5px] sm:text-xs font-bold rounded-lg sm:rounded-xl border transition-all cursor-pointer ${
                      shift === sNum
                        ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/15 font-extrabold'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-950 hover:text-slate-300'
                    }`}
                  >
                    Shift {sNum}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
            {/* Start Time */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Jam Mulai Kerja
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 text-white font-mono rounded-lg sm:rounded-xl py-1.5 px-3 sm:py-2 sm:px-4 text-xs focus:outline-none transition-all"
                id="form_start_time"
              />
            </div>

            {/* End Time */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block font-sans">
                Jam Selesai Kerja
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 text-white font-mono rounded-lg sm:rounded-xl py-1.5 px-3 sm:py-2 sm:px-4 text-xs focus:outline-none transition-all"
                id="form_end_time"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
            {/* Area Master Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Area Harris Hotel
              </label>
              <select
                required
                value={areaType}
                onChange={(e) => setAreaType(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-orange-500 text-slate-200 rounded-lg sm:rounded-xl py-1.5 px-3 sm:py-2 sm:px-4 text-xs focus:outline-none"
                id="form_area_type"
              >
                {areas.map(a => (
                  <option key={a.id} value={a.name} className="bg-slate-950 text-slate-200">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Specialty category Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Specialty Kategori Kerja
              </label>
              <select
                required
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-orange-500 text-slate-200 rounded-lg sm:rounded-xl py-1.5 px-3 sm:py-2 sm:px-4 text-xs focus:outline-none"
                id="form_specialty"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.name} className="bg-slate-950 text-slate-200">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
            {/* Area Detail Details Text */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Keterangan Area Spesifik
              </label>
              <input
                type="text"
                value={areaDetail}
                onChange={(e) => setAreaDetail(e.target.value)}
                placeholder="Cth: Kamar 402, Ubud room, Lift Lobby 1"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 text-white rounded-lg sm:rounded-xl py-1.5 px-3 sm:py-2 sm:px-4 text-xs focus:outline-none transition-all placeholder:text-slate-600"
                id="form_area_detail"
              />
            </div>

            {/* Type Maintenance */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Tipe Maintenance Work
              </label>
              <select
                required
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-orange-500 text-slate-200 rounded-lg sm:rounded-xl py-1.5 px-3 sm:py-2 sm:px-4 text-xs focus:outline-none"
                id="form_maintenance_type"
              >
                {maintenanceTypes.length > 0 ? (
                  maintenanceTypes.map((mt) => (
                    <option key={mt.id} value={mt.name} className="bg-slate-950 text-slate-200">
                      {mt.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Corrective" className="bg-slate-950 text-slate-200">Corrective Maintenance</option>
                    <option value="Preventive" className="bg-slate-950 text-slate-200">Preventive Maintenance</option>
                    <option value="Breakdown" className="bg-slate-950 text-slate-200">Breakdown Maintenance</option>
                    <option value="Installation" className="bg-slate-950 text-slate-200">New Installation</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Details Damage and Resolution Action */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block font-sans">
              Detail Kerusakan & Tindakan Perbaikan (Wajib)
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan kerusakan dan langkah tindakan perbaikan teknis yang telah diambil..."
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 text-white rounded-lg sm:rounded-2xl p-3 sm:p-4 text-xs focus:outline-none transition-all placeholder:text-slate-600 leading-relaxed"
              id="form_description"
            />
          </div>

          {/* DRAG AND DROP / CAMERA SNAP AREA */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Foto Dokumentasi Lapangan (Maksimal 3 Foto)
              </label>
              <span className={`text-[10px] sm:text-[11px] font-mono font-bold ${imageAttachments.length >= 3 ? 'text-red-400' : 'text-slate-500'}`}>
                {imageAttachments.length} / 3 Foto
              </span>
            </div>
            
            <div
              onDragEnter={imageAttachments.length < 3 ? handleDrag : undefined}
              onDragOver={imageAttachments.length < 3 ? handleDrag : undefined}
              onDragLeave={imageAttachments.length < 3 ? handleDrag : undefined}
              onDrop={imageAttachments.length < 3 ? handleDrop : undefined}
              onClick={clickUploadArea}
              className={`p-3.5 sm:p-5 border border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                imageAttachments.length >= 3
                  ? 'border-red-900/30 bg-red-950/5 cursor-not-allowed text-slate-500'
                  : dragActive
                    ? 'border-orange-500 bg-orange-500/5'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/45 hover:bg-slate-950/70'
              }`}
              id="upload_drop_zone"
            >
              {/* Hidden file input for Photo Gallery */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                id="form_file_selector"
                disabled={imageAttachments.length >= 3}
              />

              {/* Hidden file input for Direct Camera (with capture="environment" for live photo option on all phones) */}
              <input
                type="file"
                ref={cameraInputRef}
                onChange={handleFileChange}
                accept="image/*"
                capture="environment"
                className="hidden"
                id="form_camera_selector"
                disabled={imageAttachments.length >= 3}
              />

              {imageAttachments.length >= 3 ? (
                <div className="text-center py-1 flex flex-col items-center space-y-1">
                  <div className="w-8 h-8 bg-red-950/20 rounded-full flex items-center justify-center text-red-400 border border-red-900/30">
                    <X className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[10.5px] font-bold text-red-400">
                      Batas Unggah Maksimal Tercapai
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      Hapus setidaknya satu foto di bawah untuk mengunggah kembali.
                    </p>
                  </div>
                </div>
              ) : uploading ? (
                <div className="flex flex-col items-center py-2 space-y-1">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                  <p className="text-[10px] font-bold text-orange-500 font-mono">
                    Memproses & mengompresi...
                  </p>
                </div>
              ) : (
                <div className="text-center py-2 flex flex-col items-center space-y-3.5 w-full">
                  <div className="text-center select-none">
                    <p className="text-[10.5px] font-black text-orange-500 uppercase tracking-wider font-sans">
                      Metode Pengambilan Foto Lapangan
                    </p>
                    <p className="text-[9.5px] text-slate-400 mt-1 font-sans">
                      Gunakan salah satu pilihan di bawah untuk akses langsung tanpa hambatan:
                    </p>
                  </div>
                  
                  {/* Two distinct high-contrast premium action buttons side-by-side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md justify-center px-1">
                    {/* OPTION 1: Direct Native Camera App via standard HTML trusted label (perfect for Chrome Mobile / Vivo / OPPO) */}
                    <label
                      htmlFor="form_camera_selector"
                      onClick={(e) => {
                        // Prevent click propagation to avoid triggering the parent dropzone area click
                        e.stopPropagation();
                      }}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 border-2 border-orange-500/20 hover:border-orange-500 text-orange-500 hover:text-orange-400 font-extrabold rounded-xl text-[10.5px] sm:text-xs flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-orange-500/5 transition-all cursor-pointer min-h-[56px] text-center select-none active:scale-95"
                    >
                      <Camera className="w-5 h-5 text-orange-500" />
                      <span className="uppercase tracking-wider text-[9.5px] sm:text-[10px]">AMBIL FOTO</span>
                    </label>
                    
                    {/* OPTION 2: Open Document Selection Photo Gallery */}
                    <label
                      htmlFor="form_file_selector"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-extrabold rounded-xl text-[10.5px] sm:text-xs flex flex-col items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer min-h-[56px] text-center select-none active:scale-95"
                    >
                      <Upload className="w-5 h-5 text-emerald-400" />
                      <span className="uppercase tracking-wider text-[9.5px] sm:text-[10px]">Buka Galeri Foto</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail preview grid list */}
            {imageAttachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5 mt-2">
                {imageAttachments.map((item, idx) => (
                  <div key={idx} className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-850/60 flex flex-col items-center space-y-1 relative group">
                    <div className="w-full h-11 sm:h-16 rounded overflow-hidden bg-black border border-slate-850">
                      <SafeImage
                        src={item.url}
                        alt={`Preview thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex justify-between items-center w-full px-1">
                      <span className="text-[8px] text-slate-500 font-mono">Foto #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(idx);
                        }}
                        className="text-[9.5px] text-red-500 hover:text-red-400 font-bold cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>           {/* Task Status Toggle Option */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Status Pekerjaan (Task Status)
              </label>
              {currentUser?.role?.toUpperCase() === 'USER' && (
                <span className="text-[8.5px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.2 rounded font-bold font-mono">LOCKED</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['Pending', 'Complete'] as const).map((tStat) => {
                const isUserRole = currentUser?.role?.toUpperCase() === 'USER';
                const isSelected = status === tStat;
                const isDisabled = isUserRole && tStat === 'Complete';
                return (
                  <button
                    type="button"
                    key={tStat}
                    disabled={isUserRole}
                    onClick={() => {
                      if (!isUserRole) setStatus(tStat);
                    }}
                    className={`py-2 px-3 text-[11px] sm:text-xs font-extrabold rounded-lg sm:rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                      isUserRole
                        ? tStat === 'Pending'
                          ? 'bg-orange-600/90 border-orange-600/80 text-white shadow-md'
                          : 'bg-slate-950/20 border-slate-900 text-slate-600 cursor-not-allowed opacity-40'
                        : isSelected
                          ? tStat === 'Complete'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20 cursor-pointer'
                            : 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-500/20 cursor-pointer'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-950 cursor-pointer'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      tStat === 'Complete' 
                        ? 'bg-emerald-300 animate-pulse' 
                        : 'bg-orange-300 animate-pulse'
                    }`} />
                    {tStat === 'Complete' ? 'Selesai' : 'Pending Perbaikan'}
                  </button>
                );
              })}
            </div>
            {currentUser?.role?.toUpperCase() === 'USER' && (
              <p className="text-[9.5px] text-slate-450 italic text-slate-400/80 pt-0.5">Role USER otomatis menginput task baru dengan status &quot;Pending&quot;.</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-3 sm:pt-4 border-t border-slate-800 flex gap-2 sm:gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3.5 sm:py-2.5 sm:px-6 bg-slate-955 bg-slate-950 border border-slate-850 hover:bg-slate-850 hover:border-slate-755 text-slate-400 hover:text-white text-xs font-semibold rounded-lg sm:rounded-xl cursor-pointer transition-all duration-100"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="py-1.5 px-4.5 sm:py-2.5 sm:px-6 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-lg sm:rounded-xl cursor-pointer shadow-lg shadow-orange-500/15 flex items-center gap-1.5 transition-all duration-100"
              id="save_task_submit_btn"
            >
              <span>Simpan Tugas</span>
            </button>
          </div>
        </form>
      </motion.div>

      {/* INDEPENDENT CONFIRMATION MODAL */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
              id="confirm_modal_box"
            >
              <div className="flex items-center gap-3 text-orange-500">
                <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white tracking-wide uppercase">
                  KONFIRMASI SIMPAN TASK
                </h4>
              </div>
              
              <div className="text-xs text-slate-300 leading-relaxed font-sans space-y-3">
                <p>Apakah Anda yakin data Work Order Task yang dimasukkan sudah benar? Silakan cek kembali ringkasan berikut:</p>
                
                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-2 text-slate-300 font-sans text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold block uppercase text-[10px] tracking-wider">Nama Task / Detail Kerusakan:</span>
                    <span className="text-white block bg-slate-900/40 p-1.5 rounded mt-0.5 border border-slate-800/40">{description || '-'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 font-semibold uppercase text-[9px] block">Area Kerja:</span>
                      <span className="text-slate-200 block font-bold">{areaType} {areaDetail ? `(${areaDetail})` : ''}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold uppercase text-[9px] block">Kategori Specialty:</span>
                      <span className="text-slate-200 block font-bold">{specialty}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-slate-500 font-semibold uppercase text-[9px] block">Tipe Maintenance:</span>
                      <span className="text-slate-200 block font-bold">{maintenanceType}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold uppercase text-[9px] block">Status:</span>
                      <span className={`font-bold inline-block px-1.5 py-0.5 rounded text-[10px] uppercase ${status === 'Complete' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-900/30' : 'bg-orange-500/20 text-orange-400 border border-orange-900/30'}`}>{status === 'Complete' ? 'Selesai' : 'Pending'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-slate-500 font-semibold uppercase text-[9px] block">Tanggal:</span>
                      <span className="text-slate-300 font-mono">{date}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold uppercase text-[9px] block">Waktu / Shift:</span>
                      <span className="text-slate-300 font-mono">Shift {shift} ({startTime} - {endTime})</span>
                    </div>
                  </div>

                  {/* Attachment multi-image thumbnails preview */}
                  {imageAttachments.length > 0 ? (
                    <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-left">
                      <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider block font-sans">
                        Pratinjau Foto Lampiran ({imageAttachments.length}):
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {imageAttachments.map((item, index) => (
                          <div key={index} className="h-20 rounded-xl border border-slate-800 overflow-hidden bg-black relative shadow-lg">
                            <SafeImage
                              src={item.url}
                              alt={`Confirm item ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-1 right-1 bg-black/75 px-1 py-0.5 rounded text-[8px] text-orange-500 font-mono">
                              #{index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-800/60 text-left">
                      <span className="text-slate-500 font-semibold uppercase text-[9px] block">Lampiran Media:</span>
                      <span className="text-[11px] text-slate-500 italic block">
                        Tidak ada foto terlampir
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="py-2 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  id="cancel_save_btn"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="py-2 px-5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-500/10"
                  id="confirm_save_btn"
                >
                  Ya, Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIRECT ACTIVE CAMERA STREAM PORTAL */}
      <AnimatePresence>
        {isLiveCameraOpen && (
          <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              id="live_camera_portal_box"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs font-black text-white uppercase tracking-widest font-mono">
                    KAMERA LIVE OPERASIONAL
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Viewport Frame */}
              <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden border-b border-slate-800">
                {cameraLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 text-slate-400 space-y-2">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    <span className="text-xs font-bold font-sans uppercase tracking-wider text-orange-500">
                      Menghubungkan Kamera...
                    </span>
                  </div>
                )}
                
                {cameraError ? (
                  <div className="absolute inset-0 z-10 p-6 flex flex-col items-center justify-center bg-slate-950 text-center space-y-3">
                    <p className="text-xs font-semibold text-red-400 leading-relaxed max-w-sm">
                      {cameraError}
                    </p>
                    <button
                      type="button"
                      onClick={() => startCamera(cameraFacingMode)}
                      className="py-1.5 px-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-orange-500 text-[10.5px] font-black rounded-lg transition-all cursor-pointer uppercase font-mono"
                    >
                      Coba Lagi
                    </button>
                    
                    <div className="pt-2">
                      <p className="text-[9.5px] text-slate-500 max-w-xs">
                        Jika masalah berlanjut, harap upload foto secara konvensional via opsi Buka Galeri.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* The HTML5 Real Video stream element wrapper */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{
                    // Mirror feed only if using the front facing camera (person selfie)
                    transform: cameraFacingMode === 'user' ? 'scaleX(-1)' : 'none'
                  }}
                />
                
                {/* Active Facing mode indicator HUD overlay */}
                <div className="absolute bottom-3 left-3 bg-black/70 px-2 py-1 rounded-lg text-[9px] font-mono font-bold text-slate-300 border border-slate-850 uppercase select-none flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Kamera: {cameraFacingMode === 'environment' ? 'BELAKANG (OK)' : 'DEPAN (SELFIE)'}</span>
                </div>
              </div>

              {/* Bottom Tactile Operational Panel */}
              <div className="p-4 bg-slate-950 flex flex-col sm:flex-row items-center gap-3 justify-between">
                {/* Camera Switcher */}
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="w-full sm:w-auto py-2.5 px-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  title="Ganti arah kamera (Depan/Belakang)"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-orange-500 animate-spin-slow" />
                  <span className="uppercase tracking-wider text-[10px] font-mono">Alihkan Kamera</span>
                </button>

                {/* Main Capture Strike Button */}
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={cameraLoading || !!cameraError}
                  className="w-full sm:w-auto flex-1 py-3 px-6 bg-orange-500 hover:bg-orange-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 cursor-pointer transition-all"
                >
                  <Camera className="w-4 h-4 text-white" />
                  <span className="uppercase tracking-widest text-[11px]">JEPRET & UNGGAH FOTO</span>
                </button>

                {/* Cancel Stream */}
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full sm:w-auto py-2.5 px-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-all"
                >
                  Kembali
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
