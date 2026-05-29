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

  // Login extras
  "login.branding_text": { en: "Streamlined blood test reporting for doctors and lab staff. Fast, accurate, and paperless.", hi: "डॉक्टरों और लैब स्टाफ के लिए सुव्यवस्थित ब्लड टेस्ट रिपोर्टिंग। तेज़, सटीक, और पेपरलेस।", hinglish: "Doctors aur lab staff ke liye streamlined blood test reporting. Fast, accurate, aur paperless." },
  "login.default_hint": { en: "Default doctor: doctor@mylab.com / password", hi: "डिफ़ॉल्ट डॉक्टर: doctor@mylab.com / password", hinglish: "Default doctor: doctor@mylab.com / password" },

  // Dashboard extras
  "dashboard.no_reports": { en: "No reports yet", hi: "अभी कोई रिपोर्ट नहीं", hinglish: "Abhi koi report nahi" },

  // Reports page
  "reports.title": { en: "All Reports", hi: "सभी रिपोर्ट", hinglish: "Sab Reports" },
  "reports.total": { en: "total reports", hi: "कुल रिपोर्ट", hinglish: "total reports" },
  "reports.date_range": { en: "Date Range", hi: "तारीख सीमा", hinglish: "Date Range" },
  "reports.from": { en: "From", hi: "से", hinglish: "From" },
  "reports.to": { en: "To", hi: "तक", hinglish: "To" },
  "reports.clear": { en: "Clear", hi: "साफ करें", hinglish: "Clear Karo" },
  "reports.search_placeholder": { en: "Search patient or referral…", hi: "मरीज या रेफरल खोजें…", hinglish: "Patient ya referral search karo…" },
  "reports.reports_count": { en: "reports", hi: "रिपोर्ट", hinglish: "reports" },
  "reports.revenue": { en: "revenue", hi: "कमाई", hinglish: "kamai" },
  "reports.no_match": { en: "No reports match your filters", hi: "कोई रिपोर्ट फ़िल्टर से मेल नहीं खाती", hinglish: "Koi report filter se match nahi hui" },
  "reports.no_reports": { en: "No reports yet", hi: "अभी कोई रिपोर्ट नहीं", hinglish: "Abhi koi report nahi" },
  "reports.col_report": { en: "Report #", hi: "रिपोर्ट #", hinglish: "Report #" },
  "reports.col_patient": { en: "Patient", hi: "मरीज", hinglish: "Patient" },
  "reports.col_age": { en: "Age", hi: "उम्र", hinglish: "Age" },
  "reports.col_weight": { en: "Weight", hi: "वज़न", hinglish: "Weight" },
  "reports.col_referred_by": { en: "Referred By", hi: "रेफर किया", hinglish: "Referred By" },
  "reports.col_date": { en: "Date", hi: "तारीख", hinglish: "Date" },
  "reports.col_amount": { en: "Amount", hi: "राशि", hinglish: "Amount" },
  "reports.col_status": { en: "Status", hi: "स्थिति", hinglish: "Status" },
  "reports.col_view": { en: "View", hi: "देखें", hinglish: "Dekho" },

  // Tests page
  "tests.title": { en: "Test Catalogue", hi: "टेस्ट सूची", hinglish: "Test List" },
  "tests.count_info": { en: "tests across", hi: "टेस्ट", hinglish: "tests across" },
  "tests.categories": { en: "categories", hi: "श्रेणियों में", hinglish: "categories mein" },
  "tests.add": { en: "Add Test", hi: "टेस्ट जोड़ें", hinglish: "Test Add Karo" },
  "tests.search_placeholder": { en: "Search…", hi: "खोजें…", hinglish: "Search…" },
  "tests.col_name": { en: "Test Name", hi: "टेस्ट का नाम", hinglish: "Test ka Naam" },
  "tests.col_category": { en: "Category", hi: "श्रेणी", hinglish: "Category" },
  "tests.col_sample": { en: "Sample", hi: "सैंपल", hinglish: "Sample" },
  "tests.col_range": { en: "Normal Range", hi: "सामान्य सीमा", hinglish: "Normal Range" },
  "tests.col_method": { en: "Method", hi: "विधि", hinglish: "Method" },
  "tests.col_tat": { en: "TAT", hi: "TAT", hinglish: "TAT" },
  "tests.col_price": { en: "Price", hi: "कीमत", hinglish: "Price" },
  "tests.no_match": { en: "No tests match your filters", hi: "कोई टेस्ट फ़िल्टर से मेल नहीं खाता", hinglish: "Koi test filter se match nahi hua" },
  "tests.no_tests": { en: "No tests added yet", hi: "अभी कोई टेस्ट नहीं जोड़ा", hinglish: "Abhi koi test add nahi kiya" },
  "tests.edit_test": { en: "Edit Test", hi: "टेस्ट संपादित करें", hinglish: "Test Edit Karo" },
  "tests.add_new": { en: "Add New Test", hi: "नया टेस्ट जोड़ें", hinglish: "Naya Test Add Karo" },
  "tests.update_details": { en: "Update Test Details", hi: "टेस्ट विवरण अपडेट करें", hinglish: "Test Details Update Karo" },
  "tests.details": { en: "Test Details", hi: "टेस्ट विवरण", hinglish: "Test Details" },
  "tests.name_label": { en: "Test Name", hi: "टेस्ट का नाम", hinglish: "Test ka Naam" },
  "tests.name_placeholder": { en: "e.g. Complete Blood Count (CBC)", hi: "जैसे Complete Blood Count (CBC)", hinglish: "e.g. Complete Blood Count (CBC)" },
  "tests.category_label": { en: "Category", hi: "श्रेणी", hinglish: "Category" },
  "tests.category_helper": { en: "Select or type a new category", hi: "चुनें या नई श्रेणी टाइप करें", hinglish: "Select karo ya nayi category type karo" },
  "tests.category_placeholder": { en: "e.g. Hematology", hi: "जैसे Hematology", hinglish: "e.g. Hematology" },
  "tests.sample_type": { en: "Sample Type", hi: "सैंपल प्रकार", hinglish: "Sample Type" },
  "tests.method_label": { en: "Method / Technique", hi: "विधि / तकनीक", hinglish: "Method / Technique" },
  "tests.method_placeholder": { en: "e.g. CLIA, Enzymatic, Microscopy", hi: "जैसे CLIA, Enzymatic, Microscopy", hinglish: "e.g. CLIA, Enzymatic, Microscopy" },
  "tests.method_helper": { en: "Testing methodology used (optional)", hi: "उपयोग की गई परीक्षण विधि (वैकल्पिक)", hinglish: "Testing methodology (optional)" },
  "tests.price_label": { en: "Price", hi: "कीमत", hinglish: "Price" },
  "tests.report_time": { en: "Report Time (TAT)", hi: "रिपोर्ट समय (TAT)", hinglish: "Report Time (TAT)" },
  "tests.not_specified": { en: "Not specified", hi: "निर्दिष्ट नहीं", hinglish: "Not specified" },
  "tests.normal_range": { en: "Normal Reference Range (optional)", hi: "सामान्य संदर्भ सीमा (वैकल्पिक)", hinglish: "Normal Reference Range (optional)" },
  "tests.min_value": { en: "Min Value", hi: "न्यूनतम", hinglish: "Min Value" },
  "tests.max_value": { en: "Max Value", hi: "अधिकतम", hinglish: "Max Value" },
  "tests.unit_label": { en: "Unit", hi: "इकाई", hinglish: "Unit" },
  "tests.update_btn": { en: "Update Test", hi: "टेस्ट अपडेट करें", hinglish: "Test Update Karo" },
  "tests.add_btn": { en: "Add Test", hi: "टेस्ट जोड़ें", hinglish: "Test Add Karo" },
  "tests.name_required": { en: "Test name is required", hi: "टेस्ट का नाम आवश्यक है", hinglish: "Test ka naam required hai" },
  "tests.category_required": { en: "Select a category", hi: "श्रेणी चुनें", hinglish: "Category select karo" },
  "tests.sample_required": { en: "Select sample type", hi: "सैंपल प्रकार चुनें", hinglish: "Sample type select karo" },
  "tests.price_required": { en: "Enter a valid price", hi: "सही कीमत डालें", hinglish: "Valid price daalo" },
  "tests.min_max_error": { en: "Min cannot be greater than Max", hi: "न्यूनतम अधिकतम से ज़्यादा नहीं हो सकता", hinglish: "Min, Max se zyada nahi ho sakta" },

  // Staff
  "staff.title": { en: "Staff Management", hi: "स्टाफ प्रबंधन", hinglish: "Staff Management" },
  "staff.subtitle": { en: "Manage lab staff accounts", hi: "लैब स्टाफ अकाउंट प्रबंधित करें", hinglish: "Lab staff accounts manage karo" },
  "staff.add": { en: "Add Compounder", hi: "कम्पाउंडर जोड़ें", hinglish: "Compounder Add Karo" },
  "staff.email_label": { en: "Email address", hi: "ईमेल पता", hinglish: "Email address" },
  "staff.password_label": { en: "Password", hi: "पासवर्ड", hinglish: "Password" },
  "staff.create_account": { en: "Create Account", hi: "अकाउंट बनाएं", hinglish: "Account Banao" },
  "staff.all_staff": { en: "All Staff", hi: "सभी स्टाफ", hinglish: "Sab Staff" },
  "staff.col_email": { en: "Email", hi: "ईमेल", hinglish: "Email" },
  "staff.col_name": { en: "Name", hi: "नाम", hinglish: "Naam" },
  "staff.col_role": { en: "Role", hi: "भूमिका", hinglish: "Role" },
  "staff.col_joined": { en: "Joined", hi: "शामिल हुए", hinglish: "Joined" },
  "staff.col_action": { en: "Action", hi: "कार्रवाई", hinglish: "Action" },
  "staff.no_staff": { en: "No staff members yet", hi: "अभी कोई स्टाफ नहीं", hinglish: "Abhi koi staff nahi" },
  "staff.reset_password": { en: "Reset Password", hi: "पासवर्ड रीसेट करें", hinglish: "Password Reset Karo" },
  "staff.new_password": { en: "New Password", hi: "नया पासवर्ड", hinglish: "Naya Password" },
  "staff.set_new_password": { en: "Set a new password for", hi: "नया पासवर्ड सेट करें", hinglish: "Naya password set karo" },

  // Settings
  "settings.title": { en: "Report Template Settings", hi: "रिपोर्ट टेम्पलेट सेटिंग्स", hinglish: "Report Template Settings" },
  "settings.subtitle": { en: "Configure how your lab reports look when printed", hi: "प्रिंट होने पर लैब रिपोर्ट कैसी दिखे, सेट करें", hinglish: "Lab reports print mein kaise dikhe, configure karo" },
  "settings.lab_info": { en: "Lab Information", hi: "लैब जानकारी", hinglish: "Lab Information" },
  "settings.lab_name": { en: "Lab Name", hi: "लैब का नाम", hinglish: "Lab ka Naam" },
  "settings.address": { en: "Address", hi: "पता", hinglish: "Address" },
  "settings.phone": { en: "Phone", hi: "फोन", hinglish: "Phone" },
  "settings.email": { en: "Email", hi: "ईमेल", hinglish: "Email" },
  "settings.header_tagline": { en: "Header Tagline", hi: "हेडर टैगलाइन", hinglish: "Header Tagline" },
  "settings.header_placeholder": { en: "e.g. Accurate Results. Trusted Care.", hi: "जैसे सटीक परिणाम। विश्वसनीय देखभाल।", hinglish: "e.g. Accurate Results. Trusted Care." },
  "settings.header_helper": { en: "Appears below lab name on reports", hi: "रिपोर्ट पर लैब नाम के नीचे दिखता है", hinglish: "Reports pe lab name ke neeche dikhta hai" },
  "settings.footer_label": { en: "Footer Disclaimer", hi: "फुटर डिस्क्लेमर", hinglish: "Footer Disclaimer" },
  "settings.footer_helper": { en: "Appears at the bottom of every report", hi: "हर रिपोर्ट के नीचे दिखता है", hinglish: "Har report ke neeche dikhta hai" },
  "settings.lab_logo": { en: "Lab Logo", hi: "लैब लोगो", hinglish: "Lab Logo" },
  "settings.logo_desc": { en: "Upload your lab logo. It will appear on the top-left of printed reports.", hi: "अपना लैब लोगो अपलोड करें। यह प्रिंटेड रिपोर्ट के ऊपर-बाएं दिखेगा।", hinglish: "Apna lab logo upload karo. Ye printed reports ke top-left mein dikhega." },
  "settings.change_logo": { en: "Change Logo", hi: "लोगो बदलें", hinglish: "Logo Change Karo" },
  "settings.upload_logo": { en: "Upload Logo", hi: "लोगो अपलोड करें", hinglish: "Logo Upload Karo" },
  "settings.remove": { en: "Remove", hi: "हटाएं", hinglish: "Hatao" },
  "settings.save": { en: "Save Settings", hi: "सेटिंग्स सेव करें", hinglish: "Settings Save Karo" },
  "settings.saving": { en: "Saving…", hi: "सेव हो रहा…", hinglish: "Save ho raha…" },

  // Profile
  "profile.title": { en: "Profile", hi: "प्रोफाइल", hinglish: "Profile" },
  "profile.subtitle": { en: "Update your name and signature for reports", hi: "रिपोर्ट के लिए अपना नाम और हस्ताक्षर अपडेट करें", hinglish: "Reports ke liye apna naam aur signature update karo" },
  "profile.personal_info": { en: "Personal Information", hi: "व्यक्तिगत जानकारी", hinglish: "Personal Information" },
  "profile.display_name": { en: "Display Name", hi: "प्रदर्शित नाम", hinglish: "Display Name" },
  "profile.name_placeholder": { en: "Dr. John Smith", hi: "डॉ. जॉन स्मिथ", hinglish: "Dr. John Smith" },
  "profile.name_helper": { en: "This name will appear on reports", hi: "यह नाम रिपोर्ट पर दिखेगा", hinglish: "Ye naam reports pe dikhega" },
  "profile.email_label": { en: "Email", hi: "ईमेल", hinglish: "Email" },
  "profile.email_helper": { en: "Email cannot be changed", hi: "ईमेल बदला नहीं जा सकता", hinglish: "Email change nahi ho sakta" },
  "profile.save": { en: "Save Profile", hi: "प्रोफाइल सेव करें", hinglish: "Profile Save Karo" },
  "profile.saving": { en: "Saving…", hi: "सेव हो रहा…", hinglish: "Save ho raha…" },
  "profile.signature": { en: "Signature", hi: "हस्ताक्षर", hinglish: "Signature" },
  "profile.signature_desc": { en: "Upload your signature image. It will be printed on lab reports. Use a PNG with transparent background for best results.", hi: "अपनी हस्ताक्षर छवि अपलोड करें। यह लैब रिपोर्ट पर प्रिंट होगी। सर्वोत्तम परिणामों के लिए पारदर्शी पृष्ठभूमि वाला PNG उपयोग करें।", hinglish: "Apni signature image upload karo. Ye lab reports pe print hogi. Best results ke liye transparent background wala PNG use karo." },
  "profile.no_signature": { en: "No signature uploaded yet", hi: "अभी कोई हस्ताक्षर अपलोड नहीं हुआ", hinglish: "Abhi koi signature upload nahi hua" },
  "profile.change_signature": { en: "Change Signature", hi: "हस्ताक्षर बदलें", hinglish: "Signature Change Karo" },
  "profile.upload_signature": { en: "Upload Signature", hi: "हस्ताक्षर अपलोड करें", hinglish: "Signature Upload Karo" },
  "profile.remove": { en: "Remove", hi: "हटाएं", hinglish: "Hatao" },
  "profile.format_hint": { en: "Accepted formats: PNG, JPEG, WebP. Max size: 2MB. Recommended: 400×150px PNG with transparent background.", hi: "स्वीकृत प्रारूप: PNG, JPEG, WebP। अधिकतम आकार: 2MB। अनुशंसित: 400×150px पारदर्शी पृष्ठभूमि वाला PNG।", hinglish: "Accepted formats: PNG, JPEG, WebP. Max size: 2MB. Recommended: 400×150px transparent background wala PNG." },

  // Sidebar
  "sidebar.doctor": { en: "Doctor", hi: "डॉक्टर", hinglish: "Doctor" },
  "sidebar.compounder": { en: "Compounder", hi: "कम्पाउंडर", hinglish: "Compounder" },

  // Nav - compounder
  "nav.compounder_reports": { en: "Reports", hi: "रिपोर्ट", hinglish: "Reports" },

  // Table common
  "table.id": { en: "ID", hi: "ID", hinglish: "ID" },
  "table.patient": { en: "Patient", hi: "मरीज", hinglish: "Patient" },
  "table.age": { en: "Age", hi: "उम्र", hinglish: "Age" },
  "table.referred_by": { en: "Referred By", hi: "रेफर किया", hinglish: "Referred By" },
  "table.date": { en: "Date", hi: "तारीख", hinglish: "Date" },
  "table.amount": { en: "Amount", hi: "राशि", hinglish: "Amount" },
  "table.status": { en: "Status", hi: "स्थिति", hinglish: "Status" },

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
