import {NextResponse} from 'next/server';
import {rivSearch} from '@/lib/riv/client';

function clean(v:string){return v.replace(/\s+/g,' ').trim();}
function yearRange(v:string){
  const s=clean(v).replace(/[–—−]/g,'-');
  const m=s.match(/(\d{4})\s*-\s*(\d{4}|\d{2})?/);
  if(!m)return null;
  const from=m[1],to=m[2]?(m[2].length===2?from.slice(0,2)+m[2]:m[2]):null;
  return to?from+'–'+to:from+'+';
}
function parseLine(line:string){
  const raw=clean(line); if(!raw)return null;
  const years=raw.match(/\b(19\d{2}|20\d{2})\s*[–—-]\s*(19\d{2}|20\d{2})?\b|\b(19\d{2}|20\d{2})\s*[–—-]/);
  const engine=raw.match(/\b(\d(?:\.\d)?(?:\s?л|L)?(?:\s?(?:бензин|дизель|gasoline|diesel))?)\b/i);
  const body=raw.match(/(?:кузов|body|chassis)\s*[:\-]?\s*([A-Za-zА-Яа-я0-9._/-]+)/i);
  const oem=raw.match(/(?:OEM|ОЕМ)\s*[:#]?\s*([A-Za-z0-9._/-]+)/i);
  const brand=raw.match(/\b(Toyota|Lexus|Nissan|Infiniti|Honda|Mazda|Mitsubishi|Subaru|Suzuki|Hyundai|Kia|Ford|Chevrolet|Volkswagen|Audi|BMW|Mercedes[- ]Benz|Skoda|Volvo|Renault|Peugeot|Citroen|Geely|Chery|Haval|GAC|Great Wall|Isuzu|Land Rover|Porsche|Opel|Fiat|Daewoo|Lada|ВАЗ|ГАЗ|УАЗ)\b/i);
  const yr=years?.[0]?yearRange(years[0]):null;
  return {raw,brand:brand?.[1]||null,years:yr,body:body?.[1]||null,engine:engine?.[1]||null,oem:oem?.[1]||null};
}
function parseCompatibility(text:string){
  const raw=clean(text||'');
  const lines=raw.split(/\r?\n|•|;(?=\s*(?:[A-ZА-ЯЁ][\w-]+\s+){1,3})/).map(clean).filter(Boolean);
  const rows=lines.map(parseLine).filter(Boolean);
  return {raw,rows};
}

export async function POST(req:Request){
  try{
    const body=await req.json();
    const article=String(body?.article||'').trim();
    if(!article)return NextResponse.json({error:'ARTICLE_REQUIRED'},{status:400});
    const result=await rivSearch(article);
    if(!result)return NextResponse.json({error:'RIV_NOT_CONFIGURED'},{status:503});
    const compatibility=parseCompatibility(String(result.compatibility||''));
    return NextResponse.json({...result,compatibility:compatibility.raw,vehicles:compatibility.rows});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'RIV_SEARCH_FAILED'},{status:502});
  }
}
