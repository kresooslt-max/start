export async function rivSearch(article:string){
  const u=process.env.RIV_WORKER_URL;if(!u)return null;
  const headers:{'content-type':string;authorization?:string}={'content-type':'application/json'};
  if(process.env.RIV_WORKER_TOKEN)headers.authorization='Bearer '+process.env.RIV_WORKER_TOKEN;
  const r=await fetch(u+'/search',{method:'POST',headers,body:JSON.stringify({article}),cache:'no-store'});
  const body=await r.text();
  if(!r.ok)throw new Error('RIV_WORKER_FAILED '+r.status+(body?' '+body:''));
  return JSON.parse(body);
}