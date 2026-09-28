'use client';

import {useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {AlertCircle,Check,Copy,Search,Sparkles} from 'lucide-react';

type RivCard={article:string;title:string|null;photos:string[];description:string};
type Result={found:boolean;source:string;article:string;card:RivCard;raw_text:string;detail_url:string|null;page_url:string|null};
type Explanation={
 product_type:string|null;
 summary:string;
 important_facts:{label:string;value:string}[];
 oem:string[];
 part_numbers:string[];
 price:string|null;
 compatibility:{
  brand:string|null;model:string|null;generation:string|null;body:string|null;
  years:string|null;engine:string|null;fuel:string|null;notes:string|null;
 }[];
 fitment_description:string;
 warnings:string[];
 sources:{title:string;url:string}[];
};

const val=(x:any)=>x&&String(x).trim()?String(x):'—';

export default function RivSearch(){
 const [article,setArticle]=useState('');
 const [loading,setLoading]=useState(false);
 const [aiLoading,setAiLoading]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState<Result|null>(null);
 const [explanation,setExplanation]=useState<Explanation|null>(null);
 const [copied,setCopied]=useState(false);

 async function search(){
  const a=article.trim();if(!a)return;
  setLoading(true);setError('');setResult(null);setExplanation(null);
  try{
   const r=await fetch('/api/riv/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({article:a})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Не удалось выполнить поиск');
   setResult(d);
  }catch(e){setError(e instanceof Error?e.message:'RIV временно недоступен')}
  finally{setLoading(false)}
 }

 async function enrich(){
  if(!result)return;
  setAiLoading(true);setError('');
  try{
   const r=await fetch('/api/riv/explain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    article:result.article,
    card:result.card,
    description:result.card.description,
    raw_text:result.raw_text
   })});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Не удалось найти информацию');
   setExplanation(d);
  }catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить AI поиск')}
  finally{setAiLoading(false)}
 }

 async function copyRaw(){
  if(!result?.card.description)return;
  await navigator.clipboard?.writeText(result.card.description);
  setCopied(true);
  setTimeout(()=>setCopied(false),1200);
 }

 return <AppShell>
  <div className="topbar">
   <div><div className="eyebrow">RIV.KZ</div><div className="pageTitle">Поиск детали</div></div>
   <div className="badge badgeAmber">Единственный источник: RIV</div>
  </div>

  <div className="page">
   <section className="hero">
    <div>
     <div className="eyebrow">RIV READER</div>
     <h2>Введите артикул</h2>
     <p>Сначала получаем исходную карточку RIV без догадок. Затем AI ищет и расшифровывает недостающую информацию.</p>
    </div>
   </section>

   <section className="panel" style={{marginTop:12}}>
    <div className="toolbar">
     <div className="search"><Search size={14}/><input value={article} onChange={e=>setArticle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Например: YCK-813"/></div>
     <button className="btn btnPrimary" onClick={search} disabled={loading||!article.trim()}>{loading?'Ищем в RIV…':'Найти в RIV'}</button>
    </div>
    {error&&<div className="errorBox"><AlertCircle size={14}/> {error}</div>}
   </section>

   {result&&<div style={{marginTop:12}}>
    <section className="panel">
     <div className="panelHead">
      <div>
       <div className="eyebrow">1 · ИСХОДНАЯ КАРТОЧКА RIV</div>
       <div className="panelTitle">Артикул: {result.article}</div>
       <div className="panelSub">{result.found?'Данные найдены в RIV.KZ':'RIV не вернул полноценную карточку'}</div>
      </div>
      <button className="btn" onClick={copyRaw} disabled={!result.card.description}>{copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Скопировано':'Скопировать описание'}</button>
     </div>

     <div className="grid2" style={{marginTop:12}}>
      <section className="panel" style={{padding:14}}>
       <div className="panelTitle">Название товара</div>
       <p style={{fontSize:16,lineHeight:1.55,margin:'10px 0 0'}}>{result.card.title||'Название не удалось извлечь из карточки RIV'}</p>
      </section>
      <section className="panel" style={{padding:14}}>
       <div className="panelTitle">Артикул</div>
       <p style={{fontSize:18,fontWeight:800,margin:'10px 0 0'}}>{result.article}</p>
      </section>
     </div>

     {result.card.photos.length>0&&<div className="photoStrip" style={{marginTop:12}}>{result.card.photos.map((src,i)=><a className="photoTile" key={src+i} href={src} target="_blank" rel="noreferrer"><img src={src} alt={result.card.title||result.article}/></a>)}</div>}

     <section className="panel" style={{marginTop:12,padding:14}}>
      <div className="panelTitle">Внутреннее описание RIV</div>
      <div style={{marginTop:10,whiteSpace:'pre-wrap',fontSize:12,lineHeight:1.75,color:'#d7dfe8'}}>{result.card.description||'Описание/применяемость из карточки RIV не удалось извлечь.'}</div>
     </section>
    </section>

    <section className="panel" style={{marginTop:12}}>
     <div className="panelHead">
      <div>
       <div className="eyebrow">2 · ПОДРОБНАЯ РАСШИФРОВКА</div>
       <div className="panelTitle">Что это за деталь и куда она подходит</div>
       <div className="panelSub">AI использует исходную информацию RIV и дополнительно ищет подтверждение в интернете.</div>
      </div>
      <button className="btn btnAi" onClick={enrich} disabled={aiLoading||!result.found}>{aiLoading?<><Sparkles size={13}/> Ищем и разбираем…</>:<><Sparkles size={13}/> Найти и расшифровать</>}</button>
     </div>

     {!explanation
      ? <div className="empty">На втором этапе AI разберёт исходную запись RIV и попробует определить марку, модель, годы, кузов, двигатель, OEM, партномер, цену и назначение детали по найденным источникам.</div>
      : <div style={{marginTop:14}}>
         <div className="grid2">
          <section className="panel" style={{padding:14}}>
           <div className="panelTitle">Что это за деталь</div>
           <p style={{lineHeight:1.75,whiteSpace:'pre-wrap'}}>{explanation.summary||'—'}</p>
           <div className="cardList" style={{marginTop:10}}>
            <div className="miniCard"><b>Тип детали</b><span>{val(explanation.product_type)}</span></div>
            <div className="miniCard"><b>Цена</b><span>{val(explanation.price)}</span></div>
           </div>
          </section>
          <section className="panel" style={{padding:14}}>
           <div className="panelTitle">OEM и партномера</div>
           <p style={{lineHeight:1.7}}><b>OEM:</b> {explanation.oem.join(', ')||'—'}</p>
           <p style={{lineHeight:1.7}}><b>Партномер:</b> {explanation.part_numbers.join(', ')||'—'}</p>
          </section>
         </div>

         <section className="panel" style={{marginTop:12,padding:14}}>
          <div className="panelTitle">Куда подходит</div>
          <p style={{lineHeight:1.8,whiteSpace:'pre-wrap'}}>{explanation.fitment_description||'—'}</p>
         </section>

         {explanation.compatibility.length>0&&<div className="tableWrap" style={{marginTop:12}}><table><thead><tr><th>Марка</th><th>Модель</th><th>Поколение</th><th>Кузов</th><th>Годы</th><th>Двигатель</th><th>Топливо</th></tr></thead><tbody>{explanation.compatibility.map((v,i)=><tr key={i}><td>{val(v.brand)}</td><td>{val(v.model)}</td><td>{val(v.generation)}</td><td>{val(v.body)}</td><td>{val(v.years)}</td><td>{val(v.engine)}</td><td>{val(v.fuel)}</td></tr>)}</tbody></table></div>}

         {explanation.important_facts.length>0&&<div className="cardList" style={{marginTop:12}}>{explanation.important_facts.map((f,i)=><div className="miniCard" key={i}><b>{f.label}</b><span>{f.value}</span></div>)}</div>}

         {explanation.sources.length>0&&<section className="panel" style={{marginTop:12,padding:14}}><div className="panelTitle">Источники, которые использовал AI</div><div className="cardList" style={{marginTop:8}}>{explanation.sources.map((s,i)=><a className="miniCard" key={s.url+i} href={s.url} target="_blank" rel="noreferrer"><b>{s.title}</b><span>{s.url}</span></a>)}</div></section>}

         {explanation.warnings.length>0&&<div className="errorBox" style={{marginTop:12}}>{explanation.warnings.map((w,i)=><span key={i}>{w}{i<explanation.warnings.length-1?' · ':''}</span>)}</div>}
        </div>
     }
    </section>
   </div>}
  </div>
 </AppShell>
}