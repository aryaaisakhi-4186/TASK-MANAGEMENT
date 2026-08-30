import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, MicOff, X, Sparkles, Volume2 } from 'lucide-react';
import { translateHindiToEnglish } from '../../utils/hindiEnglishTranslator';

interface VoiceSearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}

export const VoiceSearchBar: React.FC<VoiceSearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search or speak in Hindi/English...',
  className = '',
  inputClassName = '',
  autoFocus = false
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'hi-IN'; // Recognizes Hindi and Indian English seamlessly

      recognition.onstart = () => {
        setIsListening(true);
        setFeedbackMsg('Listening... (Hindi ya English me bolein)');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (currentInterim) {
          setInterimText(currentInterim);
        }

        if (finalTranscript) {
          const translated = translateHindiToEnglish(finalTranscript);
          onChange(translated);
          setFeedbackMsg(`Translated: "${translated}"`);
          setTimeout(() => {
            setFeedbackMsg(null);
            setInterimText('');
          }, 1800);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        setFeedbackMsg(event.error === 'not-allowed' ? 'Mic permission denied' : 'Mic error, please retry');
        setTimeout(() => setFeedbackMsg(null), 2500);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onChange]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!speechSupported) {
      alert('Speech Recognition is not supported by your current browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setFeedbackMsg(null);
    } else {
      try {
        setInterimText('');
        recognitionRef.current?.start();
      } catch (err) {
        console.warn('Speech start error:', err);
        recognitionRef.current?.stop();
        setTimeout(() => recognitionRef.current?.start(), 200);
      }
    }
  };

  const clearSearch = () => {
    onChange('');
    setInterimText('');
    setFeedbackMsg(null);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Search Left Icon */}
      <Search size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />

      {/* Input Field */}
      <input
        type="text"
        value={isListening && interimText ? interimText : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isListening ? '🎙️ Listening... (Bolein)' : placeholder}
        autoFocus={autoFocus}
        className={`w-full pl-9 pr-16 py-2 rounded-xl bg-white dark:bg-slate-900 border ${
          isListening
            ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-950/20'
            : 'border-slate-200 dark:border-slate-800 focus:border-amber-500'
        } text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none shadow-sm transition-all ${inputClassName}`}
      />

      {/* Right Controls (Clear & Mic Button) */}
      <div className="absolute right-2 flex items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={clearSearch}
            title="Clear search"
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={13} />
          </button>
        )}

        {/* Voice Mic Button */}
        <button
          type="button"
          onClick={toggleListening}
          title={isListening ? 'Stop recording' : 'Voice Search (Hindi / English / Hinglish)'}
          className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
            isListening
              ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30'
              : 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10'
          }`}
        >
          {isListening ? <MicOff size={14} className="animate-bounce" /> : <Mic size={14} />}
        </button>
      </div>

      {/* Floating Listening & Translation Feedback Banner */}
      {feedbackMsg && (
        <div className="absolute left-0 -bottom-7 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 text-[10px] font-bold shadow-lg border border-amber-500/30 animate-in fade-in slide-in-from-top-1">
          <Sparkles size={11} className="text-amber-400 shrink-0 animate-spin" />
          <span className="truncate max-w-xs">{feedbackMsg}</span>
        </div>
      )}
    </div>
  );
};
