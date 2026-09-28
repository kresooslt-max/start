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
 warnings:z.array(z.string()),
 sources:z.array(z.object({title:z.string(),url:z.string()}))
});

export async function generateRivExplanation(input:any){
 const key=process.env.AI_API_KEY;
 if(!key)throw new Error('AI_API_KEY_MISSING');
 const model=process.env.AI_MODEL||'gpt-4o';
 const system=`Ты эксперт по автозапчастям.
На первом этапе пользователь передал ТОЛЬКО реальные данные карточки RIV.KZ: артикул, название, фото и внутреннее описание/применяемость.
Твоя задача на втором этапе — разобраться, что означает эта запись, и найти недостающие сведения через переданные web-источники.
Сначала определи реальную марку/модель/деталь по тексту RIV.
Разложи сокращения и записи вроде "1.3 Trailblazer" на нормальные поля.
Найди подтвержденные OEM/оригинальные номера, годы, кузов, двигатель, топливо и цену, когда это есть в web-источниках.
Подробно опиши применяемость.
Не выдавай догадки как факты. При конфликте источников укажи это в warnings.
Если факт не удалось подтвердить — оставь null/пусто.
Не считай артикул продавца OEM.
sources должны содержать реальные URL, использованные для существенных фактов.
Верни только JSON по схеме.`;
 const response=await fetch('https://api.openai.com/v1/chat/completions',{
  method:'POST',
  headers:{'content-type':'application/json',authorization:'Bearer '+key},
  body:JSON.stringify({
   model,
   messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(input)}],
   temperature:.1,
   response_format:{type:'json_object'}
  })
 });
 if(!response.ok)throw new Error('AI_REQUEST_FAILED '+response.status);
 const j=await response.json();
 return RivExplanationSchema.parse(JSON.parse(j.choices?.[0]?.message?.content||'{}'));
}


export const CardSuggestionSchema=z.object({
 name:z.string().nullable(),
 annotation:z.string().nullable(),
 description:z.string().nullable(),
 hashtags:z.array(z.string()),
 manufacturer_part_number:z.string().nullable(),
 tn_ved:z.string().nullable(),
 compatibility:z.array(z.any()),
 oem:z.array(z.string()),
 characteristics:z.record(z.string(),z.string())
});

export async function generateCardSuggestion(product:any){
 const key=process.env.AI_API_KEY;if(!key)throw new Error('AI_API_KEY_MISSING');
 const model=process.env.AI_MODEL||'gpt-4o';
 const response=await fetch('https://api.openai.com/v1/chat/completions',{
  method:'POST',
  headers:{'content-type':'application/json',authorization:'Bearer '+key},
  body:JSON.stringify({
   model,
   messages:[
    {role:'system',content:'Return JSON only. This legacy endpoint is retained only so unused legacy routes can compile. Never invent facts; use supplied data only.'},
    {role:'user',content:JSON.stringify(product)}
   ],
   temperature:.1,
   response_format:{type:'json_object'}
  })
 });
 if(!response.ok)throw new Error('AI_REQUEST_FAILED '+response.status);
 const j=await response.json();
 return CardSuggestionSchema.parse(JSON.parse(j.choices?.[0]?.message?.content||'{}'));
}
