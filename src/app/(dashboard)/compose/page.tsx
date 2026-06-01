'use client';

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Bold,
  Eye,
  File,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Lock,
  Paperclip,
  Quote,
  Redo2,
  RemoveFormatting,
  Send,
  UnderlineIcon,
  Undo2,
  X,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface ITemplate {
  _id: string;
  name: string;
  to_addresses?: string[];
  cc_addresses?: string[];
  subject: string;
  body: string;
  status: string;
}

interface ISignature {
  _id: string;
  name: string;
  body: string;
  is_default: boolean;
  status: string;
}

interface IAttachment {
  id: string;
  name: string;
  size: number;
  contentType: string;
  status: 'uploading' | 'done' | 'error';
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const createObjectId = () => {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${timestamp}${randomHex}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getRoleLabel = (role?: string | null) =>
  role === 'SENIOR_PRODUCT_MANAGER' ? 'Senior Product Manager' : 'Product Manager';

const resolveTemplatePlaceholders = (
  html: string,
  user?: { name?: string | null; email?: string | null; role?: string | null } | null
) => {
  const senderName = user?.name || user?.email?.split('@')[0] || 'Your Name';
  const senderEmail = user?.email || 'info@m37labs.com';
  const senderRole = getRoleLabel(user?.role);

  return html
    .replaceAll('{{sender_name}}', escapeHtml(senderName))
    .replaceAll('{{sender_role}}', escapeHtml(senderRole))
    .replaceAll('{{sender_email}}', escapeHtml(senderEmail));
};

const getMeaningfulEditorText = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function ComposePageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get('templateId');

  // Form Fields
  const [toAddresses, setToAddresses] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [ccAddresses, setCcAddresses] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  // Attachments
  const [attachments, setAttachments] = useState<IAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lists from API
  const [templates, setTemplates] = useState<ITemplate[]>([]);
  const [signatures, setSignatures] = useState<ISignature[]>([]);

  // Selected Options
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedSignatureId, setSelectedSignatureId] = useState('');
  const [sigPreview, setSigPreview] = useState('');

  // UI States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [supabaseStorageEnabled, setSupabaseStorageEnabled] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Placeholder.configure({
        placeholder: 'Write your email body...',
      }),
      Underline,
    ],
    content: bodyHtml,
    editorProps: {
      attributes: {
        class:
          'min-h-[220px] rounded-b-lg border bg-slate-900 px-4 py-3 text-sm leading-relaxed text-slate-200 outline-none transition-all [&_p]:mb-3 last:[&_p]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-indigo-400 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-700 [&_blockquote]:pl-3 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-slate-600 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setBodyHtml(currentEditor.getHTML());
    },
  });

  const setEditorHtml = useCallback((nextHtml: string) => {
    setBodyHtml(nextHtml);
    if (editor) {
      editor.commands.setContent(nextHtml, { emitUpdate: false });
    }
  }, [editor]);

  // Load templates & signatures once
  useEffect(() => {
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTemplates(data.filter((t) => t.status === 'ACTIVE'));
        }
      });

    fetch('/api/signatures?scope=mine')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const activeSigs = data.filter((s) => s.status === 'ACTIVE');
          setSignatures(activeSigs);
          // Set default signature
          const defSig = activeSigs.find((s) => s.is_default);
          if (defSig) {
            setSelectedSignatureId(defSig._id);
            setSigPreview(defSig.body);
          }
        }
      });

    fetch('/api/attachments/upload')
      .then((res) => res.json())
      .then((data) => {
        setSupabaseStorageEnabled(!!data.supabaseStorageEnabled);
      })
      .catch(() => {
        setSupabaseStorageEnabled(false);
      });
  }, []);

  // Auto-apply template from query parameter if present
  useEffect(() => {
    if (templateIdParam && templates.length > 0) {
      const template = templates.find((t) => t._id === templateIdParam);
      if (template) {
        setSelectedTemplateId(template._id);
        setToAddresses(template.to_addresses || []);
        setCcAddresses(template.cc_addresses || []);
        setSubject(template.subject);
        const nextBodyHtml = resolveTemplatePlaceholders(template.body, session?.user);
        setEditorHtml(nextBodyHtml);
      }
    }
  }, [templateIdParam, templates, session?.user, setEditorHtml]);

  const handleSignatureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sigId = e.target.value;
    setSelectedSignatureId(sigId);
    if (!sigId) {
      setSigPreview('');
      return;
    }
    const signature = signatures.find((s) => s._id === sigId);
    if (signature) {
      setSigPreview(signature.body);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tmplId = e.target.value;
    setSelectedTemplateId(tmplId);
    if (!tmplId) return;

    const template = templates.find((t) => t._id === tmplId);
    if (template) {
      if (
        toAddresses.length > 0 ||
        ccAddresses.length > 0 ||
        subject ||
        (editor && getMeaningfulEditorText(editor.getHTML()).length > 0)
      ) {
        if (!confirm('Applying this template will overwrite your current subject and body. Proceed?')) {
          setSelectedTemplateId('');
          return;
        }
      }
      setToAddresses(template.to_addresses || []);
      setCcAddresses(template.cc_addresses || []);
      setSubject(template.subject);
      const nextBodyHtml = resolveTemplatePlaceholders(template.body, session?.user);
      setEditorHtml(nextBodyHtml);
    }
  };

  // Recipient Tag logic
  const handleRecipientKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    type: 'to' | 'cc'
  ) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      const inputVal = type === 'to' ? toInput : ccInput;
      const cleanVal = inputVal.replace(/,/g, '').trim();

      if (!cleanVal) return;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanVal)) {
        setFieldErrors((prev) => ({
          ...prev,
          [type]: 'Please enter a valid email address.',
        }));
        return;
      }

      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[type];
        return copy;
      });

      if (type === 'to') {
        if (toAddresses.includes(cleanVal) || ccAddresses.includes(cleanVal)) {
          setFieldErrors((prev) => ({ ...prev, to: 'Duplicate email address.' }));
          return;
        }
        setToAddresses((prev) => [...prev, cleanVal]);
        setToInput('');
      } else {
        if (toAddresses.includes(cleanVal) || ccAddresses.includes(cleanVal)) {
          setFieldErrors((prev) => ({ ...prev, cc: 'Duplicate email address.' }));
          return;
        }
        setCcAddresses((prev) => [...prev, cleanVal]);
        setCcInput('');
      }
    } else if (e.key === 'Backspace') {
      const inputVal = type === 'to' ? toInput : ccInput;
      if (!inputVal) {
        if (type === 'to' && toAddresses.length > 0) {
          setToAddresses((prev) => prev.slice(0, -1));
        } else if (type === 'cc' && ccAddresses.length > 0) {
          setCcAddresses((prev) => prev.slice(0, -1));
        }
      }
    }
  };

  const removeRecipient = (index: number, type: 'to' | 'cc') => {
    if (type === 'to') {
      setToAddresses((prev) => prev.filter((_, i) => i !== index));
    } else {
      setCcAddresses((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Format Text in Editor
  const formatText = (cmd: string, val: string = '') => {
    if (!editor) return;

    const chain = editor.chain().focus();
    switch (cmd) {
      case 'bold':
        chain.toggleBold().run();
        break;
      case 'italic':
        chain.toggleItalic().run();
        break;
      case 'underline':
        chain.toggleUnderline().run();
        break;
      case 'insertUnorderedList':
        chain.toggleBulletList().run();
        break;
      case 'insertOrderedList':
        chain.toggleOrderedList().run();
        break;
      case 'blockquote':
        chain.toggleBlockquote().run();
        break;
      case 'undo':
        chain.undo().run();
        break;
      case 'redo':
        chain.redo().run();
        break;
      case 'createLink':
        if (val) {
          chain.extendMarkRange('link').setLink({ href: val }).run();
        }
        break;
      case 'unsetLink':
        chain.extendMarkRange('link').unsetLink().run();
        break;
      case 'clearNodes':
        chain.clearNodes().unsetAllMarks().run();
        break;
      default:
        break;
    }
  };

  const insertLink = () => {
    if (!editor) return;
    const currentHref = editor.getAttributes('link').href || '';
    setLinkUrl(currentHref);
    setLinkModalOpen(true);
  };

  const handleCloseLinkModal = () => {
    setLinkModalOpen(false);
    setLinkUrl('');
  };

  const handleSaveLink = () => {
    if (!editor) return;

    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) {
      formatText('unsetLink');
      handleCloseLinkModal();
      return;
    }

    formatText('createLink', trimmedUrl);
    handleCloseLinkModal();
  };

  const handleFileBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!session?.user?.id) {
      setErrorMsg('Please sign in again before uploading attachments.');
      return;
    }

    // Check sizes
    let currentTotal = attachments.reduce((sum, a) => sum + (a.status === 'done' ? a.size : 0), 0);
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const currentMaxLimit = (!supabaseStorageEnabled && !isLocal) ? 4.5 * 1024 * 1024 : MAX_FILE_SIZE;

    for (const file of files) {
      if (file.size > currentMaxLimit) {
        if (!supabaseStorageEnabled && !isLocal) {
          setErrorMsg(`File "${file.name}" exceeds Vercel's 4.5MB serverless limit. Please configure Supabase Storage environment variables to use direct-to-cloud storage and allow up to 25MB.`);
        } else {
          setErrorMsg(`File "${file.name}" exceeds the 25MB size limit.`);
        }
        return;
      }
      if (currentTotal + file.size > currentMaxLimit) {
        if (!supabaseStorageEnabled && !isLocal) {
          setErrorMsg(`Total attachment size exceeds Vercel's 4.5MB serverless limit. Please configure Supabase Storage environment variables to use direct-to-cloud storage and allow up to 25MB.`);
        } else {
          setErrorMsg('Total attachment size exceeds the 25MB limit.');
        }
        return;
      }
      currentTotal += file.size;
    }

    setErrorMsg(null);

    // Initial state
    const tempAttachments = files.map((file) => ({
      id: Math.random().toString(), // temp ID
      name: file.name,
      size: file.size,
      contentType: file.type,
      status: 'uploading' as const,
    }));

    setAttachments((prev) => [...prev, ...tempAttachments]);

    // Upload files sequentially or concurrently
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = tempAttachments[i].id;

      try {
        const contentType = file.type || 'application/octet-stream';
        let attachmentId = createObjectId();

        if (supabaseStorageEnabled) {
          const createRes = await fetch('/api/attachments/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'supabase.create-upload',
              filename: file.name,
              size: file.size,
              contentType,
            }),
          });

          if (!createRes.ok) {
            throw new Error('Failed to prepare upload');
          }

          const uploadData = await createRes.json();
          attachmentId = uploadData.attachmentId;
          const supabase = createClient(uploadData.supabaseUrl, uploadData.supabaseAnonKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          });

          const { error: uploadError } = await supabase
            .storage
            .from(uploadData.bucket)
            .uploadToSignedUrl(uploadData.path, uploadData.token, file, {
              contentType,
            });

          if (uploadError) {
            throw new Error(uploadError.message || 'Direct upload failed');
          }

          const registerRes = await fetch('/api/attachments/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'supabase.register-completed',
              attachmentId,
              path: uploadData.path,
              filename: file.name,
              size: file.size,
              contentType,
            }),
          });

          if (!registerRes.ok) {
            throw new Error('Upload registration failed');
          }
        } else {
          // Local/development GridFS upload
          const formData = new FormData();
          formData.append('file', file);
          formData.append('attachmentId', attachmentId);
          formData.append('uploadedBy', session.user.id);

          const res = await fetch('/api/attachments/upload', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            throw new Error('Local upload failed');
          }
        }

        // Update attachment with true database ID
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === tempId
              ? { ...att, id: attachmentId, status: 'done' as const }
              : att
          )
        );
        toast.success(`${file.name} uploaded successfully.`);
      } catch (err) {
        console.error('Upload error:', err);
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === tempId ? { ...att, status: 'error' as const } : att
          )
        );
        setErrorMsg(`Failed to upload ${file.name}`);
      }
    }
  };

  const removeAttachment = async (id: string, status: string) => {
    // Remove from UI first
    setAttachments((prev) => prev.filter((a) => a.id !== id));

    // If it was uploaded successfully, delete it from attachment storage
    if (status === 'done') {
      try {
        await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete attachment from server:', err);
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const totalAttachmentSize = attachments.reduce((sum, a) => sum + a.size, 0);

  // Validate fields for preview/send
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (toAddresses.length === 0) {
      errors.to = 'At least one recipient (TO) is required.';
    }
    if (!subject.trim()) {
      errors.subject = 'Subject is required.';
    }

    const editorText = getMeaningfulEditorText(editor?.getHTML() || bodyHtml);
    if (!editorText) {
      errors.body = 'Email body is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Preview Email Modal
  const handlePreview = async () => {
    if (!validateForm()) return;
    setErrorMsg(null);

    const bodyHtmlValue = editor?.getHTML() || bodyHtml;

    try {
      const res = await fetch('/api/emails/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_addresses: toAddresses,
          cc_addresses: ccAddresses,
          subject,
          body: bodyHtmlValue,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to generate preview.');
      } else {
        setPreviewData(data);
        setPreviewOpen(true);
      }
    } catch (err) {
      setErrorMsg('Error generating preview.');
      console.error(err);
    }
  };

  // Queue Email for Send
  const handleSend = async () => {
    if (!validateForm()) return;

    // Check if any attachments are still uploading
    if (attachments.some((a) => a.status === 'uploading')) {
      setErrorMsg('Please wait for all attachments to finish uploading.');
      return;
    }

    setErrorMsg(null);
    setSending(true);

    const bodyHtmlValue = editor?.getHTML() || bodyHtml;
    const attachmentIds = attachments.filter((a) => a.status === 'done').map((a) => a.id);

    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_addresses: toAddresses,
          cc_addresses: ccAddresses,
          subject,
          body: bodyHtmlValue,
          attachment_ids: attachmentIds,
          template_id: selectedTemplateId || null,
          signature_id: selectedSignatureId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to queue email.');
      } else {
        // Redirect to queue page
        router.push('/queue');
      }
    } catch (err) {
      setErrorMsg('Error queueing email.');
      console.error(err);
    } finally {
      setSending(false);
      setPreviewOpen(false);
    }
  };

  return (
    <div id="compose-screen" className="flex flex-col flex-1 text-slate-200">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-md px-6">
        <span className="text-base font-semibold tracking-tight">Compose Email</span>
        <div className="ml-auto flex items-center gap-3">
          <button className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50" onClick={handlePreview}>
            <Eye size={14} strokeWidth={2} />
            Preview
          </button>
          <button className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70 active:scale-95" onClick={handleSend} disabled={sending}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Send size={14} strokeWidth={2} />
            )}
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
      <div className="flex-1 p-6">
        {errorMsg && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-400">
            <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span className="leading-tight">{errorMsg}</span>
          </div>
        )}

        <div className="mb-6 flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-2.5 text-xs text-slate-400">
          <Lock className="shrink-0 text-slate-500" size={14} strokeWidth={2} />
          From: <strong className="font-medium text-slate-200">info@m37labs.com</strong>
          <span className="ml-2 text-slate-500">
            · Reply-To: <span id="compose-replyto" className="text-slate-300">{session?.user?.email}</span>
          </span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-6 max-xl:grid-cols-1">
          <div className="space-y-4">
            {/* TO */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">To <span className="text-red-400">*</span></label>
              <div className={`tag-wrap flex min-h-[42px] cursor-text flex-wrap items-center gap-2 rounded-lg border bg-slate-900 px-3 py-2 transition-all focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50 ${fieldErrors.to ? 'border-red-500/50' : 'border-slate-700/50'
                }`} onClick={() => document.getElementById('to-input')?.focus()}>
                {toAddresses.map((email, idx) => (
                  <span key={email} className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 py-1 pl-2.5 pr-1.5 text-xs text-slate-200">
                    {email}
                    <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-sm leading-none text-slate-500 transition-colors hover:text-red-400" onClick={(e) => { e.stopPropagation(); removeRecipient(idx, 'to'); }}>×</button>
                  </span>
                ))}
                <input
                  className="min-w-24 flex-1 border-0 bg-transparent p-0 text-sm text-slate-200 placeholder-slate-600 outline-none"
                  id="to-input"
                  type="text"
                  placeholder={toAddresses.length === 0 ? "Add recipients, press Enter…" : ""}
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => handleRecipientKeyDown(e, 'to')}
                />
              </div>
              {fieldErrors.to && <div className="text-[11px] text-red-400">{fieldErrors.to}</div>}
            </div>

            {/* CC */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">CC</label>
              <div className={`tag-wrap flex min-h-[42px] cursor-text flex-wrap items-center gap-2 rounded-lg border bg-slate-900 px-3 py-2 transition-all focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50 ${fieldErrors.cc ? 'border-red-500/50' : 'border-slate-700/50'
                }`} onClick={() => document.getElementById('cc-input')?.focus()}>
                {ccAddresses.map((email, idx) => (
                  <span key={email} className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 py-1 pl-2.5 pr-1.5 text-xs text-slate-200">
                    {email}
                    <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-sm leading-none text-slate-500 transition-colors hover:text-red-400" onClick={(e) => { e.stopPropagation(); removeRecipient(idx, 'cc'); }}>×</button>
                  </span>
                ))}
                <input
                  className="min-w-24 flex-1 border-0 bg-transparent p-0 text-sm text-slate-200 placeholder-slate-600 outline-none"
                  id="cc-input"
                  type="text"
                  placeholder={ccAddresses.length === 0 ? "Add CC recipients, press Enter…" : ""}
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => handleRecipientKeyDown(e, 'cc')}
                />
              </div>
              {fieldErrors.cc && <div className="text-[11px] text-red-400">{fieldErrors.cc}</div>}
            </div>

            {/* SUBJECT */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Subject <span className="text-red-400">*</span></label>
              <input
                id="subject-input"
                type="text"
                placeholder="Email subject"
                className={`w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-sm text-slate-200 transition-all placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 ${fieldErrors.subject ? 'border-red-500/50' : 'border-slate-700/50'}`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
              <div className="flex items-center justify-between">
                {fieldErrors.subject ? (
                  <div className="text-[11px] text-red-400">{fieldErrors.subject}</div>
                ) : <div />}
                <div className={`text-[10px] ${subject.length > 150 ? 'font-medium text-red-400' : 'text-slate-500'}`}>
                  {subject.length} / 150
                </div>
              </div>
            </div>

            {/* BODY (RTE) */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Body <span className="text-red-400">*</span></label>
              <div className="flex flex-wrap gap-1 rounded-t-lg border border-b-0 border-slate-700/50 bg-slate-800/80 px-2 py-2">
                <button type="button" className={`cursor-pointer rounded border-0 px-2.5 py-1.5 text-xs transition-colors ${editor?.isActive('bold') ? 'bg-slate-700 text-slate-200' : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} onClick={() => formatText('bold')}><Bold size={14} strokeWidth={2} /></button>
                <button type="button" className={`cursor-pointer rounded border-0 px-2.5 py-1.5 text-xs transition-colors ${editor?.isActive('italic') ? 'bg-slate-700 text-slate-200' : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} onClick={() => formatText('italic')}><Italic size={14} strokeWidth={2} /></button>
                <button type="button" className={`cursor-pointer rounded border-0 px-2.5 py-1.5 text-xs transition-colors ${editor?.isActive('underline') ? 'bg-slate-700 text-slate-200' : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} onClick={() => formatText('underline')}><UnderlineIcon size={14} strokeWidth={2} /></button>
                <div className="mx-1 my-1 w-px self-stretch bg-slate-700"></div>
                <button type="button" className={`cursor-pointer rounded border-0 px-2.5 py-1.5 text-xs transition-colors ${editor?.isActive('bulletList') ? 'bg-slate-700 text-slate-200' : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} onClick={() => formatText('insertUnorderedList')}><List size={14} strokeWidth={2} /></button>
                <button type="button" className={`cursor-pointer rounded border-0 px-2.5 py-1.5 text-xs transition-colors ${editor?.isActive('orderedList') ? 'bg-slate-700 text-slate-200' : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} onClick={() => formatText('insertOrderedList')}><ListOrdered size={14} strokeWidth={2} /></button>
                <div className="mx-1 my-1 w-px self-stretch bg-slate-700"></div>
                <button type="button" className={`cursor-pointer rounded border-0 px-2.5 py-1.5 text-xs transition-colors ${editor?.isActive('link') ? 'bg-slate-700 text-slate-200' : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} onClick={insertLink}><Link2 size={14} strokeWidth={2} /></button>
                <button type="button" className="cursor-pointer rounded border-0 bg-transparent px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200" onClick={() => fileInputRef.current?.click()}><Paperclip size={14} strokeWidth={2} /></button>
                <button type="button" className={`cursor-pointer rounded border-0 px-2.5 py-1.5 text-xs transition-colors ${editor?.isActive('blockquote') ? 'bg-slate-700 text-slate-200' : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} onClick={() => formatText('blockquote')}><Quote size={14} strokeWidth={2} /></button>
                <button type="button" className="cursor-pointer rounded border-0 bg-transparent px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200" onClick={() => formatText('clearNodes')}><RemoveFormatting size={14} strokeWidth={2} /></button>
                <div className="mx-1 my-1 w-px self-stretch bg-slate-700"></div>
                <button type="button" className="cursor-pointer rounded border-0 bg-transparent px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200" onClick={() => formatText('undo')}><Undo2 size={14} strokeWidth={2} /></button>
                <button type="button" className="cursor-pointer rounded border-0 bg-transparent px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200" onClick={() => formatText('redo')}><Redo2 size={14} strokeWidth={2} /></button>
              </div>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 border-x border-slate-700/50 bg-slate-900/60 px-3 py-3">
                  {attachments.map((file) => (
                    <div key={file.id} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-slate-500">
                        <File size={14} strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-200">{file.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {formatSize(file.size)}
                          {file.status === 'uploading' ? ' • Uploading...' : ''}
                          {file.status === 'error' ? ' • Failed' : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="cursor-pointer rounded-md p-1 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => removeAttachment(file.id, file.status)}
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                id="file-input"
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileBrowse}
              />
              <EditorContent
                editor={editor}
                id="body-rte"
                className={`${fieldErrors.body ? '[&_.ProseMirror]:border-red-500/50' : '[&_.ProseMirror]:border-slate-700/50'} [&_.ProseMirror]:min-h-[220px] [&_.ProseMirror]:rounded-b-lg [&_.ProseMirror]:border [&_.ProseMirror]:focus:border-indigo-500 [&_.ProseMirror]:focus:ring-1 [&_.ProseMirror]:focus:ring-indigo-500/50`}
              />
              {fieldErrors.body && <div className="text-[11px] text-red-400">{fieldErrors.body}</div>}
              {attachments.length > 0 && (
                <div className={`mt-2 text-right text-[10px] font-medium ${totalAttachmentSize > MAX_FILE_SIZE ? 'text-red-400' : 'text-slate-500'}`}>
                  Total: {formatSize(totalAttachmentSize)} / 25 MB
                </div>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 bg-slate-950/20 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Template</div>
              <div className="p-4">
                <select
                  className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                  value={selectedTemplateId}
                  onChange={handleTemplateChange}
                >
                  <option value="">— None —</option>
                  {templates.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
                <p className="mt-2.5 text-[10px] text-slate-500 leading-relaxed">Populates all fields. You can edit before sending.</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 bg-slate-950/20 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Signature</div>
              <div className="p-4">
                <select
                  className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                  id="sig-select"
                  value={selectedSignatureId}
                  onChange={handleSignatureChange}
                >
                  <option value="">— No signature —</option>
                  {signatures.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
                {sigPreview && (
                  <div
                    id="sig-preview"
                    className="mt-4 rounded-lg border border-slate-700/40 bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-400"
                    dangerouslySetInnerHTML={{ __html: sigPreview }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewOpen && previewData && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all" onClick={() => setPreviewOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-[640px] overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <span className="font-semibold text-slate-200">Email Preview</span>
              <button className="cursor-pointer rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200" onClick={() => setPreviewOpen(false)}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 text-xs">
                <div className="mb-2 flex gap-3">
                  <span className="w-16 shrink-0 font-medium text-slate-500">From</span>
                  <span className="font-medium
                   text-slate-300">{previewData.from}</span>
                </div>
                <div className="mb-2 flex gap-3">
                  <span className="w-16 shrink-0 font-medium text-slate-500">Reply-To</span>
                  <span className="font-medium
                   text-slate-300">{previewData.reply_to}</span>
                </div>
                <div className="mb-2 flex gap-3">
                  <span className="w-16 shrink-0 font-medium text-slate-500">To</span>
                  <span className="font-medium
                   text-slate-300">{previewData.to_addresses.join(', ')}</span>
                </div>
                {previewData.cc_addresses.length > 0 && (
                  <div className="mb-2 flex gap-3">
                    <span className="w-16 shrink-0 font-medium text-slate-500">CC</span>
                    <span className="font-medium text-slate-300">{previewData.cc_addresses.join(', ')}</span>
                  </div>
                )}
                <div className="mb-2 flex gap-3 pt-1">
                  <span className="w-16 shrink-0 font-medium text-slate-500">Subject</span>
                  <strong className="text-slate-200">{previewData.subject}</strong>
                </div>
                {attachments.length > 0 && (
                  <div className="flex gap-3 pt-1">
                    <span className="w-16 shrink-0 font-medium text-slate-500">Attach</span>
                    <span className="text-slate-400">
                      {attachments.map((a) => `${a.name} (${formatSize(a.size)})`).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              <div
                className="mt-5 min-h-[160px] rounded-lg border border-slate-700/50 bg-slate-950/50 p-5 text-sm leading-relaxed text-slate-300"
                dangerouslySetInnerHTML={{ __html: previewData.body }}
                style={{ overflowWrap: 'break-word' }}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 bg-slate-900/50 px-6 py-4">
              <button className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700/60 bg-transparent px-4 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100" onClick={() => setPreviewOpen(false)}>
                Back to Edit
              </button>
              <button className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70 active:scale-95" onClick={handleSend} disabled={sending}>
                {sending ? 'Queueing...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {linkModalOpen && (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={handleCloseLinkModal}>
          <div className="w-full max-w-[520px] rounded-2xl border border-slate-300/10 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-300/10 px-5 py-4">
              <span className="text-sm font-semibold">Insert Link</span>
              <button
                type="button"
                className="cursor-pointer rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                onClick={handleCloseLinkModal}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label htmlFor="compose-link-url" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                Link URL
              </label>
              <input
                id="compose-link-url"
                type="text"
                autoFocus
                placeholder="https://example.com"
                className="w-full rounded-lg border border-slate-300/10 bg-white px-3.5 py-2.5 text-sm placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveLink();
                  }
                }}
              />
              <p className="text-[11px] text-slate-500">
                Leave empty to remove the current link.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-300/10 px-5 py-4">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300/10 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 hover:text-slate-900"
                onClick={handleCloseLinkModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-400"
                onClick={handleSaveLink}
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={null}>
      <ComposePageContent />
    </Suspense>
  );
}
