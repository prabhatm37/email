'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, LayoutTemplate, AlertCircle } from 'lucide-react';

interface ITemplate {
  _id: string;
  name: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body: string;
  status: 'ACTIVE' | 'INACTIVE';
  visibility: 'PERSONAL';
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

const getRoleLabel = (role?: string | null) =>
  role === 'SENIOR_PRODUCT_MANAGER' ? 'Senior Product Manager' : 'Product Manager';

const buildTemplateExample = () => `<p>Hi {{name}},</p>

<p>I hope this message finds you well. I wanted to follow up on our recent discussion regarding the <strong>Q3 product roadmap</strong>.</p>

<p>Here's a quick summary of next steps:</p>
<ul>
  <li>Review the updated feature spec by <strong>Friday</strong></li>
  <li>Share feedback with the team via Slack</li>
  <li>Confirm availability for the sync call next week</li>
</ul>

<p>Please don't hesitate to reach out if you have any questions or need clarification on any of the points above.</p>
<br />
<p>Best regards,<br/>
{{sender_name}}<br/>
{{sender_role}}<br/>
<a href="mailto:{{sender_email}}">{{sender_email}}</a><br/>
M37 Labs</p>`;

const renderTemplatePreview = ({
  html,
  senderName,
  senderRole,
  senderEmail,
}: {
  html: string;
  senderName: string;
  senderRole: string;
  senderEmail: string;
}) =>
  html
    .replaceAll('{{name}}', 'Recipient Name')
    .replaceAll('{{sender_name}}', escapeHtml(senderName))
    .replaceAll('{{sender_role}}', escapeHtml(senderRole))
    .replaceAll('{{sender_email}}', escapeHtml(senderEmail));

export default function TemplatesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<ITemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ITemplate | null>(null);
  const [name, setName] = useState('');
  const [toAddresses, setToAddresses] = useState('');
  const [ccAddresses, setCcAddresses] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setTemplates(data);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const senderName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Your Name';
  const senderEmail = session?.user?.email || 'info@m37labs.com';
  const senderRole = getRoleLabel(session?.user?.role);
  const previewBody = renderTemplatePreview({
    html: body,
    senderName,
    senderRole,
    senderEmail,
  });

  const handleOpenNew = () => {
    setEditingTemplate(null);
    setName('');
    setToAddresses('');
    setCcAddresses('');
    setSubject('');
    setBody('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (template: ITemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setToAddresses((template.to_addresses || []).join(', '));
    setCcAddresses((template.cc_addresses || []).join(', '));
    setSubject(template.subject);
    setBody(template.body);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleToggleStatus = async (template: ITemplate) => {
    const nextStatus = template.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/templates/${template._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchTemplates();
      }
    } catch (err) {
      console.error('Error toggling template status:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setErrorMsg('All fields are required.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const url = editingTemplate ? `/api/templates/${editingTemplate._id}` : '/api/templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          to_addresses: toAddresses,
          cc_addresses: ccAddresses,
          subject,
          body,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to save template.');
      } else {
        setModalOpen(false);
        fetchTemplates();
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const isSpm = session?.user?.role === 'SENIOR_PRODUCT_MANAGER';

  return (
    <div id="templates-screen" className="flex flex-col flex-1 text-slate-200">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-md px-6">
        <span className="text-base font-semibold tracking-tight text-slate-100">Templates</span>
        <div className="ml-auto flex items-center">
          <button
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-400 active:scale-95"
            onClick={handleOpenNew}
          >
            <Plus size={14} strokeWidth={2.5} />
            New Template
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
                  <th className="px-4 py-3">Recipients</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Visibility</th>
                  {isSpm && <th id="tmpl-owner-col" className="px-4 py-3">Created by</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading && templates.length === 0 ? (
                  <tr>
                    <td colSpan={isSpm ? 7 : 6} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        <span>Loading templates...</span>
                      </div>
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td colSpan={isSpm ? 7 : 6} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="rounded-full bg-slate-900/60 p-4 border border-slate-800 text-slate-500">
                          <LayoutTemplate size={32} strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-300">No templates found</p>
                          <p className="text-xs text-slate-500">Create a template to start using pre-filled details.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  templates.map((template) => (
                    <tr key={template._id} className="transition-colors hover:bg-slate-800/30">
                      <td className={`px-4 py-3 font-semibold ${template.status === 'INACTIVE' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {template.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-slate-400">
                        {(template.to_addresses || []).length > 0
                          ? `${template.to_addresses[0]}${template.to_addresses.length > 1 ? ` (+${template.to_addresses.length - 1})` : ''}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[200px] truncate" title={template.subject}>{template.subject}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Personal
                        </span>
                      </td>
                      {isSpm && <td className="px-4 py-3 text-slate-300">{template.created_by?.full_name || 'System'}</td>}
                      <td className="px-4 py-3">
                        {template.status === 'ACTIVE' ? (
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
                            disabled={template.status === 'INACTIVE'}
                            onClick={() => {
                              router.push(`/compose?templateId=${template._id}`);
                            }}
                          >
                            Use
                          </button>
                          <button
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100"
                            onClick={() => handleOpenEdit(template)}
                          >
                            Edit
                          </button>
                          <button
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                              template.status === 'ACTIVE'
                                ? 'border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                            onClick={() => handleToggleStatus(template)}
                          >
                            {template.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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

      {/* Template Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-[1080px] rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800/60 px-6 py-4">
                <span className="text-sm font-semibold tracking-tight text-slate-100">
                  {editingTemplate ? 'Edit Template' : 'New Template'}
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

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="tmpl-name" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Template Name <span className="text-red-400">*</span></label>
                    <input
                      id="tmpl-name"
                      type="text"
                      placeholder="e.g. Q3 Feedback Follow-up"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="tmpl-to" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">TO Recipients</label>
                    <input
                      id="tmpl-to"
                      type="text"
                      placeholder="client@example.com, stakeholder@example.com"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      value={toAddresses}
                      onChange={(e) => setToAddresses(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="tmpl-cc" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">CC Recipients</label>
                    <input
                      id="tmpl-cc"
                      type="text"
                      placeholder="optional@example.com"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      value={ccAddresses}
                      onChange={(e) => setCcAddresses(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="tmpl-subject" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Subject <span className="text-red-400">*</span></label>
                    <input
                      id="tmpl-subject"
                      type="text"
                      placeholder="Email subject line"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="tmpl-body" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Body <span className="text-red-400">*</span></label>
                      <button
                        type="button"
                        onClick={() => {
                          setBody(buildTemplateExample());
                        }}
                        className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        {body.trim() ? 'Reset example' : 'Use example'} ↗
                      </button>
                    </div>
                    <textarea
                      id="tmpl-body"
                      placeholder={`<p>Hi {{name}},</p>\n\n<p>Your message here...</p>\n\n<p>Best regards,<br/>{{sender_name}}<br/>{{sender_role}}<br/>{{sender_email}}</p>`}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-3 text-[11px] text-slate-200 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-mono min-h-[240px] leading-5"
                      value={body}
                      onChange={(e) => {
                        setBody(e.target.value);
                      }}
                      required
                    />
                  </div>

                  <div className="">
                    <div className="flex h-5 items-center">
                      <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Preview</span>
                    </div>
                    <div className="min-h-[240px] overflow-hidden rounded-lg border border-slate-700 bg-white text-sm leading-relaxed text-slate-900">
                      {body.trim() ? (
                        <iframe
                          title="Template preview"
                          className="h-full min-h-[240px] w-full bg-white"
                          srcDoc={`<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        padding: 20px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        color: #0f172a;
        background: #ffffff;
      }
      p { margin: 0 0 16px; }
      ul, ol { margin: 0 0 16px 20px; padding: 0; }
      li { margin: 0 0 8px; }
      a { color: #4f46e5; }
    </style>
  </head>
  <body>${previewBody}</body>
</html>`}
                        />
                      ) : (
                        <div className="flex min-h-[240px] items-center justify-center p-5 text-center text-xs text-slate-400">
                          Template preview will appear here.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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
                  {submitting ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
