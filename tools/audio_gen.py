# -*- coding: utf-8 -*-
"""Synthesize the simulator's SFX + BGM loop (no third-party samples)."""
import os, subprocess, math
import numpy as np

SR = 44100
OUT = r"E:\dsh-workspace\endfield-gacha\audio"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def t(dur):
    return np.arange(int(SR * dur)) / SR


def env_ad(n, a=0.005, d=0.2, curve=3.0):
    ai = max(1, int(SR * a))
    out = np.ones(n)
    out[:ai] = np.linspace(0, 1, ai)
    tail = np.linspace(0, 1, max(1, n - ai))
    out[ai:] = (1 - tail) ** curve
    return out


def exp_env(n, tau):
    return np.exp(-np.arange(n) / (SR * tau))


def lowpass(x, cutoff, q=0.7):
    """simple one-pole-ish lowpass"""
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def lowpass_fast(x, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    # vectorised IIR via cumulative trick (approx): use scipy-free recursive filter
    y = np.empty_like(x)
    acc = 0.0
    c1 = 1 - a
    for i in range(len(x)):
        acc = c1 * x[i] + a * acc
        y[i] = acc
    return y


def hp(x, cutoff):
    return x - lowpass_fast(x, cutoff)


def sine(freq, dur, phase=0.0):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    f = np.full(n, freq) if np.isscalar(freq) else freq
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    return np.sin(ph)


def saw(freq, dur, detune=0.0):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    f = freq * (1 + detune)
    return 2 * ((f * tt) % 1.0) - 1


def noise(dur):
    return rng.normal(0, 1, int(SR * dur))


def reverb(x, tau=0.35, wet=0.25, seed=3):
    r = np.random.default_rng(seed)
    ir_n = int(SR * tau * 3)
    ir = r.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (SR * tau))
    ir = ir / (np.abs(ir).sum() ** 0.5)
    y = np.convolve(x, ir)[:len(x)]
    return (1 - wet) * x + wet * y * 1.6


def norm(x, peak=0.92):
    m = np.abs(x).max()
    return x if m < 1e-9 else x * (peak / m)


def write(name, x, gain=1.0):
    x = norm(np.asarray(x, dtype=np.float64), 0.95) * gain
    pcm = np.clip(x, -1, 1)
    pcm = (pcm * 32767).astype(np.int16)
    wav = os.path.join(OUT, name + ".wav")
    import wave
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    mp3 = os.path.join(OUT, name + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame",
                    "-b:a", "160k", mp3], check=True)
    os.remove(wav)
    print("%-14s %6.1f KB  %.2fs" % (name, os.path.getsize(mp3) / 1024, len(x) / SR))


# ---------------------------------------------------------------- ui tick
def ui_tick():
    d = 0.05
    x = noise(d) * exp_env(int(SR * d), 0.006)
    x = hp(x, 1800)
    x += sine(2400, d) * exp_env(int(SR * d), 0.004) * 0.5
    return x * 0.55


# ---------------------------------------------------------------- card deal
def card_deal():
    d = 0.22
    n = int(SR * d)
    src = noise(d) * exp_env(n, 0.08)
    # sweep the filter by blending two lowpassed versions
    a = lowpass_fast(src, 900)
    b = lowpass_fast(src, 4200)
    mix = np.linspace(0, 1, n) ** 2
    x = a * (1 - mix) + b * mix
    x += sine(np.linspace(300, 900, n), d) * exp_env(n, 0.05) * 0.15
    return x * 0.5


# ---------------------------------------------------------------- card flip
def card_flip():
    d = 0.14
    n = int(SR * d)
    x = noise(d) * exp_env(n, 0.012) * 0.8
    x = hp(x, 900)
    x += sine(1500, d) * exp_env(n, 0.02) * 0.35
    x += sine(760, d) * exp_env(n, 0.03) * 0.2
    return x * 0.6


# ---------------------------------------------------------------- 5 star
def rare5():
    d = 1.5
    n = int(SR * d)
    x = np.zeros(n)
    for f, delay, g in [(784, 0.0, 0.5), (1175, 0.09, 0.42), (1568, 0.18, 0.3)]:
        seg = sine(f, d - delay) * exp_env(int(SR * (d - delay)), 0.45)
        seg += sine(f * 2.01, d - delay) * exp_env(int(SR * (d - delay)), 0.2) * 0.15
        x[int(SR * delay):int(SR * delay) + len(seg)] += seg * g
    return reverb(x, 0.5, 0.28) * 0.7


# ---------------------------------------------------------------- 6 star
def rare6():
    d = 2.6
    n = int(SR * d)
    x = np.zeros(n)
    tt = np.arange(n) / SR
    # sub drop
    sub = sine(np.linspace(120, 42, n), d) * exp_env(n, 0.55) * 0.9
    # riser before the hit
    rise_n = int(SR * 0.65)
    riser = noise(0.65) * np.linspace(0, 1, rise_n) ** 2
    riser = lowpass_fast(riser, 5200) * 0.35
    x[:rise_n] += riser
    # hit
    hit = np.zeros(n)
    hit[rise_n:] += sub[rise_n:]
    # metallic chord
    chord = [261.6, 392.0, 523.3, 784.0, 1046.5]
    for i, f in enumerate(chord):
        seg = saw(f, d, detune=(i - 2) * 0.002)
        seg = lowpass_fast(seg, 2600 + i * 400)
        hit += seg * exp_env(n, 0.35 + i * 0.05) * (0.16 - i * 0.02)
    # shimmer
    sh = noise(d) * exp_env(n, 0.6)
    sh = hp(sh, 5200) * 0.16
    hit += sh
    x += hit
    return reverb(x, 0.6, 0.32) * 0.85


# ---------------------------------------------------------------- preroll riser
def preroll():
    d = 1.4
    n = int(SR * d)
    f = np.linspace(120, 520, n) ** 1.02
    x = sine(f, d) * np.linspace(0, 1, n) ** 2.2 * 0.35
    ns = noise(d) * np.linspace(0, 1, n) ** 3
    ns = lowpass_fast(ns, 3800) * 0.3
    x += ns
    # ticking
    for k in range(6):
        i = int(SR * (0.2 + k * 0.18))
        ln = int(SR * 0.02)
        if i + ln < n:
            x[i:i + ln] += sine(1800, 0.02) * exp_env(ln, 0.004) * 0.12
    return reverb(x, 0.4, 0.2) * 0.8


# ---------------------------------------------------------------- confirm
def confirm():
    d = 0.5
    n = int(SR * d)
    x = np.zeros(n)
    for f, dl in [(660, 0.0), (990, 0.07)]:
        seg = sine(f, d - dl) * exp_env(int(SR * (d - dl)), 0.09)
        seg += saw(f, d - dl) * exp_env(int(SR * (d - dl)), 0.06) * 0.1
        x[int(SR * dl):int(SR * dl) + len(seg)] += seg
    return reverb(x, 0.25, 0.2) * 0.6


# ---------------------------------------------------------------- potential up
def potential():
    d = 1.1
    n = int(SR * d)
    x = np.zeros(n)
    notes = [523.3, 659.3, 784.0, 1046.5, 1318.5]
    for i, f in enumerate(notes):
        dl = i * 0.055
        seg = sine(f, d - dl) * exp_env(int(SR * (d - dl)), 0.16)
        seg += sine(f * 2, d - dl) * exp_env(int(SR * (d - dl)), 0.07) * 0.2
        x[int(SR * dl):int(SR * dl) + len(seg)] += seg * (0.4 - i * 0.05)
    return reverb(x, 0.45, 0.3) * 0.75


# ---------------------------------------------------------------- error
def error():
    d = 0.4
    n = int(SR * d)
    x = saw(150, d) * exp_env(n, 0.12) * 0.3
    x += saw(146, d) * exp_env(n, 0.12) * 0.3
    x = lowpass_fast(x, 1200)
    return x * 0.5


# ---------------------------------------------------------------- bgm loop
def bgm(length=24.0):
    n = int(SR * length)
    tt = np.arange(n) / SR
    x = np.zeros(n)
    # drone with slow swell
    lfo = 0.65 + 0.35 * np.sin(2 * np.pi * tt / length * 2)
    x += np.sin(2 * np.pi * 55 * tt) * 0.16 * lfo
    x += np.sin(2 * np.pi * 82.5 * tt + 0.7) * 0.09 * lfo
    x += np.sin(2 * np.pi * 110 * tt + 1.3) * 0.05 * lfo
    # pad: detuned saws, heavy lowpass, slow chord changes
    for k, f in enumerate([164.8, 196.0, 246.9]):
        s = 2 * ((f * tt * 1.0015) % 1.0) - 1
        s += 2 * ((f * tt * 0.9985) % 1.0) - 1
        s = lowpass_fast(s * 0.5, 700)
        swing = 0.5 + 0.5 * np.sin(2 * np.pi * tt / length + k * 1.7)
        x += s * 0.055 * swing
    # pulse every 2s (soft kick + tick)
    for k in range(int(length / 2)):
        i = int(SR * k * 2)
        ln = int(SR * 0.35)
        if i + ln < n:
            f = np.linspace(70, 42, ln)
            kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_env(ln, 0.16) * 0.22
            x[i:i + ln] += kick
        j = int(SR * (k * 2 + 1.0))
        ln2 = int(SR * 0.05)
        if j + ln2 < n:
            x[j:j + ln2] += np.sin(2 * np.pi * 2200 * np.arange(ln2) / SR) * exp_env(ln2, 0.008) * 0.03
    # distant metallic pings
    for k, (pos, f) in enumerate([(3.1, 1318), (9.6, 988), (15.2, 1568), (20.4, 1175)]):
        i = int(SR * pos)
        ln = int(SR * 1.8)
        if i + ln < n:
            ping = np.sin(2 * np.pi * f * np.arange(ln) / SR) * exp_env(ln, 0.5) * 0.05
            ping += np.sin(2 * np.pi * f * 2.4 * np.arange(ln) / SR) * exp_env(ln, 0.22) * 0.02
            x[i:i + ln] += ping
    # air noise bed
    air = lowpass_fast(noise(length), 1200) * 0.02
    x += air
    # seamless wrap: crossfade the tail into the head
    fade = int(SR * 1.0)
    head = x[:fade].copy()
    x[-fade:] = x[-fade:] * np.linspace(1, 0, fade) + head * np.linspace(0, 1, fade)
    return x * 0.9


if __name__ == "__main__":
    write("ui_tick", ui_tick(), 0.9)
    write("card_deal", card_deal(), 0.9)
    write("card_flip", card_flip(), 0.9)
    write("rare5", rare5(), 0.9)
    write("rare6", rare6(), 0.85)
    write("preroll", preroll(), 0.85)
    write("confirm", confirm(), 0.9)
    write("potential", potential(), 0.85)
    write("error", error(), 0.7)
    write("bgm_loop", bgm(), 0.8)
    print("total", round(sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) / 1048576, 2), "MB")
