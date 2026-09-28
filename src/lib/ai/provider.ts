import {z} from 'zod';

export const DraftSchema=z.object({
 title:z.string(),
 description:z.string(),
 hashtags:z.array(z.string()).max(10),
 product_type:z.string().nullable(),
 tnved:z.string().nullable(),
 oem_numbers:z.array(z.string()),
 cross_references:z.array(z.string()),
 applicability:z.array(z.any()),
 warnings:z.array(z.string()),
 conflicts:z.array(z.string()),
 confidence_score:z.number().int().min(0).max(100)
});

export async function generateDraft(input:any){
 const key=process.env.AI_API_KEY;if(!key)throw new Error('AI_API_KEY_MISSING');
 const model=process.env.AI_MODEL||'gpt-4o';
 const r=await fetch('https://api.openai.com/v1/chat/completions',{
  method:'POST',
  headers:{'content-type':'application/json',authorization:'Bearer '+key},
  body:JSON.stringify({model,messages:[{role:'system',content:'Return JSON only. Never invent facts. Use supplied data.'},{role:'user',content:JSON.stringify(input)}],temperature:.1,response_format:{type:'json_object'}})
 });
 if(!r.ok)throw new Error('AI_REQUEST_FAILED '+r.status);
 const j=await r.json();return DraftSchema.parse(JSON.parse(j.choices?.[0]?.message?.content||'{}'));
}

export const RivExplanationSchema=z.object({
 product_type:z.string().nullable(),
 summary:z.string(),
 important_facts:z.array(z.object({label:z.string(),value:z.string()})),
 oem:z.array(z.string()),
 part_numbers:z.array(z.string()),
 price:z.string().nullable(),
 compatibility:z.array(z.object({
  brand:z.string().nullable(),
  model:z.string().nullable(),
  generation:z.string().nullable(),
  body:z.string().nullable(),
  years:z.string().nullable(),
  engine:z.string().nullable(),
  fuel:z.string().nullable(),
  notes:z.string().nullable()
 })),
 fitment_description:z.string(),
 warnings:z.array(z.string())
});

export async function generateRivExplanation(input:any){
 const key=process.env.AI_API_KEY;if(!key)throw new Error('AI_API_KEY_MISSING');
 const model=process.env.AI_MODEL||'gpt-4o';
 const system=`Ты эксперт по автозапчастям и расшифровке карточек RIV.KZ.
Используй только переданные данные RIV. Не придумывай факты.
Нельзя придумывать OEM, партномер, цену, автомобиль, кузов, двигатель, топливо, годы, технические характеристики.
Если в RIV факт не найден, ставь null/пустой массив и добавляй понятное замечание.
Разложи запутанную запись вроде "1.3 Trailblazer" на понятные поля только если соответствующие значения реально есть в переданных данных.
Не называй артикул продавца OEM, если RIV этого прямо не указывает.
Сохрани максимум полезных деталей и сделай понятный русский текст о том, что это за деталь и для каких автомобилей она подходит.`;
 const r=await fetch('https://api.openai.com/v1/chat/completions',{
  method:'POST',
  headers:{'content-type':'application/json',authorization:'Bearer '+key},
  body:JSON.stringify({
   model,
   messages:[
    {role:'system',content:system},
    {role:'user',content:JSON.stringify({source:'RIV.KZ',...input})}
   ],
   temperature:.1,
   response_format:{type:'json_object'}
  })
 });
 if(!r.ok)throw new Error('AI_REQUEST_FAILED '+r.status);
 const j=await r.json();
 return RivExplanationSchema.parse(JSON.parse(j.choices?.[0]?.message?.content||'{}'));
}
