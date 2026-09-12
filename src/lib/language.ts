export const supportedLanguages = ["en-IN", "gu-IN", "hi-IN", "mr-IN", "ta-IN", "te-IN", "bn-IN"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<SupportedLanguage, string> = {
  "en-IN": "English",
  "gu-IN": "Gujarati",
  "hi-IN": "Hindi",
  "mr-IN": "Marathi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "bn-IN": "Bengali",
};
export const nativeLanguageNames: Record<SupportedLanguage, string> = {
  "en-IN": "English", "gu-IN": "ગુજરાતી", "hi-IN": "हिन्दी", "mr-IN": "मराठी", "ta-IN": "தமிழ்", "te-IN": "తెలుగు", "bn-IN": "বাংলা",
};

/** Small, reliable UI vocabulary. Dynamic offer copy is translated server-side for voice. */
const copy = {
  "en-IN": { save: "Save profile", saving: "Saving...", accept: "Accept offer", skip: "Skip without penalty", notifications: "Notifications", markRead: "Mark all read", verify: "Verify readings", complete: "Generate readings", languageSaved: "Language preference saved.", today: "Today", activities: "Activities", offers: "Offers", rewards: "Rewards", profile: "Profile" },
  "gu-IN": { save: "પ્રોફાઇલ સાચવો", saving: "સાચવી રહ્યા છીએ...", accept: "ઓફર સ્વીકારો", skip: "દંડ વગર છોડો", notifications: "સૂચનાઓ", markRead: "બધી વાંચેલી કરો", verify: "રીડિંગ ચકાસો", complete: "રીડિંગ બનાવો", languageSaved: "ભાષાની પસંદગી સાચવાઈ.", today: "આજે", activities: "પ્રવૃત્તિઓ", offers: "ઓફર્સ", rewards: "ઇનામો", profile: "પ્રોફાઇલ" },
  "hi-IN": { save: "प्रोफ़ाइल सहेजें", saving: "सहेज रहे हैं...", accept: "ऑफ़र स्वीकार करें", skip: "बिना दंड छोड़ें", notifications: "सूचनाएँ", markRead: "सभी को पढ़ा हुआ करें", verify: "रीडिंग सत्यापित करें", complete: "रीडिंग बनाएँ", languageSaved: "भाषा की पसंद सहेजी गई।", today: "आज", activities: "गतिविधियाँ", offers: "ऑफ़र", rewards: "पुरस्कार", profile: "प्रोफ़ाइल" },
  "mr-IN": { save: "प्रोफाइल जतन करा", saving: "जतन करत आहे...", accept: "ऑफर स्वीकारा", skip: "दंडाशिवाय वगळा", notifications: "सूचना", markRead: "सर्व वाचले म्हणून चिन्हांकित करा", verify: "रीडिंग तपासा", complete: "रीडिंग तयार करा", languageSaved: "भाषेची निवड जतन झाली.", today: "आज", activities: "उपक्रम", offers: "ऑफर", rewards: "बक्षिसे", profile: "प्रोफाइल" },
  "ta-IN": { save: "சுயவிவரத்தை சேமிக்கவும்", saving: "சேமிக்கிறது...", accept: "சலுகையை ஏற்கவும்", skip: "அபராதமின்றி தவிர்க்கவும்", notifications: "அறிவிப்புகள்", markRead: "அனைத்தையும் படித்ததாக குறிக்கவும்", verify: "ரீடிங்கை சரிபார்க்கவும்", complete: "ரீடிங்கை உருவாக்கவும்", languageSaved: "மொழி விருப்பம் சேமிக்கப்பட்டது.", today: "இன்று", activities: "செயல்கள்", offers: "சலுகைகள்", rewards: "வெகுமதிகள்", profile: "சுயவிவரம்" },
  "te-IN": { save: "ప్రొఫైల్‌ను సేవ్ చేయండి", saving: "సేవ్ చేస్తోంది...", accept: "ఆఫర్‌ను అంగీకరించండి", skip: "పెనాల్టీ లేకుండా దాటవేయండి", notifications: "నోటిఫికేషన్లు", markRead: "అన్నీ చదివినట్లు గుర్తించండి", verify: "రీడింగ్స్ ధృవీకరించండి", complete: "రీడింగ్స్ రూపొందించండి", languageSaved: "భాష ప్రాధాన్యత సేవ్ చేయబడింది.", today: "ఈ రోజు", activities: "కార్యకలాపాలు", offers: "ఆఫర్లు", rewards: "రివార్డులు", profile: "ప్రొఫైల్" },
  "bn-IN": { save: "প্রোফাইল সংরক্ষণ করুন", saving: "সংরক্ষণ হচ্ছে...", accept: "অফার গ্রহণ করুন", skip: "জরিমানা ছাড়া এড়িয়ে যান", notifications: "বিজ্ঞপ্তি", markRead: "সব পড়া হিসাবে চিহ্নিত করুন", verify: "রিডিং যাচাই করুন", complete: "রিডিং তৈরি করুন", languageSaved: "ভাষার পছন্দ সংরক্ষিত হয়েছে।", today: "আজ", activities: "কার্যকলাপ", offers: "অফার", rewards: "পুরস্কার", profile: "প্রোফাইল" },
} as const;

export type ConsumerCopy = { [K in keyof (typeof copy)["en-IN"]]: string };
export function getConsumerCopy(language: string): ConsumerCopy {
  return copy[language as SupportedLanguage] ?? copy["en-IN"];
}

/** Use both languages when a heading has room; compact controls can use native text only. */
export function bilingual(language: string, key: keyof ConsumerCopy, english: string, compact = false): string {
  if (language === "en-IN") return english;
  const native = getConsumerCopy(language)[key];
  return compact ? native : `${english} (${native})`;
}

const actionTranslations: Record<string, Record<Exclude<SupportedLanguage, "en-IN">, string>> = {
  "Modify the time": { "gu-IN": "સમય બદલો", "hi-IN": "समय बदलें", "mr-IN": "वेळ बदला", "ta-IN": "நேரத்தை மாற்றவும்", "te-IN": "సమయాన్ని మార్చండి", "bn-IN": "সময় পরিবর্তন করুন" },
  "Save proposed time": { "gu-IN": "સૂચવેલ સમય સાચવો", "hi-IN": "प्रस्तावित समय सहेजें", "mr-IN": "सुचवलेली वेळ जतन करा", "ta-IN": "பரிந்துரைத்த நேரத்தை சேமிக்கவும்", "te-IN": "ప్రతిపాదిత సమయాన్ని భద్రపరచండి", "bn-IN": "প্রস্তাবিত সময় সংরক্ষণ করুন" },
  "Override schedule": { "gu-IN": "સમયપત્રક રદ કરો", "hi-IN": "समय-सारणी रद्द करें", "mr-IN": "वेळापत्रक रद्द करा", "ta-IN": "அட்டவணையை ரத்து செய்யவும்", "te-IN": "షెడ్యూల్‌ను రద్దు చేయండి", "bn-IN": "সময়সূচি বাতিল করুন" },
  "Mark activity complete": { "gu-IN": "પ્રવૃત્તિ પૂર્ણ નોંધો", "hi-IN": "गतिविधि पूरी दर्ज करें", "mr-IN": "उपक्रम पूर्ण नोंदवा", "ta-IN": "செயல் முடிந்ததாக குறிக்கவும்", "te-IN": "పని పూర్తయినట్లు గుర్తించండి", "bn-IN": "কাজ সম্পূর্ণ চিহ্নিত করুন" },
  "Retry verification": { "gu-IN": "ફરી ચકાસો", "hi-IN": "फिर सत्यापित करें", "mr-IN": "पुन्हा तपासा", "ta-IN": "மீண்டும் சரிபார்க்கவும்", "te-IN": "మళ్లీ ధృవీకరించండి", "bn-IN": "আবার যাচাই করুন" },
  "Load recommendation": { "gu-IN": "ભલામણ જુઓ", "hi-IN": "सुझाव देखें", "mr-IN": "शिफारस पहा", "ta-IN": "பரிந்துரையை பார்க்கவும்", "te-IN": "సూచనను చూడండి", "bn-IN": "পরামর্শ দেখুন" },
  "Save activity": { "gu-IN": "પ્રવૃત્તિ સાચવો", "hi-IN": "गतिविधि सहेजें", "mr-IN": "उपक्रम जतन करा", "ta-IN": "செயலை சேமிக்கவும்", "te-IN": "పనిని భద్రపరచండి", "bn-IN": "কাজ সংরক্ষণ করুন" },
  "Sign out": { "gu-IN": "સાઇન આઉટ", "hi-IN": "साइन आउट", "mr-IN": "साइन आउट", "ta-IN": "வெளியேறவும்", "te-IN": "నిష్క్రమించండి", "bn-IN": "সাইন আউট" },
};

export function actionLabel(language: string, english: string) {
  const native = actionTranslations[english]?.[language as Exclude<SupportedLanguage, "en-IN">];
  return native ? `${english} (${native})` : english;
}
