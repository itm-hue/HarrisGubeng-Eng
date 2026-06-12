/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, AreaMaster, CategoryMaster, MaintenanceTypeMaster } from '../types';
import { dbService } from '../lib/supabase';
import { Users, Map, Tags, Hammer, Plus, Trash2, Edit2, ShieldAlert, BadgeCheck, X, Check, Save, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  users: User[];
  areas: AreaMaster[];
  categories: CategoryMaster[];
  maintenanceTypes: MaintenanceTypeMaster[];
  onRefreshData: () => Promise<void>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setAreas: React.Dispatch<React.SetStateAction<AreaMaster[]>>;
  setCategories: React.Dispatch<React.SetStateAction<CategoryMaster[]>>;
  setMaintenanceTypes: React.Dispatch<React.SetStateAction<MaintenanceTypeMaster[]>>;
}

type AdminSubTab = 'USERS' | 'AREAS' | 'CATEGORIES' | 'MAINTENANCE_TYPES';

export default function AdminPanel({
  users,
  areas,
  categories,
  maintenanceTypes,
  onRefreshData,
  setUsers,
  setAreas,
  setCategories,
  setMaintenanceTypes
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminSubTab>('USERS');
  const [saving, setSaving] = useState(false);

  // Users specific States
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormFullname, setUserFormFullname] = useState('');
  const [userFormRole, setUserFormRole] = useState<'TEKNISI' | 'ADMIN' | 'USER'>('TEKNISI');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);

  // Custom Confirmation Modal states
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<{ id: string; username: string; fullname: string; role: 'TEKNISI' | 'ADMIN' | 'USER'; password?: string } | null>(null);

  // Area specific States
  const [areaFormName, setAreaFormName] = useState('');
  const [showCreateArea, setShowCreateArea] = useState(false);
  const [areaToCreate, setAreaToCreate] = useState<string | null>(null);
  const [areaToDelete, setAreaToDelete] = useState<AreaMaster | null>(null);

  // Category specific States
  const [catFormName, setCatFormName] = useState('');
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [catToCreate, setCatToCreate] = useState<string | null>(null);
  const [catToDelete, setCatToDelete] = useState<CategoryMaster | null>(null);

  // Maintenance Type specific States
  const [mtFormName, setMtFormName] = useState('');
  const [showCreateMt, setShowCreateMt] = useState(false);
  const [mtToCreate, setMtToCreate] = useState<string | null>(null);
  const [mtToDelete, setMtToDelete] = useState<MaintenanceTypeMaster | null>(null);

  // --- ACTIONS: USER MANAGEMENT ---
  const handleSimpanUserDirect = async () => {
    const username = userFormUsername;
    const password_text = userFormPassword;
    const nama_lengkap = userFormFullname;
    const role = userFormRole;

    console.log("Tombol Berhasil Diklik! Data yang akan dikirim:", { username, password_text, nama_lengkap, role });

    if (!username.trim() || !nama_lengkap.trim() || !password_text.trim()) {
      alert("Mohon isi semua kolom!");
      return;
    }

    setSaving(true);
    try {
      const newUser = await dbService.createUser({
        username: username.trim().toLowerCase(),
        fullname: nama_lengkap.trim(),
        role: role,
        password: password_text.trim()
      });
      
      // Update local state React lists on-the-fly instantly
      setUsers((prev) => {
        if (prev.some(u => u.id === newUser.id)) return prev;
        return [...prev, newUser];
      });

      // Clear form
      setUserFormUsername('');
      setUserFormFullname('');
      setUserFormRole('TEKNISI');
      setUserFormPassword('');
      setShowCreateUser(false);
      await onRefreshData();
    } catch (e: any) {
      alert('Gagal membuat user: ' + (e?.message || e?.toString() || 'Kesalahan tidak diketahui'));
    } finally {
      setSaving(false);
    }
  };

  const startEditUser = (u: User) => {
    setEditingUserId(u.id);
    setUserFormUsername(u.username);
    setUserFormFullname(u.fullname);
    setUserFormRole(u.role);
    setUserFormPassword(u.password || '');
  };

  // Open confirmation modal instead of calling directly
  const handleUpdateUser = (uId: string) => {
    if (!userFormUsername.trim() || !userFormFullname.trim()) return;
    const targetUser = users.find(u => u.id === uId);
    if (targetUser) {
      setUserToEdit({
        id: uId,
        username: userFormUsername,
        fullname: userFormFullname,
        role: userFormRole,
        password: userFormPassword
      });
    }
  };

  const executeUpdateUser = async () => {
    if (!userToEdit) return;
    setSaving(true);
    try {
      const existingUser = users.find(u => u.id === userToEdit.id);
      if (existingUser) {
        const payload: User = {
          ...existingUser,
          username: userToEdit.username.trim().toLowerCase(),
          fullname: userToEdit.fullname.trim(),
          role: userToEdit.role,
          password: userToEdit.password?.trim()
        };
        
        await dbService.updateUser(payload);
        
        // INSTANTLY update state on the fly
        setUsers((prev) => prev.map(u => u.id === userToEdit.id ? payload : u));
        
        setEditingUserId(null);
        setUserFormPassword('');
        await onRefreshData();
      }
    } catch (e: any) {
      alert('Gagal mengupdate user: ' + (e?.message || e?.toString() || 'Kesalahan tidak diketahui'));
    } finally {
      setSaving(false);
      setUserToEdit(null);
    }
  };

  // Open delete confirmation modal instead of standard confirm dialog
  const handleDeleteUser = (uId: string, uName: string) => {
    const target = users.find(u => u.id === uId);
    if (target) {
      setUserToDelete(target);
    }
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    setSaving(true);
    try {
      await dbService.deleteUser(userToDelete.id);
      
      // INSTANTLY remove deleted user from local state on the fly
      setUsers((prev) => prev.filter(u => u.id !== userToDelete.id));
      
      await onRefreshData();
    } catch (e: any) {
      alert('Gagal menghapus user: ' + (e?.message || e?.toString() || 'Kesalahan tidak diketahui'));
    } finally {
      setSaving(false);
      setUserToDelete(null);
    }
  };

  // --- ACTIONS: AREA MASTER ---
  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaFormName.trim()) return;
    setAreaToCreate(areaFormName.trim());
  };

  const executeCreateArea = async () => {
    if (!areaToCreate) return;
    setSaving(true);
    try {
      const newArea = await dbService.createArea({
        name: areaToCreate,
        description: ''
      });
      // Update local state instantly (anti-delay)
      setAreas((prev) => {
        if (prev.some(a => a.id === newArea.id)) return prev;
        return [...prev, newArea];
      });
      setAreaFormName('');
      setShowCreateArea(false);
      await onRefreshData();
    } catch (e: any) {
      alert('Gagal menyimpan area baru: ' + (e?.message || e?.toString()));
    } finally {
      setSaving(false);
      setAreaToCreate(null);
    }
  };

  const handleDeleteAreaClick = (a: AreaMaster) => {
    setAreaToDelete(a);
  };

  const executeDeleteArea = async () => {
    if (!areaToDelete) return;
    setSaving(true);
    try {
      await dbService.deleteArea(areaToDelete.id);
      // Update local state instantly (anti-delay)
      setAreas((prev) => prev.filter(a => a.id !== areaToDelete.id));
      await onRefreshData();
    } catch (e: any) {
      alert('Gagal menghapus master Area: ' + (e?.message || e?.toString()));
    } finally {
      setSaving(false);
      setAreaToDelete(null);
    }
  };

  // --- ACTIONS: CATEGORIES MASTER ---
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormName.trim()) return;
    setCatToCreate(catFormName.trim());
  };

  const executeCreateCategory = async () => {
    if (!catToCreate) return;
    setSaving(true);
    try {
      const newCat = await dbService.createCategory({
        name: catToCreate,
        description: ''
      });
      // Update local state instantly (anti-delay)
      setCategories((prev) => {
        if (prev.some(c => c.id === newCat.id)) return prev;
        return [...prev, newCat];
      });
      setCatFormName('');
      setShowCreateCat(false);
      await onRefreshData();
    } catch (e: any) {
      alert('Gagal menyimpan kategori baru: ' + (e?.message || e?.toString()));
    } finally {
      setSaving(false);
      setCatToCreate(null);
    }
  };

  const handleDeleteCategoryClick = (c: CategoryMaster) => {
    setCatToDelete(c);
  };

  const executeDeleteCategory = async () => {
    if (!catToDelete) return;
    setSaving(true);
    try {
      await dbService.deleteCategory(catToDelete.id);
      // Update local state instantly (anti-delay)
      setCategories((prev) => prev.filter(c => c.id !== catToDelete.id));
      await onRefreshData();
    } catch (e: any) {
      alert('Gagal menghapus master Kategori: ' + (e?.message || e?.toString()));
    } finally {
      setSaving(false);
      setCatToDelete(null);
    }
  };

  // --- ACTIONS: MAINTENANCE TYPES ---
  const handleCreateMt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mtFormName.trim()) return;
    setMtToCreate(mtFormName.trim());
  };

  const executeCreateMt = async () => {
    if (!mtToCreate) return;
    setSaving(true);
    try {
      const newMt = await dbService.createMaintenanceType({
        name: mtToCreate
      });
      // Update local state instantly (anti-delay)
      setMaintenanceTypes((prev) => {
        if (prev.some(m => m.id === newMt.id)) return prev;
        return [...prev, newMt];
      });
      setMtFormName('');
      setShowCreateMt(false);
      await onRefreshData();
    } catch (e: any) {
      alert('Gagal menyimpan tipe maintenance baru: ' + (e?.message || e?.toString()));
    } finally {
      setSaving(false);
      setMtToCreate(null);
    }
  };

  const handleDeleteMtClick = (m: MaintenanceTypeMaster) => {
    setMtToDelete(m);
  };

  const executeDeleteMt = async () => {
    if (!mtToDelete) return;
    setSaving(true);
    try {
      await dbService.deleteMaintenanceType(mtToDelete.id);
      // Update local state instantly (anti-delay)
      setMaintenanceTypes((prev) => prev.filter(m => m.id !== mtToDelete.id));
      await onRefreshData();
    } catch (e: any) {
      alert('Gagal menghapus tipe maintenance: ' + (e?.message || e?.toString()));
    } finally {
      setSaving(false);
      setMtToDelete(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-3xl overflow-hidden shadow-xl shadow-black/15" id="administrator_control_panel">
      {/* Visual Navigation Subtab headers */}
      <div className="p-3 sm:p-6 border-b border-slate-800 bg-slate-900/60 flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="text-left w-full lg:w-auto">
          <h2 className="text-sm sm:text-lg font-extrabold text-white tracking-wide uppercase">
            ADMINISTRATOR MASTER PANEL
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 leading-normal">
            Kelola data akun, wilayah operasional hotel, dan kategori kerja teknisi.
          </p>
        </div>

        {/* Tab triggers */}
        <div className="grid grid-cols-2 md:flex bg-slate-950 p-1 rounded-xl sm:rounded-2xl border border-slate-850 w-full lg:w-auto shrink-0 gap-1" id="admin_subtab_selectors">
          <button
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center justify-center gap-1 px-1.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-bold font-sans cursor-pointer transition-all ${
              activeTab === 'USERS'
                ? 'bg-orange-500 text-white shadow shadow-orange-500/10'
                : 'text-slate-400 hover:text-white bg-transparent'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Kelola Akun ({users.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('AREAS')}
            className={`flex items-center justify-center gap-1 px-1.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-bold font-sans cursor-pointer transition-all ${
              activeTab === 'AREAS'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white bg-transparent'
            }`}
          >
            <Map className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Master Area ({areas.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('CATEGORIES')}
            className={`flex items-center justify-center gap-1 px-1.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-bold font-sans cursor-pointer transition-all ${
              activeTab === 'CATEGORIES'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white bg-transparent'
            }`}
          >
            <Tags className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Kategori ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('MAINTENANCE_TYPES')}
            className={`flex items-center justify-center gap-1 px-1.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-bold font-sans cursor-pointer transition-all ${
              activeTab === 'MAINTENANCE_TYPES'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white bg-transparent'
            }`}
          >
            <Hammer className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Maintenance ({maintenanceTypes.length})</span>
          </button>
        </div>
      </div>

      {/* Tabs active viewports */}
      <div className="p-3 sm:p-6">
        {/* TAB 1: USERS */}
        {activeTab === 'USERS' && (
          <div className="space-y-4 sm:space-y-6" id="users_management_tab">
            <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center bg-slate-950/40 p-3 sm:p-4 border border-slate-850 rounded-xl sm:rounded-2xl gap-3">
              <div className="text-left">
                <h3 className="text-xs sm:text-sm font-bold text-slate-200">Daftar Akun Teknisi & Admin</h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Mendaftarkan personel yang diijinkan mengisi log work order.</p>
              </div>
              <button
                onClick={() => setShowCreateUser(!showCreateUser)}
                className="w-full xs:w-auto flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold text-white py-2 px-3 sm:py-2 sm:px-4 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs transition-colors cursor-pointer shadow-md shadow-orange-600/10 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrasi Akun</span>
              </button>
            </div>

            {/* Create Account Modal Popup (Mobile, Tablet, and PC) */}
            <AnimatePresence>
              {showCreateUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md" id="create_user_modal">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ type: 'spring', duration: 0.3 }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-left"
                  >
                    {/* Header */}
                    <div className="bg-slate-950 px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-805 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/30">
                          <Plus className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                          <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">REGISTRASI AKUN BARU</h3>
                          <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">CREATE PERSONNEL PROFILE</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setShowCreateUser(false)} 
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg duration-150 cursor-pointer"
                      >
                        <X className="w-4.5 h-4.5" />
                      </button>
                    </div>

                    {/* Form body */}
                    <div className="p-4 sm:p-5 space-y-4">
                      <div className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Username Login</label>
                            <input
                              type="text"
                              required
                              value={userFormUsername}
                              onChange={(e) => setUserFormUsername(e.target.value)}
                              placeholder="e.g. bobby (lowercase)"
                              className="w-full bg-slate-950/60 border border-slate-805 focus:border-orange-500 text-white rounded-lg py-2 px-3 text-xs focus:outline-none placeholder:text-slate-605 transition-all font-mono"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nama Lengkap</label>
                            <input
                              type="text"
                              required
                              value={userFormFullname}
                              onChange={(e) => setUserFormFullname(e.target.value)}
                              placeholder="Bobby Pratama"
                              className="w-full bg-slate-950/60 border border-slate-850 focus:border-orange-500 text-white rounded-lg py-2 px-3 text-xs focus:outline-none placeholder:text-slate-605 transition-all"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Otoritas Role</label>
                            <select
                              value={userFormRole}
                              onChange={(e) => setUserFormRole(e.target.value as any)}
                              className="w-full bg-slate-950/60 border border-slate-805 focus:border-orange-500 text-slate-205 rounded-lg py-2 px-2.5 text-xs focus:outline-none transition-all"
                            >
                              <option value="TEKNISI">TEKNISI (Work Order)</option>
                              <option value="ADMIN">ADMIN (Supervision & PDF)</option>
                              <option value="USER">USER (Input Work Order Only)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                            <input
                              type="text"
                              required
                              value={userFormPassword}
                              onChange={(e) => setUserFormPassword(e.target.value)}
                              placeholder="Sandi login akun"
                              className="w-full bg-slate-955 bg-slate-950/60 border border-slate-805 focus:border-orange-500 text-white rounded-lg py-2 px-3 text-xs focus:outline-none placeholder:text-slate-605 transition-all font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-850/60">
                        <button
                          type="button"
                          onClick={() => setShowCreateUser(false)}
                          className="py-2 px-4 rounded-lg bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-semibold hover:text-white duration-150 cursor-pointer active:scale-95"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleSimpanUserDirect}
                          disabled={saving}
                          className="py-2 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold cursor-pointer transition-all active:scale-95 shadow-md shadow-orange-600/10 shrink-0"
                        >
                          {saving ? 'Menyimpan...' : 'Draft Personil'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Desktop Account List Table */}
            <div className="hidden md:block overflow-x-auto border border-slate-800/80 rounded-2xl" id="users_board_table">
              <table className="w-full text-left text-xs text-nowrap">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-4 font-semibold">Username</th>
                    <th className="p-4 font-semibold">Nama Lengkap</th>
                    <th className="p-4 font-semibold">Otoritas Role</th>
                    <th className="p-4 font-semibold">Password</th>
                    <th className="p-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-300">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-950/20">
                      {editingUserId === u.id ? (
                        <>
                          <td className="p-4">
                            <input
                              type="text"
                              value={userFormUsername}
                              onChange={(e) => setUserFormUsername(e.target.value)}
                              className="bg-slate-950 border border-slate-800 text-white rounded-md py-1 px-2 font-mono"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              value={userFormFullname}
                              onChange={(e) => setUserFormFullname(e.target.value)}
                              className="bg-slate-950 border border-slate-800 text-white rounded-md py-1 px-2"
                            />
                          </td>
                          <td className="p-4">
                            <select
                              value={userFormRole}
                              onChange={(e) => setUserFormRole(e.target.value as any)}
                              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-md py-1 px-2"
                            >
                              <option value="TEKNISI">TEKNISI</option>
                              <option value="ADMIN">ADMIN</option>
                              <option value="USER">USER</option>
                            </select>
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              value={userFormPassword}
                              onChange={(e) => setUserFormPassword(e.target.value)}
                              placeholder="Password"
                              className="bg-slate-950 border border-slate-800 text-white rounded-md py-1 px-2 font-mono w-28"
                            />
                          </td>
                          <td className="p-4 text-right flex justify-end gap-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleUpdateUser(u.id)}
                              disabled={saving}
                              className="p-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Ok</span>
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="p-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 cursor-pointer"
                            >
                              Batal
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-4 font-semibold font-mono text-slate-100">{u.username}</td>
                          <td className="p-4">{u.fullname}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-[10px] font-bold ${
                              u.role === 'ADMIN'
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                : u.role === 'USER'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {u.role === 'ADMIN' ? 'ADMINISTRATOR' : u.role === 'USER' ? 'USER' : 'TEKNISI LAPANGAN'}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-xs text-left">
                            <div className="flex items-center gap-2">
                              <span className={visiblePasswords[u.id] ? 'text-slate-200 font-extrabold font-mono text-xs' : 'text-slate-500 font-mono text-xs'}>
                                {u.password 
                                  ? (visiblePasswords[u.id] ? u.password : '••••••••') 
                                  : 'Sandi Standar'}
                              </span>
                              {u.password && (
                                <button
                                  type="button"
                                  onClick={() => setVisiblePasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                                  className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-1 rounded transition-colors cursor-pointer"
                                  title={visiblePasswords[u.id] ? "Sembunyikan password" : "Tampilkan password"}
                                >
                                  {visiblePasswords[u.id] ? (
                                    <Eye className="w-3.5 h-3.5 text-orange-400" />
                                  ) : (
                                    <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex gap-2 justify-end items-center">
                              <button
                                onClick={() => startEditUser(u)}
                                className="p-1.5 duration-200 transition-colors bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white"
                                title="Edit Akun"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              
                              <button
                                onClick={() => handleDeleteUser(u.id, u.fullname)}
                                disabled={u.username === 'admin'}
                                className="p-1.5 duration-200 transition-colors bg-slate-950 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/30 rounded-xl text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent"
                                title="Hapus Akun"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Account List Cards View */}
            <div className="md:hidden space-y-2.5" id="users_board_cards_mobile">
              {users.map((u) => {
                const isEditing = editingUserId === u.id;
                return (
                  <div
                    key={u.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isEditing
                        ? 'bg-slate-950 border-orange-500/50'
                        : 'bg-slate-950/40 border-slate-850'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3 text-left">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                          <span className="text-[9px] font-bold text-orange-400 font-mono uppercase">EDIT USER AKUN</span>
                          <span className="text-[8px] text-slate-500 uppercase">ID: {u.id.substring(0, 8)}</span>
                        </div>
                        <div className="space-y-2.5">
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Username</label>
                            <input
                              type="text"
                              value={userFormUsername}
                              onChange={(e) => setUserFormUsername(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-orange-500 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Nama Lengkap</label>
                            <input
                              type="text"
                              value={userFormFullname}
                              onChange={(e) => setUserFormFullname(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Otoritas Role</label>
                              <select
                                value={userFormRole}
                                onChange={(e) => setUserFormRole(e.target.value as any)}
                                className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-lg py-1.5 px-2 text-xs"
                              >
                                <option value="TEKNISI">TEKNISI</option>
                                <option value="ADMIN">ADMIN</option>
                                <option value="USER">USER</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Password</label>
                              <input
                                type="text"
                                value={userFormPassword}
                                onChange={(e) => setUserFormPassword(e.target.value)}
                                placeholder="Sandi login"
                                className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-1.5 px-2 text-xs focus:outline-none focus:border-orange-500 font-mono"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="pt-2 flex justify-end gap-1.5">
                          <button
                            onClick={() => handleUpdateUser(u.id)}
                            disabled={saving}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold rounded-lg flex items-center justify-center gap-1 active:scale-95 duration-100 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Ok</span>
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="flex-1 py-1.5 bg-slate-900 text-slate-400 text-[10.5px] font-semibold border border-slate-800 rounded-lg flex items-center justify-center gap-1 active:scale-95 duration-100 cursor-pointer"
                          >
                            <span>Batal</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-left space-y-2.5">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-100 leading-tight truncate">{u.fullname}</p>
                            <p className="text-[9.5px] font-mono text-slate-400 font-semibold mt-0.5">@{u.username}</p>
                          </div>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-mono text-[7.5px] font-bold border shrink-0 ml-2 ${
                            u.role === 'ADMIN'
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                              : u.role === 'USER'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {u.role === 'ADMIN' ? 'ADMIN' : u.role === 'USER' ? 'USER' : 'TEKNISI'}
                          </span>
                        </div>
                        
                        <div className="bg-slate-900/50 p-1.5 rounded-lg border border-slate-850/40 text-[9.5px] flex justify-between items-center gap-2">
                          <span className="text-slate-500 font-bold">PASSWORD:</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono ${visiblePasswords[u.id] ? 'text-orange-400 font-bold text-[10px]' : 'text-slate-400 text-xs'}`}>
                              {u.password 
                                ? (visiblePasswords[u.id] ? u.password : '••••••••') 
                                : 'Sandi Standar'}
                            </span>
                            {u.password && (
                              <button
                                type="button"
                                onClick={() => setVisiblePasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                                className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-1 rounded transition-colors cursor-pointer"
                                title={visiblePasswords[u.id] ? "Sembunyikan password" : "Tampilkan password"}
                              >
                                {visiblePasswords[u.id] ? (
                                  <Eye className="w-3.5 h-3.5 text-orange-505 text-orange-500" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end gap-1.5 pt-1.5 border-t border-slate-850/60">
                          <button
                            onClick={() => startEditUser(u)}
                            className="p-1 px-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-orange-500/30 rounded-lg text-slate-400 hover:text-white duration-100 cursor-pointer flex items-center justify-center gap-1 active:scale-95 text-[9.5px]"
                          >
                            <Edit2 className="w-3 h-3 text-orange-400" />
                            <span className="font-bold">Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.fullname)}
                            disabled={u.username === 'admin'}
                            className="p-1 px-2.5 bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-550/30 rounded-lg text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent duration-100 cursor-pointer flex items-center justify-center gap-1 active:scale-95 text-[9.5px]"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                            <span className="font-bold">Hapus</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: AREAS (CRD) */}
        {activeTab === 'AREAS' && (
          <div className="space-y-4 sm:space-y-6" id="areas_management_tab">
            <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center bg-slate-950/40 p-3 sm:p-4 border border-slate-850 rounded-xl sm:rounded-2xl gap-3">
              <div className="text-left">
                <h3 className="text-xs sm:text-sm font-bold text-slate-200">Daftar Wilayah Hotel Master (Area)</h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Mendifinisikan sayap lobby, kamar, dapur yang terintegrasi di form logging.</p>
              </div>
              <button
                onClick={() => setShowCreateArea(!showCreateArea)}
                className="w-full xs:w-auto flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold text-white py-2 px-3 sm:py-2 sm:px-4 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Area</span>
              </button>
            </div>

            {/* Create Area Inline Drawer */}
            <AnimatePresence>
              {showCreateArea && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateArea}
                  className="bg-slate-950 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-805 space-y-3.5"
                  id="create_area_drawer"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs font-bold text-orange-400 uppercase tracking-widest font-mono">Create Facility Master</span>
                    <button type="button" onClick={() => setShowCreateArea(false)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase">Nama Area Baru</label>
                      <input
                        type="text"
                        required
                        value={areaFormName}
                        onChange={(e) => setAreaFormName(e.target.value)}
                        placeholder="Guest Room, Public Toilet, Spa Lounge, dll"
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateArea(false)}
                      className="py-1.5 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="py-1.5 px-3.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer transition-colors"
                    >
                      Simpan Area
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Areas Table List (Desktop Only) */}
            <div className="hidden md:block overflow-x-auto border border-slate-800/80 rounded-2xl" id="areas_table_container">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-4 font-semibold">Nama Area</th>
                    <th className="p-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-300">
                  {areas.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-950/20">
                      <td className="p-4 font-semibold text-slate-100">{a.name}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteAreaClick(a)}
                          className="p-1.5 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/30 rounded-xl text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Areas Card List (Mobile Only) */}
            <div className="md:hidden space-y-2" id="areas_cards_mobile">
              {areas.map((a) => (
                <div key={a.id} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between text-left">
                  <span className="text-xs font-bold text-slate-100">{a.name}</span>
                  <button
                    onClick={() => handleDeleteAreaClick(a)}
                    className="p-2 bg-slate-905 bg-slate-900 border border-slate-800 hover:bg-red-955/20 hover:border-red-500/30 rounded-lg text-slate-400 hover:text-red-400 cursor-pointer duration-100 active:scale-95 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
              {areas.length === 0 && (
                <div className="p-6 bg-slate-950/20 border border-slate-850 rounded-xl text-center text-xs text-slate-500 italic">
                  Belum ada master area yang terdaftar.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CATEGORIES (CRD) */}
        {activeTab === 'CATEGORIES' && (
          <div className="space-y-4 sm:space-y-6" id="categories_management_tab">
            <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center bg-slate-950/40 p-3 sm:p-4 border border-slate-850 rounded-xl sm:rounded-2xl gap-3">
              <div className="text-left">
                <h3 className="text-xs sm:text-sm font-bold text-slate-200">Daftar Kategori Specialty Master</h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Mendifinisikan devisi keahlian teknis (AC, listrik, Sipil, plumbing).</p>
              </div>
              <button
                onClick={() => setShowCreateCat(!showCreateCat)}
                className="w-full xs:w-auto flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold text-white py-2 px-3 sm:py-2 sm:px-4 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Specialty</span>
              </button>
            </div>

            {/* Create Category Inline Drawer */}
            <AnimatePresence>
              {showCreateCat && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateCategory}
                  className="bg-slate-950 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-805 space-y-3.5"
                  id="create_category_drawer"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs font-bold text-orange-400 uppercase tracking-widest font-mono">Create Skill Specialization</span>
                    <button type="button" onClick={() => setShowCreateCat(false)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase">Nama Kategori Specialty</label>
                      <input
                        type="text"
                        required
                        value={catFormName}
                        onChange={(e) => setCatFormName(e.target.value)}
                        placeholder="Plumbing, Generator, Audio/Video, IoT"
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateCat(false)}
                      className="py-1.5 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="py-1.5 px-3.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer transition-colors"
                    >
                      Simpan Kategori
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Categories Table List (Desktop Only) */}
            <div className="hidden md:block overflow-x-auto border border-slate-800/80 rounded-2xl" id="categories_table_container">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-4 font-semibold">Nama Specialty</th>
                    <th className="p-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-300">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-950/20">
                      <td className="p-4 font-semibold text-slate-100">{c.name}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteCategoryClick(c)}
                          className="p-1.5 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/30 rounded-xl text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Categories Card List (Mobile Only) */}
            <div className="md:hidden space-y-2" id="categories_cards_mobile">
              {categories.map((c) => (
                <div key={c.id} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between text-left">
                  <span className="text-xs font-bold text-slate-100">{c.name}</span>
                  <button
                    onClick={() => handleDeleteCategoryClick(c)}
                    className="p-2 bg-slate-905 bg-slate-900 border border-slate-800 hover:bg-red-955/20 hover:border-red-500/30 rounded-lg text-slate-400 hover:text-red-400 cursor-pointer duration-100 active:scale-95 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="p-6 bg-slate-950/20 border border-slate-850 rounded-xl text-center text-xs text-slate-500 italic">
                  Belum ada master kategory specialty yang terdaftar.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MAINTENANCE_TYPES (CRD) */}
        {activeTab === 'MAINTENANCE_TYPES' && (
          <div className="space-y-4 sm:space-y-6" id="maintenance_types_management_tab">
            <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center bg-slate-950/40 p-3 sm:p-4 border border-slate-850 rounded-xl sm:rounded-2xl gap-3">
              <div className="text-left">
                <h3 className="text-xs sm:text-sm font-bold text-slate-200">Daftar Tipe Maintenance Master</h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Mendefinisikan jenis aktivitas pemeliharaan teknis di hotel.</p>
              </div>
              <button
                onClick={() => setShowCreateMt(!showCreateMt)}
                className="w-full xs:w-auto flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold text-white py-2 px-3 sm:py-2 sm:px-4 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tipe Baru</span>
              </button>
            </div>

            {/* Create Maintenance Type Inline Drawer */}
            <AnimatePresence>
              {showCreateMt && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateMt}
                  className="bg-slate-950 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-805 space-y-3.5"
                  id="create_mt_drawer"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs font-bold text-orange-400 uppercase tracking-widest font-mono">Create Maintenance Type</span>
                    <button type="button" onClick={() => setShowCreateMt(false)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase">Nama Tipe Maintenance</label>
                      <input
                        type="text"
                        required
                        value={mtFormName}
                        onChange={(e) => setMtFormName(e.target.value)}
                        placeholder="Corrective, Preventive, Breakdown, Installation"
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateMt(false)}
                      className="py-1.5 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="py-1.5 px-3.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer transition-colors"
                    >
                      Simpan Tipe
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Maintenance Type Table List (Desktop Only) */}
            <div className="hidden md:block overflow-x-auto border border-slate-800/80 rounded-2xl" id="maintenance_types_table_container">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-4 font-semibold">Nama Tipe Maintenance</th>
                    <th className="p-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-300">
                  {maintenanceTypes.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-950/20">
                      <td className="p-4 font-semibold text-slate-100">{m.name}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteMtClick(m)}
                          className="p-1.5 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/30 rounded-xl text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {maintenanceTypes.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-slate-500 italic">
                        Tidak ada tipe maintenance ditemukan. Silahkan tambahkan tipe baru.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Maintenance Type Card List (Mobile Only) */}
            <div className="md:hidden space-y-2" id="maintenance_types_cards_mobile">
              {maintenanceTypes.map((m) => (
                <div key={m.id} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between text-left">
                  <span className="text-xs font-bold text-slate-100">{m.name}</span>
                  <button
                    onClick={() => handleDeleteMtClick(m)}
                    className="p-2 bg-slate-905 bg-slate-900 border border-slate-800 hover:bg-red-955/20 hover:border-red-500/30 rounded-lg text-slate-400 hover:text-red-400 cursor-pointer duration-100 active:scale-95 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
              {maintenanceTypes.length === 0 && (
                <div className="p-6 bg-slate-950/20 border border-slate-850 rounded-xl text-center text-xs text-slate-500 italic">
                  Belum ada tipe maintenance yang terdaftar.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Pop-up Confirm Modal - Delete User */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" id="delete_user_confirm_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">Konfirmasi Hapus Akun</h3>
                <p className="text-xs text-slate-400">
                  Apakah anda yakin akan menghapus data user <strong className="text-white">{userToDelete.fullname}</strong>?
                </p>
                <div className="flex gap-2 w-full pt-2">
                  <button
                    onClick={() => setUserToDelete(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeDeleteUser}
                    disabled={saving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-red-600/20 disabled:opacity-55"
                  >
                    {saving ? 'Proses...' : 'Ya, Hapus'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Pop-up Confirm Modal - Edit User */}
      <AnimatePresence>
        {userToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" id="edit_user_confirm_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-orange-500/10 text-orange-400 rounded-full border border-orange-500/20">
                  <Save className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">Konfirmasi Simpan Perubahan</h3>
                <p className="text-xs text-slate-400">
                  Apakah anda yakin merubah data user <strong className="text-white">{userToEdit.fullname}</strong>?
                </p>
                <div className="flex gap-2 w-full pt-2">
                  <button
                    onClick={() => setUserToEdit(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeUpdateUser}
                    disabled={saving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-orange-500/20 disabled:opacity-55"
                  >
                    {saving ? 'Proses...' : 'Ya, Simpan'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Pop-up Confirm Modal - Create Area */}
      <AnimatePresence>
        {areaToCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" id="create_area_confirm_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-orange-500/10 text-orange-400 rounded-full border border-orange-500/20">
                  <Plus className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">Konfirmasi Simpan Area</h3>
                <p className="text-xs text-slate-400">
                  Apakah anda yakin menambahkan area <strong className="text-white">{areaToCreate}</strong>?
                </p>
                <div className="flex gap-2 w-full pt-2">
                  <button
                    onClick={() => setAreaToCreate(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeCreateArea}
                    disabled={saving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-orange-500/20 disabled:opacity-55"
                  >
                    {saving ? 'Proses...' : 'Ya, Simpan'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Pop-up Confirm Modal - Delete Area */}
      <AnimatePresence>
        {areaToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" id="delete_area_confirm_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">Konfirmasi Hapus Area</h3>
                <p className="text-xs text-slate-400">
                  Apakah anda yakin akan menghapus <strong className="text-white">{areaToDelete.name}</strong>?
                </p>
                <div className="flex gap-2 w-full pt-2">
                  <button
                    onClick={() => setAreaToDelete(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeDeleteArea}
                    disabled={saving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-red-600/20 disabled:opacity-55"
                  >
                    {saving ? 'Proses...' : 'Ya, Hapus'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Pop-up Confirm Modal - Create Category */}
      <AnimatePresence>
        {catToCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" id="create_cat_confirm_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-orange-500/10 text-orange-400 rounded-full border border-orange-500/20">
                  <Plus className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">Konfirmasi Simpan Kategori</h3>
                <p className="text-xs text-slate-400">
                  Apakah anda yakin menambahkan kategori <strong className="text-white">{catToCreate}</strong>?
                </p>
                <div className="flex gap-2 w-full pt-2">
                  <button
                    onClick={() => setCatToCreate(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeCreateCategory}
                    disabled={saving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-orange-500/20 disabled:opacity-55"
                  >
                    {saving ? 'Proses...' : 'Ya, Simpan'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Pop-up Confirm Modal - Delete Category */}
      <AnimatePresence>
        {catToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" id="delete_cat_confirm_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">Konfirmasi Hapus Kategori</h3>
                <p className="text-xs text-slate-400">
                  Apakah anda yakin akan menghapus <strong className="text-white">{catToDelete.name}</strong>?
                </p>
                <div className="flex gap-2 w-full pt-2">
                  <button
                    onClick={() => setCatToDelete(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeDeleteCategory}
                    disabled={saving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-red-600/20 disabled:opacity-55"
                  >
                    {saving ? 'Proses...' : 'Ya, Hapus'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Pop-up Confirm Modal - Create Maintenance Type */}
      <AnimatePresence>
        {mtToCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" id="create_mt_confirm_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-orange-500/10 text-orange-400 rounded-full border border-orange-500/20">
                  <Plus className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">Konfirmasi Simpan Tipe Maintenance</h3>
                <p className="text-xs text-slate-400">
                  Apakah anda yakin menambahkan tipe maintenance <strong className="text-white">{mtToCreate}</strong>?
                </p>
                <div className="flex gap-2 w-full pt-2">
                  <button
                    onClick={() => setMtToCreate(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeCreateMt}
                    disabled={saving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-orange-500/20 disabled:opacity-55"
                  >
                    {saving ? 'Proses...' : 'Ya, Simpan'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Pop-up Confirm Modal - Delete Maintenance Type */}
      <AnimatePresence>
        {mtToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" id="delete_mt_confirm_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">Konfirmasi Hapus Tipe Maintenance</h3>
                <p className="text-xs text-slate-400">
                  Apakah anda yakin akan menghapus tipe maintenance <strong className="text-white">{mtToDelete.name}</strong>?
                </p>
                <div className="flex gap-2 w-full pt-2">
                  <button
                    onClick={() => setMtToDelete(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeDeleteMt}
                    disabled={saving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-red-600/20 disabled:opacity-55"
                  >
                    {saving ? 'Proses...' : 'Ya, Hapus'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
