'use client';
import {useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {Search,Copy,Check,AlertCircle,Sparkles} from 'lucide-react';

type Vehicle={raw:string;brand:string|null;model:string|null;generation:string|null;body:string|null;years:string|null;engine:string|null;fuel:string|null;notes:string|null};
type Card={title:string|null;brand:string|null;category:string|null;manufacturer_part_number:string|null;price:string|null;currency:string|null;photos:string[];details:string[]};
type Result={found:boolean;source:string;article:string;page_url:string|null;detail_url:string|null;card:Card;vehicles:Vehicle[];oem:string[];raw_text:string;confidence:number};
type Explanation={product_type:string|null;summary:string;important_facts:{label:string;value:string}[];oem:string[];part_numbers:string[];price:string|null;compatibility:Vehicle[];fitment_description:string;warnings:string[]};

const val=(x:any)=>x&&String(x).trim()?String(x):'—';

function Field({label,value}:{label:string;value:any}){return <div className="miniCard"><b>{label}</b><span>{val(value)}</span></div>}

export default function RivSearch(){
 const [article,setArticle]=useState('');const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [result,setResult]=useState<Result|null>(null);const [explanation,setExplanation]=useState<Explanation|null>(null);const [aiBusy,setAiBusy]=useState(false);const [copied,setCopied]=useState(false);

 async function search(){
  const a=article.trim();if(!a)return;
  setLoading(true);setError('');setResult(null);setExplanation(null);
  try{
   const r=await fetch('/api/riv/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({article:a})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось выполнить поиск');
   setResult(d);
  }catch(e){setError(e instanceof Error?e.message:'RIV временно недоступен')}
  finally{setLoading(false)}
 }

 async function explain(){
  if(!result)return;
  setAiBusy(true);setError('');
  try{
   const r=await fetch('/api/riv/explain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    article:result.article,card:result.card,vehicles:result.vehicles,oem:result.oem,raw_text:result.raw_text
   })});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось расшифровать');
   setExplanation(d);
  }catch(e){setError(e instanceof Error?e.message:'AI сервис недоступен')}
  finally{setAiBusy(false)}
 }

 async function copyRaw(){
  await navigator.clipboard?.writeText(result?.raw_text||'');setCopied(true);setTimeout(()=>setCopied(false),1200);
 }

 return <AppShell>
  <div className="topbar"><div><div className="eyebrow">RIV.KZ</div><div className="pageTitle">Поиск детали</div></div><div className="topActions"><div className="badge badgeAmber">RIV — основной источник</div></div></div>
  <div className="page">
   <section className="hero"><div><div className="eyebrow">STARTAUTO · RIV READER</div><h2>Найдите артикул и разберите его до понятной карточки</h2><p>Сначала показываем то, что реально есть в карточке RIV.KZ. Затем превращаем эти данные в подробное описание без выдуманных фактов.</p></div><div className="toggle"><Search size={14}/> Два этапа</div></section>

   <section className="panel" style={{marginTop:12}}>
    <div className="toolbar"><div className="search"><Search size={14}/><input value={article} onChange={e=>setArticle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Например: HLT-505"/></div><button className="btn btnPrimary" onClick={search} disabled={loading||!article.trim()}>{loading?'Ищем в RIV…':'Найти в RIV'}</button></div>
    {error&&<div className="errorBox"><AlertCircle size={14}/>{error}</div>}
   </section>

   {result&&<div style={{marginTop:12}}>
    <section className="panel">
     <div className="panelHead"><div><div className="eyebrow">1 · ИСХОДНАЯ КАРТОЧКА RIV</div><div className="panelTitle">Результат: {result.article}</div><div className="panelSub">{result.found?'Данные найдены в RIV.KZ':'В карточке не удалось найти полезные данные'}</div></div><button className="btn" onClick={copyRaw} disabled={!result.raw_text}>{copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Скопировано':'Скопировать RIV'}</button></div>

     {(result.card.photos||[]).length>0&&<div className="photoStrip" style={{marginTop:14}}>{result.card.photos.map((src,i)=><a key={src+i} href={src} target="_blank" rel="noreferrer" className="photoTile"><img src={src} alt={result.card.title||result.article}/></a>)}</div>}
     <div className="infoGrid" style={{marginTop:14}}>
      <Field label="Что указано в карточке" value={result.card.title}/>
      <Field label="Марка" value={result.card.brand}/>
      <Field label="Категория" value={result.card.category}/>
      <Field label="Партномер производителя" value={result.card.manufacturer_part_number}/>
      <Field label="Цена" value={result.card.price ? [result.card.price,result.card.currency].filter(Boolean).join(' ') : null}/>
      <Field label="OEM" value={result.oem.join(', ')}/>
     </div>
     {result.card.details.length>0&&<div className="panel" style={{marginTop:12,padding:14}}><div className="panelTitle">Подробности из карточки RIV</div><div style={{marginTop:8}}>{result.card.details.map((x,i)=><p key={i} style={{margin:'6px 0',lineHeight:1.55}}>{x}</p>)}</div></div>}
     {result.vehicles.length>0&&<div style={{marginTop:12}}><div className="panelTitle">Применяемость, как она найдена в RIV</div><div className="cardList" style={{marginTop:8}}>{result.vehicles.map((v,i)=><div className="miniCard" key={i}><b>{[v.brand,v.model,v.generation].filter(Boolean).join(' ')||v.raw}</b><span>{[v.years,v.body,v.engine,v.fuel].filter(Boolean).join(' · ')||v.notes||'Данные в raw'}</span></div>)}</div></div>}
     <details style={{marginTop:14}}><summary style={{cursor:'pointer',fontWeight:700}}>Исходный текст RIV</summary><pre style={{whiteSpace:'pre-wrap',marginTop:8,fontSize:12,lineHeight:1.55}}>{result.raw_text||'—'}</pre></details>
    </section>

    <section className="panel" style={{marginTop:12}}>
      <div className="panelHead"><div><div className="eyebrow">2 · ПОДРОБНАЯ РАСШИФРОВКА</div><div className="panelTitle">Что это за деталь и куда она подходит</div><div className="panelSub">Вторая версия строится только из информации, полученной на первом этапе.</div></div><button className="btn btnAi" onClick={explain} disabled={aiBusy||!result.found}>{aiBusy?<><Sparkles size={13}/> Формируем…</>:<><Sparkles size={13}/> Подробно расшифровать</>}</button></div>
      <div style={{marginTop:14}}>
       <div className="grid2"><section className="panel" style={{padding:14}}><div className="panelTitle">Что это за товар</div><p style={{lineHeight:1.65}}>{result.card.title||'Название не указано в RIV'}</p><Field label="Бренд" value={result.card.brand}/><Field label="Категория" value={result.card.category}/><Field label="Цена из RIV" value={result.card.price ? [result.card.price,result.card.currency].filter(Boolean).join(' ') : null}/><Field label="Партномер" value={result.card.manufacturer_part_number||((result as any).part_numbers||[]).join(', ')}/></section><section className="panel" style={{padding:14}}><div className="panelTitle">OEM</div><p style={{fontSize:16,fontWeight:700,lineHeight:1.6}}>{result.oem.join(', ')||'OEM в карточке не указан'}</p><div className="panelSub">Здесь показываем только то, что удалось найти в RIV.</div></section></div>
       {(result.card.photos||[]).length>0&&<div className="photoStrip" style={{marginTop:12}}>{result.card.photos.map((src,i)=><div key={src+i} className="photoTile"><img src={src} alt={result.card.title||result.article}/></div>)}</div>}
       <section className="panel" style={{marginTop:12,padding:14}}><div className="panelTitle">Куда подходит</div>{result.vehicles.length>0?<div className="cardList" style={{marginTop:10}}>{result.vehicles.map((v,i)=><div className="miniCard" key={i}><b>{[v.brand,v.model,v.generation].filter(Boolean).join(' ')||'Автомобиль'}</b><span>{[v.years,v.body,v.engine,v.fuel].filter(Boolean).join(' · ')||v.raw}</span></div>)}</div>:<p className="panelSub">Подробная применяемость не распознана из данных RIV. Исходный текст сохранён ниже.</p>}</section>
       {!explanation?<div className="empty">Нажмите «Подробно расшифровать», чтобы AI разложил данные RIV на понятные поля и подробно описал применяемость.</div>:<><section className="panel" style={{marginTop:12,padding:14}}><div className="panelTitle">Подробное объяснение</div><p style={{lineHeight:1.7,whiteSpace:'pre-wrap'}}>{explanation.summary||'—'}</p><p style={{lineHeight:1.7,whiteSpace:'pre-wrap'}}>{explanation.fitment_description||'—'}</p></section><div className="grid2" style={{marginTop:12}}><section className="panel" style={{padding:14}}><div className="panelTitle">OEM и номера</div><p><b>OEM:</b> {explanation.oem.join(', ')||'—'}</p><p><b>Партномера:</b> {explanation.part_numbers.join(', ')||'—'}</p><p><b>Цена:</b> {explanation.price||'—'}</p></section><section className="panel" style={{padding:14}}><div className="panelTitle">Тип детали</div><p>{explanation.product_type||'Не указан в RIV'}</p>{explanation.important_facts.length>0&&<div className="cardList" style={{marginTop:8}}>{explanation.important_facts.map((f,i)=><div className="miniCard" key={i}><b>{f.label}</b><span>{f.value}</span></div>)}</div>}</section></div>{explanation.compatibility.length>0&&<div className="tableWrap" style={{marginTop:12}}><table><thead><tr><th>Марка</th><th>Модель</th><th>Поколение</th><th>Кузов</th><th>Годы</th><th>Двигатель</th></tr></thead><tbody>{explanation.compatibility.map((v,i)=><tr key={i}><td>{val(v.brand)}</td><td>{val(v.model)}</td><td>{val(v.generation)}</td><td>{val(v.body)}</td><td>{val(v.years)}</td><td>{val(v.engine)}</td></tr>)}</tbody></table></div>}{explanation.warnings.length>0&&<div className="errorBox" style={{marginTop:12}}>{explanation.warnings.map((w,i)=><span key={i}>{w}{i<explanation.warnings.length-1?' · ':''}</span>)}</div>}</>}
      </div>
    </section>
   </div>}
  </div>
 </AppShell>
}