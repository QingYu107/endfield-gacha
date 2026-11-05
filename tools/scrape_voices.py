#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓六星干员的真实语音（voice.fz.wiki 的中文 wav），转成 mp3 放进 audio/voice/。

产出：
  audio/voice/<charId>.mp3
  data/voices.js   -> window.VOICES = { charId: { text, dur, scene } }
"""
import json, os, re, subprocess, sys, urllib.parse, urllib.request, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.fz.wiki/api/v1/articles/by-title?ns=0&withRevision=1&title="
UA = {"User-Agent": "Mozilla/5.0 (endfield-gacha asset builder)"}
OUT_DIR = os.path.join(ROOT, "audio", "voice")

PREFERRED = ["talk-1", "present-received", "gift-offer", "talk-2"]


def ffmpeg():
    hits = glob.glob(os.path.expanduser(
        r"~\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg*\**\bin\ffmpeg.exe"), recursive=True)
    if hits:
        return hits[0]
    return "ffmpeg"


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=30))


def article(title):
    return get_json(API + urllib.parse.quote(title))["revision"]["contentJson"]


def scenes_of(node):
    out = []
    def walk(n):
        if isinstance(n, dict):
            if n.get("itemType") == "endfieldCardCharacterShipTalk__scenes":
                out.append(n.get("data") or {})
            for v in n.values():
                walk(v)
        elif isinstance(n, list):
            for v in n:
                walk(v)
    walk(node)
    return out


def pick(scenes):
    """挑一句中文语音：优先 PREFERRED 场景，其次任何带音频的短句。"""
    cand = []
    for sc in scenes:
        for ln in sc.get("lines") or []:
            url = (ln.get("audioUrls") or {}).get("Chinese")
            text = (ln.get("text") or "").strip()
            if not url or not text:
                continue
            cand.append({"key": sc.get("key"), "title": sc.get("title"),
                         "text": text, "url": url, "len": len(text)})
    if not cand:
        return None
    for key in PREFERRED:
        for c in cand:
            if c["key"] == key:
                return c
    cand.sort(key=lambda c: c["len"])
    return cand[0]


def to_mp3(wav_bytes, dst):
    tmp = dst + ".src.wav"
    with open(tmp, "wb") as f:
        f.write(wav_bytes)
    # 去掉首尾静音，压成 96k 单声道
    cmd = [ffmpeg(), "-y", "-loglevel", "error", "-i", tmp,
           "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,"
                  "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse",
           "-ac", "1", "-ar", "24000", "-b:a", "72k", dst]
    subprocess.run(cmd, check=True)
    os.remove(tmp)


def probe_dur(path):
    out = subprocess.run([ffmpeg().replace("ffmpeg.exe", "ffprobe.exe"), "-v", "error",
                          "-show_entries", "format=duration", "-of",
                          "default=nw=1:nk=1", path], capture_output=True, text=True)
    try:
        return round(float(out.stdout.strip()), 2)
    except Exception:
        return 0.0


def main():
    data = open(os.path.join(ROOT, "data", "data.js"), encoding="utf-8").read()
    blob = json.loads(data.split("=", 1)[1].strip().rstrip(";"))
    ops = blob["ops"]
    six = list(ops.items())
    print("ops:", len(six))

    os.makedirs(OUT_DIR, exist_ok=True)
    result, miss = {}, []

    for name, op in six:
        cid = op.get("charId") or op.get("id")
        dst = os.path.join(OUT_DIR, cid + ".mp3")
        try:
            node = article("干员/" + op.get("name", name))
        except Exception as e:
            print("  !! article fail", name, e)
            miss.append((name, "no article"))
            continue
        pickd = pick(scenes_of(node))
        if not pickd:
            print("  -- no voice", name)
            miss.append((name, "no audio"))
            continue
        got_audio = False
        if op.get("rarity") == 6:
            try:
                req = urllib.request.Request(pickd["url"], headers=UA)
                blob_bytes = urllib.request.urlopen(req, timeout=60).read()
                to_mp3(blob_bytes, dst)
                got_audio = True
            except Exception as e:
                print("  ~  text only (audio 404)", name)
        if not got_audio and os.path.exists(dst):
            os.remove(dst)
        dur = probe_dur(dst) if op.get("rarity") == 6 else 0
        result[cid] = {"text": pickd["text"], "dur": dur, "scene": pickd["title"],
                       "voice": bool(got_audio)}
        print("  ok %-6s %5.2fs %-10s %s" % (name, dur, pickd["key"], pickd["text"][:18]))

    js = "/* 六星干员语音：抓自 voice.fz.wiki（干员频道台词），仅保留中文 */\n"
    js += "window.VOICES = " + json.dumps(result, ensure_ascii=False, indent=1) + ";\n"
    open(os.path.join(ROOT, "data", "voices.js"), "w", encoding="utf-8").write(js)
    total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
    print("\nvoices:", len(result), " size:", round(total / 1024), "KB", " miss:", miss)


if __name__ == "__main__":
    main()
