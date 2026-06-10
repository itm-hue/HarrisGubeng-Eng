/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, AreaMaster, CategoryMaster, MaintenanceTypeMaster } from '../types';
import { dbService } from '../lib/supabase';
import { Users, Map, Tags, Hammer, Plus, Trash2, Edit2, ShieldAlert, BadgeCheck, X, Check, Save } from 'lucide-react';
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
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormFullname, setUserFormFullname] = useState('');
  const [userFormRole, setUserFormRole] = useState<'TEKNISI' | 'ADMIN'>('TEKNISI');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);

  // Custom Confirmation Modal states
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<{ id: string; username: string; fullname: string; role: 'TEKNISI' | 'ADMIN' } | null>(null);

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
        role: userFormRole
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
          role: userToEdit.role
        };
        
        await dbService.updateUser(payload);
        
        // INSTANTLY update state on the fly
        setUsers((prev) => prev.map(u => u.id === userToEdit.id ? payload : u));
        
        setEditingUserId(null);
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
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl shadow-black/15" id="administrator_control_panel">
      {/* Visual Navigation Subtab headers */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="text-left">
          <h2 className="text-lg font-extrabold text-white tracking-wide">
            ADMINISTRATOR MASTER PANEL
          </h2>
          <p className="text-xs text-slate-400">
            Kelola data akun, wilayah operasional hotel, dan kategori kerja teknisi.
          </p>
        </div>

        {/* Tab triggers */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 w-full sm:w-auto shrink-0" id="admin_subtab_selectors">
          <button
            onClick={() => setActiveTab('USERS')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-sans cursor-pointer transition-all ${
              activeTab === 'USERS'
                ? 'bg-orange-500 text-white shadow shadow-orange-500/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kelola Akun ({users.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('AREAS')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-sans cursor-pointer transition-all ${
              activeTab === 'AREAS'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Map className="w-4 h-4" />
            <span>Master Area ({areas.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('CATEGORIES')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-sans cursor-pointer transition-all ${
              activeTab === 'CATEGORIES'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Tags className="w-4 h-4" />
            <span>Kategori ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('MAINTENANCE_TYPES')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-sans cursor-pointer transition-all ${
              activeTab === 'MAINTENANCE_TYPES'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Hammer className="w-4 h-4" />
            <span>Tipe Maintenance ({maintenanceTypes.length})</span>
          </button>
        </div>
      </div>

      {/* Tabs active viewports */}
      <div className="p-6">
        {/* TAB 1: USERS */}
        {activeTab === 'USERS' && (
          <div className="space-y-6" id="users_management_tab">
            <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
              <div className="text-left">
                <h3 className="text-sm font-bold text-slate-200">Daftar Akun Teknisi & Admin</h3>
                <p className="text-[11px] text-slate-500">Mendaftarkan personel yang diijinkan mengisi log work order.</p>
              </div>
              <button
                onClick={() => setShowCreateUser(!showCreateUser)}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold text-white py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-orange-600/10"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrasi Akun</span>
              </button>
            </div>

            {/* Create Account Inline Drawer */}
            <AnimatePresence>
              {showCreateUser && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={(e) => e.preventDefault()}
                  className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4"
                  id="create_user_drawer_form"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-widest font-mono">Create Personnel Profile</span>
                    <button type="button" onClick={() => setShowCreateUser(false)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Username Login</label>
                      <input
                        type="text"
                        required
                        value={userFormUsername}
                        onChange={(e) => setUserFormUsername(e.target.value)}
                        placeholder=" bobby (lowercase)"
                        className="w-full bg-slate-905 bg-slate-900 border border-slate-800 text-white rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Nama Lengkap</label>
                      <input
                        type="text"
                        required
                        value={userFormFullname}
                        onChange={(e) => setUserFormFullname(e.target.value)}
                        placeholder="Bobby Pratama"
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Otoritas Role</label>
                      <select
                        value={userFormRole}
                        onChange={(e) => setUserFormRole(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg py-2 px-3 text-xs"
                      >
                        <option value="TEKNISI">TEKNISI (Work Order)</option>
                        <option value="ADMIN">ADMIN (Supervision & PDF)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Password</label>
                      <input
                        type="text"
                        required
                        value={userFormPassword}
                        onChange={(e) => setUserFormPassword(e.target.value)}
                        placeholder="Sandi login akun"
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateUser(false)}
                      className="py-1.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSimpanUserDirect}
                      disabled={saving}
                      className="py-1.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer transition-colors"
                    >
                      Draft Personil
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Account List Board */}
            <div className="overflow-x-auto border border-slate-800/80 rounded-2xl" id="users_board_table">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-4 font-semibold">Username</th>
                    <th className="p-4 font-semibold">Nama Lengkap</th>
                    <th className="p-4 font-semibold">Otoritas Role</th>
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
                            </select>
                          </td>
                          <td className="p-4 text-right flex justify-end gap-1.5">
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
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {u.role === 'ADMIN' ? 'ADMINISTRATOR' : 'TEKNISI LAPANGAN'}
                            </span>
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
                              
                              {/* Can't delete self admin */}
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
          </div>
        )}

        {/* TAB 2: AREAS (CRD) */}
        {activeTab === 'AREAS' && (
          <div className="space-y-6" id="areas_management_tab">
            <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
              <div className="text-left">
                <h3 className="text-sm font-bold text-slate-200">Daftar Wilayah Hotel Master (Area)</h3>
                <p className="text-[11px] text-slate-500">Mendifinisikan sayap lobby, kamar, dapur yang terintegrasi di form logging.</p>
              </div>
              <button
                onClick={() => setShowCreateArea(!showCreateArea)}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold text-white py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
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
                  className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4"
                  id="create_area_drawer"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-widest font-mono">Create Facility Master</span>
                    <button type="button" onClick={() => setShowCreateArea(false)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Nama Area Baru</label>
                      <input
                        type="text"
                        required
                        value={areaFormName}
                        onChange={(e) => setAreaFormName(e.target.value)}
                        placeholder="Guest Room, Public Toilet, Spa Lounge, dll"
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-2.5 px-3 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateArea(false)}
                      className="py-1.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="py-1.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Simpan Area
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Areas Table List */}
            <div className="overflow-x-auto border border-slate-800/80 rounded-2xl" id="areas_table_container">
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
          </div>
        )}

        {/* TAB 3: CATEGORIES (CRD) */}
        {activeTab === 'CATEGORIES' && (
          <div className="space-y-6" id="categories_management_tab">
            <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
              <div className="text-left">
                <h3 className="text-sm font-bold text-slate-200">Daftar Kategori Specialty Master</h3>
                <p className="text-[11px] text-slate-500">Mendifinisikan devisi keahlian teknis (AC, listrik, Sipil, plumbing).</p>
              </div>
              <button
                onClick={() => setShowCreateCat(!showCreateCat)}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold text-white py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
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
                  className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4"
                  id="create_category_drawer"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-widest font-mono">Create Skill Specialization</span>
                    <button type="button" onClick={() => setShowCreateCat(false)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Nama Kategori Specialty</label>
                      <input
                        type="text"
                        required
                        value={catFormName}
                        onChange={(e) => setCatFormName(e.target.value)}
                        placeholder="Plumbing, Generator, Audio/Video, IoT"
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-2.5 px-3 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateCat(false)}
                      className="py-1.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="py-1.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Simpan Kategori
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Categories Table List */}
            <div className="overflow-x-auto border border-slate-800/80 rounded-2xl" id="categories_table_container">
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
          </div>
        )}

        {/* TAB 4: MAINTENANCE_TYPES (CRD) */}
        {activeTab === 'MAINTENANCE_TYPES' && (
          <div className="space-y-6" id="maintenance_types_management_tab">
            <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
              <div className="text-left">
                <h3 className="text-sm font-bold text-slate-200">Daftar Tipe Maintenance Master</h3>
                <p className="text-[11px] text-slate-500">Mendefinisikan jenis aktivitas pemeliharaan teknis di hotel.</p>
              </div>
              <button
                onClick={() => setShowCreateMt(!showCreateMt)}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold text-white py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Tipe Maintenance</span>
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
                  className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4"
                  id="create_mt_drawer"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-widest font-mono">Create Maintenance Type</span>
                    <button type="button" onClick={() => setShowCreateMt(false)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Nama Tipe Maintenance</label>
                      <input
                        type="text"
                        required
                        value={mtFormName}
                        onChange={(e) => setMtFormName(e.target.value)}
                        placeholder="Corrective, Preventive, Breakdown, Installation"
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-2.5 px-3 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateMt(false)}
                      className="py-1.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="py-1.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Simpan Tipe
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Maintenance Type Table List */}
            <div className="overflow-x-auto border border-slate-800/80 rounded-2xl" id="maintenance_types_table_container">
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
