export async function searchWeb(query:string,maxResults=12){
  const key=process.env.TAVILY_API_KEY;
  if(!key)return [];
  const q=String(query||'').trim();
  if(!q)return [];
  const r=await fetch('https://api.tavily.com/search',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({api_key:key,query:q,max_results:maxResults,search_depth:'advanced'})
  });
  if(!r.ok)throw new Error('TAVILY_REQUEST_FAILED '+r.status);
  const j=await r.json();
  return (j.results||[]).filter((x:any)=>x?.url).map((x:any)=>({
    title:x.title||x.url,
    url:x.url,
    content:x.content||'',
    score:x.score??null
  }));
}

export async function searchArticle(article:string){
  const a=String(article||'').trim();
  if(!a)return [];
  const qs=[a,a.replace(/[\s\-_/]/g,''),'"'+a+'" OEM','"'+a+'" automotive','"'+a+'" "part number"'];
  const out:any[]=[];
  for(const q of qs){
    try{
      const items=await searchWeb(q,8);
      for(const x of items)if(!out.some(y=>y.url===x.url))out.push(x);
    }catch{}
  }
  return out.slice(0,30);
}