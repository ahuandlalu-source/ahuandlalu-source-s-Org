/**
 * Synthesizes a serene, warm classical Carnatic-inspired ambient WAV loop
 * (soft tanpura fifth/octave drone + gentle temple chime harmonics in Mohanam scale)
 * as an in-memory Blob URL.
 *
 * Used automatically when weddingConfig.media.musicUrl is null/unconfigured so
 * background music plays reliably offline and in sandboxes without broken external URLs.
 */
export function createKeralaAmbienceWavUrl(): string {
  const sampleRate = 22050;
  const durationSec = 12;
  const numSamples = sampleRate * durationSec;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // Standard PCM WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // Audio format = PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Sa = D3 (146.83 Hz), Pa = A3 (220.00 Hz), Upper Sa = D4 (293.66 Hz)
  // Mohanam pentatonic melody notes: D4, E4, F#4, A4, B4, D5
  const sa = 146.83;
  const pa = 220.0;
  const saHigh = 293.66;

  const chimes: Array<{start: number; freq: number; dur: number}> = [
    {start: 0.4, freq: 293.66, dur: 2.2}, // Sa
    {start: 2.2, freq: 329.63, dur: 2.0}, // Ri2
    {start: 4.0, freq: 369.99, dur: 2.4}, // Ga3
    {start: 6.2, freq: 440.0, dur: 2.6}, // Pa
    {start: 8.6, freq: 369.99, dur: 2.0}, // Ga3
    {start: 10.2, freq: 293.66, dur: 1.8}, // Sa
  ];

  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;

    // Quick, gentle fade-in on start and smooth crossfade at loop end
    const loopFade =
      t < 0.22 ? t / 0.22 : t > durationSec - 0.6 ? (durationSec - t) / 0.6 : 1;

    // Warm tanpura drone with subtle jawari shimmer
    const droneSa = Math.sin(2 * Math.PI * sa * t) * 0.28;
    const droneSa2 = Math.sin(2 * Math.PI * sa * 2 * t) * 0.11;
    const dronePa =
      Math.sin(2 * Math.PI * pa * t) * (0.18 + 0.04 * Math.sin(2 * Math.PI * 0.25 * t));
    const droneTop = Math.sin(2 * Math.PI * saHigh * t) * 0.09;

    // Soft plucked veena / temple bell pentatonic notes
    let chimeSum = 0;
    for (const note of chimes) {
      if (t >= note.start && t <= note.start + note.dur) {
        const nt = t - note.start;
        const env = Math.min(1, nt / 0.03) * Math.exp(-nt * 1.4);
        const fundamental = Math.sin(2 * Math.PI * note.freq * nt);
        const harmonic = Math.sin(2 * Math.PI * note.freq * 2 * nt) * 0.26;
        chimeSum += (fundamental + harmonic) * env * 0.22;
      }
    }

    const mixed = (droneSa + droneSa2 + dronePa + droneTop + chimeSum) * loopFade;
    const clamped = Math.max(-0.9, Math.min(0.9, mixed));
    view.setInt16(44 + i * 2, Math.floor(clamped * 32767), true);
  }

  const blob = new Blob([buffer], {type: 'audio/wav'});
  return URL.createObjectURL(blob);
}
