# -*- coding: utf-8 -*-
"""把 VTT 字幕切成 ~10 分钟的内容段落（跳过开头寒暄/结尾）。"""
import re, os, glob

RAW = os.path.dirname(os.path.abspath(__file__))
SEG = os.path.join(RAW, '..', 'segments')
os.makedirs(SEG, exist_ok=True)

def parse_vtt(path):
    text = open(path, encoding='utf-8').read()
    cues = []
    for m in re.finditer(r'(\d{2}):(\d{2}):(\d{2})\.\d+\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.\d+[^\n]*\n(.*?)(?=\n\n|\Z)', text, re.DOTALL):
        h1, m1, s1, h2, m2, s2 = [int(x) for x in m.groups()[:6]]
        body = re.sub(r'<[^>]+>', '', m.group(7)).replace('\n', ' ').strip()
        start = h1*3600 + m1*60 + s1
        cues.append((start, body))
    # 合并相邻重复行（YouTube 字幕逐行滚动重复/卡拉OK式逐词重复）
    merged = []
    prev = ''
    for t, body in cues:
        if body and body != prev and not (prev and body.startswith(prev)):
            merged.append((t, body))
            prev = body
    return merged

def slice_windows(cues, lecture_tag, windows, min_words=800, max_words=1300):
    """windows: list of (start_min, label). 每段从 start_min 开始凑够 ~1000 词。"""
    made = []
    for start_min, label in windows:
        start_s = start_min * 60
        words = []
        for t, body in cues:
            if t >= start_s:
                words.append(body)
                total = len(' '.join(words).split())
                if total >= min_words:
                    end_min = t // 60
                    break
        text = ' '.join(words)
        wc = len(text.split())
        # 超太多就截到 max_words
        if wc > max_words:
            text = ' '.join(text.split()[:max_words])
            wc = max_words
        fn = os.path.join(SEG, f'{label}.txt')
        with open(fn, 'w', encoding='utf-8') as f:
            f.write(text)
        made.append((label, lecture_tag, start_min, wc))
        print(f'{label}: {lecture_tag} from {start_min}min, {wc} words')
    return made

all_made = []
jobs = [
    # (vtt文件前缀, 课程标签, [(起始分钟, 段名)])
    ('lec1_1806', 'MIT 18.06 Linear Algebra L1 (Strang)', [(6, 'seg01'), (20, 'seg02'), (34, 'seg03')]),
    # 6.0001 因 YouTube 限流下载失败，改用已下载讲座的后半段（2D peak finding / 市场与政府）
    ('lec1_6006', 'MIT 6.006 Intro to Algorithms L1 (2D peak finding)', [(33, 'seg04')]),
    ('lec1_6006', 'MIT 6.006 Intro to Algorithms L1 (2D peak finding cont.)', [(43, 'seg05')]),
    ('lec1_1401', 'MIT 14.01 Microeconomics L1 (markets & government)', [(34, 'seg06')]),
    ('lec1_6006', 'MIT 6.006 Intro to Algorithms L1',   [(6, 'seg07'), (20, 'seg08')]),
    ('lec1_1401', 'MIT 14.01 Microeconomics L1',        [(6, 'seg09'), (22, 'seg10')]),
]
for prefix, tag, windows in jobs:
    files = glob.glob(os.path.join(RAW, prefix + '.en*.vtt'))
    if not files:
        print(f'!! 缺字幕: {prefix}')
        continue
    # 人工字幕（en-en-* / en-uk-*）优先，其次按解析出的 cue 数取最多
    def rank(p):
        name = os.path.basename(p)
        human = 1 if re.search(r'\.en-(en|uk|us)-', name) else 0
        return (human, len(parse_vtt(p)))
    vtt = max(files, key=rank)
    cues = parse_vtt(vtt)
    print(f'--- {prefix}: {len(cues)} cues, using {os.path.basename(vtt)}')
    all_made += slice_windows(cues, tag, windows)

print(f'\n共 {len(all_made)} 段')
