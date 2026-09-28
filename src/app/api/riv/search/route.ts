import {NextResponse} from 'next/server';
import {rivSearch} from '@/lib/riv/client';

function clean(v:any){return String(v??'').replace(/\s+/g,' ').trim();}
function unique(values:any[]){return [...new Set(values.map(clean).filter(Boolean))];}

export async function POST(req:Request){
 try{
  const body=await req.json();
  const article=clean(body?.article);
  if(!article)return NextResponse.json({error:'ARTICLE_REQUIRED'},{status:400});
  const result=await rivSearch(article);
  if(!result)return NextResponse.json({error:'RIV_NOT_CONFIGURED'},{status:503});
  const card=result.card||{};
  const vehicles=Array.isArray(result.vehicles)?result.vehicles:[];
  const oem=unique(Array.isArray(result.oem)?result.oem:[]);
  const raw=clean(result.raw_text||result.compatibility);
  const found=Boolean(result.found && (raw || card.title || vehicles.length || (card.photos||[]).length));
  return NextResponse.json({
   found,
   source:'RIV.KZ',
   article,
   page_url:result.page_url||null,
   detail_url:result.detail_url||null,
   card:{
    title:card.title||null,
    brand:card.brand||null,
    category:card.category||null,
    manufacturer_part_number:card.manufacturer_part_number||null,
    price:card.price||null,
    currency:card.currency||null,
    photos:Array.isArray(card.photos)?unique(card.photos):[],
    details:Array.isArray(card.details)?card.details.map(clean).filter(Boolean):[]
   },
   vehicles,
   oem,
   raw_text:raw,
   confidence:Number(result.confidence||0)
  });
 }catch(e){
  console.error('riv search',e);
  return NextResponse.json({error:'RIV временно недоступен'},{status:502});
 }
}