import {NextResponse} from 'next/server';
import {generateRivExplanation} from '@/lib/ai/provider';
import {searchWeb} from '@/lib/search/web';

const clean=(v:any)=>String(v??'').replace(/\s+/g,' ').trim();
const uniqueByUrl=(items:any[])=>{
 const seen=new Set<string>();return items.filter(x=>x?.url&&!seen.has(x.url)&&seen.add(x.url));
};

export async function POST(req:Request){
 try{
  const body=await req.json();
  const article=clean(body?.article);
  const card=body?.card||{};
  const description=clean(body?.description||card?.description||body?.raw_text||'');
  if(!article)return NextResponse.json({error:'ARTICLE_REQUIRED'},{status:400});
  if(!description && !card?.title)return NextResponse.json({error:'В RIV не удалось получить описание карточки'},{status:422});

  const seed=[article,clean(card?.title),description].filter(Boolean).join(' ').slice(0,1800);
  const queries=[
   seed,
   [article,clean(card?.title),'OEM цена характеристики'].filter(Boolean).join(' '),
   [article,description.slice(0,900),'кузов двигатель годы'].filter(Boolean).join(' ')
  ];

  const searched=await Promise.all(queries.map(q=>searchWeb(q,10).catch(()=>[])));
  const sources=uniqueByUrl(searched.flat()).slice(0,24);

  const result=await generateRivExplanation({
   article,
   riv_card:{
    article,
    title:card?.title||null,
    description,
    photos:Array.isArray(card?.photos)?card.photos:[],
   },
   web_sources:sources.map((x:any)=>({title:x.title,url:x.url,content:x.content}))
  });

  return NextResponse.json({...result,search_sources:sources.map((x:any)=>({title:x.title,url:x.url}))});
 }catch(e){
  console.error('riv explain',e);
  const message=e instanceof Error?e.message:'RIV_EXPLAIN_FAILED';
  if(message==='AI_API_KEY_MISSING')return NextResponse.json({error:'AI сервис не настроен'},{status:503});
  return NextResponse.json({error:'Не удалось найти и расшифровать данные по RIV карточке'},{status:502});
 }
}