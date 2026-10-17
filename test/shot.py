import asyncio, os, sys, threading, http.server, functools, socketserver
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start(); URL = 'http://127.0.0.1:%d/index.html' % srv.server_address[1]
OUT = '/workspace/sdshots/'; os.makedirs(OUT, exist_ok=True); TAG = sys.argv[1] if len(sys.argv) > 1 else 'a'
VPS = [('desk', {'width': 1280, 'height': 800}), ('mob', {'width': 390, 'height': 844})]
if len(sys.argv) > 2: VPS = [v for v in VPS if v[0] == sys.argv[2]]
BOT = '''(n) => { for (let i = 0; i < n; i++) { const x = __sd.next(); if (x && x.t - __sd.S.songT < .02) __sd.press(x.lane); __sd.stepq(1/30); } __sd.step(1/30); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for name, vp in VPS:
            ctx = await b.new_context(viewport=vp); await ctx.add_init_script("window.__sdSeed=7;window.__sdNoAutoQ=true;localStorage.setItem('sd-q','high')")
            pg = await ctx.new_page(); pg.set_default_timeout(240000); logs = []
            pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: logs.append(str(e)))
            await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready")'); await pg.evaluate('window.__sdManual=true; __sd.stepq(1/30,59); __sd.step(1/30)')
            await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + f'{TAG}-{name}-menu.png')
            await pg.evaluate('localStorage.clear()'); await pg.click('#btnPlay'); await pg.wait_for_timeout(300); await pg.evaluate('__sd.stepq(1/30,74); __sd.step(1/30)')
            await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + f'{TAG}-{name}-play0.png')
            await pg.evaluate(f'({BOT})(240)'); await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + f'{TAG}-{name}-play1.png')
            await pg.evaluate(f'({BOT})(240)'); await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + f'{TAG}-{name}-play2.png')
            await pg.evaluate(f'({BOT})(420)'); await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + f'{TAG}-{name}-play3.png')
            await pg.evaluate('__sd.end(); __sd.stepq(1/30,59); __sd.step(1/30)'); await pg.wait_for_timeout(500)
            await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + f'{TAG}-{name}-end.png')
            print(name, await pg.evaluate('[__sd.S.state, __sd.S.score, __sd.S.combo]'), logs[:4]); await ctx.close()
        await b.close()
asyncio.run(main())
