import React, { useState, useEffect } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Client } from '../../types';
import { 
  X, 
  Send, 
  Building, 
  User, 
  FileText, 
  CheckCircle2, 
  MessageSquare, 
  Share2,
  Users,
  Mic,
  MicOff,
  Sparkles
} from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { translateHindiToEnglish } from '../../utils/hindiEnglishTranslator';

interface Props {
  isOpen: boolean;
  preSelectedClient?: Client | null;
  onClose: () => void;
}

export const ClientReminderModal: React.FC<Props> = ({
  isOpen,
  preSelectedClient,
  onClose
}) => {
  const { clients, sendClientReminder } = useTasks();
  const { currentUser } = useAuth();

  const [selectedClientId, setSelectedClientId] = useState('');
  const [complianceTitle, setComplianceTitle] = useState('Monthly GST & TDS Working');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');
  const [isListeningNotes, setIsListeningNotes] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEscapeKey(onClose, isOpen);

  const toggleVoiceNotes = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported by your current browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListeningNotes) {
      setIsListeningNotes(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListeningNotes(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const translated = translateHindiToEnglish(transcript);
        setCustomNotes(prev => (prev ? prev + ' ' + translated : translated));
      };
      recognition.onerror = () => setIsListeningNotes(false);
      recognition.onend = () => setIsListeningNotes(false);

      recognition.start();
    }
  };

  useEffect(() => {
    if (preSelectedClient) {
      setSelectedClientId(preSelectedClient.id);
    } else if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [preSelectedClient, clients]);

  if (!isOpen) return null;

  const currentClient = clients.find(c => c.id === selectedClientId) || clients[0];

  const standardDocuments = [
    'Bank Account Statements (PDF & Excel with password if any)',
    'Monthly Sales Register & Outward Invoices',
    'Purchase Bills / Invoices & Debit Notes',
    'TDS / TCS Challan copies & TRACES 26AS matching',
    'GSTR-2B & ITC Reconciliation details',
    'Salary Statement & EPF/ESIC payment challans',
    'Electricity Bill / Rent Agreement (for GST Amendment)',
    'Form 16 / TDS Certificates from Deductors'
  ];

  const handleToggleDoc = (doc: string) => {
    setSelectedDocs(prev => prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]);
  };

  const handleSendReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClient) return;

    const senderName = currentUser?.name || 'Staff Associate';

    // Send in-app reminder (stored in cloud & visible to client + client employee in portal)
    sendClientReminder({
      clientId: currentClient.id,
      clientName: currentClient.tradeName,
      clientContactPerson: currentClient.contactPerson || currentClient.legalName,
      clientPhone: currentClient.phone,
      clientEmail: currentClient.email,
      employeeName: currentClient.employeeName || 'Accountant',
      employeePhone: currentClient.employeePhone || '',
      complianceTitle,
      requiredDocuments: selectedDocs.length > 0 ? selectedDocs : ['Required statutory working papers'],
      notes: customNotes.trim(),
      senderId: currentUser?.id || 'staff',
      senderName
    });

    setSuccessMessage(`✅ Document request successfully sent to ${currentClient.tradeName} (Owner: ${currentClient.contactPerson}) & Employee: (${currentClient.employeeName || 'Accountant'})!`);
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 2500);
  };

  // Generate WhatsApp Message Template for both Owner & Employee
  const generateWhatsAppUrl = (phone: string) => {
    if (!currentClient || !phone) return '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;

    const docsList = selectedDocs.length > 0
      ? selectedDocs.map((d, i) => `${i + 1}. ${d}`).join('\n')
      : '1. Required statutory documents for compliance';

    const text = encodeURIComponent(
      `*URGENT: DOCUMENT & PAPERS REQUEST FOR ${currentClient.tradeName.toUpperCase()}*\n\n` +
      `Dear Sir/Madam & Accounts Team,\n\n` +
      `For processing your upcoming statutory compliance (*${complianceTitle}*), please provide the following papers/documents at the earliest:\n\n` +
      `${docsList}\n\n` +
      (customNotes ? `*Working Notes:* ${customNotes}\n\n` : '') +
      `_Sent by ${currentUser?.name || 'Tax Compliance Team'} • TASK-VAANI CA Management Portal_`
    );

    return `https://api.whatsapp.com/send?phone=${targetPhone}&text=${text}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title="Close"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-serif">
              Client Reminder & Document Request
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Request papers for next working • Delivered to <strong>Client Owner & Client Employee/Accountant</strong>
            </p>
          </div>
        </div>

        {successMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSendReminder} className="space-y-4 text-xs">
          
          {/* Client Selector & Compliance Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Building size={13} className="text-amber-500" /> Select Client Entity:
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs focus:border-amber-500 focus:outline-none"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.tradeName} ({c.pan})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <FileText size={13} className="text-emerald-500" /> Compliance / Work Stage:
              </label>
              <input
                type="text"
                required
                value={complianceTitle}
                onChange={(e) => setComplianceTitle(e.target.value)}
                placeholder="e.g. Monthly GSTR-1, Tax Audit Vouching, 26AS matching"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Dual Recipients Information Display Card */}
          {currentClient && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                  <User size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">1. Client Owner / MD</p>
                  <p className="font-bold text-slate-900 dark:text-white text-xs">{currentClient.contactPerson || currentClient.tradeName}</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">{currentClient.phone} • {currentClient.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 border-t sm:border-t-0 sm:border-l border-amber-500/20 pt-2 sm:pt-0 sm:pl-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">2. Client Employee / Accountant</p>
                  <p className="font-bold text-slate-900 dark:text-white text-xs">{currentClient.employeeName || 'Accountant / Manager'}</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">{currentClient.employeePhone || 'Portal App Login Active'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Required Papers / Documents Checkboxes */}
          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-2">
              Select Required Working Papers / Documents:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl">
              {standardDocuments.map((doc, idx) => (
                <label key={idx} className="flex items-start gap-2 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800">
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc)}
                    onChange={() => handleToggleDoc(doc)}
                    className="mt-0.5 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 leading-tight">
                    {doc}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Notes / Instructions with Voice Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-800 dark:text-slate-200">
                Custom Notes / Specific Working Details:
              </label>

              <button
                type="button"
                onClick={toggleVoiceNotes}
                title="Voice Type (Speak in Hindi or English, auto-translated)"
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  isListeningNotes
                    ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30'
                    : 'bg-amber-500/15 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 border border-amber-500/30'
                }`}
              >
                {isListeningNotes ? <MicOff size={13} /> : <Mic size={13} />}
                <span>{isListeningNotes ? 'Listening...' : '🎙️ Voice Type (Hindi/Eng)'}</span>
              </button>
            </div>
            <textarea
              rows={2}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. Please provide password for ICICI Bank statement and copy of Form 16 (or speak with Mic)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* 1-Click WhatsApp Quick Triggers */}
          {currentClient && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Share2 size={13} className="text-emerald-600" /> Quick WhatsApp Triggers:
              </span>
              <div className="flex items-center gap-2">
                {currentClient.phone && (
                  <a
                    href={generateWhatsAppUrl(currentClient.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 transition-all"
                  >
                    WhatsApp Owner ↗
                  </a>
                )}
                {currentClient.employeePhone && (
                  <a
                    href={generateWhatsAppUrl(currentClient.employeePhone)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center gap-1 transition-all"
                  >
                    WhatsApp Accountant ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-300 dark:border-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Send size={15} /> Send Request to Portal & Log
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
