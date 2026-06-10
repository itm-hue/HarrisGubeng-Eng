/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { User, Task, AreaMaster, CategoryMaster, MaintenanceTypeMaster, TaskFilter, ImageAttachment } from './types';
import { dbService, isConfigured, supabase, mapDbUserToFrontend } from './lib/supabase';
import { parseImageUrls } from './lib/imageUtils';
import Login from './components/Login';
import MetricCards from './components/MetricCards';
import TaskTable from './components/TaskTable';
import TaskFormModal from './components/TaskFormModal';
import TaskDetailsModal from './components/TaskDetailsModal';
import AdminPanel from './components/AdminPanel';
import ArchiveHistoryCsv from './components/ArchiveHistoryCsv';
import { Hotel, User as UserIcon, LogOut, Plus, ShieldCheck, Zap, Database, Info, FileSpreadsheet, LayoutDashboard, Settings, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const getShortFileNameFromUrl = (url: string): string => {
  if (!url) return '';
  if (url.includes('?file=')) {
    return url.split('?file=')[1] || url;
  }
  if (url.includes('file=')) {
    return url.split('file=')[1] || url;
  }
  if (url.startsWith('http')) {
    const parts = url.split('/');
    return parts[parts.length - 1] || url;
  }
  return url;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inactivityNotice, setInactivityNotice] = useState<string>('');
  
  // Master lists
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasksForMetrics, setAllTasksForMetrics] = useState<Task[]>([]);
  const [areas, setAreas] = useState<AreaMaster[]>([]);
  const [categories, setCategories] = useState<CategoryMaster[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceTypeMaster[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Filter settings
  const [activeFilters, setActiveFilters] = useState<TaskFilter>(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    return {
      searchQuery: '',
      startDate: todayStr,
      endDate: todayStr,
      status: 'All',
      area: 'All',
      category: 'All'
    };
  });

  // Flow State controlling
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [dbMode, setDbMode] = useState<'MOCK' | 'REAL'>('REAL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTaskToEdit, setActiveTaskToEdit] = useState<Task | null>(null);
  const [activeTaskToView, setActiveTaskToView] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Navigation tabs for Admin (Dashboard / Master Settings / CSV Archives)
  const [adminTab, setAdminTab] = useState<'DASHBOARD' | 'MASTER_PANEL' | 'CSV_ARCHIVE'>('DASHBOARD');

  // Load configuration modes on boot
  useEffect(() => {
    // Determine active mode (Strictly Real Supabase Mode)
    setDbMode('REAL');

    // Persist Login session helper (using sessionStorage for "wajib login lagi ketika ditutup")
    const savedUser = sessionStorage.getItem('harris_logged_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        setCurrentUser(parsedUser);
        sessionStorage.setItem('last_active_time', Date.now().toString());
        if (parsedUser.role?.toUpperCase() === 'USER') {
          setActiveFilters(prev => ({ ...prev, searchQuery: parsedUser.fullname }));
        }
      } catch (e) {
        sessionStorage.removeItem('harris_logged_user');
      }
    }
  }, []);

  // Inactivity tracking (30 minutes session timeout)
  useEffect(() => {
    if (!currentUser) return;

    // Refresh last active timestamp
    sessionStorage.setItem('last_active_time', Date.now().toString());

    const updateActivity = () => {
      sessionStorage.setItem('last_active_time', Date.now().toString());
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    const intervalId = setInterval(() => {
      const lastActive = sessionStorage.getItem('last_active_time');
      if (lastActive) {
        const elapsed = Date.now() - parseInt(lastActive, 10);
        const timeoutMs = 30 * 60 * 1000; // 30 minutes in ms

        if (elapsed > timeoutMs) {
          // Trigger Auto Logout
          setCurrentUser(null);
          sessionStorage.removeItem('harris_logged_user');
          sessionStorage.removeItem('last_active_time');
          setInactivityNotice('Sesi Anda telah berakhir karena tidak ada aktivitas selama 30 menit. Silakan login kembali.');
        }
      }
    }, 10000); // Check every 10 seconds

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(intervalId);
    };
  }, [currentUser]);

  // Sync masters and tasks upon user login or DbMode toggle
  useEffect(() => {
    if (!currentUser) return;
    
    let isSubscribed = true;
    setLoading(true);

    const loadAppData = async () => {
      try {
        const [fetchedTasks, fetchedAllTasks, fetchedAreas, fetchedCategories, fetchedUsers, fetchedMaintenanceTypes] = await Promise.all([
          dbService.getTasks(activeFilters),
          dbService.getTasks(), // Fetches all tasks without filter for overall counts
          dbService.getAreas(),
          dbService.getCategories(),
          dbService.getUsers(),
          dbService.getMaintenanceTypes()
        ]);

        if (isSubscribed) {
          setTasks(fetchedTasks);
          setAllTasksForMetrics(fetchedAllTasks);
          setAreas(fetchedAreas);
          setCategories(fetchedCategories);
          setUsers(fetchedUsers);
          setMaintenanceTypes(fetchedMaintenanceTypes || []);
          setLoading(false);
        }
      } catch (e) {
        console.error('Error fetching initial application registers', e);
        if (isSubscribed) setLoading(false);
      }
    };

    loadAppData();

    // -------------------------------------------------------------------------
    // BIND REAL-TIME SYNC SUBSCRIPTION (SUPABASE OR MOCK ENGINE)
    // -------------------------------------------------------------------------
    const subscription = dbService.subscribeToTasks((payload) => {
      console.log('Realtime payload caught inside React App lifecycle:', payload);
      
      // Update local state React lists on-the-fly without requiring page reloads!
      if (payload.eventType === 'INSERT') {
        const newTask = payload.new as Task;
        setTasks((prev) => {
          // Prevent duplicates
          if (prev.some(t => t.id === newTask.id)) return prev;
          return [newTask, ...prev];
        });
        setAllTasksForMetrics((prev) => {
          if (prev.some(t => t.id === newTask.id)) return prev;
          return [newTask, ...prev];
        });
      } else if (payload.eventType === 'UPDATE') {
        const updatedTask = payload.new as Task;
        setTasks((prev) => prev.map(t => t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
        setAllTasksForMetrics((prev) => prev.map(t => t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
      } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) {
          setTasks((prev) => prev.filter(t => t.id !== deletedId));
          setAllTasksForMetrics((prev) => prev.filter(t => t.id !== deletedId));
        }
      }
    });

    // Custom Real-time subscription for Users with custom-all-channel support
    let userSubscription: any;
    if (dbMode === 'REAL' && supabase) {
      console.log('Attaching custom-all-channel postgres_changes listener to users table in App.tsx');
      const channel = supabase
        .channel('custom-all-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'users' },
          (payload: any) => {
            console.log('Supabase real-time user change received on custom-all-channel:', payload);
            
            const mapUser = (u: any): Partial<User> => {
              if (!u) return {};
              return mapDbUserToFrontend(u);
            };

            const mappedNew = mapUser(payload.new);
            const mappedOld = mapUser(payload.old);

            if (payload.eventType === 'INSERT') {
              const newUser = mappedNew as User;
              setUsers((prev) => {
                if (prev.some(u => u.id === newUser.id)) return prev;
                return [...prev, newUser];
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedUser = mappedNew as User;
              setUsers((prev) => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
            } else if (payload.eventType === 'DELETE') {
              const deletedId = mappedOld?.id || payload.old?.id;
              if (deletedId) {
                setUsers((prev) => prev.filter(u => u.id !== deletedId));
              }
            }
          }
        )
        .subscribe();
      
      userSubscription = {
        unsubscribe: () => {
          console.log('Unsubscribing custom-all-channel from users table in App.tsx');
          supabase.removeChannel(channel);
        }
      };
    } else {
      userSubscription = dbService.subscribeToUsers((payload) => {
        console.log('Realtime user mock payload:', payload);
        if (payload.eventType === 'INSERT') {
          const newUser = payload.new as User;
          setUsers((prev) => {
            if (prev.some(u => u.id === newUser.id)) return prev;
            return [...prev, newUser];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedUser = payload.new as User;
          setUsers((prev) => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setUsers((prev) => prev.filter(u => u.id !== deletedId));
          }
        }
      });
    }

    const areaSubscription = dbService.subscribeToAreas((payload) => {
      console.log('Realtime area payload:', payload);
      if (payload.eventType === 'INSERT') {
        const newArea = payload.new as AreaMaster;
        setAreas((prev) => {
          if (prev.some(a => a.id === newArea.id)) return prev;
          return [...prev, newArea];
        });
      } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) {
          setAreas((prev) => prev.filter(a => a.id !== deletedId));
        }
      }
    });

    const categorySubscription = dbService.subscribeToCategories((payload) => {
      console.log('Realtime category payload:', payload);
      if (payload.eventType === 'INSERT') {
        const newCategory = payload.new as CategoryMaster;
        setCategories((prev) => {
          if (prev.some(c => c.id === newCategory.id)) return prev;
          return [...prev, newCategory];
        });
      } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) {
          setCategories((prev) => prev.filter(c => c.id !== deletedId));
        }
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
      userSubscription.unsubscribe();
      areaSubscription.unsubscribe();
      categorySubscription.unsubscribe();
    };
  }, [currentUser, dbMode]);

  const isInitialMount = React.useRef(true);

  useEffect(() => {
    if (!currentUser) {
      isInitialMount.current = true;
    }
  }, [currentUser]);

  // Lightweight refetch effect when activeFilters changes (WITHOUT rebuilding subscriptions)
  useEffect(() => {
    if (!currentUser) return;
    
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    let isSubscribed = true;
    
    const fetchFilteredTasks = async () => {
      setIsSearching(true);
      try {
        const fetchedTasks = await dbService.getTasks(activeFilters);
        if (isSubscribed) {
          setTasks(fetchedTasks);
        }
      } catch (e) {
        console.error('Error auto-filtering tasks on activeFilters change:', e);
      } finally {
        setTimeout(() => {
          if (isSubscribed) {
            setIsSearching(false);
          }
        }, 400);
      }
    };

    fetchFilteredTasks();

    return () => {
      isSubscribed = false;
    };
  }, [activeFilters]);

  // Handle Login session
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('harris_logged_user', JSON.stringify(user));
    sessionStorage.setItem('last_active_time', Date.now().toString());
    setInactivityNotice('');
    if (user.role?.toUpperCase() === 'USER') {
      setActiveFilters(prev => ({ ...prev, searchQuery: user.fullname }));
    } else {
      setActiveFilters(prev => ({ ...prev, searchQuery: '' }));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('harris_logged_user');
    sessionStorage.removeItem('last_active_time');
    setInactivityNotice('');
  };

  // Toggle database active stream (Disabled - Always locked in REAL mode)
  const toggleDbMode = () => {
    console.log('Database locked in active production stream.');
  };

  const resetAllStates = () => {
    setTasks([]);
    setAllTasksForMetrics([]);
    setAreas([]);
    setCategories([]);
    setActiveFilters({
      searchQuery: '',
      startDate: '',
      endDate: '',
      status: 'All',
      area: 'All',
      category: 'All'
    });
  };

  // Create or Update task actions
  const handleSaveTask = async (
    taskData: Omit<Task, 'id' | 'created_at'> & { id?: string },
    imageAttachments: ImageAttachment[] = []
  ) => {
    try {
      if (!currentUser) return;
      
      const timestamp = new Date().toISOString();
      let taskId = taskData.id;
      const isNew = !taskId;
      
      let finalTask: Task;
      let existingHistory: any[] = [];
      let updatedHistory: any[] = [];

      if (isNew) {
        // 1. Insert temporary empty task to generate the true database integer `id`
        const tempTaskPayload = {
          ...taskData,
          image_url: '', // Will update with true URLs after uploads complete
          history: [] // Will populate after uploads complete
        };
        const created = await dbService.createTask(tempTaskPayload);
        taskId = created.id;
        finalTask = created;
      } else {
        const currentTask = tasks.find(t => t.id === taskId);
        if (!currentTask) throw new Error('Pekerjaan tidak ditemukan di sistem.');
        finalTask = currentTask;
        existingHistory = Array.isArray(currentTask.history) ? currentTask.history : [];
      }

      // 2. Perform sequential uploads to Google Drive with ID-based file naming
      const uploadedUrls: string[] = [];
      const driveUploadFailures: string[] = [];

      for (let i = 0; i < imageAttachments.length; i++) {
        const item = imageAttachments[i];
        if (item.base64Url) {
          try {
            console.log(`Lazy image upload #${i+1} using Task ID ${taskId}...`);
            const extension = item.fileName?.split('.').pop() || 'png';
            const originalNameClean = item.fileName?.split('.')[0]?.replace(/[^a-zA-Z0-9_-]/g, '') || `foto${i + 1}`;
            const indexLabel = `foto${i + 1}`;
            
            // Format TASK_[ID_TASK]_[INDEX_FOTO]_[NAMA_ASLI]
            let customFileName = '';
            if (originalNameClean.toLowerCase().includes('foto')) {
              customFileName = `TASK_${taskId}_${originalNameClean}.${extension}`;
            } else {
              customFileName = `TASK_${taskId}_${indexLabel}_${originalNameClean}.${extension}`;
            }
            
            // Timeout limits to force robust fallback if Drive times out after 35s
            const uploadPromise = dbService.uploadImageToGoogleDrive(item.base64Url, customFileName);
            const timeoutPromise = new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error('Google Drive upload timed out')), 35000)
            );

            const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);
            if (uploadResult) {
              uploadedUrls.push(uploadResult); // Save the real direct Google Drive URL to the database
              console.log(`Google Drive upload succeeded with URL: ${uploadResult}`);
              try {
                localStorage.setItem('local_img_' + customFileName, item.base64Url);
                localStorage.setItem('local_img_' + uploadResult, item.base64Url);
              } catch (e) {
                console.warn('Storage quota exceeded during upload caching:', e);
              }
            } else {
              throw new Error('Google Apps Script response was empty.');
            }
          } catch (err: any) {
            console.error(`Google Drive upload failed for photo #${i+1}, falling back to direct real-time database Base64 storage:`, err);
            driveUploadFailures.push(item.fileName || `TASK_${taskId}`);
            
            // Store the actual base64 URL directly in the database so that ALL devices synchronize instantly
            uploadedUrls.push(item.base64Url);
            
            // Also cache locally for extra compatibility
            const extension = item.fileName?.split('.').pop() || 'png';
            const originalNameClean = item.fileName?.split('.')[0]?.replace(/[^a-zA-Z0-9_-]/g, '') || `foto${i + 1}`;
            const indexLabel = `foto${i + 1}`;
            let customFileName = '';
            if (originalNameClean.toLowerCase().includes('foto')) {
              customFileName = `TASK_${taskId}_${originalNameClean}.${extension}`;
            } else {
              customFileName = `TASK_${taskId}_${indexLabel}_${originalNameClean}.${extension}`;
            }
            try {
              localStorage.setItem('local_img_' + customFileName, item.base64Url);
              localStorage.setItem('local_img_' + item.base64Url, item.base64Url);
            } catch (e) {
              console.warn('Storage quota exceeded during fallback upload caching:', e);
            }
          }
        } else if (item.url) {
          // Carry forward existing photographs, ensuring we keep only the short name
          uploadedUrls.push(getShortFileNameFromUrl(item.url));
        }
      }

      const finalImageUrl = uploadedUrls.filter(Boolean).join(', ');

      // 3. Build history status change entries and payload update
      const newHistoryEntry = {
        status: taskData.status,
        updated_at: timestamp,
        updated_by_nama: currentUser.fullname,
        description: taskData.description,
        image_url: finalImageUrl,
        maintenance_type: taskData.maintenance_type,
        area_type: taskData.area_type,
        area_detail: taskData.area_detail,
        specialty: taskData.specialty,
        shift: taskData.shift,
        date: taskData.date,
        start_time: taskData.start_time,
        end_time: taskData.end_time
      };

      if (isNew) {
        // Prepare initial state history point
        const initialEntry = {
          status: taskData.status || 'Pending',
          updated_at: timestamp,
          updated_by_nama: currentUser.fullname,
          description: taskData.description,
          image_url: finalImageUrl,
          maintenance_type: taskData.maintenance_type,
          area_type: taskData.area_type,
          area_detail: taskData.area_detail,
          specialty: taskData.specialty,
          shift: taskData.shift,
          date: taskData.date,
          start_time: taskData.start_time,
          end_time: taskData.end_time
        };
        const updatedTask = {
          ...finalTask,
          image_url: finalImageUrl,
          history: [initialEntry]
        };
        await dbService.updateTask(updatedTask);
      } else {
        // Appending to logs database of edits
        if (existingHistory.length === 0) {
          const initialEntry = {
            status: finalTask.status || 'Pending',
            updated_at: finalTask.created_at || timestamp,
            updated_by_nama: finalTask.technician_name || 'Teknisi Awal',
            description: finalTask.description || '',
            image_url: finalTask.image_url || '',
            maintenance_type: finalTask.maintenance_type,
            area_type: finalTask.area_type,
            area_detail: finalTask.area_detail,
            specialty: finalTask.specialty,
            shift: finalTask.shift,
            date: finalTask.date,
            start_time: finalTask.start_time,
            end_time: finalTask.end_time
          };
          updatedHistory = [initialEntry, newHistoryEntry];
        } else {
          updatedHistory = [...existingHistory, newHistoryEntry];
        }

        const updated = {
          ...finalTask,
          ...taskData,
          image_url: finalImageUrl,
          history: updatedHistory
        } as Task;
        await dbService.updateTask(updated);
      }

      setIsFormOpen(false);
      setActiveTaskToEdit(null);

      if (driveUploadFailures.length > 0) {
        alert(`Tugas berhasil disimpan ke database!\n\nNamun, ${driveUploadFailures.length} foto gagal diunggah ke Google Drive karena timeout/koneksi (tersimpan aman di local-backup).`);
      }
    } catch (e: any) {
      console.error('Error saving task register:', e);
      alert(`Gagal menyinkronkan tugas ke database: ${e?.message || JSON.stringify(e)}`);
      throw e;
    }
  };

  // Delete task action
  const handleDeleteTask = async (taskId: string) => {
    try {
      // Find the task before deletion to get its attached image URLs
      const taskToDelete = tasks.find(t => t.id === taskId) || allTasksForMetrics.find(t => t.id === taskId);
      
      if (taskToDelete && taskToDelete.image_url) {
        const urls = parseImageUrls(taskToDelete.image_url);
        if (urls.length > 0) {
          console.log(`Ditemukan ${urls.length} media untuk dihapus dari Google Drive.`);
          // Fire-and-forget background deletion for each image
          Promise.all(
            urls.map(async (url) => {
              try {
                // Clear local image caches if any
                if (typeof window !== 'undefined') {
                  window.localStorage?.removeItem('local_img_' + url);
                  const fileId = url.includes('file=') ? url.split('file=')[1] : null;
                  if (fileId) {
                    window.localStorage?.removeItem('local_img_' + fileId);
                  }
                }
                await dbService.deleteImageFromGoogleDrive(url);
              } catch (err) {
                console.warn('Gagal menghapus file dari Google Drive:', err);
              }
            })
          ).catch(e => console.error('Error in multi-file deletion chain:', e));
        }
      }

      await dbService.deleteTask(taskId);
      // Directly manipulate local frontend state instantly (anti-delay)
      setTasks((prev) => prev.filter(t => t.id !== taskId));
      setAllTasksForMetrics((prev) => prev.filter(t => t.id !== taskId));
    } catch (e: any) {
      console.error('Error deleting task:', e);
      throw e;
    }
  };

  const triggerMockRemoteJob = async (type: 'INSERT' | 'UPDATE') => {
    await dbService.triggerDemoSync(type);
  };

  // Edit action binder
  const triggerEditForm = (task: Task) => {
    setActiveTaskToEdit(task);
    setIsFormOpen(true);
  };

  // View action binder
  const triggerViewDetails = (task: Task) => {
    setActiveTaskToView(task);
    setIsDetailOpen(true);
  };

  // Dynamically filter lists for USER role to show only their own tasks/metrics
  const displayedTasks = useMemo(() => {
    if (currentUser?.role?.toUpperCase() === 'USER') {
      const userFullnameLower = (currentUser.fullname || '').trim().toLowerCase();
      return tasks.filter(t => (t.technician_name || '').trim().toLowerCase() === userFullnameLower);
    }
    return tasks;
  }, [tasks, currentUser]);

  const displayedTasksForMetrics = useMemo(() => {
    if (currentUser?.role?.toUpperCase() === 'USER') {
      const userFullnameLower = (currentUser.fullname || '').trim().toLowerCase();
      return allTasksForMetrics.filter(t => (t.technician_name || '').trim().toLowerCase() === userFullnameLower);
    }
    return allTasksForMetrics;
  }, [allTasksForMetrics, currentUser]);

  if (!currentUser) {
    return (
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        inactivityNotice={inactivityNotice} 
        onClearNotice={() => setInactivityNotice('')} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#07111e] bg-gradient-to-tr from-[#050c15] via-[#091629] to-[#040910] text-slate-100 font-sans pb-16 antialiased" id="main_app_wrapper">
      {/* -----------------------------------------------------------------------
          MAIN HEADER STYLED UTILITY RAILS
          ----------------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 shadow" id="main_navigation_header">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-4 flex items-center justify-between gap-2">
          
          {/* Brand Identity / Hotel Harris logo placeholder */}
          <div className="flex items-center gap-2 sm:gap-3 text-left">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md shadow-orange-500/10 shrink-0">
              <Hotel className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 leading-none">
                <h1 className="text-xs sm:text-sm font-black tracking-tight text-white uppercase sm:text-base font-sans">
                  HARRIS <span className="text-orange-500">GUBENG</span>
                </h1>
                <span className="text-[8px] sm:text-[9px] bg-orange-500/15 text-orange-400 font-semibold px-1 sm:px-1.5 py-0.5 rounded font-mono">
                  SBY
                </span>
              </div>
              <p className="text-[8px] sm:text-[10px] text-slate-400 font-mono tracking-wider mt-0.5 uppercase">
                Work Order Task Operations
              </p>
            </div>
          </div>

          {/* Database Mode Switcher & User Profile Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0" id="header_profile_actions">
            
            {/* User credentials banner drawer */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
              <div className="text-right min-w-0 flex flex-col items-end justify-center">
                <p className="text-[9.5px] sm:text-[11px] font-black text-slate-200 whitespace-normal break-words leading-tight text-right max-w-[110px] xs:max-w-[130px] sm:max-w-[200px]">
                  {currentUser.fullname}
                </p>
                <div className="flex items-center justify-end gap-1 font-mono text-[7.5px] sm:text-[9px] font-bold mt-0.5 leading-none">
                  <span className={currentUser.role === 'ADMIN' ? 'text-orange-400' : 'text-blue-400'}>
                    {currentUser.role}
                  </span>
                </div>
                
                {/* S-BASE indicator moved directly under role */}
                <div 
                  className="flex items-center gap-0.5 sm:gap-1 px-1 py-0.5 border rounded text-[6.5px] sm:text-[8px] font-extrabold uppercase mt-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 leading-none select-none shrink-0"
                  title="Database Synchronized with Supabase Cloud"
                >
                  <Database className="w-2.2 h-2.2 sm:w-3 sm:h-3 text-emerald-400" />
                  <span>S-BASE</span>
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              </div>

              {/* Avatar Icon */}
              <div className="w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-lg sm:rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 shadow-inner shrink-0">
                <UserIcon className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-orange-500" />
              </div>

              {/* Log out trigger */}
              <button
                onClick={handleLogout}
                className="p-1 sm:p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 hover:border-slate-750 rounded-lg sm:rounded-xl text-slate-500 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                title="Keluar Akun"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            ADMIN PERSISTENT ROUTING PANEL NAVIGATION TABS
            ----------------------------------------------------------------- */}
        {currentUser.role === 'ADMIN' && (
          <div className="bg-slate-950 border-t border-slate-850/80 w-full overflow-hidden">
            <div className="max-w-7xl mx-auto px-1 sm:px-6 lg:px-8 grid grid-cols-3 sm:flex sm:justify-start sm:gap-1" id="admin_main_tab_deck">
              <button
                onClick={() => setAdminTab('DASHBOARD')}
                className={`py-2 px-0.5 sm:py-3 sm:px-4.5 text-[9px] xs:text-[10px] sm:text-xs font-bold border-b-2 flex flex-col xs:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                  adminTab === 'DASHBOARD'
                    ? 'border-orange-500 text-white bg-slate-900/40 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="truncate">Logs Dashboard</span>
              </button>

              <button
                onClick={() => setAdminTab('MASTER_PANEL')}
                className={`py-2 px-0.5 sm:py-3 sm:px-4.5 text-[9px] xs:text-[10px] sm:text-xs font-bold border-b-2 flex flex-col xs:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                  adminTab === 'MASTER_PANEL'
                    ? 'border-orange-500 text-white bg-slate-900/40 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="truncate">Admin Panel</span>
              </button>

              <button
                onClick={() => setAdminTab('CSV_ARCHIVE')}
                className={`py-2 px-0.5 sm:py-3 sm:px-4.5 text-[9px] xs:text-[10px] sm:text-xs font-bold border-b-2 flex flex-col xs:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                  adminTab === 'CSV_ARCHIVE'
                    ? 'border-orange-500 text-white bg-slate-900/40 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="truncate">Arsip (CSV)</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* -----------------------------------------------------------------------
          MAIN CONTENT CONTAINER (ROUTING BY ACTIVE TAB & ROLE)
          ----------------------------------------------------------------------- */}
      <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 mt-4 sm:mt-8">
        
        {/* Real-time pub/sub trigger assist box (EXCLUSIVELY IN MOCK MODE TO AID EVALUATION) */}
        {dbMode === 'MOCK' && (
          <div className="mb-6 bg-slate-950/60 border border-slate-850 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-2.5 text-left">
              <Zap className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-extrabold text-slate-200">KENDALIKAN SIMULATOR REAL-TIME SYNC (OFFLINE VITE MODE)</p>
                <p className="text-[10px] text-slate-400 block leading-normal md:max-w-xl">
                  Karena Anda berada dalam mode simulasi, Anda dapat menguji fitur <strong>Real-Time Sync</strong> (menerima pembaharuan data langsung di semua window tanpa reloads) dengan memicu event remote acak di bawah ini:
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 w-full md:w-auto justify-end">
              <button
                onClick={() => triggerMockRemoteJob('INSERT')}
                className="flex-1 md:flex-none text-[10px] bg-orange-500 hover:bg-orange-600 font-bold text-white px-3 py-1.5 rounded-lg active:scale-95 cursor-pointer"
              >
                + Simulasikan Task Baru Masuk
              </button>
              <button
                onClick={() => triggerMockRemoteJob('UPDATE')}
                className="flex-1 md:flex-none text-[10px] bg-slate-900 border border-slate-800 text-slate-350 hover:text-white px-3 py-1.5 rounded-lg active:scale-95 cursor-pointer"
              >
                ✓ Simulasikan Rubah Status Pending ke Done
              </button>
            </div>
          </div>
        )}

        {/* VIEW ROUTER FOR ADMIN TABS OR TECHNICIAN DASHBOARD */}
        {currentUser.role === 'ADMIN' && adminTab === 'MASTER_PANEL' ? (
          /* View sub-tab: Administrator CRUD Control panel */
          <AdminPanel
            users={users}
            areas={areas}
            categories={categories}
            maintenanceTypes={maintenanceTypes}
            setUsers={setUsers}
            setAreas={setAreas}
            setCategories={setCategories}
            setMaintenanceTypes={setMaintenanceTypes}
            onRefreshData={async () => {
              // Direct refetch all local registers
              const [u, a, c, m] = await Promise.all([
                dbService.getUsers(),
                dbService.getAreas(),
                dbService.getCategories(),
                dbService.getMaintenanceTypes()
              ]);
              // Update master lists React States
              setUsers(u);
              setAreas(a);
              setCategories(c);
              setMaintenanceTypes(m || []);
            }}
          />
        ) : currentUser.role === 'ADMIN' && adminTab === 'CSV_ARCHIVE' ? (
          /* View sub-tab: Csv Archive spreadsheet */
          <ArchiveHistoryCsv />
        ) : (
          /* View default: Main Technical Work Order Logs and Filtering Dashboard */
          <div className="space-y-5 sm:space-y-8" id="technical_operations_dashboard">
            
            {/* Action Bar containing Creator Button */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 justify-between items-start sm:items-center bg-slate-900/40 p-3 sm:p-6 border border-slate-800 rounded-xl sm:rounded-3xl relative overflow-hidden">
              <div className="text-left">
                <h2 className="text-xs sm:text-base md:text-lg font-extrabold text-white">
                  MANAJEMEN TASK OPERASIONAL
                </h2>
                <p className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-0 leading-relaxed">
                  Melaporkan, mengontrol, dan memverifikasi perbaikan infrastruktur Hotel Harris Gubeng.
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveTaskToEdit(null);
                  setIsFormOpen(true);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold text-white py-2 px-3 sm:py-3 sm:px-6 rounded-lg sm:rounded-2xl text-[10px] sm:text-xs tracking-wider uppercase transition-all shadow-lg shadow-orange-500/15 cursor-pointer mt-0.5 sm:mt-0"
                id="create_task_button"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah Pekerjaan (Work Order)</span>
              </button>
            </div>

            {/* Stats Metrics deck */}
            <MetricCards tasks={displayedTasksForMetrics} currentUserRole={currentUser.role} />

            {/* Filterable Data Directory */}
            <TaskTable
              tasks={displayedTasks}
              areas={areas}
              categories={categories}
              currentUser={currentUser}
              onEditTask={triggerEditForm}
              onDeleteTask={handleDeleteTask}
              onViewDetails={triggerViewDetails}
              onApplyFilters={(filters) => {
                // Instantly recompute active task query results
                setActiveFilters(filters);
              }}
              loading={loading}
            />
          </div>
        )}
      </main>

      {/* -----------------------------------------------------------------------
          ANIMATED MODAL RENDERING (POP-UPS)
          ----------------------------------------------------------------------- */}
      {/* 1. Modal creation / edit task form */}
      <AnimatePresence>
        {isFormOpen && (
          <TaskFormModal
            isOpen={isFormOpen}
            onClose={() => {
              setIsFormOpen(false);
              setActiveTaskToEdit(null);
            }}
            onSave={handleSaveTask}
            taskToEdit={activeTaskToEdit}
            areas={areas}
            categories={categories}
            maintenanceTypes={maintenanceTypes}
            currentUser={currentUser}
          />
        )}
      </AnimatePresence>

      {/* 2. Modal viewing task specs in full detail */}
      <AnimatePresence>
        {isDetailOpen && (
          <TaskDetailsModal
            isOpen={isDetailOpen}
            task={activeTaskToView}
            onClose={() => {
              setIsDetailOpen(false);
              setActiveTaskToView(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* 3. Pop-up loading cepat saat pencarian data */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-bl-full pointer-events-none" />
              <div className="relative flex justify-center">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 animate-pulse">
                  <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-extrabold text-white tracking-widest uppercase font-mono">MENCARI DATA</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Menyaring arsip work order dan menyinkronkan dengan database...
                </p>
              </div>
              <div className="w-full bg-slate-950/60 h-1 rounded-full overflow-hidden border border-slate-850">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                  className="w-1/2 h-full bg-gradient-to-r from-orange-600 to-amber-500 rounded-full"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
