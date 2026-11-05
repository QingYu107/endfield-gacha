# -*- coding: utf-8 -*-
"""Download art, convert to webp, emit data/data.js for the static simulator."""
import json, os, io, hashlib, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = r"E:\dsh-workspace\endfield-gacha"
RAW = json.load(open(os.path.join(ROOT, "data", "_raw.json"), encoding="utf-8"))
CACHE = os.path.join(ROOT, "_cache")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      "Accept": "image/avif,image/webp,image/png,*/*"}


def fetch_bytes(url):
    key = hashlib.md5(url.encode()).hexdigest()
    cp = os.path.join(CACHE, key)
    if os.path.exists(cp) and os.path.getsize(cp) > 0:
        return open(cp, "rb").read()
    last = None
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as r:
                raw = r.read()
            open(cp, "wb").write(raw)
            return raw
        except Exception as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise last


def save_webp(url, relpath, max_w, quality=87, square=False):
    dst = os.path.join(ROOT, relpath)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    try:
        raw = fetch_bytes(url)
        im = Image.open(io.BytesIO(raw))
        im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
        w, h = im.size
        if square:
            s = min(w, h)
            im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
            w = h = s
        if w > max_w:
            nh = int(h * max_w / w)
            im = im.resize((max_w, nh), Image.LANCZOS)
        if im.mode == "RGBA":
            # flatten alpha onto transparent kept as webp alpha
            im.save(dst, "WEBP", quality=quality, method=5)
        else:
            im.save(dst, "WEBP", quality=quality, method=5)
        return True, os.path.getsize(dst)
    except Exception as e:
        print("FAIL", relpath, url, e)
        return False, 0


jobs = []
ops = RAW["ops"]
for nm, o in ops.items():
    cid = o.get("charId") or nm
    if o.get("portrait"):
        jobs.append((o["portrait"], "assets/portrait/%s.webp" % cid, 900, 86, False))
    if o.get("icon"):
        jobs.append((o["icon"], "assets/icon/%s.webp" % cid, 320, 88, True))

for p in RAW["pools"]:
    pid = p["poolId"]
    if p.get("_bannerIcon"):
        jobs.append((p["_bannerIcon"], "assets/banner/%s.webp" % pid, 480, 88, True))

# dedupe
seen = set()
uniq = []
for j in jobs:
    if j[1] in seen:
        continue
    seen.add(j[1])
    uniq.append(j)

print("jobs:", len(uniq))
t0 = time.time()
with ThreadPoolExecutor(max_workers=8) as ex:
    res = list(ex.map(lambda j: save_webp(*j), uniq))
ok = sum(1 for r in res if r[0])
total = sum(r[1] for r in res)
print("done %d/%d in %.1fs, %.1f MB" % (ok, len(uniq), time.time() - t0, total / 1048576))
