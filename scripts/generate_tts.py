#!/usr/bin/env python3
"""
Tạo file mp3 giọng đọc từ một file JSON, không dùng Supabase.

Input (xem scripts/tts-input-template.json):
    { "voices": [ { "text": "Which one is red?" }, { "text": "Which one is blue?" } ] }
Mỗi mục có thể thêm "name" (tên file, không cần đuôi .mp3), "voice", "rate", "pitch"
để ghi đè giá trị mặc định cho riêng câu đó.

Output: text-to-speech-out/ trong thư mục repo, mỗi câu một file mp3 (đường dẫn đầy đủ được in ra khi chạy).

Dùng qua npm (macOS):
    npm run tts:setup                      # tạo scripts/.venv và cài edge-tts, chạy một lần
    npm run tts                            # đọc scripts/tts-input-template.json
    npm run tts -- path/to/input.json --rate -20%
Xem danh sách voice: npm run tts:voices
"""
import argparse, asyncio, hashlib, json, re, sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT / "scripts" / "tts-input-template.json"
DEFAULT_OUT = ROOT / "text-to-speech-out"


def slug(text: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "x"
    return f"{base}-{hashlib.sha1(text.encode()).hexdigest()[:8]}"


def load_voices(path: Path) -> list[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        sys.exit(f"Không thấy {path}. Chép scripts/tts-input-template.json thành scripts/tts-input.json rồi sửa.")
    except json.JSONDecodeError as e:
        sys.exit(f"{path} không phải JSON hợp lệ: {e}")
    items = data.get("voices") if isinstance(data, dict) else None
    if not isinstance(items, list) or not items:
        sys.exit('JSON phải có dạng { "voices": [ { "text": "..." }, ... ] }')
    for i, it in enumerate(items, 1):
        if not isinstance(it, dict) or not str(it.get("text", "")).strip():
            sys.exit(f'Mục số {i} thiếu "text"')
    return items


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", nargs="?", default=str(DEFAULT_INPUT), help="file JSON đầu vào")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="thư mục xuất mp3")
    ap.add_argument("--voice", default="en-US-AnaNeural")
    ap.add_argument("--rate", default="+0%", help="tốc độ: +0%% bình thường, +15%% nhanh, -15%% chậm")
    ap.add_argument("--pitch", default="+0Hz")
    ap.add_argument("--force", action="store_true", help="tạo lại cả file đã có")
    a = ap.parse_args()

    items = load_voices(Path(a.input))
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    print(f"Input:  {Path(a.input).resolve()}")
    print(f"Output: {out.resolve()}\n")

    made = skipped = 0
    for it in items:
        text = it["text"].strip()
        name = re.sub(r"[^\w.-]+", "-", str(it["name"])).strip("-") if it.get("name") else slug(text)
        f = out / f"{name}.mp3"
        if f.exists() and not a.force:
            skipped += 1
            print("  bỏ qua (đã có)", f.name)
            continue
        await edge_tts.Communicate(
            text,
            it.get("voice", a.voice),
            rate=it.get("rate", a.rate),
            pitch=it.get("pitch", a.pitch),
        ).save(str(f))
        made += 1
        print("  ok", f.name, "<-", text)

    print(f"\nXong: tạo {made}, bỏ qua {skipped}. Thư mục: {out}")


asyncio.run(main())
