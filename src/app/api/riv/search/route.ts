import {NextResponse} from 'next/server';
import {rivSearch} from '@/lib/riv/client';

const clean=(v:any)=>String(v??'').replace(/\s+/g,' ').trim();

export async function POST(req:Request){
  try{
    const body=await req.json();
    const article=clean(body?.article);
    if(!article)return NextResponse.json({error:'ARTICLE_REQUIRED'},{status:400});

    const result=await rivSearch(article);
    if(!result)return NextResponse.json({error:'RIV_NOT_CONFIGURED'},{status:503});

    const card=result.card||{};
    const photos=Array.isArray(card.photos)?card.photos.filter((x:any)=>typeof x==='string'&&x.trim()).slice(0,12):[];
    const description=clean(card.description||result.raw_text||'');
    const found=Boolean(result.found && (card.title||description||photos.length));

    return NextResponse.json({
      found,
      source:'RIV.KZ',
      article,
      card:{
        article,
        title:card.title||null,
        photos,
        description
      },
      raw_text:description,
      detail_url:result.detail_url||null,
      page_url:result.page_url||null
    });
  }catch(e){
    console.error('riv search',e);
    return NextResponse.json({error:'RIV временно недоступен'},{status:502});
  }
}