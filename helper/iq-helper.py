# Ironquill helper (picture bridge + research)
# Runs on your PC next to Forge. Uses only Python's standard library, so it runs with the Python
# bundled inside Forge. It does three jobs for the Ironquill website:
#   1. Pictures: passes requests through to Forge (port 7860) and adds the CORS header Forge leaves out.
#   2. Search:   /iq/search?q=...  -> SearXNG on this PC if it's running (port 8888),
#                otherwise DuckDuckGo, otherwise Wikipedia.
#   3. Reading:  /iq/read?url=...  -> the readable text of one web page (private/local addresses refused).
# Only the Ironquill website and pages on this PC are allowed to use it.
import os, html
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
ALLOWED = {'https://ironquillstories.netlify.app'}
# Extra web addresses allowed to use this helper: one per line in allowed-sites.txt next to this file
try:
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'allowed-sites.txt'), encoding='utf-8') as f:
        ALLOWED |= {l.strip().rstrip('/') for l in f if l.strip().startswith('https://')}
except OSError:
    pass
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 IronquillHelper/1.0'
MAX_PAGE = 2_500_000   # bytes read from any one web page
MAX_TEXT = 16000       # characters of readable text returned


def allowed(origin):
    return origin in ALLOWED or origin.startswith('http://localhost') or origin.startswith('http://127.0.0.1')


def fetch(url, data=None, timeout=20, headers=None, limit=MAX_PAGE):
    h = {'User-Agent': UA, 'Accept-Encoding': 'identity', 'Accept-Language': 'en-US,en;q=0.9'}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
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
    st, body, ctype = fetch(url)
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
            return self.reply(200, {'ok': True, 'helper': 2, 'forge': forge_up(), 'searxng': searxng_up()})
        if u.path == '/iq/search':
            term = (q.get('q') or [''])[0].strip()
            if not term:
                return self.reply(400, {'error': 'missing q'})
            n = max(1, min(10, int((q.get('n') or ['6'])[0] or 6)))
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
        if self.path.startswith('/iq/'):
            origin = self.headers.get('Origin') or ''
            if origin and not allowed(origin):
                return self.reply(403, {'error': 'not allowed'})
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
    try:
        srv = Server(('127.0.0.1', PORT), Helper)
    except OSError as e:
        print('Could not start the helper on port %d (%s). Is it already running in another window?' % (PORT, e))
        sys.exit(1)
    print('Ironquill helper is running (pictures + research).')
    print('  Ironquill (this PC):  http://localhost:%d' % PORT)
    print('  Pictures:             %s (Forge) %s' % (FORGE, 'found' if forge_up() else '- not running yet'))
    print('  Web search:           %s' % ('SearXNG at ' + SEARXNG if searxng_up() else 'DuckDuckGo (SearXNG not running), Wikipedia as backup'))
    print('Keep this window open (minimize it). Close it to stop the helper.')
    srv.serve_forever()
