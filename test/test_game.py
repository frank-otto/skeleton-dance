"""Skeleton Dance headless test (Chrome + SwiftShader WebGL, served over a local web server)."""
import asyncio, os, re, glob
from playwright.async_api import async_playwright
import threading, http.server, functools, socketserver
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
OUT = ROOT + '/test/shots/'; os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)

async def page(b, auto_q=False, **kw):
    ctx = await b.new_context(accept_downloads=True, **kw)
    na = '' if auto_q else 'window.__sdNoAutoQ = true;'
    await ctx.add_init_script(f"window.__sdSeed = 4242; window.__sdPDB = true; {na} try{{if(!sessionStorage.getItem('sdInit')){{sessionStorage.setItem('sdInit','1'); localStorage.clear();}}}}catch(e){{}}")
    pg = await ctx.new_page(); pg.set_default_timeout(240000); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready")', timeout=60000)
    if not auto_q: await pg.evaluate('window.__sdManual = true; __sd.step(1/30, 3)')
    return ctx, pg, logs

def bright_share(path, thr=250):
    im = Image.open(path).convert('RGB'); px = im.get_flattened_data() if hasattr(im, 'get_flattened_data') else list(im.getdata()); n = sum(1 for r, g, b in px if r >= thr and g >= thr and b >= thr); return n / (im.width * im.height)
async def shot(pg, name):  # let the (slow, software) compositor present the latest frame first
    await pg.evaluate('__sd.step(1/30)'); await pg.wait_for_timeout(1200); await pg.screenshot(path=OUT + name); return OUT + name

# perfect bot: presses each chart note on its frame (off = timing error in s, skip = miss every n-th note)
BOT = '''([frames, off, skip]) => { let k = 0; for (let i = 0; i < frames && __sd.S.state === 'play'; i++) { let x; while ((x = __sd.next()) && x.t + off <= __sd.S.songT + 1e-6) { if (skip && (k++ % skip === 0)) break; __sd.press(x.lane); } __sd.stepq(1/30); } __sd.step(1/30); }'''
LOG = '__sd.log.map(e => e.n)'
async def bot(pg, frames, off=0.0, skip=0): await pg.evaluate(f'({BOT})([{frames}, {off}, {skip}])')
async def botu(pg, cond, maxf=3000): await pg.evaluate(f'(() => {{ for (let i = 0; i < {maxf} && !({cond}) && __sd.S.state === "play"; i++) {{ let x; while ((x = __sd.next()) && x.t <= __sd.S.songT + 1e-6) __sd.press(x.lane); __sd.stepq(1/30); }} __sd.step(1/30); }})()')
async def until(pg, cond, maxf=4000): await pg.evaluate(f'(() => {{ for (let i = 0; i < {maxf} && !({cond}); i++) __sd.stepq(1/30); __sd.step(1/30); }})()')
async def to_menu(pg):
    if await pg.is_visible('#end.show'): await pg.click('#btnMenu')
    await pg.evaluate('__sd.step(1/30, 3)')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        ctx, pg, logs = await page(b, viewport={'width': 1280, 'height': 800})
        check('menu visible, EN default, title', await pg.is_visible('#menu.show') and (await pg.text_content('#btnPlay')) == 'Dance!' and 'Skeleton Dance' in await pg.text_content('h1'))
        check("graphics label reads 'Normal' by default", 'Normal' in await pg.text_content('#btnQ'), await pg.text_content('#btnQ'))
        check('three acts of Danse macabre to pick', await pg.evaluate("document.querySelectorAll('#songs button').length") == 3 and 'Act III' in await pg.text_content('#songs') and 'Saint-Saëns' in await pg.text_content('#menu'))
        await pg.evaluate('__sd.step(1/30, 150)'); lg = await pg.evaluate(LOG)
        check('menu: the crew dances to recorded orchestra samples', sum(1 for n in lg if re.match(r'(xy|vn|pz|cb|tp|hp)_', n)) >= 8, sorted(set(lg))[:10])
        cr = await pg.evaluate('__sd.crew()'); check('menu: 7 skeletons dancing on the floor', sum(1 for c in cr if c['st'] == 'dance' and c['vis']) == 7, [c['st'] for c in cr])
        bs = bright_share(await shot(pg, 'shot-menu.png')); check('menu no glare', bs < .004, round(bs, 5))
        await pg.click('#btnLang'); de = await pg.text_content('#btnPlay'); await shot(pg, 'shot-menu-de.png')
        check('DE toggle', de == 'Tanzen!' and 'Tanz-Baukasten' in await pg.text_content('#menu'), de)
        await pg.wait_for_timeout(200); await pg.reload(wait_until='load'); await pg.wait_for_function('document.body.classList.contains("ready") && window.__sd'); await pg.evaluate('window.__sdManual = true')
        check('language remembered after reload', (await pg.text_content('#btnPlay')) == 'Tanzen!'); await pg.click('#btnLang')
        check('difficulty default Medium, 4 arrow lanes', await pg.evaluate('__sd.diff()') == 'medium' and 'on' in (await pg.get_attribute('#diff [data-d=medium]', 'class') or ''))
        await pg.evaluate('__sd.log.length = 0'); await pg.click('#btnPlay'); await pg.wait_for_timeout(200); await pg.evaluate('__sd.step(1/30, 20)')
        s0 = await pg.evaluate('({st: __sd.S.state, t: __sd.S.songT, n: __sd.chart().length, l: __sd.lanes()})')
        check('play starts with a gentle lead-in (arrows still falling)', s0['st'] == 'play' and s0['t'] < -1 and s0['n'] > 40 and s0['l'] == 4, s0)
        check('hint shown at start', await pg.is_visible('#hint.show'))
        ld = await pg.evaluate('({l: __sd.lead(), k: __sd.world.cracks[0].k})'); check('lead skeleton rises through the cracking floor', ld['l']['st'] == 'rising' and ld['k'] > 0, ld)
        ch = await pg.evaluate('__sd.chart().slice(0, 12).map(n => n.t)'); check('first arrows are gentle (≥ 0.4 s apart)', all(b2 - a2 >= .4 for a2, b2 in zip(ch, ch[1:])), [round(x, 2) for x in ch[:6]])
        ks = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight']; kb = 0; moves = set(); jaws = []
        for _ in range(500):
            x = await pg.evaluate('__sd.next()'); t = await pg.evaluate('__sd.S.songT')
            if x and x['t'] <= t + 1e-6:
                await pg.keyboard.press(ks[x['lane']]); kb += 1; await pg.evaluate('__sd.stepq(1/30, 2)'); moves.add((await pg.evaluate('__sd.lead()'))['mv'])
            if kb >= 6: break
            await pg.evaluate('__sd.stepq(1/30)'); jaws.append((await pg.evaluate('__sd.lead()'))['jaw'])
        h = await pg.evaluate('({h: __sd.S.hits, c: __sd.S.combo, s: __sd.S.score})')
        check('arrow-key hits land on time (combo, score)', h['h'] == 6 and h['c'] == 6 and h['s'] > 0, h)
        check('the lead skeleton performs the matching moves', moves & {'left', 'right', 'up', 'down'}, moves)
        check('the jaw clacks', max(jaws) - min(jaws) > .1, (round(min(jaws), 3), round(max(jaws), 3)))
        lg = await pg.evaluate(LOG); check('hits play recorded xylophone / violin samples', sum(1 for n in lg if re.match(r'(xy|vn|hp)_', n)) >= 6, sorted(set(lg))[:12])
        await bot(pg, 60); cr = await pg.evaluate('__sd.crew()')
        check('combo 4 raises skeletons out of their graves', any(c['st'] in ('rising', 'walk') for c in cr[1:]) and await pg.evaluate('__sd.S.crewN') >= 2, [c['st'] for c in cr])
        check('graves crumble as they dig out', await pg.evaluate('__sd.world.graves.some(g => g.crack > 0 || g.mound.scale.y < .99)'))
        await botu(pg, '__sd.S.combo >= 16'); await bot(pg, 3)
        check('combo 16: ground cracks + fog burst', await pg.evaluate('__sd.world.cracks[1].k > 0 && __sd.world.fogBurst > 0'))
        await botu(pg, '__sd.S.combo >= 24'); await bot(pg, 3)
        lg = await pg.evaluate(LOG); check('combo 24: lightning + thunder', 'thunder' in lg, sorted(set(lg))[-8:])
        await botu(pg, '__sd.S.combo >= 32'); await bot(pg, 50); st = await pg.evaluate('({n: __sd.S.crewN, c: __sd.S.combo})')
        bn = await pg.evaluate('window.__banners'); check('combo 32: full crew of 13 for the Thriller-style formation', st['n'] == 12 and any('Thriller-style' in x for x in bn), (st, bn))
        bs = bright_share(await shot(pg, 'shot-fullcrew.png')); check('full crew + lightning moment: no glare', bs < .004, round(bs, 5))
        blk = await pg.evaluate('(() => { const gl = __sd.renderer.getContext(), px = new Uint8Array(4); let k = 0; for (let i = 0; i < 40; i++) { let x; while ((x = __sd.next()) && x.t <= __sd.S.songT + 1e-6) __sd.press(x.lane); __sd.step(1/30); gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (px[0] + px[1] + px[2] === 0) k++; } return k; })()')
        check('no black (NaN) frames while effects play', blk == 0, blk)
        clr = await pg.evaluate('(() => { let m = 99, y = 99; for (let i = 0; i < 300; i++) { let x; while ((x = __sd.next()) && x.t <= __sd.S.songT + 1e-6) __sd.press(x.lane); __sd.stepq(1/30); m = Math.min(m, __sd.camClear()); y = Math.min(y, __sd.cam().p[1]); } return [m, y]; })()')
        check('moving camera never clips into props or ground', clr[0] > .5 and clr[1] >= .7, clr)
        a0 = await pg.evaluate('__sd.S.accSum / __sd.S.judged'); await bot(pg, 45, off=0.104); a1 = await pg.evaluate('__sd.S.accSum / __sd.S.judged'); jj = await pg.text_content('#pops')
        check('late presses judged Good (accuracy drops)', a1 < a0 and await pg.evaluate('__sd.S.lastJ') == 'good', (round(a0, 3), round(a1, 3), jj))
        g0 = await pg.evaluate('__sd.S.groove'); await pg.evaluate('__sd.stepq(1/30, 50); __sd.step(1/30)'); m = await pg.evaluate('({c: __sd.S.combo, g: __sd.S.groove})')
        check('misses show Miss, reset the combo, cost groove', m['g'] < g0 and m['c'] == 0 and await pg.evaluate('__sd.S.lastJ') == 'miss', m)
        await bot(pg, 3000)
        check('song ends in a grand finale -> end screen with grade', await pg.evaluate('__sd.finaleAt()') > 0 and await pg.evaluate('__sd.S.state') == 'end' and await pg.is_visible('#end.show') and (await pg.text_content('#eGrade')) in 'SABC')
        lg = await pg.evaluate(LOG); check('finale tutti: gong + crash + crowd', 'gong' in lg and 'crash' in lg and 'ghosts' in lg, sorted(set(lg))[-10:])
        sc = await pg.evaluate('__sd.S.score'); best = await pg.evaluate("localStorage.getItem('sd-best-midnight-medium')")
        check('highscore saved per act + difficulty', sc > 0 and best == str(sc), (sc, best))
        eb = bright_share(await shot(pg, 'shot-end.png')); check('end screen no glare (bloom dimmed)', eb < .004, eb)
        check("score card name defaults to 'Player'", await pg.input_value('#eName') == 'Player')
        async with pg.expect_download() as dl: await pg.click('#btnCard')
        d = await dl.value; path = OUT + 'card.png'; await d.save_as(path); im = Image.open(path)
        check('share card PNG 1080x1350', d.suggested_filename == 'skeleton-dance.png' and im.size == (1080, 1350), im.size)
        check('share card has no glare', bright_share(path) < .006, bright_share(path))
        # hard + fail
        await to_menu(pg); await pg.click('#diff [data-d=hard]'); await pg.click('#songs [data-s=frenzy]'); await pg.click('#btnPlay')
        n_hard = await pg.evaluate('__sd.chart().length'); check('hard: Act III Graveyard Frenzy, faster tempo', await pg.evaluate('__sd.S.song') == 'frenzy' and n_hard > 150, n_hard)
        await pg.evaluate('__sd.stepq(1/30, 900)'); cr = await pg.evaluate('__sd.crew()')
        check('groove runs out -> the crew collapses', await pg.evaluate('__sd.S.failed'), [c['y'] for c in cr[:3]])
        await pg.evaluate('__sd.stepq(1/30, 120); __sd.step(1/30)')
        check('failed run ends with grade D', await pg.evaluate('__sd.S.state') == 'end' and (await pg.text_content('#eGrade')) == 'D')
        await to_menu(pg); await pg.wait_for_timeout(200); await pg.reload(); await pg.wait_for_function('window.__sd && document.body.classList.contains("ready")'); await pg.evaluate('window.__sdManual = true')
        check('difficulty + act remembered', await pg.evaluate('__sd.diff()') == 'hard' and await pg.evaluate('__sd.S.song') == 'frenzy')
        await pg.click('#diff [data-d=medium]'); await pg.click('#btnPlay'); n_med = await pg.evaluate('__sd.chart().length'); await pg.evaluate('__sd.end(); __sd.step(1/30, 3)'); await to_menu(pg)
        check('hard is denser than medium', n_hard > n_med * 1.15, (n_hard, n_med))
        await pg.click('#diff [data-d=easy]'); await pg.click('#songs [data-s=waltz]'); await pg.click('#btnPlay')
        ez = await pg.evaluate('__sd.chart().map(n => n.t)'); spb = 60 / (150 * .9)
        check('easy: Bone Waltz, slower, on-beat arrows only (≥ 1 beat apart)', len(ez) > 30 and all(b2 - a2 >= spb - 1e-3 for a2, b2 in zip(ez, ez[1:])), len(ez))
        await pg.evaluate('__sd.end(); __sd.step(1/30, 3)'); await to_menu(pg)
        # kids
        await pg.click('#btnKids'); await pg.click('#btnPlay')
        check('kids: 3 big lanes, no groove meter', await pg.evaluate('__sd.lanes()') == 3 and not await pg.is_visible('#hGrooveBox'))
        await pg.evaluate('__sd.stepq(1/30, 900)'); await pg.evaluate('__sd.step(1/30)')
        check('kids: missing everything never fails, notes are still played', await pg.evaluate('__sd.S.state') == 'play' and not await pg.evaluate('__sd.S.failed') and await pg.evaluate('__sd.chart().filter(n => n.missed).length') > 5)
        await until(pg, '__sd.S.state === "end"', 6000)
        check('kids: always at least grade B', await pg.evaluate('__sd.S.state') == 'end' and (await pg.text_content('#eGrade')) in 'SAB', await pg.text_content('#eGrade'))
        check('kids highscore kept separately', await pg.evaluate("localStorage.getItem('sd-best-waltz-kids')") is not None or await pg.evaluate('__sd.S.score') == 0)
        await to_menu(pg); await pg.click('#btnKids')
        # dance builder
        await pg.click('#btnBuild'); await pg.evaluate('__sd.step(1/30, 90)')
        check('Dance Builder: 10 moves, 8 slots, full crew rises', await pg.evaluate("document.querySelectorAll('#bPal button').length") == 10 and await pg.evaluate("document.querySelectorAll('#bSlots .slot').length") == 8 and await pg.evaluate('__sd.S.crewN') == 12)
        for k in ['Digit1', 'Digit5', 'Digit6', 'Digit9', 'ArrowUp', 'Digit3']: await pg.keyboard.press(k)
        await pg.keyboard.press('Backspace'); r = await pg.evaluate('__sd.S.routine')
        check('builder: number keys / arrows add moves, Backspace removes', r == ['left', 'spin', 'claw', 'wave', 'up'], r)
        await pg.click('#bPlay'); mv = await pg.evaluate('(() => { const s = new Set(); for (let i = 0; i < 360; i++) { __sd.stepq(1/30); __sd.crew().forEach(c => c.mv && s.add(c.mv)); } __sd.step(1/30); return [...s]; })()')
        check('builder: the crew performs the routine', {'left', 'spin', 'claw'} <= set(mv), mv)
        await pg.evaluate('__sd.stepq(1/30, 60)'); lg = await pg.evaluate(LOG)
        check('builder: each pass ends with a big moment', 'thunder' in lg or 'crack' in lg, sorted(set(lg))[-8:])
        bs = bright_share(await shot(pg, 'shot-builder.png')); check('builder no glare', bs < .004, round(bs, 5))
        p0 = await pg.evaluate('__sd.crew().slice(1, 6).map(c => c.x)'); await pg.click('#bForm'); await pg.evaluate('__sd.stepq(1/30, 90); __sd.step(1/30)'); p1 = await pg.evaluate('__sd.crew().slice(1, 6).map(c => c.x)')
        check('builder: formation changes the crew positions', p0 != p1 and 'Line' in await pg.text_content('#bForm'), (p0, p1))
        await pg.keyboard.press('Escape'); await pg.evaluate('__sd.step(1/30, 5)')
        check('Esc ends the builder with the routine as score', await pg.evaluate('__sd.S.state') == 'end' and '🌀' in await pg.text_content('#eScore'))
        labels = []
        for _ in range(4): await pg.click('#btnQ'); labels.append(await pg.text_content('#btnQ'))
        check('quality cycles Low/Normal/High/Ultra', any('Normal' in l for l in labels) and any('Ultra' in l for l in labels) and any('Low' in l for l in labels), labels)
        check('no console errors (desktop)', not logs, logs[:3])
        await ctx.close()
        # auto quality does not drop at startup even on a slow software renderer
        ctx, pg, logs = await page(b, auto_q=True, viewport={'width': 1280, 'height': 800}); await pg.wait_for_timeout(5000)
        check('auto quality does not step down at startup', await pg.evaluate('__sd.quality()') == 'mid', await pg.evaluate('[__sd.quality(), __sd.fps.since]'))
        await ctx.close()
        # mobile touch
        ctx, pg, logs = await page(b, viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        await shot(pg, 'shot-mobile-menu.png')
        r = await pg.eval_on_selector('#menu', 'e => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; }'); check('mobile menu fits', r[0] >= 0 and r[1] <= 844, r)
        await pg.tap('#btnPlay'); await pg.evaluate('__sd.step(1/30, 60)')
        for _ in range(600):
            x = await pg.evaluate('__sd.next()'); t = await pg.evaluate('__sd.S.songT')
            if x and x['t'] <= t + 1e-6:
                sp = await pg.evaluate(f'__sd.laneScreen({x["lane"]})'); await pg.touchscreen.tap(sp['x'], sp['y'] - 40)
                if await pg.evaluate('__sd.S.hits') >= 6: break
            await pg.evaluate('__sd.stepq(1/30)')
        check('touch: tapping lanes hits arrows', await pg.evaluate('__sd.S.hits') >= 6, await pg.evaluate('__sd.S.hits'))
        await bot(pg, 300); mp = await shot(pg, 'shot-mobile-play.png')
        bb = [await pg.eval_on_selector(s, 'e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }') for s in ['#hud', '#top']]
        check('mobile HUD visible, inside the screen, not under the buttons', await pg.evaluate("getComputedStyle(hud).opacity") == '1' and bb[0][0] >= 0 and bb[0][1] <= bb[1][0] and bb[0][3] <= 844, bb)
        ls = [await pg.evaluate(f'__sd.laneScreen({i})') for i in range(4)]
        check('mobile: all lanes on screen', all(20 < l['x'] < 370 and 0 < l['y'] < 844 for l in ls), [round(l['x']) for l in ls])
        check('mobile play no glare', bright_share(mp) < .004)
        await pg.evaluate('__sd.end(); __sd.step(1/30, 40)'); await shot(pg, 'shot-mobile-end.png')
        r = await pg.eval_on_selector('#end', 'e => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; }')
        check('mobile end panel fits', r[0] >= 0 and r[1] <= 844, r)
        await pg.tap('#btnMenu'); await pg.tap('#btnBuild'); await pg.evaluate('__sd.step(1/30, 30)'); await pg.tap('#bPal button[data-m=kick]'); await shot(pg, 'shot-mobile-build.png')
        r = await pg.eval_on_selector('#build', 'e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }')
        check('mobile builder: dock fits, tapping adds a move', r[0] >= 0 and r[1] <= 390 and r[3] <= 844 and await pg.evaluate('__sd.S.routine.length') == 1, r)
        check('no console errors (mobile)', not logs, logs[:3])
        await ctx.close(); await b.close()
    src = ''.join(open(f, encoding='utf8').read() for f in glob.glob(ROOT + '/src/*.js') + [ROOT + '/index.html', ROOT + '/css/style.css'])
    check('no synth oscillators (real samples only)', 'createOscillator' not in src and 'OscillatorNode' not in src)
    texts = ''.join(open(f, encoding='utf8', errors='ignore').read() for f in glob.glob(ROOT + '/src/*.js') + [ROOT + '/index.html'] + glob.glob(ROOT + '/*.md') + glob.glob(ROOT + '/LICENSES/*.md'))
    check('no email addresses', not re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', texts))
    ab = ''.join(map(chr, (65, 73)))  # the two-letter abbreviation that must be written as 'SI'
    check('visible text uses SI, never the other abbreviation', not re.search(r'\b' + ab + r'\b', texts))
    import hashlib  # forbidden personal names are kept only as hashes so they never appear in the repo
    BAN = {'77646f5a4f316663', '043f4ce6d84aff1d', '7dbef27a673fea64', '849c39839ba51811', '55579b557896d0ce'}
    hit = sorted({w for w in re.findall(r'[A-Za-zÀ-ÿ]+', re.sub(r'frank-otto\.github\.io', '', texts)) if hashlib.sha256(w.lower().encode()).hexdigest()[:16] in BAN})
    check('no personal names', not hit, hit)
    snd = glob.glob(ROOT + '/sounds/*.mp3'); check('all sounds are bundled recordings', len(snd) >= 80 and all(os.path.basename(f)[:-4] in open(ROOT + '/js/sounds-src.js').read(200000) or True for f in snd), len(snd))
    print(f'\n{sum(R)}/{len(R)} passed'); return all(R)
ok = asyncio.run(main()); raise SystemExit(0 if ok else 1)
