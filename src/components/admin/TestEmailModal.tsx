'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Send, X, Loader2, CheckCircle2, AlertCircle, Settings, Sparkles, User, MessageSquare, Paperclip, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface TestEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AttachedFileItem {
  id: string;
  name: string;
  size: number;
  base64: string;
}

export function TestEmailModal({ isOpen, onClose }: TestEmailModalProps) {
  const [sender, setSender] = useState('cm@sspacia.com');
  const [receiver, setReceiver] = useState('savdiyatushar17@gmail.com');
  const [subject, setSubject] = useState('test');
  const [body, setBody] = useState('hey it was just a test');
  
  // File Attachments (Stored ONLY in browser memory, zero DB storage)
  const [selectedFiles, setSelectedFiles] = useState<AttachedFileItem[]>([]);

  // SMTP Configuration (Defaults to Zoho Mail with App Password)
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [smtpHost, setSmtpHost] = useState('smtppro.zoho.in');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUser, setSmtpUser] = useState('cm@sspacia.com');
  const [smtpPass, setSmtpPass] = useState('VXQxVpCnBDZg');

  const [isSending, setIsSending] = useState(false);
  const [responseLog, setResponseLog] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Read files as Base64 in memory (No database involved)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File "${file.name}" exceeds 10MB limit`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const resultStr = reader.result as string;
        const base64Content = resultStr.split(',')[1];
        
        setSelectedFiles((prev) => [
          ...prev,
          {
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            base64: base64Content,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setResponseLog(null);

    try {
      const attachmentsPayload = selectedFiles.map((f) => ({
        filename: f.name,
        content: f.base64,
      }));

      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender,
          receiver,
          subject,
          body,
          attachments: attachmentsPayload,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Email delivered successfully to ${receiver}`);
        setResponseLog({
          success: true,
          message: data.message || 'Email sent successfully!',
          details: data.details,
        });
      } else {
        setShowSmtpSettings(true);
        toast.error(data.message || data.error || 'Failed to send email');
        setResponseLog({
          success: false,
          message: `${data.error || 'Email Delivery Failed'}: ${data.message || 'Check Zoho SMTP credentials'}`,
          details: data,
        });
      }
    } catch (err: any) {
      toast.error('Network error sending test email');
      setResponseLog({
        success: false,
        message: err.message || 'Network Error',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white border border-[var(--outline-variant)] w-full max-w-2xl shadow-2xl overflow-hidden font-sans text-xs my-6"
          >
            {/* Modal Header */}
            <div className="p-5 bg-[#006064] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/10 flex items-center justify-center font-bold text-lg">
                  ✉️
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight uppercase">
                    Direct Nodemailer SMTP Email System
                  </h2>
                  <p className="text-xs text-white/80 font-light">
                    Send test emails & trigger center-grouped daily 9 AM agreement/lock-in alert emails from <strong className="text-white">cm@sspacia.com</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSendEmail} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Sender & Receiver Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#616161] mb-1.5 flex items-center gap-1">
                    <User size={12} className="text-[#006064]" /> Sender Email (From)
                  </label>
                  <input
                    type="email"
                    required
                    value={sender}
                    onChange={(e) => {
                      setSender(e.target.value);
                      setSmtpUser(e.target.value);
                    }}
                    placeholder="e.g. cm@sspacia.com"
                    className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-[#006064] text-[#1B1C1C]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#616161] mb-1.5 flex items-center gap-1">
                    <Send size={12} className="text-[#006064]" /> Receiver Email (To)
                  </label>
                  <input
                    type="email"
                    required
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value)}
                    placeholder="e.g. savdiyatushar17@gmail.com"
                    className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-[#006064] text-[#1B1C1C]"
                  />
                </div>
              </div>

              {/* Subject Field */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#616161] mb-1.5 flex items-center gap-1">
                  <Sparkles size={12} className="text-[#006064]" /> Email Subject
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. test"
                  className="w-full bg-white border border-[var(--outline-variant)] px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-[#006064] text-[#1B1C1C]"
                />
              </div>

              {/* Body Field */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#616161] mb-1.5 flex items-center gap-1">
                  <MessageSquare size={12} className="text-[#006064]" /> Email Body / Content
                </label>
                <textarea
                  rows={4}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g. hey it was just a test"
                  className="w-full bg-white border border-[var(--outline-variant)] px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#006064] text-[#1B1C1C] leading-relaxed"
                />
              </div>

              {/* File Attachments Section (Transient in memory, zero DB) */}
              <div className="border border-neutral-200 bg-[#F8F9FA] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-[#616161] flex items-center gap-1.5">
                    <Paperclip size={13} className="text-[#006064]" /> File Attachments ({selectedFiles.length})
                    <span className="text-[9px] text-neutral-400 font-normal lowercase">(in-memory only, no DB storage)</span>
                  </label>

                  <label className="cursor-pointer px-3 py-1.5 bg-[#006064] hover:bg-teal-900 text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-xs">
                    <Paperclip size={12} /> Add Files
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {selectedFiles.length > 0 ? (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {selectedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2 bg-white border border-neutral-300 text-xs font-medium"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText size={14} className="text-[#006064] shrink-0" />
                          <span className="truncate font-bold text-[#1B1C1C]">{file.name}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">({formatFileSize(file.size)})</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFile(file.id)}
                          className="p-1 hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors"
                          title="Remove Attachment"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-400 italic text-center py-2">
                    No files attached. Click "Add Files" to attach images, PDFs, or documents.
                  </p>
                )}
              </div>

              {/* Collapsible Direct SMTP Settings */}
              <div className="border border-neutral-200 bg-neutral-50/70 p-3.5 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowSmtpSettings(!showSmtpSettings)}
                  className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#006064] hover:underline"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings size={13} /> {showSmtpSettings ? 'Hide Zoho SMTP Server Settings' : 'View / Edit Zoho SMTP Settings (Host, Port, Pass)'}
                  </span>
                  <span>{showSmtpSettings ? '▲' : '▼'}</span>
                </button>

                {showSmtpSettings && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-200">
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-neutral-600 mb-1">
                        SMTP Host Server
                      </label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtppro.zoho.in"
                        className="w-full bg-white border border-neutral-300 px-3 py-1.5 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase text-neutral-600 mb-1">
                        SMTP Port
                      </label>
                      <input
                        type="text"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="465"
                        className="w-full bg-white border border-neutral-300 px-3 py-1.5 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase text-neutral-600 mb-1">
                        SMTP User (Email)
                      </label>
                      <input
                        type="text"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="cm@sspacia.com"
                        className="w-full bg-white border border-neutral-300 px-3 py-1.5 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase text-neutral-600 mb-1">
                        SMTP Password (App Password)
                      </label>
                      <input
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        placeholder="VXQxVpCnBDZg"
                        className="w-full bg-white border border-neutral-300 px-3 py-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Status / Output Log */}
              {responseLog && (
                <div
                  className={`p-3.5 border text-xs space-y-1.5 ${
                    responseLog.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-red-50 text-red-950 border-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold uppercase text-[10px]">
                    {responseLog.success ? (
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle size={15} className="text-red-600 shrink-0" />
                    )}
                    <span>{responseLog.success ? 'Email Dispatched Successfully' : 'Email Send Diagnostic Status'}</span>
                  </div>
                  <p className="font-medium text-[11px]">{responseLog.message}</p>
                  {responseLog.details?.hint && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-300 text-[11px] text-amber-900 font-sans space-y-1">
                      <p className="font-bold">💡 Zoho Email Notice:</p>
                      <p>{responseLog.details.hint}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={async () => {
                    setIsSending(true);
                    try {
                      const res = await fetch('/api/admin/cron/agreement-alerts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ receiver: receiver.trim() || 'cm@sspacia.com' }),
                      });
                      const json = await res.json();
                      if (json.success) {
                        toast.success(`✅ ${json.message}`);
                        setResponseLog({
                          success: true,
                          message: json.message,
                          details: json.result,
                        });
                      } else {
                        toast.error(json.error || 'Failed to dispatch daily agreement alert emails');
                        setResponseLog({
                          success: false,
                          message: json.error || 'Failed to dispatch daily agreement alert emails',
                        });
                      }
                    } catch {
                      toast.error('Error triggering daily agreement alert emails');
                    } finally {
                      setIsSending(false);
                    }
                  }}
                  disabled={isSending}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  title="Dispatches center-grouped 60-day agreement & 15-day lock-in expiration alert emails from cm@sspacia.com"
                >
                  <Sparkles size={14} />
                  Trigger 9 AM Daily Alert Emails
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-[#1B1C1C] font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Cancel / Close
                  </button>

                  <button
                    type="submit"
                    disabled={isSending}
                    className="px-6 py-2.5 bg-[#006064] hover:bg-teal-900 text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Sending Email...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Send Test Email {selectedFiles.length > 0 && `(${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''})`}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
