#!/usr/bin/env python3
"""One-off migration helper: wraps user-facing Italian string literals / template
literals in t(...) calls (templates become t("… {name} …", { name })). Kept in
tools/ for reference; re-running on already-wrapped code is a no-op."""
import re, sys

SKIP_WORDS = {"Enter","Escape","Backspace","Delete","Tab","Shift","Control","Meta","Alt","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","Home","End",
              "Inter","Playfair","GET","POST","PUT","UTF","JSON","None","Google","Firebase","Murdoku","Firestore"}
LETTERS = re.compile(r'[A-Za-zÀ-ú]{3,}')

def looks_italian(s):
    core = re.sub(r'\$\{[^}]*\}', '', s)
    if not LETTERS.search(core): return False
    if core.strip() in SKIP_WORDS: return False
    if re.search(r'px|var\(|rgb|--|[;]\s*\w+:|^\s*[#.]', core): return False
    if re.fullmatch(r'[\w\-\.#:\[\]=/>,]+', core.strip()) and not re.match(r'[A-ZÀ-Ú]', core.strip()): return False
    core = re.sub(r'^[^A-Za-zÀ-ú]+', '', core)  # leading emoji / symbols / punctuation
    words = [w for w in core.split() if re.search(r'[A-Za-zÀ-ú]', w)]
    if re.search(r'[àèéìòùÀÈÉÌÒÙ]', core): return True
    if re.match(r'\s*[A-ZÀ-Ú]', core): return True
    if len(words) >= 3 and all(re.fullmatch(r"[A-Za-zÀ-ú'’,.…:;!?()\"\-]+", w) for w in words): return True
    return False

def tokenize(src):
    """Yield (kind, start, end) for string ('s') and template ('t') literals at any depth-0 code position."""
    i, n, out = 0, len(src), []
    while i < n:
        c = src[i]
        if src.startswith('//', i):
            j = src.find('\n', i); i = n if j < 0 else j
        elif src.startswith('/*', i):
            j = src.find('*/', i + 2); i = n if j < 0 else j + 2
        elif c in '"\'':
            j = i + 1
            while j < n and src[j] != c:
                j += 2 if src[j] == '\\' else 1
            out.append(('s', i, j + 1)); i = j + 1
        elif c == '`':
            j, depth, nested = i + 1, 0, False
            while j < n:
                if src[j] == '\\': j += 2; continue
                if depth == 0 and src[j] == '`': break
                if src.startswith('${', j): depth += 1; j += 2; continue
                if depth and src[j] == '}': depth -= 1
                if depth and src[j] == '`': nested = True
                j += 1
            out.append(('tn' if nested else 't', i, j + 1)); i = j + 1
        elif c == '/' and re.match(r'[=(,:\[!&|?{};]\s*$', src[max(0,i-3):i].rstrip()[-1:] or ';'):
            # regex literal
            j = i + 1
            while j < n and src[j] != '/':
                j += 2 if src[j] == '\\' else 1
            i = j + 1
        else:
            i += 1
    return out

def context_blocks(src, start, end):
    before = src[max(0, start - 40):start]
    after = src[end:end + 6]
    if re.search(r'(===|!==|==|!=|case|import|from|\bin)\s*$', before): return True
    if re.search(r'\[\s*$', before) and re.search(r'[\w\]\)]\s*\[\s*$', before): return True   # obj["key"]
    if re.match(r'\s*:', after) and not re.search(r'\?\s*[^:]*$', before.split('\n')[-1]): return True  # object key
    if re.search(r'(querySelector(All)?|getElementById|getAttribute|setAttribute|classList\.\w+|addEventListener|createElement|createElementNS|matches|closest|dataset|localStorage\.\w+|removeAttribute)\(\s*$', before): return True
    if re.search(r'\bel\(\s*$', before): return True   # el("tag")
    if re.search(r'(class|type|role|id|href|src|name|value|for|tabindex|rel|target|dataset)\s*:\s*$', before): return True
    if re.search(r'new Set\(|Object\.keys|\.includes\(\s*$', before): return True
    return False

def convert_template(body):
    params, names, parts, last = [], {}, [], 0
    out = ''
    i = 0
    while i < len(body):
        if body.startswith('${', i):
            depth, j = 1, i + 2
            while j < len(body) and depth:
                if body[j] == '{': depth += 1
                elif body[j] == '}': depth -= 1
                j += 1
            expr = body[i+2:j-1].strip()
            m = re.fullmatch(r'[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*', expr)
            base = re.split(r'\??\.', expr)[-1] if m else 'v'
            base = re.sub(r'\W', '', base) or 'v'
            k = base; c = 1
            while k in names and names[k] != expr:
                c += 1; k = f'{base}{c}'
            names[k] = expr
            out += '{' + k + '}'
            i = j
        else:
            out += body[i]; i += 1
    plist = ', '.join(k if k == v else f'{k}: {v}' for k, v in names.items())
    return out, plist

def process(path):
    src = open(path).read()
    toks = tokenize(src)
    edits = []
    for kind, a, b in toks:
        lit = src[a:b]
        body = lit[1:-1]
        if kind == 'tn': continue
        if kind == 's' and lit[0] == "'" and '"' in body: pass
        if not looks_italian(body): continue
        if context_blocks(src, a, b): continue
        before = src[max(0, a-3):a]
        if re.search(r'\bt\(\s*$', src[max(0,a-4):a]): continue
        if kind == 's':
            q = lit[0]
            if q == "'": body = body.replace("\\'", "'").replace('"', '\\"'); 
            new = f't("{body}")'
        else:
            if '${' not in body:
                new = f't(`{body}`)'
            else:
                tpl, plist = convert_template(body)
                tpl = tpl.replace('\\`', '`').replace('"', '\\"').replace('\n', '\\n')
                new = f't("{tpl}", {{ {plist} }})'
        edits.append((a, b, new))
    if not edits: return 0
    for a, b, new in sorted(edits, reverse=True):
        src = src[:a] + new + src[b:]
    if not re.search(r'import \{[^}]*\bt\b[^}]*\} from "[^"]*i18n\.js"', src):
        depth = path.count('/') - 1
        rel = '../' * depth if depth > 0 else './'
        lines = src.split('\n'); idx = 0
        for i, l in enumerate(lines):
            if l.startswith('import '): idx = i + 1
        lines.insert(idx, f'import {{ t }} from "{rel}i18n/i18n.js";')
        src = '\n'.join(lines)
    open(path, 'w').write(src)
    return len(edits)

if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(p, process(p))
