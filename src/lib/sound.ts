// A short, joyful "ta-da" chime played on a match — synthesised via Web Audio so
// there's no asset to download. Works in the browser and the native webview.
// Must be triggered from a user gesture (a match always follows a tap), or the
// AudioContext stays suspended and it silently no-ops.
export function playCelebration(): void {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // C5 · E5 · G5 · C6 — a bright major arpeggio.
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + i * 0.11;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
    setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 1600);
  } catch { /* audio unavailable — ignore */ }
}
