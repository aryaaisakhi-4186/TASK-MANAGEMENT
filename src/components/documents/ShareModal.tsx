import React from 'react';
import { DocumentItem } from '../../types';
import { X, MessageSquare, Send, Copy, ExternalLink } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  document: DocumentItem | null;
  onClose: () => void;
}

export const ShareModal: React.FC<Props> = ({ isOpen, document, onClose }) => {
  useEscapeKey(onClose, isOpen);

  if (!isOpen || !document) return null;

  const shareText = encodeURIComponent(
    `*TASK-VAANI Compliance Document Share*\n\n📄 Document: ${document.title}\n🏢 Client: ${document.clientName}\n🏷️ Category: ${document.category}\n📅 Date: ${document.uploadedAt}\n\nProtected & Verified by M/S VAANI & ASSOCIATES, CHARTERED ACCOUNTANTS.`
  );

  const whatsappUrl = `https://wa.me/?text=${shareText}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent('https://taskvaani.app/docs')}&text=${shareText}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} title="Close" className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800">
          <X size={18} />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <MessageSquare size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-serif">1-Click Client Dispatch</h3>
          <p className="text-xs text-slate-500">Share "{document.title}" directly with client</p>
        </div>

        <div className="space-y-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
          >
            <MessageSquare size={16} /> Share via WhatsApp (wa.me)
          </a>

          <a
            href={telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full py-3 px-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all"
          >
            <Send size={16} /> Share via Telegram
          </a>
        </div>

      </div>
    </div>
  );
};
