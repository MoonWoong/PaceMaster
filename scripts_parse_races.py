import json

with open("/tmp/mod27476.js", "r", encoding="utf-8") as f:
    text = f.read()

arr_start = text.find("let i=[{")
print("arr_start:", arr_start)
idx = arr_start + len("let i=")
stack = []
in_str = False
str_char = None
escape = False
arr_end = -1

for pos in range(idx, len(text)):
    ch = text[pos]
    if escape:
        escape = False
        continue
    if ch == "\\":
        escape = True
        continue
    if in_str:
        if ch == str_char:
            in_str = False
            str_char = None
    else:
        if ch in ('"', "'", "`"):
            in_str = True
            str_char = ch
        elif ch in ("[", "{"):
            stack.append(ch)
        elif ch == "]":
            if stack and stack[-1] == "[":
                stack.pop()
            if len(stack) == 0:
                print("Exact end of array i found at position:", pos)
                arr_end = pos
                break
        elif ch == "}":
            if stack and stack[-1] == "{":
                stack.pop()

print("arr_end:", arr_end)
if arr_end != -1:
    raw_array = text[idx:arr_end + 1]
    with open("src/data/races_raw.js", "w", encoding="utf-8") as out:
        out.write("module.exports = " + raw_array + ";")
    print("Saved src/data/races_raw.js successfully, size:", len(raw_array))
