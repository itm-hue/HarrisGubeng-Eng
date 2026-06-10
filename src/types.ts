/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'TEKNISI' | 'ADMIN';

export interface ImageAttachment {
  url: string;
  base64Url?: string;
  fileName: string;
}

export interface User {
  id: string;
  username: string;
  fullname: string;
  role: UserRole;
  createdAt: string;
}

export type TaskStatus = 'Complete' | 'Pending';

export interface Task {
  id: string;
  created_at: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  area_type: string; // Guest Room, Meeting Room, Public Area, Kitchen, or custom masters
  area_detail: string; // Keterangan Area
  specialty: string; // AC, listrik, Sipil, Audio/Video, or custom masters
  shift: '1' | '2' | '3';
  maintenance_type: string; // Corrective, Preventive, Breakdown, etc.
  description: string; // Detail Kerusakan & Tindakan
  image_url: string; // Google Drive webViewLink
  status: TaskStatus;
  technician_name: string;
  technician_id: string;
  history?: any[] | string;
}

export interface AreaMaster {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface CategoryMaster {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface MaintenanceTypeMaster {
  id: string;
  name: string;
  created_at: string;
}

export interface TaskFilter {
  searchQuery: string;
  startDate: string;
  endDate: string;
  status: string; // 'All' | 'Complete' | 'Pending'
  area: string; // 'All' + masters
  category: string; // 'All' + masters
}
