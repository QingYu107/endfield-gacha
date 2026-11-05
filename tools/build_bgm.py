# -*- coding: utf-8 -*-
"""Extract the official opening theme from the wiki video and build a seamless loop bed."""
import os, subprocess, wave
import numpy as np

FF = r"C:\Users\青雨\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
ROOT = r"E:\dsh-workspace\endfield-gacha"
SRC = os.path.join(ROOT, "_tmp_audio", "wiki_opening.mp4")
TMP = os.path.join(ROOT, "_tmp_audio", "ost.wav")
OUT = os.path.join(ROOT, "audio")
os.makedirs(OUT, exist_ok=True)

subprocess.run([FF, "-y", "-v", "error", "-i", SRC, "-vn", "-ac", "2", "-ar", "44100",
                "-c:a", "pcm_s16le", TMP], check=True)

with wave.open(TMP, "rb") as w:
    sr = w.getframerate()
    ch = w.getnchannels()
    data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
x = data.reshape(-1, ch).mean(axis=1)
print("source", round(len(x) / sr, 2), "s", sr, "Hz")

# --- trim silence at both ends
env = np.abs(x)
thr = env.max() * 0.02
idx = np.where(env > thr)[0]
if len(idx):
    x = x[idx[0]: idx[-1]]
print("trimmed", round(len(x) / sr, 2), "s")

# --- find a loop point near the end: pick the last N seconds whose head/tail energy matches
n = len(x)
fade = int(sr * 0.9)
loop = x.copy()
# equal-power crossfade tail into head so the loop is seamless
body = loop[:-fade].copy()
tail = loop[-fade:]
head = loop[:fade].copy()
w = np.linspace(0, np.pi / 2, fade)
mixed = head * np.sin(w) + tail * np.cos(w)
loop = np.concatenate([mixed, body[fade:]])
print("loop", round(len(loop) / sr, 2), "s")

# --- normalise
loop = loop / (np.abs(loop).max() + 1e-9) * 0.9

# --- build a 3x bed with an ambient undertone so the short loop feels intentional
bed_len = len(loop) * 3
bed = np.zeros(bed_len + sr, dtype=np.float32)


def place(dst, src, at, gain=1.0):
    end = min(len(dst), at + len(src))
    dst[at:end] += src[:end - at] * gain


for k in range(3):
    g = (1.0, 0.92, 0.86)[k]
    place(bed, loop, k * len(loop), g)

# ambient pad: two detuned sines + filtered noise, very quiet
tt = np.arange(bed_len) / sr
pad = (np.sin(2 * np.pi * 55 * tt) * 0.5 + np.sin(2 * np.pi * 82.5 * tt + 1.1) * 0.3)
pad *= 0.05 * (0.7 + 0.3 * np.sin(2 * np.pi * tt / 24))
bed[:bed_len] += pad

# gentle tail fade to keep the seam clean when the browser loops the file
end_fade = int(sr * 1.2)
bed[-end_fade:] *= np.linspace(1, 0, end_fade) ** 1.5

bed = bed / (np.abs(bed).max() + 1e-9) * 0.92
pcm = np.stack([bed, bed], axis=1)
pcm = np.clip(pcm, -1, 1)
pcm16 = (pcm * 32767).astype(np.int16)

wav_path = os.path.join(OUT, "bgm_enfield.wav")
with wave.open(wav_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes(pcm16.tobytes())

mp3 = os.path.join(OUT, "bgm_enfield.mp3")
subprocess.run([FF, "-y", "-v", "error", "-i", wav_path, "-codec:a", "libmp3lame",
                "-b:a", "160k", mp3], check=True)
os.remove(wav_path)
print("wrote", mp3, round(os.path.getsize(mp3) / 1024), "KB", round(len(bed) / sr, 1), "s")
