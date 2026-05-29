"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "en" | "hi" | "hinglish";

const translations: Record<string, Record<Lang, string>> = {
  // Common
  "app.name": { en: "MyLab", hi: "MyLab", hinglish: "MyLab" },
  "app.tagline": { en: "Diagnostics Portal", hi: "डायग्नोस्टिक्स पोर्टल", hinglish: "Diagnostics Portal" },
  "common.save": { en: "Save", hi: "सेव करें", hinglish: "Save Karo" },
  "common.cancel": { en: "Cancel", hi: "रद्द करें", hinglish: "Cancel" },
  "common.back": { en: "Back", hi: "वापस", hinglish: "Back" },
  "common.search": { en: "Search", hi: "खोजें", hinglish: "Search Karo" },
  "common.delete": { en: "Delete", hi: "हटाएं", hinglish: "Delete Karo" },
  "common.edit": { en: "Edit", hi: "संपादित करें", hinglish: "Edit Karo" },
  "common.print": { en: "Print", hi: "प्रिंट करें", hinglish: "Print Karo" },
  "common.logout": { en: "Logout", hi: "लॉग आउट", hinglish: "Logout" },
  "common.loading": { en: "Loading…", hi: "लोड हो रहा…", hinglish: "Loading…" },
  "common.today": { en: "Today", hi: "आज", hinglish: "Aaj" },
  "common.all": { en: "All", hi: "सभी", hinglish: "Sab" },
  "common.pending": { en: "Pending", hi: "बाकी", hinglish: "Pending" },
  "common.done": { en: "Done", hi: "हो गया", hinglish: "Ho Gaya" },
  "common.paid": { en: "Paid", hi: "भुगतान हुआ", hinglish: "Paid" },
  "common.unpaid": { en: "Unpaid", hi: "बाकी है", hinglish: "Unpaid" },

  // Login
  "login.title": { en: "Welcome back", hi: "वापस स्वागत है", hinglish: "Welcome Back" },
  "login.subtitle": { en: "Sign in to your account to continue", hi: "जारी रखने के लिए साइन इन करें", hinglish: "Sign in karo continue karne ke liye" },
  "login.email": { en: "Email address", hi: "ईमेल पता", hinglish: "Email address" },
  "login.password": { en: "Password", hi: "पासवर्ड", hinglish: "Password" },
  "login.submit": { en: "Sign In", hi: "साइन इन करें", hinglish: "Sign In Karo" },
  "login.signing_in": { en: "Signing in…", hi: "साइन इन हो रहा…", hinglish: "Sign in ho raha…" },

  // Sidebar
  "nav.dashboard": { en: "Dashboard", hi: "डैशबोर्ड", hinglish: "Dashboard" },
  "nav.tests": { en: "Test Catalogue", hi: "टेस्ट सूची", hinglish: "Test List" },
  "nav.reports": { en: "All Reports", hi: "सभी रिपोर्ट", hinglish: "Sab Reports" },
  "nav.staff": { en: "Staff", hi: "स्टाफ", hinglish: "Staff" },
  "nav.settings": { en: "Report Settings", hi: "रिपोर्ट सेटिंग्स", hinglish: "Report Settings" },
  "nav.profile": { en: "Profile", hi: "प्रोफाइल", hinglish: "Profile" },

  // Dashboard
  "dashboard.title": { en: "Dashboard", hi: "डैशबोर्ड", hinglish: "Dashboard" },
  "dashboard.today_reports": { en: "Today's Reports", hi: "आज की रिपोर्ट", hinglish: "Aaj ki Reports" },
  "dashboard.today_revenue": { en: "Today's Revenue", hi: "आज की कमाई", hinglish: "Aaj ki Kamai" },
  "dashboard.total_reports": { en: "Total Reports", hi: "कुल रिपोर्ट", hinglish: "Total Reports" },
  "dashboard.total_revenue": { en: "Total Revenue", hi: "कुल कमाई", hinglish: "Total Kamai" },
  "dashboard.recent": { en: "Recent Reports", hi: "हाल की रिपोर्ट", hinglish: "Recent Reports" },

  // Compounder
  "compounder.reports": { en: "Reports", hi: "रिपोर्ट", hinglish: "Reports" },
  "compounder.new_sample": { en: "New Sample", hi: "नया सैंपल", hinglish: "Naya Sample" },
  "compounder.enter_results": { en: "Enter Results", hi: "रिजल्ट डालें", hinglish: "Result Daalo" },
  "compounder.view_print": { en: "View / Print", hi: "देखें / प्रिंट", hinglish: "Dekho / Print" },
  "compounder.finalize_print": { en: "Finalize & Print", hi: "फाइनल करें और प्रिंट", hinglish: "Final Karo aur Print" },
  "compounder.save_draft": { en: "Save Draft", hi: "ड्राफ्ट सेव करें", hinglish: "Draft Save Karo" },
  "compounder.register_sample": { en: "Register Sample", hi: "सैंपल रजिस्टर करें", hinglish: "Sample Register Karo" },
  "compounder.select_tests": { en: "Select Tests", hi: "टेस्ट चुनें", hinglish: "Tests Chuno" },
  "compounder.patient_name": { en: "Patient Name", hi: "मरीज का नाम", hinglish: "Patient ka Naam" },
  "compounder.age": { en: "Age", hi: "उम्र", hinglish: "Age" },
  "compounder.gender": { en: "Gender", hi: "लिंग", hinglish: "Gender" },
  "compounder.phone": { en: "Phone Number", hi: "फोन नंबर", hinglish: "Phone Number" },
  "compounder.referred_by": { en: "Referred By", hi: "रेफर किया", hinglish: "Refer Kiya" },
  "compounder.recent_patients": { en: "Recent Patients", hi: "हाल के मरीज", hinglish: "Recent Patients" },
  "compounder.search_placeholder": { en: "Search by name, phone number, or ID…", hi: "नाम, फोन नंबर, या ID से खोजें…", hinglish: "Naam, phone ya ID se search karo…" },
  "compounder.no_reports": { en: "No reports found", hi: "कोई रिपोर्ट नहीं मिली", hinglish: "Koi report nahi mili" },
  "compounder.all_caught_up": { en: "All caught up! No pending results.", hi: "सब हो गया! कोई बाकी रिजल्ट नहीं।", hinglish: "Sab ho gaya! Koi pending result nahi." },
  "compounder.enter_value": { en: "Enter value", hi: "वैल्यू डालें", hinglish: "Value daalo" },
  "compounder.previous": { en: "Previous", hi: "पिछला", hinglish: "Pichla" },
  "compounder.next": { en: "Next", hi: "अगला", hinglish: "Agla" },
  "compounder.filled_of": { en: "filled", hi: "भरे", hinglish: "bhare" },
  "compounder.test_of": { en: "Test", hi: "टेस्ट", hinglish: "Test" },
  "compounder.normal": { en: "Normal", hi: "सामान्य", hinglish: "Normal" },
  "compounder.sample_registered": { en: "Sample registered", hi: "सैंपल रजिस्टर हो गया", hinglish: "Sample register ho gaya" },
  "compounder.results_saved": { en: "Results saved", hi: "रिजल्ट सेव हो गए", hinglish: "Results save ho gaye" },
  "compounder.selected": { en: "selected", hi: "चुने गए", hinglish: "selected" },

  // Staff
  "staff.title": { en: "Staff Management", hi: "स्टाफ प्रबंधन", hinglish: "Staff Management" },
  "staff.add": { en: "Add Compounder", hi: "कम्पाउंडर जोड़ें", hinglish: "Compounder Add Karo" },
  "staff.reset_password": { en: "Reset Password", hi: "पासवर्ड रीसेट करें", hinglish: "Password Reset Karo" },
  "staff.new_password": { en: "New Password", hi: "नया पासवर्ड", hinglish: "Naya Password" },

  // Settings
  "settings.title": { en: "Report Template Settings", hi: "रिपोर्ट टेम्पलेट सेटिंग्स", hinglish: "Report Template Settings" },
  "settings.lab_name": { en: "Lab Name", hi: "लैब का नाम", hinglish: "Lab ka Naam" },
  "settings.save": { en: "Save Settings", hi: "सेटिंग्स सेव करें", hinglish: "Settings Save Karo" },

  // Language
  "lang.title": { en: "Language", hi: "भाषा", hinglish: "Language" },
  "lang.en": { en: "English", hi: "अंग्रेजी", hinglish: "English" },
  "lang.hi": { en: "हिंदी", hi: "हिंदी", hinglish: "Hindi" },
  "lang.hinglish": { en: "Hinglish", hi: "हिंग्लिश", hinglish: "Hinglish" },
};

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("mylab-lang") as Lang;
    if (saved && (saved === "en" || saved === "hi" || saved === "hinglish")) {
      setLangState(saved);
    }
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("mylab-lang", l);
  }

  function t(key: string): string {
    return translations[key]?.[lang] || translations[key]?.["en"] || key;
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
