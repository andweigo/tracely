export const SITE_CONFIG = {
  webAppUrl:
    import.meta.env.VITE_WEB_APP_URL || 'https://tracely-web.up.railway.app',
  downloadUrl:
    import.meta.env.VITE_DOWNLOAD_URL || 'https://tracely-web.up.railway.app/download',
  directApkUrl:
    import.meta.env.VITE_DIRECT_APK_URL || 'https://tracely-web.up.railway.app/download/tracely.apk',
  androidVersion: '1.0.11',
} as const;
