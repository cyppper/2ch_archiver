import os
import requests

url_template = 'https://2ch.life/ololo/threadid_num.gif'

all_threads = [
    'b', 'gacha', 'fag', 'po', 'nvr', 'news', 'vg', 'hw', 'ai', 'wm', 'v', '2d',
    'wr', 'sex', 'soc', 'em', 'me', 'hry', 'zog', 'ja', 'dev', 'man', 'mov', 'gg',
    'ya', 'media', 'au', 'fa', 'rf', 'e', 'a', 'mobi', 'fiz', 'd', 'tes', 'ma',
    'alco', 's', 'psy', 'pa', 'bi', 'cc', 'h', 'diy', 'nf', 'izd', 'mus', 'es',
    'hc', 'tv', 'pr', 'sp', 'socionics', 'ch', 'cg', 'spc', 'dr', 'kpop', 'mlp',
    'dom', 'bo', 'int', 'se', 'fd', 'vn', 'mmo', 'mc', 'brg', 'sw', 'td', 'asmr',
    'o', 'sf', 're', 'ra', 'ph', 'asylum', 'gd', 'mo', 'hi', 'fl', 'wrk', 'fet',
    'trv', 'biz', 'wh', 'gb', 'fs', 'mu', 'br', 'web', 'moba', 'ho', 'abu', 'cul',
    'out', 'old', 'ga', 'fur', 'fg', 'ussr', 'jsf', 'ukr', 'r', 'law', 'm', 'to',
    'r34', 'qtr4', 'wow', 'gabe', 'cute', 'by', 'rm', 'kz', '8', 'aa', 'bg', 'mlpr',
    'ro', 'who', 'srv', 'wp', 'test', 'p', 'electrach', 'ing', 'got', 'crypt', 'de',
    'lap', 'smo', 'hg', 'sad', 'fi', 'vape', 'di', 'ind', 'ld', 'fem', 'gsg', 'w',
    'un', 'tr', 'vr', 't', 'char', 'pok', 'obr', 'hv', 'sn', 'wwe', 'sci', 'pvc',
    'ruvn', 'math', 'ne', 'mg', 'whn', 'hh', 'ftb', 'ew', 'c'
]

output_dir = 'gifs'
os.makedirs(output_dir, exist_ok=True)

for thread in all_threads:
    for num in range(10):
        url = url_template.replace('threadid', thread).replace('num', str(num))
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                filename = f'{thread}_{num}.gif'
                path = os.path.join(output_dir, filename)
                with open(path, 'wb') as f:
                    f.write(resp.content)
                print(f'[OK]   {url} → {filename}')
            else:
                print(f'[Miss] {url} (HTTP {resp.status_code})')
        except requests.RequestException as e:
            print(f'[Error] {url} ({e})')
