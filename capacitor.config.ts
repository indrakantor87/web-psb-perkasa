import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.psbperkasa.app',
  appName: 'PSB PERKASA',
  webDir: 'mobile-build', // Folder fallback jika offline
  server: {
    androidScheme: 'https',
    cleartext: true,
    url: 'https://psb.perkasa.net.id'
  }
};

export default config;
