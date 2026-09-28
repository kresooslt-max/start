import {NextResponse} from 'next/server';
import {generateRivExplanation} from '@/lib/ai/provider';

export async function POST(req:Request){
 try{
  const body=await req.json();
  if(!body?.article)return NextResponse.json({error:'ARTICLE_REQUIRED'},{status:400});
  const result=await generateRivExplanation({
   article:String(body.article),
   card:body.card||{},
   vehicles:Array.isArray(body.vehicles)?body.vehicles:[],
   oem:Array.isArray(body.oem)?body.oem:[],
   raw_text:String(body.raw_text||'')
  });
  return NextResponse.json(result);
 }catch(e){
  console.error('riv explain',e);
  const message=e instanceof Error?e.message:'RIV_AI_FAILED';
  if(message==='AI_API_KEY_MISSING')return NextResponse.json({error:'AI сервис не настроен'},{status:503});
  return NextResponse.json({error:'Не удалось расшифровать данные RIV'},{status:502});
 }
}