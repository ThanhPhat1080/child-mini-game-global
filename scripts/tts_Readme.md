# Tạo giọng đọc (TTS)

[generate_tts.py](generate_tts.py) đọc một file JSON và tạo mỗi câu một file mp3 bằng `edge-tts`. Không cần Supabase. File mp3 nằm trong `text-to-speech-out/` (đã được gitignore). Sau đó bạn tự upload vào trang admin.

Cần có `python3` (3.9 trở lên) và chạy lệnh từ thư mục gốc của repo.

## 1. Cài đặt (làm một lần)

```bash
npm run tts:setup
```

Lệnh này tạo môi trường ảo `scripts/.venv` và cài `edge-tts` vào đó. Các lệnh `npm run tts...` bên dưới tự dùng `.venv`, nên **không cần "activate" thủ công**.

## 2. Chuẩn bị file input

Chép file mẫu rồi sửa:

```bash
cp scripts/tts-input-template.example.json scripts/tts-input-template.json
```

Nội dung của file thật chỉ cần phần `voices`, không cần `Note`, `Filename`, `template`:

```json
{
  "voices": [
    { "text": "Which one is red?" },
    { "text": "Which one is blue?", "name": "blue-question", "rate": "-10%" }
  ]
}
```

Mỗi mục có `text` (bắt buộc). Có thể thêm `name` (tên file, không cần `.mp3`), `voice`, `rate`, `pitch` để ghi đè mặc định cho riêng câu đó.

## 3. Chạy

```bash
npm run tts                  # đọc scripts/tts-input-template.json, tốc độ bình thường
npm run tts:fast             # nhanh hơn 15%, xuất vào text-to-speech-out/fast
npm run tts:slow             # chậm hơn 15%, xuất vào text-to-speech-out/slow
npm run tts -- path/to/input.json --rate -20%    # file khác, tốc độ tuỳ chọn
npm run tts -- --force       # tạo lại cả file đã có
npm run tts:voices           # liệt kê các voice en-US
```

- File đã tồn tại thì được bỏ qua, trừ khi thêm `--force`.
- Voice mặc định là `en-US-AnaNeural`. Đổi bằng `--voice <tên>`.
- Chạy xong, script in đường dẫn thư mục output.

## 4. Thoát khỏi `(.venv)` trong terminal

Nếu terminal đang hiện `(.venv)` ở đầu dòng, tức là bạn đã activate môi trường ảo (ví dụ chạy `source scripts/.venv/bin/activate`). Thoát bằng:

```bash
deactivate
```

Dấu `(.venv)` sẽ biến mất. Không cần xoá thư mục `.venv`. Đóng tab terminal cũng có tác dụng tương tự.

Nếu muốn vào lại để chạy tay (không bắt buộc):

```bash
source scripts/.venv/bin/activate
python scripts/generate_tts.py
```

## Lỗi thường gặp

- `No such file ... scripts/.venv/bin/python`: chưa chạy `npm run tts:setup`.
- `Không thấy ... tts-input-template.json`: chưa chép file mẫu (bước 2).
- Cần internet vì `edge-tts` gọi dịch vụ giọng đọc của Microsoft Edge.
