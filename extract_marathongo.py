import urllib.request
import re
import json
import os

print("Fetching MarathonGo _app chunk...")
url = 'https://marathongo.co.kr/_next/static/chunks/pages/_app-c1e874cd0ee7a925.js'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
text = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
print(f"Total text length: {len(text)}")

def extract_js_array(full_text, start_pos):
    stack = []
    in_str = False
    str_char = None
    escape = False
    for pos in range(start_pos, len(full_text)):
        ch = full_text[pos]
        if escape:
            escape = False
            continue
        if ch == '\\':
            escape = True
            continue
        if in_str:
            if ch == str_char:
                in_str = False
                str_char = None
        else:
            if ch in ('"', "'", '`'):
                in_str = True
                str_char = ch
            elif ch == '[':
                stack.append(ch)
            elif ch == ']':
                if stack and stack[-1] == '[':
                    stack.pop()
                if len(stack) == 0:
                    return full_text[start_pos:pos+1]
    return None

matches = list(re.finditer(r'\[\{id:\d+,raceName:', text))
print(f"Found {len(matches)} race arrays in _app")

for idx, m in enumerate(matches):
    start = m.start()
    arr_str = extract_js_array(text, start)
    print(f"Array {idx} extracted, length: {len(arr_str) if arr_str else 0}")
    out_path = f"/tmp/races_arr_{idx}.js"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("module.exports = " + arr_str + ";")
    print(f"Saved {out_path}")
