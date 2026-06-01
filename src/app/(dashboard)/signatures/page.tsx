'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Loader2, Signature, AlertCircle } from 'lucide-react';

interface ISignature {
  _id: string;
  name: string;
  body: string;
  visibility: 'PERSONAL';
  is_default: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  created_by: {
    _id: string;
    full_name: string;
    email: string;
  };
  createdAt: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildSignatureTemplate = ({
  displayName,
  email,
  roleLabel,
}: {
  displayName: string;
  email: string;
  roleLabel: string;
}) => {
  const safeName = escapeHtml(displayName.trim() || 'Your Name');
  const safeEmail = escapeHtml(email.trim() || 'info@m37labs.com');
  const safeRole = escapeHtml(roleLabel);

  return `<table role="presentation" cellpadding="0" cellspacing="0"
  style="font-family: Helvetica, Arial, sans-serif; border-collapse: collapse; background: #ffffff;">
  <tr>
    <td style="padding: 12px 0;">
      <strong style="display: block; font-size: 17px; color: #111827; font-weight: 600;">
        ${safeName}
      </strong>
      <span style="display: block; margin-top: 4px; font-size: 13px; color: #6b7280;">
        ${safeRole}
      </span>
      <span style="display: block; margin-top: 10px; font-size: 14px; color: #111827;">
        M37 Labs
      </span>
      <a href="mailto:${safeEmail}"
        style="display: block; margin-top: 4px; font-size: 13px; color: #4f46e5; text-decoration: none;">
        ${safeEmail}
      </a>
    </td>
  </tr>
</table>`;
};

export default function SignaturesPage() {
  const { data: session } = useSession();
  const [signatures, setSignatures] = useState<ISignature[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSignature, setEditingSignature] = useState<ISignature | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templateActive, setTemplateActive] = useState(false);

  const fetchSignatures = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/signatures');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSignatures(data);
      }
    } catch (err) {
      console.error('Error fetching signatures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignatures();
  }, []);

  const roleLabel =
    session?.user?.role === 'SENIOR_PRODUCT_MANAGER' ? 'Senior Product Manager' : 'Product Manager';
  const userEmail = session?.user?.email || 'info@m37labs.com';

  useEffect(() => {
    if (!templateActive) return;
    setBody(buildSignatureTemplate({ displayName: name, email: userEmail, roleLabel }));
  }, [name, roleLabel, templateActive, userEmail]);

  const handleOpenNew = () => {
    setEditingSignature(null);
    setName('');
    setBody('');
    setIsDefault(false);
    setErrorMsg(null);
    setTemplateActive(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (sig: ISignature) => {
    setEditingSignature(sig);
    setName(sig.name);
    setBody(sig.body);
    setIsDefault(sig.is_default);
    setErrorMsg(null);
    setTemplateActive(false);
    setModalOpen(true);
  };

  const handleSetDefault = async (sigId: string) => {
    try {
      const res = await fetch(`/api/signatures/${sigId}/default`, {
        method: 'PATCH',
      });
      if (res.ok) {
        fetchSignatures();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to set default signature.');
      }
    } catch (err) {
      console.error('Error setting default signature:', err);
    }
  };

  const handleToggleStatus = async (sig: ISignature) => {
    const nextStatus = sig.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/signatures/${sig._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchSignatures();
      }
    } catch (err) {
      console.error('Error toggling signature status:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) {
      setErrorMsg('Name and signature body are required.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const url = editingSignature ? `/api/signatures/${editingSignature._id}` : '/api/signatures';
      const method = editingSignature ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, body, is_default: isDefault }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to save signature.');
      } else {
        setModalOpen(false);
        setTemplateActive(false);
        fetchSignatures();
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const isSpm = session?.user?.role === 'SENIOR_PRODUCT_MANAGER';

  // Helper to strip HTML tags for simple preview
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  };

  return (
    <div id="signatures-screen" className="flex flex-col flex-1 text-slate-200">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-md px-6">
        <span className="text-base font-semibold tracking-tight text-slate-100">Signatures</span>
        <div className="ml-auto flex items-center">
          <button
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-400 active:scale-95"
            onClick={handleOpenNew}
          >
            <Plus size={14} strokeWidth={2.5} />
            New Signature
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
                  <th className="px-4 py-3">Default</th>
                  {isSpm && <th id="sig-owner-col" className="px-4 py-3">Created by</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading && signatures.length === 0 ? (
                  <tr>
                    <td colSpan={isSpm ? 6 : 5} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        <span>Loading signatures...</span>
                      </div>
                    </td>
                  </tr>
                ) : signatures.length === 0 ? (
                  <tr>
                    <td colSpan={isSpm ? 6 : 5} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="rounded-full bg-slate-900/60 p-4 border border-slate-800 text-slate-500">
                          <Signature size={32} strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-300">No signatures found</p>
                          <p className="text-xs text-slate-500">Create a signature to append to the bottom of composed emails.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  signatures.map((sig) => (
                    <tr key={sig._id} className="transition-colors hover:bg-slate-800/30">
                      <td className={`px-4 py-3 font-semibold ${sig.status === 'INACTIVE' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {sig.name}
                      </td>
                      <td className="px-4 py-3">
                        {sig.is_default ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            Default
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      {isSpm && <td className="px-4 py-3 text-slate-300">{sig.created_by?.full_name || 'System'}</td>}
                      <td className="px-4 py-3">
                        {sig.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/40 text-slate-500 border border-slate-700/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={sig.status === 'INACTIVE' || sig.is_default}
                            onClick={() => handleSetDefault(sig._id)}
                          >
                            Set Default
                          </button>
                          <button
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100"
                            onClick={() => handleOpenEdit(sig)}
                          >
                            Edit
                          </button>
                          <button
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                              sig.status === 'ACTIVE'
                                ? 'border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                            onClick={() => handleToggleStatus(sig)}
                          >
                            {sig.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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

      {/* Signature Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-[1080px] rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800/60 px-6 py-4">
                <span className="text-sm font-semibold tracking-tight text-slate-100">
                  {editingSignature ? 'Edit Signature' : 'New Signature'}
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
                  <label htmlFor="sig-name" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Signature Name <span className="text-red-400">*</span></label>
                  <input
                    id="sig-name"
                    type="text"
                    placeholder="e.g. Aryan Kumar (Main)"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="sig-body" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Body (HTML) <span className="text-red-400">*</span></label>
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateActive(true);
                          setBody(buildSignatureTemplate({ displayName: name, email: userEmail, roleLabel }));
                        }}
                        className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        {body.trim() ? 'Reset template' : 'Use template'} ↗
                      </button>
                    </div>
                    <textarea
                      id="sig-body"
                      placeholder={`<strong>${name.trim() || 'Your Name'}</strong><br/>\n${roleLabel} · M37 Labs<br/>\n<a href="mailto:${userEmail}">${userEmail}</a>`}
                      className="w-full min-h-[240px] resize-y rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-3 font-mono text-[11px] leading-5 text-slate-200 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      value={body}
                      onChange={(e) => {
                        setTemplateActive(false);
                        setBody(e.target.value);
                      }}
                      required
                    />
                  </div>

                  <div className="">
                    <div className="flex h-5 items-center">
                      <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Preview</span>
                    </div>
                    <div className="flex min-h-[240px] items-center justify-center overflow-auto rounded-lg border border-slate-700 bg-white p-5 text-sm text-slate-900">
                      {body.trim() ? (
                        <div
                          className="max-w-full overflow-auto"
                          dangerouslySetInnerHTML={{ __html: body }}
                        />
                      ) : (
                        <div className="text-center text-xs text-slate-400">
                          Signature preview will appear here.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {!editingSignature && (
                  <div className="flex items-center gap-2.5 pt-2">
                    <input
                      id="sig-default"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950/40 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-slate-900"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                    />
                    <label htmlFor="sig-default" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                      Set as default signature
                    </label>
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
                  {submitting ? 'Saving...' : 'Save Signature'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
