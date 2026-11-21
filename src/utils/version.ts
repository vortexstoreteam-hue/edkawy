import versionConfig from '../../version.json';

export interface VersionInfo {
  version: string;
  buildDate: string;
  season: number;
  major: number;
  minor: number;
  patch: number;
  releaseName?: string;
}

export const VERSION_INFO: VersionInfo = {
  version: versionConfig.version || '1.0.0.2',
  buildDate: versionConfig.buildDate || '2026-11-05',
  season: versionConfig.season || 1,
  major: versionConfig.major || 0,
  minor: versionConfig.minor || 0,
  patch: versionConfig.patch || 2,
  releaseName: versionConfig.releaseName || 'التحديث الشامل للإصلاحات والجودة',
};

export const APP_VERSION: string = VERSION_INFO.version;

export function logAppVersion(): void {
  const banner = `
=============================================
🚀 إدكاوي (Edkawy) - منصة التوصيل الشاملة
📦 الإصدار: v${APP_VERSION} (${VERSION_INFO.releaseName})
📅 تاريخ البناء: ${VERSION_INFO.buildDate}
🏷️ التكويد: [الموسم: ${VERSION_INFO.season} | رئيسي: ${VERSION_INFO.major} | فرعي: ${VERSION_INFO.minor} | ترقيع: ${VERSION_INFO.patch}]
=============================================
  `.trim();
  console.log(`%c${banner}`, 'color: #ff6b00; font-weight: bold; font-family: monospace; font-size: 11px;');
}
