import os, asyncio, re, traceback
from urllib.parse import quote_plus
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

app=FastAPI(title='StartAuto RIV Worker')
lock=asyncio.Lock()

class SearchRequest(BaseModel):
    article:str

async def authorize(token):
    expected=os.getenv('RIV_WORKER_TOKEN')
    if expected and token != f'Bearer {expected}':
        raise HTTPException(status_code=401,detail='UNAUTHORIZED')

async def close_modals(page):
    try:
        await page.keyboard.press('Escape')
    except:
        pass
    selectors=["button:has-text('×')","[class*='close']",".modal-header button",".popup-close","button:has-text('Закрыть')"]
    for sel in selectors:
        try:
            loc=page.locator(sel).first
            if await loc.is_visible(timeout=400):
                await loc.click(timeout=1000,force=True)
                return
        except:
            pass

async def disable_pointer_overlays(page):
    try:
        return await page.evaluate("""() => {
          let changed=0;
          for (const el of document.querySelectorAll('body *')) {
            const s=getComputedStyle(el);
            const r=el.getBoundingClientRect();
            const z=parseInt(s.zIndex||'0');
            if ((s.position==='fixed'||s.position==='sticky') && z>=20 && r.width>20 && r.height>20) {
              el.dataset.startautoPointerBackup=s.pointerEvents;
              el.style.pointerEvents='none';
              changed++;
            }
          }
          return changed;
        }""")
    except:
        return 0

async def trigger_hover(page,node):
    try:
        await node.scroll_into_view_if_needed(timeout=5000)
    except:
        pass
    try:
        await node.dispatch_event('pointerover')
        await node.dispatch_event('mouseover')
        await node.dispatch_event('mouseenter')
        await node.dispatch_event('mousemove')
        return
    except:
        pass
    try:
        await node.hover(timeout=5000,force=True)
    except PlaywrightTimeoutError:
        pass
    except:
        pass

async def visible_text_candidates(page):
    try:
        return await page.evaluate("""() => {
          const out=[];
          for(const el of document.querySelectorAll('div,span,section,article,td')) {
            const s=getComputedStyle(el),r=el.getBoundingClientRect(),z=parseInt(s.zIndex||'0'),t=(el.innerText||'').trim();
            if(!t||t.length<4) continue;
            if((s.position==='absolute'||s.position==='fixed') && s.display!=='none' && s.visibility!=='hidden' && z>=20 && r.width>40 && r.height>10) out.push(t);
          }
          return Array.from(new Set(out)).slice(0,30);
        }""")
    except:
        return []

async def extract_tooltip(page,nodes):
    for node in nodes:
        try:
            await trigger_hover(page,node)
            await page.wait_for_timeout(900)
        except:
            pass
        for sel in [
            'div.tooltip','div.popover','div[role="tooltip"]','.tooltip-inner',
            '.tippy-content','div[class*="tooltip"]','div[class*="popover"]',
            '[data-radix-popper-content-wrapper]'
        ]:
            try:
                loc=page.locator(sel).filter(has_text=re.compile(r'\S+')).last
                if await loc.is_visible(timeout=500):
                    t=(await loc.inner_text()).strip()
                    if t and len(t)>=4:
                        return t
            except:
                pass
        candidates=await visible_text_candidates(page)
        for t in candidates:
            if len(t)>=8 and ('год' in t.lower() or 'двиг' in t.lower() or 'кузов' in t.lower() or 'oem' in t.lower() or 'toyota' in t.lower() or 'nissan' in t.lower()):
                return t
        for attr in ('title','data-original-title','aria-label'):
            try:
                t=(await node.get_attribute(attr) or '').strip()
                if t:
                    return t
            except:
                pass
    return None

async def card_text(page,node):
    try:
        return (await node.evaluate("""el => {
          const candidates=[
            el.closest('a'),el.closest('article'),el.closest('li'),
            el.closest('[class*="card"]'),el.closest('[class*="product"]'),
            el.parentElement,el
          ].filter(Boolean);
          for(const c of candidates){
            const t=(c.innerText||'').trim();
            if(t.length>10) return t;
          }
          return '';
        }""")).strip()
    except:
        return ''

@app.get('/health')
async def health():
    return {'ok':True,'service':'riv-worker'}

@app.post('/search')
async def search(data:SearchRequest,authorization:str|None=Header(default=None)):
    await authorize(authorization)
    article=data.article.strip()
    if not article:
        raise HTTPException(status_code=400,detail='ARTICLE_REQUIRED')
    async with lock:
        browser=None
        try:
            async with async_playwright() as p:
                browser=await p.chromium.launch(headless=os.getenv('RIV_HEADLESS','true').lower()!='false')
                ctx=await browser.new_context(viewport={'width':1366,'height':768})
                page=await ctx.new_page()
                page.set_default_timeout(int(os.getenv('RIV_TIMEOUT_MS','30000')))
                base=os.getenv('RIV_URL','https://riv.kz').rstrip('/')

                await page.goto(base+'/login',wait_until='domcontentloaded')
                await page.wait_for_timeout(1200)
                await close_modals(page)

                login,password=os.getenv('RIV_USERNAME'),os.getenv('RIV_PASSWORD')
                if login and password:
                    inp=page.locator("input[type='text'],input[name='login'],input[name='phone'],input[type='tel']").first
                    if await inp.is_visible(timeout=1500):
                        await inp.fill(login)
                        pwd=page.locator("input[type='password']").first
                        await pwd.fill(password)
                        btn=page.locator("button[type='submit'],button:has-text('Войти')").first
                        await btn.click(force=True)
                        await page.wait_for_timeout(1800)
                        await close_modals(page)

                # RIV search is case-insensitive in practice, but retry with both forms.
                variants=list(dict.fromkeys([article,article.upper(),article.lower()]))
                node=None
                for variant in variants:
                    await page.goto(base+'/catalog?q='+quote_plus(variant),wait_until='domcontentloaded')
                    await page.wait_for_timeout(1500)
                    await close_modals(page)
                    exact=page.locator('span.text-ink').filter(has_text=re.compile('^'+re.escape(variant)+'$')).first
                    if await exact.is_visible(timeout=2000):
                        node=exact
                        break
                    exact=page.get_by_text(variant,exact=True).first
                    if await exact.is_visible(timeout=1500):
                        node=exact
                        break
                    fallback=page.locator('.product-card,.catalog-item,article,table tbody tr').first
                    if await fallback.is_visible(timeout=1000):
                        node=fallback
                        break

                if node is None:
                    print(f'RIV_SEARCH no match article={article} url={page.url}')
                    await browser.close()
                    browser=None
                    return {'found':False,'source':'RIV.KZ','article':article,'compatibility':None,'confidence':0,'reason':'ARTICLE_NOT_FOUND'}

                try:
                    await node.scroll_into_view_if_needed(timeout=5000)
                except:
                    pass

                # Sticky/fixed headers on the current RIV UI can intercept real pointer hover.
                changed=await disable_pointer_overlays(page)
                print(f'RIV_SEARCH article={article} url={page.url} overlay_fix={changed}')

                nodes=[node]
                for sel in ['h1','h2','h3','h4','h5','.title','.name','span.text-ink','p','td']:
                    try:
                        parent=node.locator('xpath=ancestor::*').locator(sel).first
                        if await parent.is_visible(timeout=300):
                            nodes.append(parent)
                    except:
                        pass

                compatibility=await extract_tooltip(page,nodes)
                fallback_text=await card_text(page,node)

                # The card text is still useful when RIV renders compatibility inline rather than in a tooltip.
                if not compatibility and fallback_text and fallback_text.lower().strip()!=article.lower():
                    compatibility=fallback_text

                print(f'RIV_SEARCH result article={article} found={bool(compatibility)} compatibility_len={len(compatibility or "")}')
                await browser.close()
                browser=None
                return {
                    'found':bool(compatibility),
                    'source':'RIV.KZ',
                    'article':article,
                    'compatibility':compatibility,
                    'confidence':90 if compatibility else 0,
                    'page_url':page.url
                }
        except HTTPException:
            raise
        except Exception as e:
            traceback.print_exc()
            if browser:
                try: await browser.close()
                except: pass
            raise HTTPException(status_code=500,detail=str(e))
