import os, asyncio, re, traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from playwright.async_api import async_playwright
app=FastAPI(title='StartAuto RIV Worker')
lock=asyncio.Lock()
class SearchRequest(BaseModel): article:str
async def close_modals(page):
    try: await page.keyboard.press('Escape')
    except: pass
    selectors=["button:has-text('×')","[class*='close']",".modal-header button",".popup-close","button:has-text('Закрыть')"]
    for sel in selectors:
        try:
            loc=page.locator(sel).first
            if await loc.is_visible(timeout=400): await loc.click(timeout=1000); return
        except: pass
async def extract_tooltip(page, hover_node):
    await hover_node.hover();await page.wait_for_timeout(700)
    for sel in ['div.tooltip','div.popover','div[role="tooltip"]','.tooltip-inner','.tippy-content','div[class*="tooltip"]','div[class*="popover"]']:
        try:
            loc=page.locator(sel).first
            if await loc.is_visible(timeout=300):
                t=(await loc.inner_text()).strip()
                if t:return t
        except: pass
    try:
        t=await page.evaluate('''() => {for(const el of document.querySelectorAll('div,span')){const s=getComputedStyle(el);const r=el.getBoundingClientRect();const z=parseInt(s.zIndex||'0');const t=(el.innerText||'').trim();if(t.length>3&&(s.position==='absolute'||s.position==='fixed')&&s.display!=='none'&&s.visibility!=='hidden'&&z>50&&r.width>40&&r.height>10)return t;}return null}''')
        if t:return t.strip()
    except: pass
    try:
        return (await hover_node.get_attribute('title') or await hover_node.get_attribute('data-original-title') or '').strip() or None
    except: return None
@app.post('/search')
async def search(data:SearchRequest):
    async with lock:
        try:
            async with async_playwright() as p:
                browser=await p.chromium.launch(headless=os.getenv('RIV_HEADLESS','true').lower()!='false')
                ctx=await browser.new_context(viewport={'width':1366,'height':768})
                page=await ctx.new_page();page.set_default_timeout(int(os.getenv('RIV_TIMEOUT_MS','30000')))
                await page.goto(os.getenv('RIV_URL','https://riv.kz')+'/login',wait_until='domcontentloaded');await page.wait_for_timeout(800);await close_modals(page)
                login=os.getenv('RIV_USERNAME');password=os.getenv('RIV_PASSWORD')
                if login and password:
                    inp=page.locator("input[type='text'],input[name='login'],input[name='phone']").first
                    if await inp.is_visible():
                        await inp.fill(login);await page.locator("input[type='password']").first.fill(password);await page.locator("button[type='submit'],button:has-text('Войти')").first.click();await page.wait_for_load_state('domcontentloaded');await page.wait_for_timeout(1000);await close_modals(page)
                await page.goto(os.getenv('RIV_URL','https://riv.kz')+f'/catalog?q={data.article}',wait_until='domcontentloaded');await page.wait_for_timeout(1200);await close_modals(page)
                node=page.locator(f"text={data.article}").first
                if not await node.is_visible(): node=page.locator('.product-card,.catalog-item,.card,table tbody tr').first
                if not await node.is_visible(): await page.screenshot(path='/tmp/riv-not-found.png',full_page=True);await browser.close();return {'found':False,'source':'RIV.KZ','article':data.article}
                hover=node.locator('h3,h4,h5,.title,.name,p,span,td').first
                if not await hover.is_visible(): hover=node
                compatibility=await extract_tooltip(page,hover)
                await page.screenshot(path='/tmp/riv-result.png',full_page=True)
                await browser.close()
                return {'found':bool(compatibility),'source':'RIV.KZ','article':data.article,'compatibility':compatibility,'confidence':90 if compatibility else 0}
        except Exception as e:
            traceback.print_exc();raise HTTPException(status_code=500,detail=str(e))
