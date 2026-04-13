import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.psbperkasa.app',
  appName: 'PSB PERKASA',
  webDir: 'mobile-build',
  server: {
    androidScheme: 'https',
    cleartext: false,
    url: 'https://webpsb.perkasa.net.id'
  },
  allowNavigation: ['webpsb.perkasa.net.id', '*.perkasa.net.id']
};

export default config;
