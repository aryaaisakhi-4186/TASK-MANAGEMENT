// Intelligent Hindi / Hinglish to English Translator for Search & Inputs
// Translates conversational Hindi/Hinglish voice input into clean English compliance terms

const HINDI_WORD_MAP: Record<string, string> = {
  // Compliance & Statutory
  'जीएसटी': 'GST',
  'टीडीएस': 'TDS',
  'इनकम टैक्स': 'INCOME TAX',
  'आयकर': 'INCOME TAX',
  'आईटीआर': 'ITR',
  'आरओसी': 'ROC',
  'ऑडिट': 'AUDIT',
  'लेखा': 'AUDIT',
  'पीएफ': 'PF',
  'ईएसआईसी': 'ESIC',
  'चालान': 'CHALLAN',
  'रिटर्न': 'RETURN',
  'बैलेंस शीट': 'BALANCE SHEET',
  'बैंक स्टेटमेंट': 'BANK STATEMENT',
  'खाता': 'ACCOUNT',

  // Status & Priority
  'पेंडिंग': 'PENDING',
  'बाकी': 'PENDING',
  'रुक हुआ': 'PENDING',
  'काम बाकी': 'PENDING',
  'चालू': 'IN_PROGRESS',
  'प्रोग्रेस': 'IN_PROGRESS',
  'चल रहा': 'IN_PROGRESS',
  'हो गया': 'DONE',
  'पूरा': 'DONE',
  'कंप्लीट': 'DONE',
  'समाप्त': 'DONE',
  'लागू नहीं': 'NOT_APPLICABLE',
  'जरूरी': 'CRITICAL',
  'अर्जेंट': 'HIGH',
  'महत्वपूर्ण': 'HIGH',
  'सामान्य': 'MEDIUM',
  'कम': 'LOW',

  // Time & Frequency
  'आज': 'TODAY',
  'कल': 'TOMORROW',
  'रोज': 'DAILY',
  'दैनिक': 'DAILY',
  'हफ्ते': 'WEEKLY',
  'साप्ताहिक': 'WEEKLY',
  'महीना': 'MONTHLY',
  'मासिक': 'MONTHLY',
  'तिमाही': 'QUARTERLY',
  'साल': 'YEARLY',
  'वार्षिक': 'YEARLY',

  // Entities & Roles
  'क्लाइंट': 'CLIENT',
  'ग्राहक': 'CLIENT',
  'पार्टनर': 'PARTNER',
  'स्टाफ': 'STAFF',
  'कर्मचारी': 'STAFF',
  'टीम': 'TEAM',
  'प्राइवेट लिमिटेड': 'PVT LTD',
  'फर्म': 'FIRM',
  'कंपनी': 'COMPANY',
  'हाजिरी': 'ATTENDANCE',
  'उपस्थिति': 'ATTENDANCE',
  'लॉगिन': 'LOGIN',
  'लॉगऑफ': 'LOGOFF',
  'लंच': 'LUNCH',
  'लंच ब्रेक': 'LUNCH BREAK',
  'ब्रेक': 'BREAK',
  'इतिहास': 'HISTORY',
  'रिकॉर्ड': 'RECORD',
  'रिपोर्ट': 'REPORT',
  'दस्तावेज': 'DOCUMENT',
  'फाइल': 'FILE',
  'फोल्डर': 'FOLDER',
  'खोजो': 'SEARCH',
  'ढूंढो': 'SEARCH'
};

const COMMON_HINGLISH_MAP: Record<string, string> = {
  'aaj': 'today',
  'kal': 'tomorrow',
  'baki': 'pending',
  'baaki': 'pending',
  'ho gaya': 'done',
  'ho gya': 'done',
  'chal raha': 'in progress',
  'chalu': 'in progress',
  'kam': 'work',
  'kaam': 'work',
  'mahina': 'monthly',
  'hafte': 'weekly',
  'saal': 'yearly',
  'haziri': 'attendance',
  'hajiri': 'attendance',
  'shuru': 'start',
  'band': 'stop',
  'dastavej': 'document',
  'dikhaye': '',
  'dikhao': '',
  'karo': '',
  'karna': '',
  'kaise': '',
  'mujhe': '',
  'chahiye': '',
  'dekho': '',
  'dhundo': '',
  'khojo': ''
};

export const translateHindiToEnglish = (text: string): string => {
  if (!text) return '';

  let processed = text.trim();

  // 1. Direct word replacements from Hindi dictionary
  for (const [hindi, eng] of Object.entries(HINDI_WORD_MAP)) {
    const regex = new RegExp(hindi, 'gi');
    processed = processed.replace(regex, eng);
  }

  // 2. Hinglish replacements
  for (const [hinglish, eng] of Object.entries(COMMON_HINGLISH_MAP)) {
    const regex = new RegExp(`\\b${hinglish}\\b`, 'gi');
    processed = processed.replace(regex, eng);
  }

  // 3. Clean up extra whitespaces
  processed = processed.replace(/\s+/g, ' ').trim();

  return processed;
};
