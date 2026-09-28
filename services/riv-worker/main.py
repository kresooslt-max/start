import os
import asyncio
import re
import traceback
from urllib.parse import quote_plus, urljoin

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

app=FastAPI(title="StartAuto RIV Worker")
lock=asyncio.Lock()

class SearchRequest(BaseModel):
    article:str

KNOWN_BRANDS=r"Toyota|Lexus|Nissan|Infiniti|Honda|Mazda|Mitsubishi|Subaru|Suzuki|Hyundai|Kia|Ford|Chevrolet|GMC|Volkswagen|Audi|BMW|Mercedes(?:[- ]Benz)?|Skoda|Volvo|Renault|Peugeot|Citroen|Geely|Chery|Haval|GAC|Great Wall|Isuzu|Land Rover|Porsche|Opel|Fiat|Daewoo|Lada|ВАЗ|ГАЗ|УАЗ|Chevrolet"
BODY_WORDS=r"седан|универсал|хэтчбек|хетчбек|кроссовер|внедорожник|купе|кабриолет|minivan|минивэн|SUV|MPV|wagon|sedan|hatchback|pickup|van|crossover"
ENGINE_RE=r"\b(?:\d{1,2}(?:[.,]\d)?(?:\s?л|\s?L)?(?:\s?(?:бензин|дизель|gasoline|diesel))?|V\d|\d(?:[.,]\d)?\s?(?:Turbo|TDI|TSI|MPI|GDI|CRDI))\b"

async def authorize(token):
    expected=os.getenv("RIV_WORKER_TOKEN")
    if expected and token != f"Bearer {expected}":
        raise HTTPException(status_code=401,detail="UNAUTHORIZED")

async def close_modals(page):
    try:
        await page.keyboard.press("Escape")
    except Exception:
        pass
    selectors=["button:has-text('×')","[class*='close']",".modal-header button",".popup-close","button:has-text('Закрыть')"]
    for sel in selectors:
        try:
            loc=page.locator(sel).first
            if await loc.is_visible(timeout=400):
                await loc.click(timeout=1000,force=True)
                return
        except Exception:
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
    except Exception:
        return 0

async def trigger_hover(page,node):
    try:
        await node.scroll_into_view_if_needed(timeout=5000)
    except Exception:
        pass
    for event in ("pointerover","mouseover","mouseenter","mousemove"):
        try:
            await node.dispatch_event(event)
        except Exception:
            pass
    try:
        await node.hover(timeout=5000,force=True)
    except (PlaywrightTimeoutError, Exception):
        pass

def clean_text(text):
    return re.sub(r"\s+"," ",str(text or "")).strip()

def clean_multiline(text):
    lines=[]
    for line in str(text or "").splitlines():
        x=clean_text(line)
        if x and x not in lines:
            lines.append(x)
    return lines

def looks_like_ui_noise(text,article):
    t=clean_text(text).lower()
    a=article.lower().strip()
    bad=("поиск:" in t and "фильтр" in t) or t in {
        a,"фильтры","фильтр","каталог","поиск","вход","войти","регистрация"
    }
    return bad

def unique(values):
    out=[]
    for value in values:
        value=clean_text(value)
        if value and value not in out:
            out.append(value)
    return out

async def ancestor_text(page,node,article):
    try:
        return await node.evaluate("""(el, article) => {
          const candidates=[];
          let cur=el;
          for(let i=0;i<7 && cur;i++,cur=cur.parentElement){
            const t=(cur.innerText||'').trim();
            if(t) candidates.push(t);
          }
          return candidates;
        }""",article)
    except Exception:
        return []

async def extract_candidate_text(page,node,article):
    candidates=await ancestor_text(page,node,article)
    good=[]
    for text in candidates:
        normalized=clean_text(text)
        if len(normalized)<8 or looks_like_ui_noise(normalized,article):
            continue
        if article.lower() in normalized.lower() or re.search(r"\b(?:OEM|ОЕМ|цена|артикул|партномер|двигател|кузов|год)\b",normalized,re.I):
            good.append(normalized)
    if good:
        return max(good,key=len)
    return clean_text(candidates[-1] if candidates else "")

async def extract_link(page,node,base):
    try:
        href=await node.evaluate("""el => {
          let cur=el;
          for(let i=0;i<8 && cur;i++,cur=cur.parentElement){
            if(cur.tagName==='A' && cur.href) return cur.href;
          }
          return null;
        }""")
        if href:
            full=urljoin(base,href)
            if "/catalog" not in full or "q=" not in full:
                return full
    except Exception:
        pass
    return None

async def extract_images(page):
    try:
        values=await page.evaluate("""() => {
          const urls=[];
          const add=(v)=>{
            if(!v || v.startsWith('data:') || v.endsWith('.svg')) return;
            try { urls.push(new URL(v,location.href).href); } catch {}
          };
          for(const el of document.querySelectorAll('img')){
            const r=el.getBoundingClientRect();
            if((r.width>70 && r.height>50) || (el.naturalWidth>120 && el.naturalHeight>80) || el.closest('main,article,[class*="product"],[class*="card"]')){
              add(el.currentSrc); add(el.src); add(el.getAttribute('data-src')); add(el.getAttribute('data-lazy-src'));
              const srcset=el.getAttribute('srcset')||el.getAttribute('data-srcset');
              if(srcset) add(srcset.split(',').pop().trim().split(' ')[0]);
            }
          }
          const og=document.querySelector('meta[property="og:image"]');
          if(og) add(og.getAttribute('content'));
          for(const el of document.querySelectorAll('[style*="background-image"]')){
            const m=(el.getAttribute('style')||'').match(/url\\((['"]?)(.*?)\\1\\)/i);
            if(m) add(m[2]);
          }
          return [...new Set(urls)].slice(0,24);
        }""")
        return unique(values)
    except Exception:
        return []

def extract_labeled(text,label_patterns):
    for pattern in label_patterns:
        m=re.search(pattern,text,re.I)
        if m:
            value=clean_text(m.group(1))
            if value:
                return value
    return None

def extract_price(text):
    patterns=[
        r"(?i)(?:цена|стоимость|price)\s*[:№#-]?\s*([\d\s.,]+\s*(?:₸|тг|KZT|руб|₽|USD|EUR|\$|€)?)",
        r"(?<!\d)(\d[\d\s.,]{2,})\s*(₸|тг|KZT|₽|руб|USD|EUR|\$|€)"
    ]
    for p in patterns:
        m=re.search(p,text)
        if m:
            value=clean_text(" ".join(x for x in m.groups() if x))
            if value:
                return value
    return None

def extract_oems(text):
    patterns=[
        r"(?i)(?:OEM|ОЕМ|OE)\s*[:№#-]?\s*([A-Z0-9][A-Z0-9._/-]{3,})",
        r"(?i)(?:оригинальный\s+номер|original\s+(?:part\s+)?number)\s*[:№#-]?\s*([A-Z0-9][A-Z0-9._/-]{3,})"
    ]
    return unique([m.group(1) for p in patterns for m in re.finditer(p,text)])

def extract_part_numbers(text):
    patterns=[
        r"(?i)(?:партномер|part\s*number|manufacturer\s*part\s*number|номер\s+производителя)\s*[:№#-]?\s*([A-Z0-9][A-Z0-9._/-]{3,})"
    ]
    return unique([m.group(1) for p in patterns for m in re.finditer(p,text)])

def parse_vehicle_line(line):
    raw=clean_text(line)
    if len(raw)<4:
        return None
    brand_m=re.search(r"\b("+KNOWN_BRANDS+r")\b",raw,re.I)
    years_m=re.search(r"\b((?:19|20)\d{2}(?:\s*[–—-]\s*(?:(?:19|20)?\d{2})?)?)",raw)
    body_m=re.search(r"\b("+BODY_WORDS+r")\b",raw,re.I)
    engine_m=re.search(ENGINE_RE,raw,re.I)
    if not (brand_m or years_m or body_m or engine_m):
        return None
    brand=brand_m.group(1) if brand_m else None
    model=None
    if brand_m:
        tail=raw[brand_m.end():].strip(" -,:")
        stop=re.search(r"\b(?:19|20)\d{2}\b|\b"+BODY_WORDS+r"\b|"+ENGINE_RE,tail,re.I)
        model_part=tail[:stop.start()] if stop else tail
        model_tokens=[x for x in re.split(r"\s+",model_part) if x][:4]
        model=clean_text(" ".join(model_tokens)) or None
    generation=None
    if model:
        gen=re.search(r"\b[A-Z]{1,4}\d{2,4}\b|\bXV\d+\b|\bE\d+\b|\bJ\d+\b",model,re.I)
        if gen:
            generation=gen.group(0)
    return {
        "brand":brand,
        "model":model,
        "generation":generation,
        "body":body_m.group(1) if body_m else None,
        "years":years_m.group(1) if years_m else None,
        "engine":engine_m.group(0) if engine_m else None,
        "fuel":None,
        "notes":None,
        "raw":raw
    }

def parse_vehicles(text):
    rows=[]
    for line in clean_multiline(text):
        if looks_like_ui_noise(line,""):
            continue
        item=parse_vehicle_line(line)
        if item and item["raw"] not in {x["raw"] for x in rows}:
            rows.append(item)
    return rows[:100]

async def scrape_page(page,article):
    text=""
    for sel in ("main","[role='main']","article","section[class*='product']","div[class*='product']"):
        try:
            loc=page.locator(sel).first
            if await loc.is_visible(timeout=700):
                candidate=await loc.inner_text(timeout=3000)
                if len(clean_text(candidate))>=80:
                    text=candidate
                    break
        except Exception:
            pass
    if not text:
        text=await page.locator("body").inner_text(timeout=5000)
    lines=clean_multiline(text)
    useful=[x for x in lines if not looks_like_ui_noise(x,article)]
    raw="\n".join(useful)
    title=None
    for sel in ("h1","main h2","article h2","h2"):
        try:
            loc=page.locator(sel).filter(has_text=re.compile(r"\S+")).first
            if await loc.is_visible(timeout=700):
                t=clean_text(await loc.inner_text())
                if t and not looks_like_ui_noise(t,article):
                    title=t
                    break
        except Exception:
            pass
    brand_m=re.search(r"\b("+KNOWN_BRANDS+r")\b",raw,re.I)
    category=extract_labeled(raw,[r"(?i)(?:категория|category)\s*[:\-]\s*(.+)",r"(?i)(?:тип\s+детали|вид\s+детали)\s*[:\-]\s*(.+)"])
    manufacturer_part=extract_labeled(raw,[r"(?i)(?:партномер|part\s*number|номер\s+производителя)\s*[:№#-]?\s*([A-Z0-9][A-Z0-9._/-]{3,})"])
    price=extract_price(raw)
    oem=extract_oems(raw)
    parts=extract_part_numbers(raw)
    vehicles=parse_vehicles(raw)
    photos=await extract_images(page)
    details=useful[:80]
    return {
        "title":title,
        "brand":brand_m.group(1) if brand_m else None,
        "category":category,
        "manufacturer_part_number":manufacturer_part,
        "price":price,
        "currency":None,
        "photos":photos,
        "details":details,
        "oem":oem,
        "part_numbers":parts,
        "vehicles":vehicles,
        "raw_text":raw
    }

@app.get("/health")
async def health():
    return {"ok":True,"service":"riv-worker"}

@app.post("/search")
async def search(data:SearchRequest,authorization:str|None=Header(default=None)):
    await authorize(authorization)
    article=clean_text(data.article)
    if not article:
        raise HTTPException(status_code=400,detail="ARTICLE_REQUIRED")
    async with lock:
        browser=None
        try:
            async with async_playwright() as p:
                browser=await p.chromium.launch(headless=os.getenv("RIV_HEADLESS","true").lower()!="false")
                ctx=await browser.new_context(viewport={"width":1440,"height":900})
                page=await ctx.new_page()
                page.set_default_timeout(int(os.getenv("RIV_TIMEOUT_MS","30000")))
                base=os.getenv("RIV_URL","https://riv.kz").rstrip("/")

                await page.goto(base+"/login",wait_until="domcontentloaded")
                await page.wait_for_timeout(1200)
                await close_modals(page)

                login,password=os.getenv("RIV_USERNAME"),os.getenv("RIV_PASSWORD")
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

                variants=list(dict.fromkeys([article,article.upper(),article.lower()]))
                node=None
                for variant in variants:
                    await page.goto(base+"/catalog?q="+quote_plus(variant),wait_until="domcontentloaded")
                    await page.wait_for_timeout(1700)
                    await close_modals(page)
                    exact=page.locator("span.text-ink").filter(has_text=re.compile("^"+re.escape(variant)+"$",re.I)).first
                    if await exact.is_visible(timeout=2500):
                        node=exact
                        break
                    exact=page.get_by_text(variant,exact=True).first
                    if await exact.is_visible(timeout=1500):
                        node=exact
                        break

                if node is None:
                    print(f"RIV_SEARCH no match article={article} url={page.url}")
                    await browser.close();browser=None
                    return {"found":False,"source":"RIV.KZ","article":article,"card":{},"vehicles":[],"oem":[],"raw_text":"","confidence":0,"reason":"ARTICLE_NOT_FOUND"}

                changed=await disable_pointer_overlays(page)
                await trigger_hover(page,node)
                await page.wait_for_timeout(1200)
                print(f"RIV_SEARCH article={article} url={page.url} overlay_fix={changed}")

                current_text=await extract_candidate_text(page,node,article)
                hover_result=None
                for sel in ["div.tooltip","div.popover","div[role='tooltip']",".tooltip-inner",".tippy-content","div[class*='tooltip']","div[class*='popover']","[data-radix-popper-content-wrapper]"]:
                    try:
                        loc=page.locator(sel).filter(has_text=re.compile(r"\S+")).last
                        if await loc.is_visible(timeout=500):
                            t=clean_text(await loc.inner_text())
                            if t and not looks_like_ui_noise(t,article):
                                hover_result=t
                                break
                    except Exception:
                        pass

                if hover_result and len(hover_result)>len(current_text):
                    current_text=hover_result

                detail_url=await extract_link(page,node,base)
                detail={}
                if detail_url:
                    detail_page=await ctx.new_page()
                    try:
                        await detail_page.goto(detail_url,wait_until="domcontentloaded")
                        await detail_page.wait_for_timeout(1500)
                        await close_modals(detail_page)
                        detail=await scrape_page(detail_page,article)
                    except Exception as e:
                        print(f"RIV_SEARCH detail scrape failed article={article} error={type(e).__name__}")
                    finally:
                        await detail_page.close()

                if not detail:
                    detail={}

                card_text=clean_text(current_text)
                if looks_like_ui_noise(card_text,article):
                    card_text=""

                card={
                    "title":detail.get("title") or (card_text if card_text and article.lower() not in card_text.lower() else None),
                    "brand":detail.get("brand"),
                    "category":detail.get("category"),
                    "manufacturer_part_number":detail.get("manufacturer_part_number"),
                    "price":detail.get("price") or extract_price(card_text),
                    "currency":detail.get("currency"),
                    "photos":detail.get("photos",[]) or await extract_images(page),
                    "details":detail.get("details",[])
                }

                raw_text=detail.get("raw_text") or card_text
                vehicles=detail.get("vehicles",[]) or parse_vehicles(raw_text)
                oem=unique((detail.get("oem",[]) or []) + extract_oems(raw_text))
                parts=unique((detail.get("part_numbers",[]) or []) + extract_part_numbers(raw_text))

                meaningful=raw_text and not looks_like_ui_noise(raw_text,article)
                found=bool(meaningful or card["title"] or card["photos"] or vehicles or oem)
                print(f"RIV_SEARCH result article={article} found={found} raw_len={len(raw_text or '')} photos={len(card['photos'])} vehicles={len(vehicles)} oem={len(oem)}")

                await browser.close();browser=None
                return {
                    "found":found,
                    "source":"RIV.KZ",
                    "article":article,
                    "card":card,
                    "vehicles":vehicles,
                    "oem":oem,
                    "part_numbers":parts,
                    "raw_text":raw_text or "",
                    "confidence":90 if found else 0,
                    "page_url":page.url,
                    "detail_url":detail_url
                }
        except HTTPException:
            raise
        except Exception as e:
            traceback.print_exc()
            if browser:
                try: await browser.close()
                except Exception: pass
            raise HTTPException(status_code=500,detail=str(e))
