export const money=(v:number|null|undefined)=>v==null?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'KZT',maximumFractionDigits:0}).format(v);
export const num=(v:number|null|undefined)=>v==null?'—':new Intl.NumberFormat('ru-RU').format(v);
export const pct=(v:number|null|undefined)=>v==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(v)+'%';
