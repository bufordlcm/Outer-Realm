# Ironquill helper (picture bridge + research)
# Runs on your PC next to Forge. Uses only Python's standard library, so it runs with the Python
# bundled inside Forge. It does three jobs for the Ironquill website:
#   1. Pictures: passes requests through to Forge (port 7860) and adds the CORS header Forge leaves out.
#   2. Search:   /iq/search?q=...  -> SearXNG on this PC if it's running (port 8888),
#                otherwise DuckDuckGo, otherwise Wikipedia.
#   3. Reading:  /iq/read?url=...  -> the readable text of one web page (private/local addresses refused).
#   4. Voices:   /iq/tts (POST {text, voice, speed}) -> natural speech from Kokoro, run on this PC's processor.
#                One-time install: run this file with --install-voices (Install voices.bat does that).
# Only the Ironquill website and pages on this PC are allowed to use it.
import os, html, io, threading, wave
import html.parser
import ipaddress
import json
import re
import socket
import socketserver
import sys
import http.server
import urllib.error
import urllib.parse
import urllib.request

FORGE = 'http://127.0.0.1:7860'
SEARXNG = 'http://127.0.0.1:8888'
PORT = 7861
ALLOWED = {'https://ironquillstories.netlify.app', 'https://outer-realm.netlify.app'}
# Extra web addresses allowed to use this helper: one per line in allowed-sites.txt next to this file
try:
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'allowed-sites.txt'), encoding='utf-8') as f:
        ALLOWED |= {l.strip().rstrip('/') for l in f if l.strip().startswith('https://')}
except OSError:
    pass
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 IronquillHelper/1.0'
MAX_PAGE = 2_500_000   # bytes read from any one web page
MAX_TEXT = 16000       # characters of readable text returned

# ---------- voices (Kokoro) ----------
HERE = os.path.dirname(os.path.abspath(__file__))
VOICE_DIR = os.path.join(HERE, 'voice')
VOICE_LIB = os.path.join(VOICE_DIR, 'lib')      # kept apart so it never touches Forge's own packages
VOICE_MODEL = os.path.join(VOICE_DIR, 'kokoro-v1.0.onnx')
VOICE_BANK = os.path.join(VOICE_DIR, 'voices-v1.0.bin')
VOICE_URLS = ['https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/',
              'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/']
_kokoro, _kokoro_err, _kokoro_lock = None, '', threading.Lock()


def voices_installed():
    return os.path.isfile(VOICE_MODEL) and os.path.isfile(VOICE_BANK) and os.path.isdir(os.path.join(VOICE_LIB, 'kokoro_onnx'))


def kokoro():
    global _kokoro, _kokoro_err
    if _kokoro is None and voices_installed():
        with _kokoro_lock:
            if _kokoro is None:
                try:
                    if VOICE_LIB not in sys.path:
                        sys.path.insert(0, VOICE_LIB)
                    from kokoro_onnx import Kokoro
                    _kokoro = Kokoro(VOICE_MODEL, VOICE_BANK)
                    print('  voices loaded (%d voices)' % len(_kokoro.get_voices()))
                except Exception as e:
                    _kokoro_err = str(e)
                    print('  voices failed to load: %s' % e)
    return _kokoro


def speak_wav(text, voice, speed):
    k = kokoro()
    if not k:
        raise RuntimeError(_kokoro_err or 'voices are not installed: run Install voices.bat')
    voices = k.get_voices()
    if voice not in voices:
        voice = 'bm_george' if 'bm_george' in voices else voices[0]
    lang = 'en-gb' if voice[:1] == 'b' else 'en-us'
    with _kokoro_lock:   # one voice at a time keeps the processor free for everything else
        audio, rate = k.create(text, voice=voice, speed=speed, lang=lang)
    import numpy as np
    pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype('<i2').tobytes()
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    return buf.getvalue()


def install_voices():
    import subprocess, urllib.request as ur
    os.makedirs(VOICE_DIR, exist_ok=True)
    print('Step 1 of 3: installing the voice engine (about 80 MB)...')
    r = subprocess.call([sys.executable, '-m', 'pip', 'install', '--upgrade', '--target', VOICE_LIB, 'kokoro-onnx'])
    if r != 0:
        print('pip could not install kokoro-onnx (code %s).' % r); return 1
    for i, (name, path) in enumerate([('voices-v1.0.bin', VOICE_BANK), ('kokoro-v1.0.onnx', VOICE_MODEL)], 2):
        if os.path.isfile(path) and os.path.getsize(path) > 1_000_000:
            print('Step %d of 3: %s already downloaded.' % (i, name)); continue
        for base in VOICE_URLS:
            try:
                print('Step %d of 3: downloading %s...' % (i, name))
                tmp = path + '.part'
                with ur.urlopen(ur.Request(base + name, headers={'User-Agent': UA}), timeout=60) as resp, open(tmp, 'wb') as f:
                    total = int(resp.headers.get('Content-Length') or 0); got = 0
                    while True:
                        chunk = resp.read(1 << 20)
                        if not chunk: break
                        f.write(chunk); got += len(chunk)
                        if total: print('\r  %d of %d MB' % (got >> 20, total >> 20), end='', flush=True)
                print()
                os.replace(tmp, path); break
            except Exception as e:
                print('  download failed from %s: %s' % (base, e))
        else:
            return 1
    print('Testing a voice...')
    try:
        data = speak_wav('The tavern door creaks open.', 'bm_george', 1.0)
        print('Voices are ready (%d KB test clip). Restart the picture helper to use them.' % (len(data) >> 10))
        return 0
    except Exception as e:
        print('The voice test failed: %s' % e); return 1


def allowed(origin):
    # exact host match: a prefix test would also let in sites like http://localhost.evil.example
    if origin.rstrip('/') in ALLOWED:
        return True
    try:
        u = urllib.parse.urlparse(origin)
        return u.scheme in ('http', 'https') and u.hostname in ('localhost', '127.0.0.1') and not u.path.strip('/')
    except ValueError:
        return False


class _PublicOnlyRedirects(urllib.request.HTTPRedirectHandler):
    # a public page must not be able to redirect the reader onto this PC or the home network
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not public_url(newurl):
            raise urllib.error.HTTPError(newurl, 403, 'redirect to a private address blocked', headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_public_opener = urllib.request.build_opener(_PublicOnlyRedirects)


def fetch(url, data=None, timeout=20, headers=None, limit=MAX_PAGE, public=False):
    h = {'User-Agent': UA, 'Accept-Encoding': 'identity', 'Accept-Language': 'en-US,en;q=0.9'}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    with (_public_opener.open if public else urllib.request.urlopen)(req, timeout=timeout) as r:
        raw = r.read(limit)
        charset = r.headers.get_content_charset() or 'utf-8'
        return r.status, raw.decode(charset, errors='replace'), r.headers.get('Content-Type', '')


def public_url(url):
    """Only plain http(s) pages on the public internet: never this PC or the home network."""
    try:
        u = urllib.parse.urlparse(url)
        if u.scheme not in ('http', 'https') or not u.hostname:
            return False
        for info in socket.getaddrinfo(u.hostname, u.port or (443 if u.scheme == 'https' else 80)):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
                return False
        return True
    except Exception:
        return False


# ---------------- search ----------------
def search_searxng(q, n):
    st, body, _ = fetch(SEARXNG + '/search?' + urllib.parse.urlencode({'q': q, 'format': 'json', 'language': 'en'}), timeout=15)
    j = json.loads(body)
    out = [{'title': r.get('title', ''), 'url': r.get('url', ''), 'snippet': r.get('content', '')} for r in j.get('results', []) if r.get('url')]
    return out[:n]


def search_ddg(q, n):
    st, body, _ = fetch('https://html.duckduckgo.com/html/', data=urllib.parse.urlencode({'q': q, 'kl': 'us-en'}).encode(), timeout=15,
                        headers={'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://html.duckduckgo.com/'})
    out = []
    for m in re.finditer(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>(.*?)(?=<a[^>]+class="result__a"|$)', body, re.S):
        href, title, rest = m.group(1), m.group(2), m.group(3)
        if 'uddg=' in href:
            href = urllib.parse.unquote(urllib.parse.parse_qs(urllib.parse.urlparse(html.unescape(href)).query).get('uddg', [''])[0])
        if href.startswith('//'):
            href = 'https:' + href
        if not href.startswith('http') or 'duckduckgo.com/y.js' in href:
            continue
        sn = re.search(r'class="result__snippet"[^>]*>(.*?)</a>', rest, re.S)
        clean = lambda s: html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()
        out.append({'title': clean(title), 'url': href, 'snippet': clean(sn.group(1) if sn else '')})
        if len(out) >= n:
            break
    return out


def search_wikipedia(q, n):
    st, body, _ = fetch('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'list': 'search', 'srsearch': q, 'srlimit': n, 'format': 'json'}), timeout=15)
    j = json.loads(body)
    return [{'title': r['title'], 'url': 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(r['title'].replace(' ', '_')),
             'snippet': html.unescape(re.sub(r'<[^>]+>', '', r.get('snippet', '')))} for r in j.get('query', {}).get('search', [])]


def search(q, n):
    for name, fn in (('searxng', search_searxng), ('duckduckgo', search_ddg), ('wikipedia', search_wikipedia)):
        try:
            res = fn(q, n)
            if res:
                return name, res
        except Exception as e:
            print('  search via %s failed: %s' % (name, e))
    return 'none', []


def searxng_up():
    try:
        st, body, _ = fetch(SEARXNG + '/search?' + urllib.parse.urlencode({'q': 'test', 'format': 'json'}), timeout=5)
        return st == 200 and body.strip().startswith('{')
    except Exception:
        return False


def forge_up():
    try:
        st, _, _ = fetch(FORGE + '/sdapi/v1/sd-models', timeout=4)
        return st == 200
    except Exception:
        return False


# ---------------- page reading ----------------
SKIP = {'script', 'style', 'noscript', 'svg', 'nav', 'header', 'footer', 'aside', 'form', 'button', 'select', 'iframe', 'figure', 'sup', 'table'}
BLOCK = {'p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'section', 'article', 'blockquote', 'dd', 'dt'}


class Text(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip, self.title, self.in_title = [], 0, '', False

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self.skip += 1
        if tag == 'title':
            self.in_title = True
        if tag in BLOCK:
            self.parts.append('\n')
        if tag in ('h1', 'h2', 'h3') and not self.skip:
            self.parts.append('## ')

    def handle_endtag(self, tag):
        if tag in SKIP and self.skip:
            self.skip -= 1
        if tag == 'title':
            self.in_title = False
        if tag in BLOCK:
            self.parts.append('\n')

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        elif not self.skip:
            self.parts.append(data)


def readable(page_html):
    tm = re.search(r'<title[^>]*>(.*?)</title>', page_html, re.S | re.I)
    page_title = html.unescape(tm.group(1)).strip() if tm else ''
    i = page_html.find('mw-parser-output')          # Wikipedia / fan wikis: start at the article body
    if i > 0:
        page_html = page_html[page_html.rfind('<', 0, i):]
    else:
        m = re.search(r'<(main|article)\b', page_html, re.I)
        if m:
            page_html = page_html[m.start():]
    p = Text()
    try:
        p.feed(page_html)
    except Exception:
        pass
    text = ''.join(p.parts)
    text = re.sub(r'\[\s*(?:\d+|edit|citation needed)\s*\]', '', text)
    text = re.sub(r'[ \t\r\f\v]+', ' ', text)
    lines = [l.strip() for l in text.split('\n')]
    lines = [l for l in lines if len(l) > 2 and l != '##']
    text = re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()
    return (page_title or p.title.strip()), text[:MAX_TEXT]


def read(url):
    m = re.match(r'https?://(\w+)\.wikipedia\.org/wiki/([^#?]+)', url)
    if m:   # clean plain text straight from Wikipedia
        lang, title = m.group(1), urllib.parse.unquote(m.group(2))
        st, body, _ = fetch('https://%s.wikipedia.org/w/api.php?' % lang + urllib.parse.urlencode(
            {'action': 'query', 'prop': 'extracts', 'explaintext': 1, 'redirects': 1, 'titles': title, 'format': 'json'}))
        pages = json.loads(body).get('query', {}).get('pages', {})
        for pg in pages.values():
            if pg.get('extract'):
                return pg.get('title', title), pg['extract'][:MAX_TEXT]
    st, body, ctype = fetch(url, public=True)
    if 'html' not in ctype and 'xml' not in ctype and not body.lstrip().startswith('<'):
        return url, body[:MAX_TEXT]
    return readable(body)


# ---------------- server ----------------
class Helper(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def cors(self):
        origin = self.headers.get('Origin') or ''
        if origin and allowed(origin):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', self.headers.get('Access-Control-Request-Headers') or 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '600')

    def reply(self, code, data, ctype='application/json'):
        if not isinstance(data, (bytes, bytearray)):
            data = json.dumps(data).encode()
        self.send_response(code)
        self.cors()
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def ironquill(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path == '/iq/health':
            return self.reply(200, {'ok': True, 'helper': 3, 'forge': forge_up(), 'searxng': searxng_up(), 'tts': voices_installed()})
        if u.path == '/iq/tts' and self.command == 'POST':
            try:
                length = int(self.headers.get('Content-Length') or 0)
                req = json.loads(self.rfile.read(min(length, 20000)) or b'{}')
                text = re.sub(r'\s+', ' ', str(req.get('text') or '')).strip()[:1500]
                if not text:
                    return self.reply(400, {'error': 'no text'})
                speed = max(0.6, min(1.6, float(req.get('speed') or 1.0)))
                return self.reply(200, speak_wav(text, str(req.get('voice') or 'bm_george'), speed), 'audio/wav')
            except Exception as e:
                return self.reply(503, {'error': str(e)})
        if u.path == '/iq/search':
            term = (q.get('q') or [''])[0].strip()
            if not term:
                return self.reply(400, {'error': 'missing q'})
            try:
                n = max(1, min(10, int((q.get('n') or ['6'])[0] or 6)))
            except ValueError:
                n = 6
            engine, res = search(term, n)
            print('  search [%s] %s -> %d results' % (engine, term[:60], len(res)))
            return self.reply(200, {'engine': engine, 'results': res})
        if u.path == '/iq/read':
            url = (q.get('url') or [''])[0].strip()
            if not public_url(url):
                return self.reply(400, {'error': 'only public web pages can be read'})
            try:
                title, text = read(url)
                print('  read %s (%d chars)' % (url[:70], len(text)))
                return self.reply(200, {'title': title, 'url': url, 'text': text})
            except Exception as e:
                return self.reply(502, {'error': 'could not read the page: %s' % e})
        return self.reply(404, {'error': 'unknown'})

    def forward(self, method):
        # check every request, Forge's too: otherwise any website open in your browser could
        # send commands to Forge through this helper (it would just not see the answer)
        origin = self.headers.get('Origin') or ''
        if origin and not allowed(origin):
            return self.reply(403, {'error': 'not allowed'})
        if self.path.startswith('/iq/'):
            return self.ironquill()
        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(FORGE + self.path, data=body, method=method,
                                     headers={'Content-Type': self.headers.get('Content-Type', 'application/json')})
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                code, data, ctype = r.status, r.read(), r.headers.get('Content-Type', 'application/json')
        except urllib.error.HTTPError as e:
            code, data, ctype = e.code, e.read(), e.headers.get('Content-Type', 'text/plain')
        except Exception as e:
            code, data, ctype = 502, ('Forge is not running or not ready yet: %s' % e).encode(), 'text/plain'
        self.reply(code, data, ctype)

    def do_GET(self):
        self.forward('GET')

    def do_POST(self):
        self.forward('POST')

    def log_message(self, fmt, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    if '--install-voices' in sys.argv:
        code = install_voices()
        sys.exit(code)
    try:
        srv = Server(('127.0.0.1', PORT), Helper)
    except OSError as e:
        print('Could not start the helper on port %d (%s). Is it already running in another window?' % (PORT, e))
        sys.exit(1)
    print('Outer Realm helper is running (pictures, research and voices).')
    print('  Ironquill (this PC):  http://localhost:%d' % PORT)
    print('  Pictures:             %s (Forge) %s' % (FORGE, 'found' if forge_up() else '- not running yet'))
    print('  Web search:           %s' % ('SearXNG at ' + SEARXNG if searxng_up() else 'DuckDuckGo (SearXNG not running), Wikipedia as backup'))
    print('  Voices:               %s' % ('ready (Kokoro)' if voices_installed() else 'not installed (run Install voices.bat for natural voices)'))
    print('Keep this window open (minimize it). Close it to stop the helper.')
    if voices_installed():
        threading.Thread(target=kokoro, daemon=True).start()   # warm up so the first line is quick
    srv.serve_forever()
