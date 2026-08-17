import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uk.kulmi.app',
  appName: 'Kulmi',
  webDir: 'dist',
  backgroundColor: '#FDFBF7',
  ios: {
    contentInset: 'always',
    backgroundColor: '#FDFBF7',
  },
  android: {
    backgroundColor: '#FDFBF7',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#1B4332',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      resize: 'native',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
