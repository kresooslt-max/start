'use client';
import {useState} from 'react';import {useRouter} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {Search, Copy, Check, CarFront, Database, AlertCircle} from 'lucide-react';

type Vehicle={raw:string;brand:string|null;years:string|null;body:string|null;engine:string|null;oem:string|null};
type Result={found:boolean;source:string;article:string;compatibility:string|null;vehicles:Vehicle[];confidence?:number};

function yearsLabel(v:string|null){if(!v)return '—';if(v.endsWith('+'))return 'с '+v.slice(0,-1)+' года';return v+' гг.'}
function field(v:string|null){return v||'—'}

export default function RivSearch(){
 const router=useRouter();
 const [article,setArticle]=useState(''); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const [result,setResult]=useState<Result|null>(null); const [copied,setCopied]=useState('');
 async function search(){
  const a=article.trim(); if(!a)return;
  setLoading(true);setError('');setResult(null);
  try{const r=await fetch('/api/riv/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({article:a})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось выполнить поиск');setResult(d)}
  catch(e){setError(e instanceof Error?e.message:'Ошибка поиска')}
  finally{setLoading(false)}
 }
 async function copy(v:string,label:string){await navigator.clipboard?.writeText(v);setCopied(label);setTimeout(()=>setCopied(''),1200)}
 async function createProduct(){if(!result)return;setLoading(true);try{const r=await fetch('/api/products',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({seller_article:result.article,brand:'Не указан'})});const d=await r.json();if(!r.ok)throw new Error(d.error);await fetch('/api/products/'+d.product.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({riv_vehicles:result.vehicles,riv_oem:(result as any).oem||[],riv_raw_text:(result as any).raw_text||result.compatibility})});router.push('/products/'+d.product.id)}catch(e){setError(e instanceof Error?e.message:'Не удалось создать карточку')}finally{setLoading(false)}}
 return <AppShell>
  <div className="topbar"><div><div className="eyebrow">RIV.KZ</div><div className="pageTitle">Поиск по RIV</div></div><div className="topActions"><div className="badge badgeAmber">Только по запросу</div></div></div>
  <div className="page">
   <section className="hero"><div><div className="eyebrow">RIV COMPATIBILITY</div><h2>Совместимость детали</h2><p>Введите артикул — StartAuto запросит RIV и преобразует сокращённые данные в удобные карточки.</p></div><div className="toggle"><Database size={14}/> Источник: RIV.KZ</div></section>
   <section className="panel" style={{marginTop:12}}><div className="toolbar"><div className="search"><Search size={14}/><input value={article} onChange={e=>setArticle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Введите артикул, например 12345" /></div><button className="btn btnPrimary" onClick={search} disabled={loading||!article.trim()}>{loading?'Поиск...':'Найти в RIV'}</button></div>
   {error&&<div className="errorBox"><AlertCircle size={14}/> {error}</div>}</section>
   {result&&<div style={{marginTop:12}}>
    <section className="panel"><div className="panelHead"><div><div className="panelTitle">Результат: {result.article}</div><div className="panelSub">{result.found?'Данные найдены в RIV.KZ':'По артикулу подходящие данные не найдены'}</div></div>{result.compatibility&&<button className="btn" onClick={()=>copy(result.compatibility||'','raw')}>{copied==='raw'?<Check size={13}/>:<Copy size={13}/>} Скопировать исходные данные</button>}<button className="btn btnPrimary" onClick={createProduct} disabled={loading}>Создать карточку из RIV</button></div>
    {!result.found?<div className="empty">RIV не вернул данные по этому артикулу.</div>:
    <>
      {result.vehicles.length>0&&<div className="tableWrap"><table><thead><tr><th>Марка</th><th>Модель / данные RIV</th><th>Кузов</th><th>Годы</th><th>Двигатель</th><th>OEM</th></tr></thead><tbody>{result.vehicles.map((v,i)=><tr key={i}><td><b>{field(v.brand)}</b></td><td>{v.raw}</td><td>{field(v.body)}</td><td>{yearsLabel(v.years)}</td><td>{field(v.engine)}</td><td>{field(v.oem)}</td></tr>)}</tbody></table></div>}
      <div className="grid2" style={{marginTop:12}}>
       <section className="panel" style={{padding:12}}><div className="panelTitle">Что удалось распознать</div><div className="cardList" style={{marginTop:9}}><div className="miniCard"><b><CarFront size={13}/> Автомобилей</b><span>{result.vehicles.length||'не удалось структурировать'}</span></div><div className="miniCard"><b>Периоды</b><span>2015–2018 → 2015–2018 гг.; 2015– → с 2015 года</span></div><div className="miniCard"><b>Источник</b><span>RIV.KZ · прямой запрос</span></div></div></section>
       <section className="panel" style={{padding:12}}><div className="panelTitle">Исходный текст RIV</div><p style={{whiteSpace:'pre-wrap',fontSize:10,lineHeight:1.6,color:'#cdd6e1'}}>{result.compatibility||'—'}</p></section>
      </div>
    </>}
    </section>
   </div>}
  </div>
 </AppShell>
}
