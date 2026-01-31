import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.psbperkasa.app',
  appName: 'PSB PERKASA',
  webDir: 'mobile-build', // Folder fallback jika offline
  server: {
    androidScheme: 'https',
    cleartext: true, // Izinkan http untuk development
     url: 'http://192.168.1.3:3000'
    // url: 'http://192.168.1.x:3000' // Uncomment dan isi IP laptop saat development local
  }
};

export default config;
