// Detect the user's rough location (city + country) so they can filter Discover
// to "nearby" with one tap instead of typing. Uses the Capacitor Geolocation
// plugin (works on web + native), then a free, keyless reverse-geocode.
export interface DetectedPlace {
  city?: string;
  country?: string;
}

export async function detectNearby(): Promise<DetectedPlace> {
  let lat: number, lon: number;
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        await Geolocation.requestPermissions();
      }
    } catch { /* web has no requestPermissions — getCurrentPosition prompts */ }
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
  } catch {
    // Fallback to the browser API (e.g. plain web build).
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('no geolocation'));
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
    });
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
  }

  const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
  const j = await res.json();
  return {
    city: (j.city || j.locality || '').trim() || undefined,
    country: (j.countryName || '').trim() || undefined,
  };
}
