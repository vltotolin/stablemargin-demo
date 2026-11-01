(function(){
'use strict';
const core=globalThis.StableMarginCore;let preset='cocoa';let current={...core.templates.cocoa};let latest;
const q=s=>document.querySelector(s),qa=s=>Array.from(document.querySelectorAll(s));
const fmt=(n,d=0)=>n===undefined||!Number.isFinite(Number(n))?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d}).format(Number(n));
const rub=(n)=>fmt(n)+' ₽';
const html=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=n=>fmt(n*100,1)+'%';
function fill(){
 qa('[data-field]').forEach(el=>el.value=current[el.dataset.field]??'');
 qa('[data-percent]').forEach(el=>el.value=core.ROUND((current[el.dataset.percent]||0)*100,2));
 qa('[data-check]').forEach(el=>el.checked=!!current[el.dataset.check]);
 q('#quantityUnit').textContent=current.unit; q('#lotUnit').textContent=current.unit;
 qa('[data-preset]').forEach(el=>el.classList.toggle('active',el.dataset.preset===preset));
 update();
}
function read(){
 qa('[data-field]').forEach(el=>current[el.dataset.field]=el.dataset.field==='product'?el.value:(el.value.trim()===''?NaN:Number(el.value)));
 qa('[data-percent]').forEach(el=>current[el.dataset.percent]=(el.value.trim()===''?NaN:Number(el.value)/100));
 qa('[data-check]').forEach(el=>current[el.dataset.check]=el.checked);
}
function update(){
 read();const res=core.evaluate(current);latest=res;
 q('#statusCode').textContent=res.status||'ERROR';
 const verdict=q('.verdict');verdict.className='verdict '+(res.status==='CANDIDATE'?'':res.status==='NO_HEDGE'?'warn':'stop');
 q('#decisionTitle').textContent=res.label;
 q('#decisionReason').textContent=res.reason;
 q('#lotsVal').textContent=res.lots===undefined?'—':fmt(res.lots);
 q('#coverageVal').textContent=res.coverage===undefined?'Проверка входных данных':fmt(res.coverage,1)+'% номинального объёма';
 q('#marginVal').textContent=res.scenarioMargin===undefined?'—':rub(res.scenarioMargin);
 q('#marginVal').style.color=res.scenarioMargin<0?'#a33b3b':'#192d43';
 q('#cashVal').textContent=res.cashRequired===undefined?'—':rub(res.cashRequired);
 q('#marginNote').textContent='прибыль/убыток в условном сценарии';
 q('#cashNote').textContent='ГО + стресс + расходы';
 q('#exportJson').disabled=res.status==='INPUT_ERROR';
 q('#exportCsv').disabled=res.status==='INPUT_ERROR';
 const show=res.status!=='INPUT_ERROR';
 q('#explainBox').innerHTML=show? `<p><b>Почему так:</b> базовая маржа ${rub(res.baseMargin)}; риск удорожания ${rub(res.stressPhysicalIncrease)}; допустимое ухудшение ${rub(res.maximumLoss)}. Один контракт требует приблизительно ${rub(res.perContractReserve)} условного денежного резерва. Это не расчёт реальных клиринговых списаний.</p>`:'<p>Исправьте исходные значения для получения сценарного результата.</p>';
 let comparisonN=res.lots||0;
 if(show){const rs=core.stressOutcomes(current,comparisonN);q('#scenarios').innerHTML=rs.map(row=>`<tr><td>${html(row.name)}<br><span style="color:#9aa8b5;font-size:10px">сырьё ${percent(row.physicalMove)} · фьючерс ${percent(row.futuresMove)}</span></td><td class="${row.without<0?'negative':''}">${rub(row.without)}</td><td class="${row.with<0?'negative':''}">${rub(row.with)}</td><td class="${row.difference<0?'negative':'positive'}">${row.difference>0?'+':''}${rub(row.difference)}</td></tr>`).join('');
 q('#scenarioFoot').textContent= (comparisonN>0?'В таблице удерживается постоянная позиция '+comparisonN+' контрактов.':'В таблице позиция не открывается, поскольку рекомендация не выдана.')+' Сценарии ниже не заменяют анализ исторического базиса и клиринга.';
 const elements=[['Начальная маржа',res.baseMargin,'₽'],['Максимально допустимое удорожание',res.maximumLoss,'₽'],['Удорожание без защиты',res.stressPhysicalIncrease,'₽'],['Контрактов помещается в денежный лимит',res.affordableLots,'шт.'],['Контрактов нужно по выбранному стрессу',res.necessaryLots??'Не рассчитывается','шт.']];
 q('#mathSteps').innerHTML=elements.map(([a,b,u])=>`<div class="math-step"><span>${html(a)}</span><b>${typeof b==='number'?fmt(b,0):html(b)} ${u}</b></div>`).join('');
 }else {q('#scenarios').innerHTML='';q('#mathSteps').innerHTML='';q('#scenarioFoot').textContent='—';}
}
function download(filename,data,type){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportJson(){if(!latest || latest.status==='INPUT_ERROR') return; const d=core.passport(current,latest);download('StableMargin_decision_demo.json',JSON.stringify(d,null,2),'application/json;charset=utf-8')}
function exportCsv(){if(!latest || latest.status==='INPUT_ERROR') return; const rows=core.stressOutcomes(current,latest?.lots||0);const cells=[['Сценарий','Изменение цены закупки, %','Изменение фьючерса, %','Без хеджа, руб','С хеджем, руб','Разница, руб'],...rows.map(a=>[a.name,a.physicalMove*100,a.futuresMove*100,a.without,a.with,a.difference])];const text='\uFEFF'+cells.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');download('StableMargin_scenarios.csv',text,'text/csv;charset=utf-8')}
function coffee(){const q=500,a=10.95,b=9.9,fx1=78.3987,fx2=85.4173;
 const rub1=q*a*fx1,rub2=q*b*fx2,comEffect=q*(b-a)*fx1,fxEffect=q*b*(fx2-fx1);
 qEl('#coffeeResult').innerHTML=[['Изменение цены в долларах',percent(b/a-1),'10,95 → 9,90 USD/кг'],['Изменение курса доллара',percent(fx2/fx1-1),'78,3987 → 85,4173 RUB/USD'],['Рублёвая стоимость партии',percent(rub2/rub1-1),rub(rub1)+' → '+rub(rub2)]].map(([name,v,note])=>`<div class="coffee-num"><span>${name}</span><strong>${v}</strong><small>${note}</small></div>`).join('');
 function qEl(s){return document.querySelector(s)}
 console.info('Расчёт кофе: товарный фактор:',core.ROUND(comEffect),'валютный фактор:',core.ROUND(fxEffect),'сумма:',core.ROUND(comEffect+fxEffect));
}
qa('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>{preset=btn.dataset.preset;current={...core.templates[preset]};fill()}));
q('#reset').addEventListener('click',()=>{current={...core.templates[preset]};fill()});
qa('[data-field],[data-percent],[data-check]').forEach(el=>{el.addEventListener('input',update);el.addEventListener('change',update)});
q('#exportJson').addEventListener('click',exportJson);q('#exportCsv').addEventListener('click',exportCsv);
fill();coffee();
})();
