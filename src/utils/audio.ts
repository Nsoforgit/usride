class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume context if it was suspended (browser auto-play security policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play a sparkling, multi-tone digital bell arpeggio (C5 -> E5 -> G5 -> C6)
  playChime() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      // Note 1: C5 (523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Note 2: E5 (659.25 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.08);
      gain2.gain.setValueAtTime(0.06, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.48);

      // Note 3: G5 (783.99 Hz)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(783.99, now + 0.16);
      gain3.gain.setValueAtTime(0.06, now + 0.16);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.16);
      osc3.stop(now + 0.56);

      // Warm triangle backing note: C6 (1046.50 Hz)
      const oscBack = ctx.createOscillator();
      const gainBack = ctx.createGain();
      oscBack.type = 'triangle';
      oscBack.frequency.setValueAtTime(1046.50, now + 0.24);
      gainBack.gain.setValueAtTime(0.03, now + 0.24);
      gainBack.gain.exponentialRampToValueAtTime(0.001, now + 0.64);
      oscBack.connect(gainBack);
      gainBack.connect(ctx.destination);
      oscBack.start(now + 0.24);
      oscBack.stop(now + 0.64);

    } catch (e) {
      console.warn("Audio Context blocked or failed:", e);
    }
  }

  // Play a realistic mechanical cash register (Bell chime followed by metallic coin clangs and spring clicks)
  playCashRegister() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      // High bell chime 1 (B5 - 987.77 Hz)
      const oscBell1 = ctx.createOscillator();
      const gainBell1 = ctx.createGain();
      oscBell1.type = 'sine';
      oscBell1.frequency.setValueAtTime(987.77, now);
      gainBell1.gain.setValueAtTime(0.05, now);
      gainBell1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      oscBell1.connect(gainBell1);
      gainBell1.connect(ctx.destination);
      oscBell1.start(now);
      oscBell1.stop(now + 0.4);

      // High bell chime 2 (E6 - 1318.51 Hz)
      const oscBell2 = ctx.createOscillator();
      const gainBell2 = ctx.createGain();
      oscBell2.type = 'sine';
      oscBell2.frequency.setValueAtTime(1318.51, now + 0.06);
      gainBell2.gain.setValueAtTime(0.05, now + 0.06);
      gainBell2.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
      oscBell2.connect(gainBell2);
      gainBell2.connect(ctx.destination);
      oscBell2.start(now + 0.06);
      oscBell2.stop(now + 0.46);

      // Coin clang 1 (1100 Hz triangle)
      const oscClang1 = ctx.createOscillator();
      const gainClang1 = ctx.createGain();
      oscClang1.type = 'triangle';
      oscClang1.frequency.setValueAtTime(1100, now + 0.1);
      gainClang1.gain.setValueAtTime(0.04, now + 0.1);
      gainClang1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      oscClang1.connect(gainClang1);
      gainClang1.connect(ctx.destination);
      oscClang1.start(now + 0.1);
      oscClang1.stop(now + 0.35);

      // Coin clang 2 (1450 Hz triangle)
      const oscClang2 = ctx.createOscillator();
      const gainClang2 = ctx.createGain();
      oscClang2.type = 'triangle';
      oscClang2.frequency.setValueAtTime(1450, now + 0.15);
      gainClang2.gain.setValueAtTime(0.03, now + 0.15);
      gainClang2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      oscClang2.connect(gainClang2);
      gainClang2.connect(ctx.destination);
      oscClang2.start(now + 0.15);
      oscClang2.stop(now + 0.38);

      // Drawer snap sound (120 Hz square snap)
      const oscDrawer = ctx.createOscillator();
      const gainDrawer = ctx.createGain();
      oscDrawer.type = 'square';
      oscDrawer.frequency.setValueAtTime(120, now + 0.12);
      gainDrawer.gain.setValueAtTime(0.03, now + 0.12);
      gainDrawer.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      oscDrawer.connect(gainDrawer);
      gainDrawer.connect(ctx.destination);
      oscDrawer.start(now + 0.12);
      oscDrawer.stop(now + 0.25);

    } catch (e) {
      console.warn("Audio Context blocked:", e);
    }
  }

  // Play a wailing European two-tone emergency wail (500Hz <-> 850Hz)
  playAlert() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      
      // Two-tone wail sweeps
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.linearRampToValueAtTime(850, now + 0.2);
      osc.frequency.linearRampToValueAtTime(500, now + 0.4);
      osc.frequency.linearRampToValueAtTime(850, now + 0.6);
      osc.frequency.linearRampToValueAtTime(500, now + 0.8);
      
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.8);
    } catch (e) {
      console.warn("Audio Context blocked:", e);
    }
  }

  // Play an ascending, plucky triple-bubble-pop (E4 -> A4 -> C#5 -> E5)
  playBubble() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      // Pop 1 (E4 -> A4)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(329.63, now); 
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.08); 
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Pop 2 (A4 -> C#5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440, now + 0.06); 
      osc2.frequency.exponentialRampToValueAtTime(554.37, now + 0.14); 
      gain2.gain.setValueAtTime(0.06, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.18);

      // Pop 3 (C#5 -> E5)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(554.37, now + 0.12); 
      osc3.frequency.exponentialRampToValueAtTime(659.25, now + 0.2); 
      gain3.gain.setValueAtTime(0.06, now + 0.12);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.12);
      osc3.stop(now + 0.24);

    } catch (e) {
      console.warn("Audio Context blocked:", e);
    }
  }
}

export const synthSound = new SoundSynthesizer();
