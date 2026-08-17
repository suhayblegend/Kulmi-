import { Capacitor } from '@capacitor/core';

// True only when running inside the packaged iOS/Android app (not the website).
export const isNative = (): boolean => Capacitor.isNativePlatform();

// Called once at startup. Everything is dynamically imported and guarded so the
// plain web build is completely unaffected.
export async function initNative(): Promise<void> {
  if (!isNative()) return;
  document.documentElement.classList.add('native');

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light }); // dark text on our light background
    try { await StatusBar.setBackgroundColor({ color: '#FDFBF7' }); } catch { /* iOS has no bg color */ }
  } catch { /* plugin missing */ }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch { /* ignore */ }

  // Hardware back button (Android) → browser history, exit at the root.
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) window.history.back();
      else App.exitApp();
    });
  } catch { /* ignore */ }
}

// Register for native push notifications and save the device token. Call after
// login. No-op on the website.
export async function registerPush(): Promise<void> {
  if (!isNative()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    PushNotifications.addListener('registration', async (t) => {
      const { savePushToken } = await import('./db');
      await savePushToken(t.value, Capacitor.getPlatform());
    });
    // Tapping a push with a `link` deep-links inside the app.
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const link = (action.notification?.data as any)?.link;
      if (link && typeof link === 'string') {
        window.history.pushState({}, '', link);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
    await PushNotifications.register();
  } catch { /* plugin missing / not native */ }
}

// Light tactile feedback on key actions (invite, match, send). No-op on web.
export async function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] });
  } catch { /* ignore */ }
}
