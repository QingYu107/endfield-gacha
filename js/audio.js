/* ==========================================================================
   终末地 · 寻访模拟器 — audio.js
   自研合成音效（numpy 生成）+ 背景氛围循环 + 本地 TTS 语音
   ========================================================================== */
(function (global) {
  'use strict';

  const BASE = 'audio/';
  const FILES = {
    tick: 'ui_tick.mp3',
    deal: 'card_deal.mp3',
    flip: 'card_flip.mp3',
    rare5: 'rare5.mp3',
    rare6: 'rare6.mp3',
    preroll: 'preroll.mp3',
    confirm: 'confirm.mp3',
    potential: 'potential.mp3',
    error: 'error.mp3'
  };
  const VOL = { tick: 0.35, deal: 0.5, flip: 0.55, rare5: 0.7, rare6: 0.9, preroll: 0.55, confirm: 0.6, potential: 0.65, error: 0.5 };

  const A = {
    on: true,
    voiceOn: true,
    bgmOn: true,
    vol: 1,
    bgmVol: 0.34,
    pool: {},
    bgm: null,
    ready: false,
    started: false,

    init() {
      if (this.ready) return;
      this.ready = true;
      Object.keys(FILES).forEach(k => {
        const a = new Audio(BASE + FILES[k]);
        a.preload = 'auto';
        a.volume = (VOL[k] || 0.6) * this.vol;
        this.pool[k] = [a];
      });
      this.bgm = new Audio(BASE + 'bgm_huasi.mp3');
      this.bgm.loop = true;
      this.bgm.preload = 'auto';
      this.bgm.volume = 0;

      const unlock = () => {
        if (this.started) return;
        this.started = true;
        if (this.bgmOn) this.fadeBgm(this.bgmVol, 2200);
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
      };
      document.addEventListener('pointerdown', unlock, { once: false });
      document.addEventListener('keydown', unlock, { once: false });
    },

    play(name, opt) {
      if (!this.on) return;
      this.init();
      const list = this.pool[name];
      if (!list) return;
      opt = opt || {};
      let a = list.find(x => x.paused || x.ended);
      if (!a) {
        a = list[0].cloneNode();
        list.push(a);
        if (list.length > 6) list.shift();
      }
      try {
        a.currentTime = 0;
        a.volume = Math.min(1, (VOL[name] || 0.6) * this.vol * (opt.vol || 1));
        a.playbackRate = opt.rate || 1;
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    },

    fadeBgm(to, ms) {
      if (!this.bgm) return;
      const from = this.bgm.volume;
      const t0 = performance.now();
      if (this.bgm.paused) { this.bgm.play().catch(() => {}); }
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        this.bgm.volume = from + (to - from) * k;
        if (k < 1) requestAnimationFrame(step);
        else if (to === 0) this.bgm.pause();
      };
      requestAnimationFrame(step);
    },

    setBgm(on) {
      this.bgmOn = !!on;
      this.init();
      if (on) this.fadeBgm(this.bgmVol, 1200);
      else this.fadeBgm(0, 700);
    },

    /** 本地合成语音：用于六星播报与干员台词试听 */
    speak(text, opt) {
      if (!this.voiceOn || !text) return;
      if (!('speechSynthesis' in global)) return;
      try {
        const u = new SpeechSynthesisUtterance(String(text).replace(/[「」“”"]/g, ''));
        u.lang = 'zh-CN';
        u.rate = (opt && opt.rate) || 0.96;
        u.pitch = (opt && opt.pitch) || 1;
        u.volume = (opt && opt.vol) || 0.9;
        const vs = speechSynthesis.getVoices().filter(v => /zh|Chinese|Mandarin/i.test(v.lang + v.name));
        if (vs.length) u.voice = vs[0];
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch (e) {}
    },

    stopSpeak() {
      try { if ('speechSynthesis' in global) speechSynthesis.cancel(); } catch (e) {}
    }
  };

  global.Audio2 = A;
})(window);
