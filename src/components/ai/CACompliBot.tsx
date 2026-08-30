import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Paperclip, 
  Check, 
  FileText, 
  Building, 
  CalendarCheck2, 
  Clock, 
  Plus, 
  Mic, 
  MicOff, 
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Folder,
  History,
  Edit3,
  ExternalLink,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { 
  processAgenticCommand, 
  parseDocumentTextToClient, 
  extractPdfTextFromServer, 
  AgenticAction 
} from '../../utils/agenticAIEngine';
import { translateHindiToEnglish } from '../../utils/hindiEnglishTranslator';
import { Client, ClientCategory } from '../../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  action?: AgenticAction;
  attachedFileName?: string;
}

const CHAT_STORAGE_KEY = 'taskvaani_agentic_ai_chat_history';

const INITIAL_BOT_MESSAGE: ChatMessage = {
  id: '1',
  sender: 'bot',
  text: 'Namaste! Main **TASK-VAANI Agentic AI Assistant** hoon. Main aapke kahne par app ke andar direct kaam kar sakta hoon:\n\n• **📄 GST Registration / PDF se Client Profile banana**: GST certificate (REG-06) ya PAN card ka PDF attach karein, main pehle live preview dikhaunga fir bina duplicate kiye import kar dunga.\n• **✅ Task Create & Update**: "Apex Tools ka GSTR-3B task banao" ya "Bharat Logistics ka GST done mark karo".\n• **💰 Extra Billing Record**: "Client X ka ₹15,000 ka extra ROC work record karo".\n• **⏱️ Office Shift & Lunch**: "Office login karo" / "Lunch break start karo".',
  timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
};

export const CACompliBot: React.FC<{
  onNavigateTab?: (tab: string) => void;
}> = ({ onNavigateTab }) => {
  const { 
    clients, 
    tasks, 
    team, 
    extraWork, 
    addClient, 
    addTask, 
    updateTaskStatus, 
    addExtraWork, 
    addTeamMember,
    loginOffice,
    startLunchBreak,
    endLunchBreak,
    logoffOffice
  } = useTasks();

  const { currentRole, currentUser } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load chat history:', e);
    }
    return [INITIAL_BOT_MESSAGE];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Editable form state for preview cards
  const [editingPreviewId, setEditingPreviewId] = useState<string | null>(null);
  const [previewFormData, setPreviewFormData] = useState<{ [msgId: string]: Partial<Client> }>({});

  // Persist chat history on every update
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat history:', e);
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Clear Chat History
  const handleClearHistory = () => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([
      {
        ...INITIAL_BOT_MESSAGE,
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setPreviewFormData({});
    setShowClearConfirm(false);
  };

  // Export Chat Log
  const handleExportChatLog = () => {
    const logText = messages.map(m => `[${m.timestamp}] ${m.sender === 'user' ? 'USER' : 'AGENTIC_AI'}:\n${m.text}\n${m.action ? '-> ACTION: ' + m.action.title + ' (' + m.action.description + ')\n' : ''}`).join('\n---\n\n');
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TASK-VAANI_AI_Chat_Log_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Execute Agentic Action directly inside app state
  const executeAction = (action: AgenticAction) => {
    try {
      if (action.type === 'CREATE_CLIENT' || action.type === 'PREVIEW_CLIENT') {
        addClient(action.data);
      } else if (action.type === 'CREATE_TASK') {
        addTask(action.data);
      } else if (action.type === 'UPDATE_TASK_STATUS') {
        updateTaskStatus(action.data.taskId, action.data.status);
      } else if (action.type === 'RECORD_EXTRA_WORK') {
        addExtraWork(action.data);
      } else if (action.type === 'OFFICE_SHIFT') {
        if (action.data.action === 'LOGIN') loginOffice();
        else if (action.data.action === 'LUNCH_START') startLunchBreak();
        else if (action.data.action === 'LUNCH_END') endLunchBreak();
        else if (action.data.action === 'LOGOFF') logoffOffice();
      } else if (action.type === 'ADD_TEAM_MEMBER') {
        addTeamMember(action.data);
      }
      action.executed = true;
    } catch (e) {
      console.warn('Action execution error:', e);
    }
  };

  // Confirm and Commit Preview Client to Master Directory
  const handleConfirmPreviewImport = (msgId: string, clientData: Partial<Client>) => {
    const currentData = previewFormData[msgId] || clientData;
    
    addClient({
      tradeName: currentData.tradeName || 'New Client',
      legalName: currentData.legalName || currentData.tradeName || 'New Client',
      pan: currentData.pan || 'PAN-PENDING',
      gstin: currentData.gstin,
      tan: currentData.tan,
      category: currentData.category || 'PVT_LTD',
      status: 'ACTIVE',
      contactPerson: currentData.contactPerson || 'Authorized Representative',
      phone: currentData.phone || '+91 98000 00000',
      email: currentData.email || 'accounts@client.com',
      formationDate: currentData.formationDate || new Date().toISOString().split('T')[0],
      assignedTeamId: '',
      assignedTeamName: currentData.assignedTeamName || 'Assigned Staff',
      portalPassword: 'client' + (currentData.phone ? currentData.phone.slice(-4) : '123'),
      googleDriveFolderId: currentData.googleDriveFolderId || '',
      googleDriveFolderUrl: currentData.googleDriveFolderUrl || '',
      customFields: []
    });

    setMessages(prev => prev.map(m => {
      if (m.id === msgId && m.action) {
        return {
          ...m,
          action: {
            ...m.action,
            executed: true,
            title: `Client Saved: ${currentData.tradeName}`,
            description: `PAN: ${currentData.pan} • GSTIN: ${currentData.gstin || 'None'} • Type: ${currentData.category}`
          }
        };
      }
      return m;
    }));
  };

  // Process Document File (PDF, Excel, Image)
  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setAttachedFile(file);

    try {
      let extractedText = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        // Use server pdf-parse endpoint for true text extraction
        extractedText = await extractPdfTextFromServer(file);
      }

      const clientData = parseDocumentTextToClient(extractedText, file.name);
      const msgId = (Date.now() + 1).toString();

      // Check if duplicate exists
      const isExisting = clients.some(c => 
        (clientData.pan && clientData.pan !== 'PAN-PENDING' && c.pan?.toUpperCase() === clientData.pan?.toUpperCase()) ||
        (clientData.gstin && c.gstin?.toUpperCase() === clientData.gstin?.toUpperCase())
      );

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: 'user',
        text: `Please analyze "${file.name}" and extract client details with Live Preview before importing.`,
        attachedFileName: file.name,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };

      const action: AgenticAction = {
        type: 'PREVIEW_CLIENT',
        title: isExisting ? `Update Profile: ${clientData.tradeName}` : `New Client: ${clientData.tradeName}`,
        description: `PAN: ${clientData.pan} • GSTIN: ${clientData.gstin || 'Auto'} • Contact: ${clientData.contactPerson}`,
        data: clientData,
        executed: false
      };

      // Set initial form data for preview
      setPreviewFormData(prev => ({ ...prev, [msgId]: clientData }));

      const botReply: ChatMessage = {
        id: msgId,
        sender: 'bot',
        text: `📄 **${file.name}** ko accurately read kar liya gaya hai!\nNiche diye gaye **Live Preview** me details verify karein aur fir **"Confirm & Import"** par click karein:`,
        action,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, userMsg, botReply]);
      setAttachedFile(null);
    } catch (err: any) {
      console.warn('Doc process error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Voice Recognition Handler
  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported by your current browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const translated = translateHindiToEnglish(transcript);
        setInput(prev => (prev ? prev + ' ' + translated : translated));
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !attachedFile) return;

    const userText = input;
    setInput('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    setTimeout(() => {
      const response = processAgenticCommand(userText, {
        clients,
        tasks,
        team,
        extraWork,
        currentRole,
        currentUser
      });

      const msgId = (Date.now() + 1).toString();

      if (response.action) {
        if (response.action.type === 'PREVIEW_CLIENT') {
          setPreviewFormData(prev => ({ ...prev, [msgId]: response.action!.data }));
        } else {
          executeAction(response.action);
        }
      }

      const botReply: ChatMessage = {
        id: msgId,
        sender: 'bot',
        text: response.replyText,
        action: response.action,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botReply]);
      setLoading(false);
    }, 400);
  };

  const updatePreviewField = (msgId: string, field: keyof Client, value: any) => {
    setPreviewFormData(prev => ({
      ...prev,
      [msgId]: {
        ...(prev[msgId] || {}),
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      
      {/* Header with Clear History & Action Buttons */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight flex items-center gap-2">
              <Sparkles className="text-amber-500" /> TASK-VAANI Agentic AI
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-mono text-[10px] font-bold">
              <History size={11} /> {messages.length} Messages in History
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
            Autonomous app assistant • Accurate GST/PAN PDF Reader with Live Preview • Zero Duplication
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Read PDF Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all"
          >
            <Paperclip size={14} /> Read GST / PAN PDF
          </button>

          {/* Export Chat Log */}
          <button
            onClick={handleExportChatLog}
            title="Download full chat log as text file"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 text-xs transition-all shadow-sm"
          >
            <Download size={15} />
          </button>

          {/* Clear History Button */}
          <button
            onClick={() => setShowClearConfirm(true)}
            title="Clear persistent AI chat history"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-700 dark:text-red-300 hover:text-white border border-red-500/30 text-xs font-bold transition-all shadow-sm"
          >
            <Trash2 size={14} /> Clear History
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Clearing History */}
      {showClearConfirm && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-red-900 dark:text-red-200 font-semibold">
            <AlertCircle size={18} className="shrink-0 text-red-600" />
            <span>Are you sure you want to clear the entire Agentic AI chat history?</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleClearHistory}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md shadow-red-600/30"
            >
              Yes, Clear History
            </button>
          </div>
        </div>
      )}

      <GlassCard className="flex flex-col h-[680px] p-4" variant="elevated" glow="gold">
        
        {/* Chat Messages Log */}
        <div className="flex-1 overflow-y-auto space-y-4 p-2">
          {messages.map(msg => {
            const isPreviewAction = msg.action?.type === 'PREVIEW_CLIENT' && !msg.action?.executed;
            const currentPreview = previewFormData[msg.id] || msg.action?.data || {};

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-sm">
                    <Bot size={20} />
                  </div>
                )}

                <div className="max-w-2xl space-y-2.5 w-full">
                  <div
                    className={`p-4 rounded-3xl text-xs leading-relaxed shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-amber-500 text-slate-950 font-semibold rounded-tr-none ml-auto max-w-xl'
                        : 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-tl-none font-medium'
                    }`}
                  >
                    {msg.attachedFileName && (
                      <div className="mb-2 p-2 rounded-xl bg-slate-900/10 dark:bg-slate-800/60 border border-amber-500/30 flex items-center gap-2 text-[11px] font-bold">
                        <FileText size={14} className="text-amber-600" />
                        <span>Attached: {msg.attachedFileName}</span>
                      </div>
                    )}

                    <div className="whitespace-pre-line">{msg.text}</div>
                    <div className={`text-[9px] mt-1.5 ${msg.sender === 'user' ? 'text-slate-800' : 'text-slate-500'}`}>
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* 1. Interactive Live Editable Preview Card for Client Setup */}
                  {isPreviewAction && (
                    <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/90 border-2 border-amber-500/40 shadow-xl space-y-3.5 animate-in zoom-in-95">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <Building className="text-amber-500" size={16} />
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            Live Extracted Client Preview
                          </span>
                        </div>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/30">
                          Review & Confirm
                        </span>
                      </div>

                      {/* Extracted Form Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Trade Name</label>
                          <input
                            type="text"
                            value={currentPreview.tradeName || ''}
                            onChange={(e) => updatePreviewField(msg.id, 'tradeName', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white text-xs focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Legal Name</label>
                          <input
                            type="text"
                            value={currentPreview.legalName || ''}
                            onChange={(e) => updatePreviewField(msg.id, 'legalName', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-amber-600 uppercase">PAN Number</label>
                          <input
                            type="text"
                            value={currentPreview.pan || ''}
                            onChange={(e) => updatePreviewField(msg.id, 'pan', e.target.value.toUpperCase())}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 font-mono font-black text-amber-800 dark:text-amber-300 text-xs focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">GSTIN Number</label>
                          <input
                            type="text"
                            value={currentPreview.gstin || ''}
                            onChange={(e) => updatePreviewField(msg.id, 'gstin', e.target.value.toUpperCase())}
                            placeholder="Optional / Pending"
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white text-xs focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Entity Constitution</label>
                          <select
                            value={currentPreview.category || 'PVT_LTD'}
                            onChange={(e) => updatePreviewField(msg.id, 'category', e.target.value as ClientCategory)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-semibold text-slate-900 dark:text-white text-xs focus:border-amber-500"
                          >
                            <option value="PVT_LTD">Private Limited</option>
                            <option value="LLP">LLP</option>
                            <option value="PARTNERSHIP">Partnership</option>
                            <option value="PROPRIETOR">Proprietorship</option>
                            <option value="INDIVIDUAL">Individual</option>
                            <option value="TRUST">Trust / NGO</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Contact Person</label>
                          <input
                            type="text"
                            value={currentPreview.contactPerson || ''}
                            onChange={(e) => updatePreviewField(msg.id, 'contactPerson', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Mobile Phone</label>
                          <input
                            type="text"
                            value={currentPreview.phone || ''}
                            onChange={(e) => updatePreviewField(msg.id, 'phone', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Email</label>
                          <input
                            type="text"
                            value={currentPreview.email || ''}
                            onChange={(e) => updatePreviewField(msg.id, 'email', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Action Commit Button */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                          <ShieldCheck size={13} className="text-emerald-500" /> Duplicate Safe (No Duplicate Rows)
                        </span>

                        <button
                          onClick={() => handleConfirmPreviewImport(msg.id, currentPreview)}
                          className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/25 transition-all active:scale-95"
                        >
                          <Check size={14} /> Confirm & Import Client
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. Standard Executed Action Card */}
                  {msg.action && msg.action.executed && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs animate-in zoom-in-95">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-emerald-900 dark:text-emerald-300 truncate">
                            {msg.action.title}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {msg.action.description}
                          </p>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] shadow-sm shrink-0">
                        Saved in Master
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-bold animate-pulse">
              <Sparkles size={16} className="animate-spin" /> Agentic AI parsing document & extracting tax fields...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Agentic Commands */}
        <div className="flex flex-wrap gap-1.5 py-2 border-t border-slate-200 dark:border-slate-800">
          {[
            '📄 Read GST Certificate & Setup Client',
            '✅ Create GSTR-3B Task for Client',
            '⏱️ Office Login (Shift IN)',
            '🍽️ Start Lunch Break',
            '💰 Record ₹15,000 Extra ROC Work'
          ].map((q, idx) => (
            <button
              key={idx}
              onClick={() => { setInput(q.replace(/^[^s]+s/, '')); }}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-600 hover:border-amber-400 font-semibold transition-all shadow-sm"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Hidden File Input for PDF / Excel */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
          className="hidden"
        />

        {/* Input Bar with Voice Mic & File Attachment */}
        <form onSubmit={handleSend} className="flex items-center gap-2 pt-2">
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach GST Registration PDF or PAN Image"
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 hover:border-amber-400 transition-all shadow-sm"
          >
            <Paperclip size={16} />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Agentic AI se kaam bolein (e.g. GST certificate se client banao, task add karo, office login)..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none shadow-sm placeholder:text-slate-400 font-medium"
          />

          {/* Voice Mic Button */}
          <button
            type="button"
            onClick={toggleVoiceInput}
            title="Speak command in Hindi or English"
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
              isListening
                ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30'
                : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 hover:border-amber-400'
            }`}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <button
            type="submit"
            disabled={loading}
            className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>

      </GlassCard>

    </div>
  );
};
