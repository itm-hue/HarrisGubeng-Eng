/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, User, AreaMaster, CategoryMaster, MaintenanceTypeMaster, TaskFilter } from '../types';
import { supabase } from '../supabase';
import { parseImageUrls } from './imageUtils';

export const isConfigured = true;
export { supabase };

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzgygKvfwKLM6CU4FEe0tIxwupi9Aw_K-LtEjSS2SrbFWgFkK-5IPD0oHeAS_Emfsrr_Q/exec';

type RealtimeCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Partial<Task>;
  old: Partial<Task>;
}) => void;

function mapTaskToFrontend(dbTask: any): Task {
  if (!dbTask) return {} as Task;
  let relativeShift: '1' | '2' | '3' = '1';
  if (dbTask.shift_operasional === 'Shift 2 Siang') {
    relativeShift = '2';
  } else if (dbTask.shift_operasional === 'Shift 3 Malam') {
    relativeShift = '3';
  }

  let fMaintType = dbTask.tipe_maintenance || '';
  if (fMaintType === 'Preventive') fMaintType = 'Preventive Maintenance';
  else if (fMaintType === 'Corrective') fMaintType = 'Corrective Maintenance';
  else if (fMaintType === 'Breakdown') fMaintType = 'Breakdown Maintenance';

  let parsedHistory = dbTask.history || [];
  if (typeof parsedHistory === 'string') {
    try {
      parsedHistory = JSON.parse(parsedHistory);
    } catch (e) {
      parsedHistory = [];
    }
  }

  // URL Bayangan jika hanya nama file pendek
  let displayImageUrl = '';
  if (dbTask.image_url) {
    const rawParts = parseImageUrls(dbTask.image_url);
    displayImageUrl = rawParts.map((trimmedPart: string) => {
      if (!trimmedPart) return '';
      if (trimmedPart.startsWith('http') || trimmedPart.startsWith('data:') || trimmedPart.startsWith('blob:')) {
        return trimmedPart;
      }
      return `${GOOGLE_APPS_SCRIPT_URL}?file=${trimmedPart}`;
    }).filter(Boolean).join(', ');
  }

  return {
    id: dbTask.id,
    date: dbTask.tanggal ? dbTask.tanggal.substring(0, 10) : '',
    start_time: dbTask.jam_mulai ? dbTask.jam_mulai.substring(0, 5) : '',
    end_time: dbTask.jam_selesai ? dbTask.jam_selesai.substring(0, 5) : '',
    area_type: dbTask.area || '',
    area_detail: dbTask.keterangan_area || '',
    specialty: dbTask.specialty || '',
    shift: relativeShift,
    maintenance_type: fMaintType,
    description: dbTask.detail_kerusakan_tindakan || '',
    image_url: displayImageUrl,
    status: dbTask.status || 'Pending',
    technician_name: dbTask.created_by_nama || '',
    technician_id: '',
    co_technicians: dbTask.co_technicians || '',
    created_at: dbTask.created_at,
    history: parsedHistory
  };
}

function mapTaskToBackend(task: Partial<Task>): any {
  const result: any = {};
  if (task.date !== undefined) result.tanggal = task.date;
  if (task.start_time !== undefined) result.jam_mulai = task.start_time;
  if (task.end_time !== undefined) result.jam_selesai = task.end_time;
  if (task.area_type !== undefined) result.area = task.area_type;
  if (task.area_detail !== undefined) result.keterangan_area = task.area_detail;
  if (task.specialty !== undefined) result.specialty = task.specialty;
  
  if (task.shift !== undefined) {
    let dbShift = 'Shift 1 Pagi';
    if (task.shift === '2') dbShift = 'Shift 2 Siang';
    else if (task.shift === '3') dbShift = 'Shift 3 Malam';
    result.shift_operasional = dbShift;
  }
  
  if (task.maintenance_type !== undefined) {
    let dbMaintType = task.maintenance_type;
    if (dbMaintType === 'Preventive Maintenance') dbMaintType = 'Preventive';
    else if (dbMaintType === 'Corrective Maintenance') dbMaintType = 'Corrective';
    else if (dbMaintType === 'Breakdown Maintenance') dbMaintType = 'Breakdown';
    result.tipe_maintenance = dbMaintType;
  }
  if (task.description !== undefined) result.detail_kerusakan_tindakan = task.description;
  
  if (task.image_url !== undefined) {
    result.image_url = task.image_url || null;
  }
  if (task.status !== undefined) result.status = task.status;
  if (task.technician_name !== undefined) result.created_by_nama = task.technician_name;
  if (task.co_technicians !== undefined) result.co_technicians = task.co_technicians;
  if (task.history !== undefined) result.history = task.history;
  
  return result;
}

let cachedAreas: any[] | null = null;
let cachedCategories: any[] | null = null;

export function mapDbUserToFrontend(u: any): User {
  if (!u) return {} as User;
  let rawFullname = u.nama_lengkap || u.fullname || '';
  let role: 'ADMIN' | 'TEKNISI' | 'USER' = 'TEKNISI';
  
  if (rawFullname.endsWith(' [USER]')) {
    role = 'USER';
    rawFullname = rawFullname.substring(0, rawFullname.length - 7);
  } else if (u.role === 'Admin' || u.role === 'ADMIN') {
    role = 'ADMIN';
  } else if (u.role === 'User' || u.role === 'USER') {
    role = 'USER';
  } else {
    role = 'TEKNISI';
  }

  return {
    id: u.id,
    username: u.username || '',
    fullname: rawFullname,
    role,
    password: u.password_text || u.password || '',
    createdAt: u.created_at || u.createdAt || new Date().toISOString()
  };
}

export function mapFrontendUserToDb(user: Partial<User> & { password?: string }): {
  username: string;
  nama_lengkap: string;
  role: string;
  password_text?: string;
} {
  const isAdmin = user.role === 'ADMIN';
  const isUser = user.role === 'USER';
  const dbRole = isAdmin ? 'Admin' : (isUser ? 'User' : 'Teknisi');
  
  let cleanFullname = (user.fullname || '').trim();
  if (cleanFullname.endsWith(' [USER]')) {
    cleanFullname = cleanFullname.substring(0, cleanFullname.length - 7);
  }
  
  const payload: any = {
    username: (user.username || '').trim().toLowerCase(),
    nama_lengkap: cleanFullname,
    role: dbRole
  };
  
  if (user.password !== undefined) {
    payload.password_text = user.password;
  }
  
  return payload;
}

async function triggerPushNotification(action: 'INSERT' | 'UPDATE', task: Task) {
  try {
    let title = '';
    let body = '';
    
    if (action === 'INSERT') {
      title = 'Work Order Baru! 🛠️';
      body = `Area: ${task.area_type || 'N/A'} (${task.area_detail || '-'}) - ${task.description || '-'}`;
    } else if (action === 'UPDATE' && task.status === 'Complete') {
      title = 'WO Selesai Diperbaiki! ✅';
      body = `Tugas di area ${task.area_type || ''} (${task.area_detail || ''}) telah diselesaikan oleh ${task.technician_name || 'Teknisi'}`;
    } else {
      return;
    }

    const payload = {
      title,
      body,
      tag: `harris-wo-${task.id}`,
      data: {
        url: '/',
        taskId: task.id
      }
    };

    const endpointUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/send-web-push` : '/api/send-web-push';
    
    fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).then(res => res.json())
      .then(data => console.log('[PUSH CLIENT] Hasil pengiriman notifikasi push:', data))
      .catch(err => console.error('[PUSH CLIENT] Gagal memicu push notification:', err));
  } catch (err) {
    console.warn('Silent error triggering client-side web push:', err);
  }
}

export const dbService = {
  isMockMode(): boolean { return false; },
  setDbMode(mode: 'MOCK' | 'REAL') {},
  getGoogleAppsScriptUrl(): string { return GOOGLE_APPS_SCRIPT_URL; },

  // --- USERS MANAGEMENT ---
  async getUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase.from('users').select('*').order('nama_lengkap', { ascending: true });
      if (error) throw error;
      return (data || []).map((u: any) => mapDbUserToFrontend(u));
    } catch (e) {
      console.error('getUsers failed:', e);
      return [];
    }
  },

  async createUser(user: Omit<User, 'id' | 'createdAt'> & { password?: string }): Promise<User> {
    const dbPayload = mapFrontendUserToDb(user);
    const { data, error } = await supabase.from('users').insert([{
      ...dbPayload,
      created_at: new Date().toISOString()
    }]).select();
    if (error) throw error;
    return mapDbUserToFrontend(data[0]);
  },

  async updateUser(user: User): Promise<User> {
    const dbPayload = mapFrontendUserToDb(user);
    const { error } = await supabase.from('users')
      .update(dbPayload)
      .eq('id', user.id);
    if (error) throw error;
    return user;
  },

  async deleteUser(id: string): Promise<boolean> {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // --- AREA MASTER ---
  async getAreas(): Promise<AreaMaster[]> {
    try {
      const { data, error } = await supabase.from('areas').select('*').order('nama_area', { ascending: true });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        name: a.nama_area || '',
        description: '',
        created_at: a.created_at
      }));
    } catch (e) {
      return [];
    }
  },

  async createArea(area: Omit<AreaMaster, 'id' | 'created_at'>): Promise<AreaMaster> {
    const { data, error } = await supabase.from('areas').insert([{ nama_area: area.name.trim() }]).select();
    if (error) throw error;
    return { id: data[0].id, name: data[0].nama_area, description: '', created_at: data[0].created_at };
  },

  async deleteArea(id: string): Promise<boolean> {
    const { error } = await supabase.from('areas').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // --- CATEGORIES MASTER ---
  async getCategories(): Promise<CategoryMaster[]> {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('nama_kategori', { ascending: true });
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.nama_kategori || '',
        description: '',
        created_at: c.created_at
      }));
    } catch (e) {
      return [];
    }
  },

  async createCategory(cat: Omit<CategoryMaster, 'id' | 'created_at'>): Promise<CategoryMaster> {
    const { data, error } = await supabase.from('categories').insert([{ nama_kategori: cat.name.trim() }]).select();
    if (error) throw error;
    return { id: data[0].id, name: data[0].nama_kategori, description: '', created_at: data[0].created_at };
  },

  async deleteCategory(id: string): Promise<boolean> {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // --- MAINTENANCE TYPES ---
  async getMaintenanceTypes(): Promise<MaintenanceTypeMaster[]> {
    try {
      const { data, error } = await supabase.from('maintenance_types').select('*').order('nama_tipe', { ascending: true });
      if (error) throw error;
      return (data || []).map((m: any) => ({ id: m.id, name: m.nama_tipe || '', created_at: m.created_at }));
    } catch (e) {
      return [];
    }
  },

  async createMaintenanceType(type: Omit<MaintenanceTypeMaster, 'id' | 'created_at'>): Promise<MaintenanceTypeMaster> {
    const { data, error } = await supabase.from('maintenance_types').insert([{ nama_tipe: type.name.trim() }]).select();
    if (error) throw error;
    return { id: data[0].id, name: data[0].nama_tipe, created_at: data[0].created_at };
  },

  async deleteMaintenanceType(id: string): Promise<boolean> {
    const { error } = await supabase.from('maintenance_types').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // --- TASK MANAGEMENT ---
  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    let tasks: Task[] = [];
    try {
      let query = supabase.from('tasks').select('*');
      
      if (filter) {
        if (filter.startDate) {
          query = query.gte('tanggal', filter.startDate);
        }
        if (filter.endDate) {
          query = query.lte('tanggal', filter.endDate);
        }
        if (filter.status && filter.status !== 'All' && filter.status !== 'Semua' && filter.status !== '') {
          const dbStat = filter.status;
          if (dbStat.toLowerCase() === 'selesai' || dbStat.toLowerCase() === 'complete' || dbStat.toLowerCase() === 'done') {
            query = query.or('status.eq.Complete,status.eq.done,status.eq.Selesai');
          } else if (dbStat.toLowerCase() === 'pending') {
            query = query.eq('status', 'Pending');
          }
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      tasks = (data || []).map(mapTaskToFrontend);
    } catch (e) {
      console.error('Real Supabase tasks retrieval failed:', e);
      return [];
    }

    if (!filter) return tasks;

    let areaName = filter.area;
    let categoryName = filter.category;

    // Use cached areas & categories to prevent multiple SQL roundtrips for metadata resolving
    try {
      if (filter.area && filter.area !== 'All' && filter.area !== 'Semua') {
        if (!cachedAreas) {
          const { data: areasData } = await supabase.from('areas').select('*');
          cachedAreas = areasData || [];
        }
        const match = cachedAreas.find(a => a.id === filter.area || (a.nama_area && a.nama_area === filter.area));
        if (match) areaName = match.nama_area;
      }
      if (filter.category && filter.category !== 'All' && filter.category !== 'Semua') {
        if (!cachedCategories) {
          const { data: catData } = await supabase.from('categories').select('*');
          cachedCategories = catData || [];
        }
        const match = cachedCategories.find(c => c.id === filter.category || (c.nama_kategori && c.nama_kategori === filter.category));
        if (match) categoryName = match.nama_kategori;
      }
    } catch (err) {
      console.warn('Fallback resolving IDs in getTasks:', err);
    }

    let filtered = [...tasks];

    if (filter.status && filter.status !== 'All' && filter.status !== 'Semua' && filter.status !== '') {
      const sVal = filter.status.toLowerCase();
      filtered = filtered.filter(t => {
        const tStat = t.status ? t.status.toLowerCase() : '';
        if (sVal === 'complete' || sVal === 'done' || sVal === 'selesai') return tStat === 'complete' || tStat === 'done' || tStat === 'selesai';
        return tStat === sVal;
      });
    }

    if (areaName && areaName !== 'All' && areaName !== 'Semua' && areaName !== '') {
      filtered = filtered.filter(t => t.area_type === areaName);
    }

    if (categoryName && categoryName !== 'All' && categoryName !== 'Semua' && categoryName !== '') {
      filtered = filtered.filter(t => t.specialty === categoryName);
    }

    if (filter.searchQuery && filter.searchQuery.trim() !== '') {
      const query = filter.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(t => 
        (t.technician_name || '').toLowerCase().includes(query) ||
        (t.area_detail || '').toLowerCase().includes(query) ||
        (t.area_type || '').toLowerCase().includes(query) ||
        (t.specialty || '').toLowerCase().includes(query) ||
        (t.description || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  },

  async createTask(task: Omit<Task, 'id' | 'created_at'>): Promise<Task> {
    const dbPayload = mapTaskToBackend(task);
    const { data, error } = await supabase.from('tasks').insert([dbPayload]).select();
    if (error) throw error;
    const created = mapTaskToFrontend(data[0]);
    triggerPushNotification('INSERT', created);
    return created;
  },

  async updateTask(task: Task): Promise<Task> {
    const dbPayload = mapTaskToBackend(task);
    const { error } = await supabase.from('tasks').update(dbPayload).eq('id', task.id);
    if (error) throw error;
    if (task.status === 'Complete') {
      triggerPushNotification('UPDATE', task);
    }
    return task;
  },

  async deleteTask(id: string): Promise<boolean> {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // --- CORE REALTIME SUBSCRIPTION BINDING ---
  subscribeToTasks(callback: RealtimeCallback) {
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        callback({
          eventType: payload.eventType,
          new: payload.new ? mapTaskToFrontend(payload.new) : {},
          old: payload.old ? mapTaskToFrontend(payload.old) : {}
        });
      }).subscribe();
    return { unsubscribe: () => { supabase.removeChannel(channel); } };
  },

  subscribeToUsers(callback: (payload: any) => void) {
    const channel = supabase.channel('users-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload: any) => {
        callback({
          eventType: payload.eventType,
          new: payload.new ? mapDbUserToFrontend(payload.new) : {},
          old: payload.old ? mapDbUserToFrontend(payload.old) : {}
        });
      }).subscribe();
    return { unsubscribe: () => { supabase.removeChannel(channel); } };
  },

  subscribeToAreas(callback: (payload: any) => void) {
    const channel = supabase.channel('areas-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'areas' }, (payload: any) => {
        const mapArea = (a: any) => !a ? {} : { id: a.id, name: a.nama_area || '', description: '', created_at: a.created_at };
        callback({ eventType: payload.eventType, new: mapArea(payload.new), old: mapArea(payload.old) });
      }).subscribe();
    return { unsubscribe: () => { supabase.removeChannel(channel); } };
  },

  subscribeToCategories(callback: (payload: any) => void) {
    const channel = supabase.channel('categories-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload: any) => {
        const mapCategory = (c: any) => !c ? {} : { id: c.id, name: c.nama_kategori || '', description: '', created_at: c.created_at };
        callback({ eventType: payload.eventType, new: mapCategory(payload.new), old: mapCategory(payload.old) });
      }).subscribe();
    return { unsubscribe: () => { supabase.removeChannel(channel); } };
  },

  async triggerDemoSync(eventType: 'INSERT' | 'UPDATE', customTask?: Partial<Task>) { return null; },

  // --- IMAGE UPLOAD TO GOOGLE DRIVE ---
  async uploadImageToGoogleDrive(base64Data: string, fileName: string, folderId: string = "1pGCKZQo45p7ZsFZiaEvknP8hyFsYtnhe"): Promise<string> {
    const generatedShortName = fileName || `TASK_${Date.now()}.jpg`;
    try {
      let cleanBase64 = base64Data;
      let mimeType = 'image/jpeg';
      const match = base64Data.match(/^data:([^;]+);base64,/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = base64Data.substring(base64Data.indexOf('base64,') + 7);
      }
      
      // Inject folder ID query parameters into the target url for Google Apps Script deployment configurations reading from e.parameter
      const targetUrl = `${GOOGLE_APPS_SCRIPT_URL}?folderId=${encodeURIComponent(folderId)}&folder_id=${encodeURIComponent(folderId)}&folder=${encodeURIComponent(folderId)}&parentId=${encodeURIComponent(folderId)}`;
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ 
          base64: cleanBase64, 
          base65: cleanBase64, 
          mimeType, 
          fileName: generatedShortName,
          folderId: folderId,
          folder_id: folderId,
          folder: folderId,
          parentId: folderId
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.status === 'success' && result.url) {
          return result.url; // Return the direct static hotlink drive URL from the script
        } else {
          throw new Error(result?.message || 'Google Apps Script returned status: unsuccessful');
        }
      } else {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
    } catch (e) {
      console.error('Failed to upload image to Google Drive:', e);
      throw e; // Throw to let the caller handle the fallback correctly
    }
  },

  // --- IMAGE DELETION FROM GOOGLE DRIVE ---
  async deleteImageFromGoogleDrive(url: string): Promise<boolean> {
    if (!url) return false;
    
    // Extract file ID if it is a Google Drive URL
    let fileId = '';
    let fileName = '';

    // If it's a blob url or raw base64 data, do not attempt deletion
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      return false;
    }

    const dMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    
    if (dMatch) {
      fileId = dMatch[1];
    } else if (idMatch) {
      fileId = idMatch[1];
    } else if (url.startsWith('https://lh3.googleusercontent.com/d/')) {
      fileId = url.replace('https://lh3.googleusercontent.com/d/', '');
    } else if (!url.startsWith('http') && url.length >= 25 && !url.includes(',') && !url.includes(' ') && !url.includes('.')) {
      // It is a direct fileId
      fileId = url;
    }

    try {
      if (url.startsWith('http')) {
        const parsedUrl = new URL(url);
        const fileParam = parsedUrl.searchParams.get('file');
        if (fileParam) {
          fileName = fileParam;
          if (!fileId && !fileParam.startsWith('TASK_') && fileParam.length >= 20) {
            fileId = fileParam;
          }
        }
        const idParam = parsedUrl.searchParams.get('id');
        if (idParam) {
          if (!fileId) fileId = idParam;
        }
      } else if (url.startsWith('TASK_')) {
        fileName = url;
      }
    } catch (err) {
      // Ignore
    }

    if (!fileId && !fileName) {
      if (url.length > 5 && !url.includes('/') && !url.includes(':')) {
        fileId = url;
        fileName = url;
      } else {
        return false;
      }
    }

    console.log(`Menghapus foto dari Google Drive: ${url} (File ID: ${fileId || 'N/A'}, File Name: ${fileName || 'N/A'})`);

    try {
      // Prepare multi-format payload to support standard Apps Script delete action configurations
      const payload = {
        action: 'delete',
        fileId: fileId,
        id: fileId,
        fileUrl: url,
        url: url,
        fileName: fileName,
        name: fileName,
        file: fileName || fileId,
        delete: true,
        deleteFile: fileId
      };

      // Add query params to URL to ensure script can parse query parameters (e.g. e.parameter.action)
      const targetUrl = `${GOOGLE_APPS_SCRIPT_URL}?action=delete&fileId=${encodeURIComponent(fileId)}&fileName=${encodeURIComponent(fileName)}&file=${encodeURIComponent(fileName || fileId)}&id=${encodeURIComponent(fileId)}&delete=true`;

      // Perform a GET send as well, since GET is extremely reliable for Google Apps Script and bypasses CORS redirects
      try {
        fetch(targetUrl, { method: 'GET', mode: 'no-cors' }).catch(err => console.warn('Silent fallback GET err:', err));
      } catch (e) {
        // ignore
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Google Apps Script delete response:', result);
        return result && (result.status === 'success' || result.success);
      }
      return true;
    } catch (e) {
      console.error('Gagal menghapus file di Google Drive:', e);
      return false;
    }
  },

  // --- PUSH NOTIFICATION SUBSCRIPTION ---
  async savePushSubscription(sub: any, userId?: string, username?: string): Promise<boolean> {
    try {
      const keys = sub.keys || (typeof sub.toJSON === 'function' ? sub.toJSON().keys : null);
      const payload = {
        user_id: userId || null,
        username: username || null,
        endpoint: sub.endpoint,
        keys_p256dh: keys?.p256dh || '',
        keys_auth: keys?.auth || '',
        created_at: new Date().toISOString()
      };

      // Check if already exists, update if true, else insert
      const { data: existing, error: selectErr } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', sub.endpoint)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('push_subscriptions')
          .update({
            user_id: userId || null,
            username: username || null,
            keys_p256dh: keys?.p256dh || '',
            keys_auth: keys?.auth || ''
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('push_subscriptions')
          .insert([payload]);
        if (error) throw error;
      }
      return true;
    } catch (e) {
      console.error('Error saving push subscription to Supabase:', e);
      return false;
    }
  },

  async deletePushSubscription(endpoint: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error deleting push subscription from Supabase:', e);
      return false;
    }
  }
};