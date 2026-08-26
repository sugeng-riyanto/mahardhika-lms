/**
 * AKADEMI Digital Campus — Bahasa Indonesia Translations
 *
 * Critical UI strings for WCAG 2.1 AA compliance.
 * Usage: import { t, useLang } from '@/i18n/translations'
 */

export type Locale = 'en' | 'id'

export const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Common
    'app.name': 'AKADEMI Digital Campus',
    'app.subtitle': 'Sign in to your account',
    'common.save': 'Save Changes',
    'common.saved': 'Saved!',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.back': 'Back',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.success': 'Success',
    'common.confirm': 'Confirm',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.refresh': 'Refresh',
    'common.close': 'Close',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.active': 'Active',
    'common.inactive': 'Inactive',
    'common.none': 'None',
    'common.all': 'All',

    // Auth
    'auth.email': 'Email address',
    'auth.password': 'Password',
    'auth.email.placeholder': 'you@example.com',
    'auth.password.placeholder': 'Enter your password',
    'auth.remember': 'Remember me',
    'auth.forgot': 'Forgot password?',
    'auth.signin': 'Sign in',
    'auth.signout': 'Sign out',
    'auth.error.invalid': 'Invalid email or password',
    'auth.error.required': 'Email and password are required',
    'auth.dev.accounts': 'Development Accounts',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.courses': 'Courses',
    'nav.users': 'Users',
    'nav.programmes': 'Programmes',
    'nav.attendance': 'Attendance',
    'nav.content': 'Content Library',
    'nav.reports': 'Reports',
    'nav.notifications': 'Notifications',
    'nav.certificates': 'Certificates',
    'nav.audit': 'Audit Log',
    'nav.settings': 'Settings',
    'nav.privacy': 'Privacy',
    'nav.consent': 'Consent',
    'nav.gradebook': 'Gradebook',
    'nav.essays': 'Essays',
    'nav.canvas': 'Canvas',
    'nav.calendar': 'Calendar',
    'nav.assignments': 'Assignments',
    'nav.finance': 'Finance',
    'nav.profile': 'Profile',
    'nav.skip': 'Skip to main content',

    // Dashboard
    'dash.activeUsers': 'Active Users',
    'dash.courses': 'Courses',
    'dash.programmes': 'Programmes',
    'dash.pendingEnrolments': 'Pending Enrolments',
    'dash.systemHealth': 'System Health',

    // Forms
    'form.required': 'This field is required',
    'form.email.invalid': 'Please enter a valid email',
    'form.password.min': 'Password must be at least 8 characters',
    'form.select.placeholder': 'Select an option',

    // Privacy
    'privacy.title': 'Privacy Notice',
    'privacy.controller': 'Data Controller',
    'privacy.legalBasis': 'Legal Basis for Processing',
    'privacy.dataCollected': 'Personal Data We Collect',
    'privacy.rights': 'Your Rights (UU PDP Article 21)',
    'privacy.childProtection': 'Child Data Protection',
    'privacy.security': 'Data Security Measures',
    'privacy.contact': 'Contact & Complaints',
    'privacy.effective': 'Effective',
    'privacy.updated': 'Last updated',
    'privacy.version': 'Version',

    // Errors
    'error.403': 'Access Denied',
    'error.403.message': 'You do not have permission to access this page.',
    'error.404': 'Page Not Found',
    'error.404.message': 'The page you are looking for does not exist.',
    'error.500': 'Server Error',
    'error.500.message': 'Something went wrong. Please try again later.',

    // Consent
    'consent.granted': 'Granted',
    'consent.withdrawn': 'Withdrawn',
    'consent.pending': 'Pending',
    'consent.expires': 'Expires',
    'consent.withdraw': 'Withdraw Consent',

    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'System configuration and preferences',
    'settings.general': 'General',
    'settings.security': 'Security',
    'settings.notifications': 'Notifications',
    'settings.data': 'Data & Privacy',
    'settings.general.title': 'General Settings',
    'settings.orgName': 'Organisation Name',
    'settings.orgSlug': 'Organisation Slug',
    'settings.orgSlug.hint': 'Slug cannot be changed after creation.',
    'settings.language': 'Default Language',
    'settings.timezone': 'Timezone',
    'settings.security.title': 'Security Settings',
    'settings.mfa': 'Enforce MFA for Admin Roles',
    'settings.mfa.desc': 'Require multi-factor authentication for owner and admin accounts.',
    'settings.sessionTimeout': 'Session Timeout',
    'settings.sessionTimeout.desc': 'Auto-logout after inactivity period.',
    'settings.thirdParty': 'Third Party Access',
    'settings.thirdParty.desc': 'Allow third-party integration grants.',
    'settings.notifications.title': 'Notification Settings',
    'settings.emailNotifications': 'Email Notifications',
    'settings.emailNotifications.desc': 'Send email notifications for grades, assignments, and announcements.',
    'settings.whatsappNotifications': 'WhatsApp Notifications',
    'settings.whatsappNotifications.desc': 'Send WhatsApp messages for urgent notifications.',
    'settings.quietHoursStart': 'Quiet Hours Start',
    'settings.quietHoursEnd': 'Quiet Hours End',
    'settings.data.title': 'Data & Privacy Settings',
    'settings.gradeRetention': 'Grade Retention Period',
    'settings.auditRetention': 'Audit Log Retention',
    'settings.sponsorThreshold': 'Sponsor Data Threshold',
    'settings.sponsorThreshold.desc': 'Minimum student count before aggregate data is shown to sponsors.',
    'settings.uuPdp': 'UU PDP Compliance',
    'settings.uuPdp.desc': 'Data minimisation, purpose limitation, and consent management are enforced at the API level. Review the',
    'settings.uuPdp.privacyNotice': 'Privacy Notice',
    'settings.uuPdp.and': 'and',
    'settings.uuPdp.consentMgmt': 'Consent Management',
    'settings.uuPdp.pagesFor': 'pages for parent/student controls.',
  },

  id: {
    // Common
    'app.name': 'AKADEMI Digital Campus',
    'app.subtitle': 'Masuk ke akun Anda',
    'common.save': 'Simpan Perubahan',
    'common.saved': 'Tersimpan!',
    'common.cancel': 'Batal',
    'common.delete': 'Hapus',
    'common.edit': 'Edit',
    'common.create': 'Buat',
    'common.back': 'Kembali',
    'common.loading': 'Memuat...',
    'common.error': 'Terjadi kesalahan',
    'common.success': 'Berhasil',
    'common.confirm': 'Konfirmasi',
    'common.search': 'Cari...',
    'common.filter': 'Filter',
    'common.export': 'Ekspor',
    'common.import': 'Impor',
    'common.refresh': 'Segarkan',
    'common.close': 'Tutup',
    'common.yes': 'Ya',
    'common.no': 'Tidak',
    'common.active': 'Aktif',
    'common.inactive': 'Tidak Aktif',
    'common.none': 'Tidak Ada',
    'common.all': 'Semua',

    // Auth
    'auth.email': 'Alamat email',
    'auth.password': 'Kata sandi',
    'auth.email.placeholder': 'anda@contoh.com',
    'auth.password.placeholder': 'Masukkan kata sandi Anda',
    'auth.remember': 'Ingat saya',
    'auth.forgot': 'Lupa kata sandi?',
    'auth.signin': 'Masuk',
    'auth.signout': 'Keluar',
    'auth.error.invalid': 'Email atau kata sandi salah',
    'auth.error.required': 'Email dan kata sandi wajib diisi',
    'auth.dev.accounts': 'Akun Pengembangan',

    // Navigation
    'nav.dashboard': 'Dasbor',
    'nav.courses': 'Kursus',
    'nav.users': 'Pengguna',
    'nav.programmes': 'Program',
    'nav.attendance': 'Kehadiran',
    'nav.content': 'Perpustakaan Konten',
    'nav.reports': 'Laporan',
    'nav.notifications': 'Notifikasi',
    'nav.certificates': 'Sertifikat',
    'nav.audit': 'Log Audit',
    'nav.settings': 'Pengaturan',
    'nav.privacy': 'Privasi',
    'nav.consent': 'Persetujuan',
    'nav.gradebook': 'Buku Nilai',
    'nav.essays': 'Esai',
    'nav.canvas': 'Kanvas',
    'nav.calendar': 'Kalender',
    'nav.assignments': 'Tugas',
    'nav.finance': 'Keuangan',
    'nav.profile': 'Profil',
    'nav.skip': 'Langsung ke konten utama',

    // Dashboard
    'dash.activeUsers': 'Pengguna Aktif',
    'dash.courses': 'Kursus',
    'dash.programmes': 'Program',
    'dash.pendingEnrolments': 'Pendaftaran Tertunda',
    'dash.systemHealth': 'Kesehatan Sistem',

    // Forms
    'form.required': 'Bidang ini wajib diisi',
    'form.email.invalid': 'Masukkan email yang valid',
    'form.password.min': 'Kata sandi minimal 8 karakter',
    'form.select.placeholder': 'Pilih opsi',

    // Privacy
    'privacy.title': 'Pemberitahuan Privasi',
    'privacy.controller': 'Pengendali Data',
    'privacy.legalBasis': 'Dasar Hukum Pemrosesan',
    'privacy.dataCollected': 'Data Pribadi yang Kami Kumpulkan',
    'privacy.rights': 'Hak Anda (UU PDP Pasal 21)',
    'privacy.childProtection': 'Perlindungan Data Anak',
    'privacy.security': 'Langkah Keamanan Data',
    'privacy.contact': 'Kontak & Keluhan',
    'privacy.effective': 'Berlaku sejak',
    'privacy.updated': 'Terakhir diperbarui',
    'privacy.version': 'Versi',

    // Errors
    'error.403': 'Akses Ditolak',
    'error.403.message': 'Anda tidak memiliki izin untuk mengakses halaman ini.',
    'error.404': 'Halaman Tidak Ditemukan',
    'error.404.message': 'Halaman yang Anda cari tidak ada.',
    'error.500': 'Kesalahan Server',
    'error.500.message': 'Terjadi kesalahan. Silakan coba lagi nanti.',

    // Consent
    'consent.granted': 'Diberikan',
    'consent.withdrawn': 'Ditarik',
    'consent.pending': 'Tertunda',
    'consent.expires': 'Kedaluwarsa',
    'consent.withdraw': 'Tarik Persetujuan',

    // Settings
    'settings.title': 'Pengaturan',
    'settings.subtitle': 'Konfigurasi sistem dan preferensi',
    'settings.general': 'Umum',
    'settings.security': 'Keamanan',
    'settings.notifications': 'Notifikasi',
    'settings.data': 'Data & Privasi',
    'settings.general.title': 'Pengaturan Umum',
    'settings.orgName': 'Nama Organisasi',
    'settings.orgSlug': 'Slug Organisasi',
    'settings.orgSlug.hint': 'Slug tidak dapat diubah setelah dibuat.',
    'settings.language': 'Bahasa Default',
    'settings.timezone': 'Zona Waktu',
    'settings.security.title': 'Pengaturan Keamanan',
    'settings.mfa': 'Wajibkan MFA untuk Peran Admin',
    'settings.mfa.desc': 'Wajibkan autentikasi multi-faktor untuk akun owner dan admin.',
    'settings.sessionTimeout': 'Batas Waktu Sesi',
    'settings.sessionTimeout.desc': 'Keluar otomatis setelah periode tidak aktif.',
    'settings.thirdParty': 'Akses Pihak Ketiga',
    'settings.thirdParty.desc': 'Izinkan grant integrasi pihak ketiga.',
    'settings.notifications.title': 'Pengaturan Notifikasi',
    'settings.emailNotifications': 'Notifikasi Email',
    'settings.emailNotifications.desc': 'Kirim notifikasi email untuk nilai, tugas, dan pengumuman.',
    'settings.whatsappNotifications': 'Notifikasi WhatsApp',
    'settings.whatsappNotifications.desc': 'Kirim pesan WhatsApp untuk notifikasi mendesak.',
    'settings.quietHoursStart': 'Jam Tenang Mulai',
    'settings.quietHoursEnd': 'Jam Tenang Selesai',
    'settings.data.title': 'Pengaturan Data & Privasi',
    'settings.gradeRetention': 'Masa Simpan Nilai',
    'settings.auditRetention': 'Masa Simpan Log Audit',
    'settings.sponsorThreshold': 'Batas Data Sponsor',
    'settings.sponsorThreshold.desc': 'Jumlah minimum siswa sebelum data agregat ditampilkan ke sponsor.',
    'settings.uuPdp': 'Kepatuhan UU PDP',
    'settings.uuPdp.desc': 'Minimasi data, pembatasan tujuan, dan manajemen persetujuan diterapkan di tingkat API. Tinjau',
    'settings.uuPdp.privacyNotice': 'Pemberitahuan Privasi',
    'settings.uuPdp.and': 'dan',
    'settings.uuPdp.consentMgmt': 'Manajemen Persetujuan',
    'settings.uuPdp.pagesFor': 'untuk kontrol orang tua/siswa.',
  },
}

// Simple hook for language context
let currentLocale: Locale = 'en'

export function setLocale(locale: Locale) {
  currentLocale = locale
  localStorage.setItem('akademi_lang', locale)
}

export function getLocale(): Locale {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('akademi_lang') as Locale | null
    if (stored && (stored === 'en' || stored === 'id')) {
      currentLocale = stored
    }
  }
  return currentLocale
}

export function t(key: string): string {
  const locale = getLocale()
  return translations[locale]?.[key] ?? translations.en[key] ?? key
}

export function useLang() {
  return {
    locale: getLocale(),
    setLocale,
    t,
  }
}
