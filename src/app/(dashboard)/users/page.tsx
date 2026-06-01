'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Users, AlertCircle, Eye, EyeOff, ChevronDown, Shield, ShieldCheck, KeyRound, Globe, Lock } from 'lucide-react';

interface IUser {
  _id: string;
  full_name: string;
  email: string;
  role: 'PRODUCT_MANAGER' | 'SENIOR_PRODUCT_MANAGER';
  status: 'ACTIVE' | 'INACTIVE';
  login_method: 'PASSWORD' | 'OAUTH' | 'BOTH';
  last_login_at: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<IUser | null>(null);
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'PRODUCT_MANAGER' | 'SENIOR_PRODUCT_MANAGER'>('PRODUCT_MANAGER');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [loginMethod, setLoginMethod] = useState<'PASSWORD' | 'OAUTH' | 'BOTH'>('PASSWORD');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openRoleMenu, setOpenRoleMenu] = useState(false);
  const [openMethodMenu, setOpenMethodMenu] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const methodMenuRef = useRef<HTMLDivElement>(null);

  // Close custom dropdowns on outside click
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (roleMenuRef.current && !roleMenuRef.current.contains(target)) {
        setOpenRoleMenu(false);
      }

      if (methodMenuRef.current && !methodMenuRef.current.contains(target)) {
        setOpenMethodMenu(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Redirect PMs away from users page (middleware does this, but client-side guard is nice)
  useEffect(() => {
    if (session && session.user && session.user.role !== 'SENIOR_PRODUCT_MANAGER') {
      router.push('/compose');
    }
  }, [session, router]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenNew = () => {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setRole('PRODUCT_MANAGER');
    setStatus('ACTIVE');
    setLoginMethod('PASSWORD');
    setPassword('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (user: IUser) => {
    setEditingUser(user);
    setFullName(user.full_name);
    setEmail(user.email);
    setRole(user.role);
    setStatus(user.status);
    setLoginMethod(user.login_method);
    setPassword('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleToggleStatus = async (user: IUser) => {
    if (user._id === session?.user?.id) {
      alert('Cannot deactivate yourself.');
      return;
    }
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/users/${user._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status.');
      }
    } catch (err) {
      console.error('Error toggling user status:', err);
    }
  };

  const handleResetPassword = async (user: IUser) => {
    if (user.status !== 'ACTIVE') {
      alert('Cannot reset password for an inactive user.');
      return;
    }
    if (user.login_method === 'OAUTH') {
      alert('Change this user to Password or Password & Google OAuth before resetting their password.');
      return;
    }
    if (!confirm(`Send a password reset link to ${user.email}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user._id}/reset-password`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to send password reset link.');
      } else {
        alert(data.message || 'Password reset link has been sent.');
      }
    } catch (err) {
      console.error('Error sending password reset:', err);
      alert('An unexpected error occurred.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !role || !loginMethod) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (!editingUser && (loginMethod === 'PASSWORD' || loginMethod === 'BOTH') && password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const payload: any = {
        full_name: fullName,
        role,
        login_method: loginMethod,
      };

      if (!editingUser) {
        payload.email = email;
        payload.status = status;
        if (loginMethod === 'PASSWORD' || loginMethod === 'BOTH') {
          payload.password = password;
        }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to save user.');
      } else {
        setModalOpen(false);
        fetchUsers();
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} · ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;
  };

  const getRoleBadge = (userRole: IUser['role']) => {
    if (userRole === 'SENIOR_PRODUCT_MANAGER') {
      return <span className="inline-flex items-center gap-1 rounded-[20px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[.04em] bg-[#fff8e1] text-[#7c5a00]">Sr. PM</span>;
    }
    return <span className="inline-flex items-center gap-1 rounded-[20px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[.04em] bg-[#f0effe] text-[#5b3fd1]">PM</span>;
  };

  return (
    <div id="users-screen" className="flex flex-col flex-1 text-slate-200">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-md px-6">
        <span className="text-base font-semibold tracking-tight text-slate-100">User Management</span>
        <div className="ml-auto flex items-center">
          <button
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-400 active:scale-95"
            onClick={handleOpenNew}
          >
            <Plus size={14} strokeWidth={2.5} />
            New User
          </button>
        </div>
      </div>
      <div className="flex-1 p-6">
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        <span>Loading user database...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="rounded-full bg-slate-900/60 p-4 border border-slate-800 text-slate-500">
                          <Users size={32} strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-300">No users found</p>
                          <p className="text-xs text-slate-500">Add users to allow them access to the portal.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u._id} className="transition-colors hover:bg-slate-800/30">
                      <td className={`px-4 py-3 font-semibold ${u.status === 'INACTIVE' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {u.full_name}
                        {u._id === session?.user?.id && <span className="text-indigo-400 text-xs font-normal font-sans ml-1.5">(You)</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-slate-400">{u.email}</td>
                      <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                      <td className="px-4 py-3 font-mono text-[10.5px] text-slate-400">{u.login_method}</td>
                      <td className="px-4 py-3">
                        {u.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/40 text-slate-500 border border-slate-700/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {formatDate(u.last_login_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100"
                            onClick={() => handleOpenEdit(u)}
                          >
                            Edit
                          </button>
                          <button
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={u.status !== 'ACTIVE' || u.login_method === 'OAUTH'}
                            title={
                              u.login_method === 'OAUTH'
                                ? 'OAuth-only users do not have portal passwords'
                                : u.status !== 'ACTIVE'
                                  ? 'Inactive users cannot reset passwords'
                                  : 'Send password reset link'
                            }
                            onClick={() => handleResetPassword(u)}
                          >
                            Reset
                          </button>
                          <button
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                              u._id === session?.user?.id
                                ? 'border-slate-800 text-slate-600 bg-transparent'
                                : u.status === 'ACTIVE'
                                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                            disabled={u._id === session?.user?.id}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-[600px] rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800/60 px-6 py-4">
                <span className="text-sm font-semibold tracking-tight text-slate-100">
                  {editingUser ? 'Edit User' : 'New User'}
                </span>
                <button type="button" className="cursor-pointer border-0 bg-transparent text-lg text-slate-400 hover:text-white transition-colors" onClick={() => setModalOpen(false)}>×</button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto">
                {errorMsg && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                    <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="usr-name" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Full Name <span className="text-red-400">*</span></label>
                  <input
                    id="usr-name"
                    type="text"
                    placeholder="e.g. Aryan Kumar"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="usr-email" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Email Address <span className="text-red-400">*</span></label>
                  <input
                    id="usr-email"
                    type="email"
                    placeholder="you@m37labs.com"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={!!editingUser}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Role Picker */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Role <span className="text-red-400">*</span></label>
                    <div ref={roleMenuRef} className="relative">
                      <button
                        id="usr-role"
                        type="button"
                        disabled={editingUser?._id === session?.user?.id}
                        onClick={(e) => { e.stopPropagation(); setOpenRoleMenu(v => !v); setOpenMethodMenu(false); }}
                        className="w-full flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 transition-all hover:border-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center gap-2">
                          {role === 'SENIOR_PRODUCT_MANAGER'
                            ? <><ShieldCheck size={13} className="text-amber-400" /><span>Senior Product Manager</span></>
                            : <><Shield size={13} className="text-indigo-400" /><span>Product Manager</span></>}
                        </span>
                        <ChevronDown size={13} className={`text-slate-500 transition-transform duration-200 ${openRoleMenu ? 'rotate-180' : ''}`} />
                      </button>
                      {openRoleMenu && (
                        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40 overflow-hidden">
                          {([
                            { value: 'PRODUCT_MANAGER', label: 'Product Manager', sub: 'Standard portal access', Icon: Shield, color: 'text-indigo-400', ring: 'border-indigo-500/60 bg-indigo-500/10' },
                            { value: 'SENIOR_PRODUCT_MANAGER', label: 'Sr. Product Manager', sub: 'Full admin access', Icon: ShieldCheck, color: 'text-amber-400', ring: 'border-amber-500/60 bg-amber-500/10' },
                          ] as const).map(({ value, label, sub, Icon, color, ring }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => { setRole(value); setOpenRoleMenu(false); }}
                              className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-800/60 ${
                                role === value ? 'bg-slate-800/40' : ''
                              }`}
                            >
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${role === value ? ring : 'border-slate-700 bg-slate-800/50'} transition-all`}>
                                <Icon size={13} className={color} />
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-xs font-semibold text-slate-200">{label}</span>
                                <span className="block text-[10px] text-slate-500">{sub}</span>
                              </span>
                              {role === value && (
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Login Method Picker */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Login Method <span className="text-red-400">*</span></label>
                    <div ref={methodMenuRef} className="relative">
                      <button
                        id="usr-method"
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenMethodMenu(v => !v); setOpenRoleMenu(false); }}
                        className="w-full flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 transition-all hover:border-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                      >
                        <span className="flex items-center gap-2">
                          {loginMethod === 'PASSWORD' && <><KeyRound size={13} className="text-indigo-400" /><span>Credentials</span></>}
                          {loginMethod === 'OAUTH' && <><Globe size={13} className="text-emerald-400" /><span>Google OAuth Only</span></>}
                          {loginMethod === 'BOTH' && <><Lock size={13} className="text-violet-400" /><span>Password & OAuth</span></>}
                        </span>
                        <ChevronDown size={13} className={`text-slate-500 transition-transform duration-200 ${openMethodMenu ? 'rotate-180' : ''}`} />
                      </button>
                      {openMethodMenu && (
                        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40 overflow-hidden">
                          {([
                            { value: 'PASSWORD', label: 'Credentials', sub: 'Email & password login', Icon: KeyRound, color: 'text-indigo-400', ring: 'border-indigo-500/60 bg-indigo-500/10' },
                            { value: 'OAUTH', label: 'Google OAuth Only', sub: 'Sign in with Google', Icon: Globe, color: 'text-emerald-400', ring: 'border-emerald-500/60 bg-emerald-500/10' },
                            { value: 'BOTH', label: 'Password & OAuth', sub: 'Either login method', Icon: Lock, color: 'text-violet-400', ring: 'border-violet-500/60 bg-violet-500/10' },
                          ] as const).map(({ value, label, sub, Icon, color, ring }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => { setLoginMethod(value); setOpenMethodMenu(false); }}
                              className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-800/60 ${
                                loginMethod === value ? 'bg-slate-800/40' : ''
                              }`}
                            >
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${loginMethod === value ? ring : 'border-slate-700 bg-slate-800/50'} transition-all`}>
                                <Icon size={13} className={color} />
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-xs font-semibold text-slate-200">{label}</span>
                                <span className="block text-[10px] text-slate-500">{sub}</span>
                              </span>
                              {loginMethod === value && (
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {!editingUser && (loginMethod === 'PASSWORD' || loginMethod === 'BOTH') && (
                  <div className="space-y-1.5">
                    <label htmlFor="usr-password" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Password <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <input
                        id="usr-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 8 characters"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 pr-10 text-xs text-slate-200 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-800/60 px-6 py-4 bg-slate-950/20">
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-75"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
