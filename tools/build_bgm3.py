# -*- coding: utf-8 -*-
"""Cut a seamless ~60s BGM loop out of the downloaded OST and normalise it."""
import os, subprocess, wave
import numpy as np

FF = r"C:\Users\青雨\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
ROOT = r"E:\dsh-workspace\endfield-gacha"
SRC = os.path.join(ROOT, "_bgm_src2.m4a")
TMP = os.path.join(ROOT, "_tmp_audio", "huasi.wav")
OUT = os.path.join(ROOT, "audio", "bgm_huasi.mp3")
LOOP = 64.0

subprocess.run([FF, "-y", "-v", "error", "-i", SRC, "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", TMP], check=True)
with wave.open(TMP, "rb") as w:
    sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
    x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
x = x.reshape(-1, ch)
mono = x.mean(axis=1)
print("source %.1fs" % (len(mono) / sr))

# energy envelope in 1s blocks
blk = sr
nb = len(mono) // blk
env = np.array([np.sqrt((mono[i * blk:(i + 1) * blk] ** 2).mean()) for i in range(nb)])
win = int(LOOP)
best, best_score = 0, -1
for i in range(0, max(1, nb - win)):
    seg = env[i:i + win]
    # steady loud-ish section: high mean, low variation
    score = seg.mean() - seg.std() * 0.6
    if score > best_score:
        best_score, best = score, i
start = best * blk
print("pick start %.1fs (score %.3f)" % (best, best_score))

seg = x[start:start + int(LOOP * sr)].copy()
fade = int(sr * 2.0)
head = seg[:fade].copy()
tail = seg[-fade:].copy()
w_ = np.linspace(0, np.pi / 2, fade)[:, None]
mixed = head * np.sin(w_) + tail * np.cos(w_)
seg = np.concatenate([mixed, seg[fade:-fade]])
print("loop %.1fs" % (len(seg) / sr))

peak = np.abs(seg).max()
seg = seg / (peak + 1e-9) * 0.9
pcm = (np.clip(seg, -1, 1) * 32767).astype(np.int16)
wav_out = os.path.join(ROOT, "_tmp_audio", "loop.wav")
with wave.open(wav_out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(pcm.tobytes())
subprocess.run([FF, "-y", "-v", "error", "-i", wav_out, "-codec:a", "libmp3lame", "-b:a", "144k", OUT], check=True)
for p in (TMP, wav_out):
    if os.path.exists(p):
        os.remove(p)
print("wrote", OUT, round(os.path.getsize(OUT) / 1024), "KB")
