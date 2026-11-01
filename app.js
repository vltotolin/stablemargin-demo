(function(){'use strict';
const core=globalThis.StableMarginCore;
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>!Number.isFinite(Number(n))?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d}).format(Number(n));
const money=x=>Number.isFinite(Number(x))?fmt(x)+' ₽':'—';
const signed=x=>(x>0?'+':'')+money(x);
const csvCell=value=>{let v=String(value??'');if(typeof value==='string'&&/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'};
const pct=x=>(x>0?'+':'')+fmt(x*100,1)+'%';
const tone=x=>x<0?'loss':x>0?'profit':'';
let savedPurchases=[];let preset='cocoa',p={...core.templates[preset]},latest=null,coffeeVals={kg:500,usdStart:10.95,usdEnd:9.90,fxStart:78.3987,fxEnd:85.4173},toastHandle;
function toast(s){const el=$('#toast');el.textContent=s;el.classList.add('visible');clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('visible'),2700)}
function setPreset(name){preset=name;p={...core.templates[name]};$$('[data-preset]').forEach(b=>{let a=b.dataset.preset===preset;b.classList.toggle('is-active',a);b.setAttribute('aria-pressed',String(a))});$$('[data-field]').forEach(el=>el.value=p[el.dataset.field]??'');$$('[data-percent]').forEach(el=>el.value=core.round(p[el.dataset.percent]*100,3));$$('[data-check]').forEach(el=>el.checked=!!p[el.dataset.check]);$('#quantityUnit').textContent=p.unit;$('#lotUnit').textContent=p.unit;$('#sourceLine').textContent='Источник параметров: '+p.reference+'. Не подключено к бирже.';update()}
function read(){
 $$('[data-field]').forEach(el=>{let k=el.dataset.field;p[k]=k==='product'?el.value:core.number(el.value)});
 $$('[data-percent]').forEach(el=>p[el.dataset.percent]=core.number(el.value)/100);
 $$('[data-check]').forEach(el=>p[el.dataset.check]=el.checked);
 const checked=$$('[data-check]').filter(e=>e.checked).length;$('#checkCount').textContent=checked+' из 4';
}
function setText(id,value){$(id).textContent=value}
function classProfit(el,value){el.classList.toggle('profit',value>=0);el.classList.toggle('loss',value<0)}
function update(){read();latest=core.evaluate(p);const r=latest;renderShowcase(r);setText('#decisionTitle',r.title);setText('#decisionReason',r.description);
 const pill=$('#statusPill');const state=r.status==='SCENARIO'?'neutral':r.status==='NO_HEDGE'?'neutral':'blocked';pill.dataset.state=state;
 pill.textContent=({SCENARIO:'Сценарный расчёт',NO_HEDGE:'Защита не требуется',NEED_DATA:'Данные не подтверждены',UNAVAILABLE:'Нет допустимой позиции',UNVIABLE:'Цель недостижима',INPUT_ERROR:'Ошибка ввода'})[r.status]||'Сценарный анализ';
 $('#exportReport').disabled=!r.valid;$('#exportCsv').disabled=!r.valid;$('#exportJson').disabled=!r.valid;$('#exportBank').disabled=!r.valid;
 if(!r.valid){setText('#lotsVal','—');setText('#coverageVal','—');setText('#marginVal','—');setText('#cashVal','—');$('#robustBanner').className='robust-banner danger';$('#robustBanner').textContent='Исправьте значения слева. Ни расчёт, ни выгрузка не выполняются при ошибке ввода.';
 $('#alternatives').innerHTML='';$('#logicItems').innerHTML='';$('#stressRows').innerHTML='';$('#stressChart').innerHTML='';$('#heatHead').innerHTML='';$('#heatBody').innerHTML='';$('#bankRows').innerHTML='';setText('#stressPassed','—');setText('#stressWorst','—');setText('#stressFloor','—');setText('#stressLots','—');return;}
 const e=r.economics,s=r.selected;setText('#lotsVal',fmt(r.proposedLots));setText('#coverageVal',fmt(s.coverage,1)+'% объёма закупки');setText('#marginVal',money(s.targetMargin));classProfit($('#marginVal'),s.targetMargin);setText('#cashVal',money(s.reserve));
 const rb=$('#robustBanner');rb.className='robust-banner';
 const intro=`При позиции ${r.proposedLots} контрактов минимальная прибыль ${money(p.minMargin)} сохраняется в ${s.passed} из ${s.total} сценариев. `;
 if(r.status!=='SCENARIO'&&r.status!=='NO_HEDGE'){rb.classList.add('danger');rb.textContent='Позиция не выбрана: '+r.description+' Альтернативы приведены для сравнения.'}
 else if(s.passed<s.total){rb.textContent=intro+'В остальных сценариях минимальная прибыль не сохраняется. Условия стратегии требуют отдельной проверки.'}
 else{rb.classList.add('positive');rb.textContent=intro+'Сценарии не заменяют анализ фактических цен поставщика и контракта.'}
 renderAlternatives(r);renderLogic(r);renderStress(r);renderHeatmap(r);renderBank(r);
}
function renderShowcase(r){
 const product=r?.input?.product||p.product||'ЗАКУПКА';
 $('#heroCaseName').textContent=product.length>29?product.slice(0,29)+'…':product;
 if(!r?.valid){$('#heroQuestion').textContent='Требуются корректные параметры';$('#heroActionLabel').textContent='Статус расчёта';$('#heroBottomLabel').textContent='Разница результатов';$('#heroUnhedged').textContent='—';$('#heroHedged').textContent='—';$('#heroBenefit').textContent='—';$('#heroLots').textContent='Уточните входные данные';$('#heroStress').textContent='Для анализа не хватает данных';return}
 const first=r.scenarios[0];
 const base=first?.unhedged??0,withPosition=r.selected.targetMargin,delta=withPosition-base;
 const blocked=!['SCENARIO','NO_HEDGE'].includes(r.status);
 $('#heroQuestion').textContent=blocked?'Стратегия недоступна':'Финансовый результат партии';
 $('#heroActionLabel').textContent=blocked?'Статус расчёта':r.status==='NO_HEDGE'?'Без открытия позиции':'С выбранной позицией';
 $('#heroBottomLabel').textContent=blocked?'Причина остановки':'Разница в сценарии';
 $('#heroUnhedged').textContent=money(base);
 $('#heroHedged').textContent=blocked?'Не предложена':money(withPosition);
 $('#heroHedged').style.color=blocked?'#a45245':withPosition<0?'#aa424a':'#087657';
 $('#heroHedged').style.fontSize=blocked?'19px':'';
 $('#heroBenefit').textContent=blocked?'Проверка':signed(delta);
 $('#heroBenefit').style.color=blocked?'#a45245':delta<0?'#b3454c':'#106f61';
 $('#heroLots').textContent=blocked?'Позиция не определена':r.proposedLots+' контр. · '+fmt(r.selected.coverage,1)+'% закупки';
 $('#heroStress').textContent=r.status==='SCENARIO'
 ?'Целевой результат в '+r.selected.passed+' из '+r.selected.total+' стресс-сценариев'
 :r.status==='NO_HEDGE'?'Позиция не требуется':r.title;
 $('#heroTestDot').style.background=r.status==='SCENARIO'&&r.selected.passed===r.selected.total?'#48af92':'#dfaa51';
}
const tourSteps=[
 {preset:'cocoa',tab:'decision',target:'.hero-showcase',title:'Стоимость риска',text:'При росте закупочной цены на 30% прибыль партии становится отрицательной. Сравните результат без позиции и с частичным покрытием.'},
 {preset:'cocoa',tab:'decision',target:'.result-panel',title:'Подбор объёма',text:'В заданном сценарии минимально достаточно 17 контрактов. Полное покрытие требует резерва выше лимита клиента.'},
 {preset:'cocoaStrict',tab:'decision',target:'.result-panel',title:'Проверка денежного лимита',text:'При повышении минимальной прибыли требуемая позиция превышает денежный резерв. Допустимого варианта нет.'},
 {preset:'cocoaBasis',tab:'decision',target:'.result-panel',title:'Контроль исходных данных',text:'Не подтверждена связь цен поставщика и фьючерса. Система останавливает подбор позиции.'},
 {preset:'cocoa',tab:'stress',target:'.stress-panel',title:'Проверка сценариев',text:'Сравните пять сценариев цен. В части из них выбранная позиция не сохраняет необходимую прибыль.'},
 {preset:'cocoa',tab:'bank',target:'.bank-panel',title:'Карточка закупочного риска',text:'Сформирована карточка с параметрами закупки, ограничениями и результатами стресс-тестов для проверки специалистом.'}
];
let tourIndex=-1;
function switchTab(name){$$('[data-tab]').forEach(b=>{let a=b.dataset.tab===name;b.classList.toggle('active',a);b.setAttribute('aria-selected',String(a))});$$('[data-pane]').forEach(x=>x.classList.toggle('active',x.dataset.pane===name));}
function showTourStep(idx){
 tourIndex=Math.max(0,Math.min(idx,tourSteps.length-1));const step=tourSteps[tourIndex];
 setPreset(step.preset);switchTab(step.tab);
 $('#tourPanel').hidden=false;$('#tourTitle').textContent=step.title;$('#tourDesc').textContent=step.text;
 $('#tourCount').textContent=String(tourIndex+1).padStart(2,'0')+' / '+String(tourSteps.length).padStart(2,'0');
 $('#tourProgress').style.width=((tourIndex+1)/tourSteps.length*100)+'%';
 $('#tourPrev').disabled=tourIndex===0;$('#tourPrev').style.opacity=tourIndex===0?'.35':'1';
 $('#tourNext').textContent=tourIndex===tourSteps.length-1?'Завершить ✓':'Дальше →';
 requestAnimationFrame(()=>document.querySelector(step.target)?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function startTour(){showTourStep(0)}
function closeTour(){tourIndex=-1;$('#tourPanel').hidden=true;}
function renderAlternatives(r){const rows=r.strategies;
 $('#alternatives').innerHTML=rows.map(x=>{
 const disabled=!x.withinReserve||!x.withinVolume;
 const klass=x.lots===r.proposedLots?'is-selected':'';
 const mark=disabled?'<span class="tag-bad">Вне лимита</span>':x.passed===x.total?'<span class="tag-good">Цель выполнена</span>':x.passed>0?'<span class="tag-neutral">Частично</span>':'<span class="tag-bad">Не проходит</span>';
 return `<tr class="${klass}"><td><strong>${escapeHTML(x.name)}</strong>${x.lots===r.proposedLots&&r.status==='SCENARIO'?'<span class="subline">Объём по сценарию</span>':''}</td><td class="align-right">${fmt(x.lots)}<span class="subline">${fmt(x.coverage,1)}%</span></td><td class="align-right">${money(x.reserve)}</td><td class="align-right ${tone(x.targetMargin)}">${money(x.targetMargin)}</td><td>${fmt(x.passed)} / ${fmt(x.total)}<br>${mark}</td></tr>`;
 }).join('');
}
function renderLogic(r){const e=r.economics;
 const list=[['Плановая прибыль',money(e.baseMargin)],['Минимальная прибыль',money(p.minMargin)],['Допустимое ухудшение',money(e.allowedDeterioration)],['Удорожание без защиты',money(e.priceLoss)],['Контрактов по лимиту средств',fmt(e.affordableLots)+' шт.'],['Необходимое число в заданном сценарии',Number.isFinite(e.requiredLots)?fmt(e.requiredLots)+' шт.':'Не определено'],['Срок закупки / инструмента',fmt(p.daysToPurchase)+' / '+fmt(p.daysToExpiry)+' дн.'],['Минимальная динамика фьючерса для цели',r.proposedLots>0?fmt(core.requiredFuturesMove(p,r.proposedLots)*100,1)+'%':'Нет выбранной позиции']];
 $('#logicItems').innerHTML=list.map(([n,v])=>`<div class="logic-item"><span>${escapeHTML(n)}</span><strong>${escapeHTML(v)}</strong></div>`).join('');
}
function renderStress(r){const rows=r.scenarios;
 setText('#stressLots',r.proposedLots+' контрактов');setText('#stressPassed',r.selected.passed+' из '+r.selected.total);setText('#stressWorst',money(r.selected.worstMargin));setText('#stressFloor',money(p.minMargin));
 $('#stressRows').innerHTML=rows.map(row=>`<tr><td><strong>${escapeHTML(row.name)}</strong><span class="subline">Закупка ${pct(row.physicalMove)} · фьючерс ${pct(row.futuresMove)}</span></td><td class="align-right ${tone(row.unhedged)}">${money(row.unhedged)}</td><td class="align-right ${tone(row.hedged)}">${money(row.hedged)}</td><td>${row.minMarginMet?'<span class="tag-good">Да</span>':`<span class="tag-bad">Нет · −${money(row.shortfall)}</span>`}</td></tr>`).join('');
 const max=Math.max(1,...rows.map(x=>Math.max(Math.abs(x.unhedged),Math.abs(x.hedged))));
 $('#stressChart').innerHTML=rows.map(row=>`<div class="chart-row"><div class="chart-label">${escapeHTML(row.name)}</div><div class="chart-bars"><div class="bar"><span>Без защиты</span><div class="bar-track"><div class="bar-fill" style="${row.unhedged<0?'right:50%':'left:50%'};width:${Math.max(0,Math.abs(row.unhedged)/max*50).toFixed(2)}%;opacity:${row.unhedged<0?.75:1}"></div></div><b class="bar-number ${tone(row.unhedged)}">${money(row.unhedged)}</b></div><div class="bar"><span>С позицией</span><div class="bar-track"><div class="bar-fill after" style="${row.hedged<0?'right:50%':'left:50%'};width:${Math.max(0,Math.abs(row.hedged)/max*50).toFixed(2)}%;opacity:${row.hedged<0?.75:1}"></div></div><b class="bar-number ${tone(row.hedged)}">${money(row.hedged)}</b></div></div></div>`).join('');
}
function renderHeatmap(r){
 const grid=core.sensitivityGrid(p,r.proposedLots);
 if(!grid.length){$('#heatHead').innerHTML='';$('#heatBody').innerHTML='';return}
 const headers=grid[0].cells.map(c=>c.futuresMove);
 $('#heatHead').innerHTML='<tr><th>Закупка ↓ / фьючерс →</th>'+headers.map(f=>'<th class="align-right">'+pct(f)+'</th>').join('')+'</tr>';
 $('#heatBody').innerHTML=grid.map(row=>'<tr><th>'+pct(row.physicalMove)+'</th>'+row.cells.map(c=>'<td class="align-right" style="background:'+(c.meetsTarget?'#e5f4eb':'#fff0ed')+';color:'+(c.meetsTarget?'#245f48':'#984d44')+';font-weight:700">'+money(c.profit)+'</td>').join('')+'</tr>').join('');
}
function renderBank(r){const e=r.economics,s=r.selected;
 const fields=[['Закупка',p.product],['Объём',fmt(p.quantity,2)+' '+p.unit],['Стоимость закупки',money(e.baseCost)],['Плановая прибыль партии',money(e.baseMargin)],['Минимально допустимая прибыль',money(p.minMargin)],['Стресс удорожания закупки',pct(p.physicalMove)],['Изменение фьючерса (допущение)',pct(p.futuresMove)],['Инструмент (справочно)',p.symbol],['Срок закупки / контракта',p.daysToPurchase+' / '+p.daysToExpiry+' дней'],['Результат анализа',r.title],['Условная позиция',r.proposedLots+' контрактов'],['Резерв в сценарии',money(s.reserve)],['Соблюдено стресс-сценариев',s.passed+' из '+s.total],['Подтверждение документов','Декларировано пользователем, не проверено программой'],['Статус передачи','Не передавалось в банк']];
 $('#bankRows').innerHTML=fields.map(([a,b])=>`<div class="bank-line"><span>${escapeHTML(a)}</span><strong>${escapeHTML(b)}</strong></div>`).join('');
}
function coffee(){const v={};$$('[data-coffee]').forEach(el=>v[el.dataset.coffee]=core.number(el.value));coffeeVals=v;const r=core.coffeeDecomposition(v);
 if(!r.ok){setText('#coffeePrice','—');setText('#coffeeFx','—');setText('#coffeeRub','—');$('#coffeeEffects').textContent=r.error;return}
 setText('#coffeePrice',fmt(r.pricePct,2)+'%');setText('#coffeeFx','+'+fmt(r.fxPct,2)+'%');setText('#coffeeRub',fmt(r.rubPct,2)+'%');
 $('#coffeeEffects').innerHTML=[['Рублёвый эквивалент до изменения',money(r.start)],['Влияние изменения долларовой цены',signed(r.commodity)],['Влияние изменения курса на конечный долларовый объём',signed(r.currency)],['Рублёвый эквивалент после изменения',money(r.end)],['Итоговое изменение',signed(r.delta)]].map(([a,b])=>`<div class="decomp"><span>${escapeHTML(a)}</span><b>${escapeHTML(b)}</b></div>`).join('');
}
function save(filename,contents,mime){const blob=new Blob([contents],{type:mime});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Файл подготовлен для скачивания')}
function csv(){if(!latest?.valid)return;const header=['Сценарий','Изменение закупки %','Изменение фьючерса %','Прибыль без позиции ₽','Прибыль с позицией ₽','Соответствует цели'];const records=latest.scenarios.map(s=>[s.name,s.physicalMove*100,s.futuresMove*100,s.unhedged,s.hedged,s.minMarginMet?'Да':'Нет']);const result='\uFEFF'+[header,...records].map(row=>row.map(csvCell).join(';')).join('\r\n');save('StableMargin_stress_scenarios.csv',result,'text/csv;charset=utf-8')}
function json(){if(!latest?.valid)return;save('StableMargin_purchase_review.json',JSON.stringify(core.passport(p,latest),null,2),'application/json;charset=utf-8')}
function report(){if(!latest?.valid)return;const r=latest,rows=r.scenarios,uid=Date.now().toString(36);
 const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>StableMargin — сценарная карточка ${uid}</title><style>body{font-family:Arial,sans-serif;color:#17354a;max-width:800px;margin:35px auto;padding:0 22px;line-height:1.6;font-size:13px}h1{color:#143c5c}h2{margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:8px}.notice{padding:12px 16px;background:#fff4e9;border-left:3px solid #ba8650}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;padding:12px;background:#f1f6fa}.stats span{font-size:11px;color:#667e8f;display:block}.stats strong{font-size:19px}table{border-collapse:collapse;width:100%;margin-top:15px}th,td{text-align:left;border-bottom:1px solid #d7e2e9;padding:9px}th{background:#eef4f7}.foot{color:#718393;font-size:11px;margin-top:35px}@media print{body{margin:5mm auto}}</style></head><body><h1>StableMargin / Расчёт закупочного риска</h1><p>Дата: ${escapeHTML(new Date().toLocaleString('ru-RU'))} · Версия 2.2 · Команда «Дихотомия»</p><div class="notice"><b>Не является финансовой рекомендацией или заявкой в банк.</b> Все проверки документа, ценовой связи и ликвидности в этой версии отмечаются вручную, а котировки не загружаются.</div><h2>${escapeHTML(p.product)}</h2><p>Объём: ${fmt(p.quantity,2)} ${escapeHTML(p.unit)} · Справочный инструмент: ${escapeHTML(p.symbol)} · Стресс закупки ${pct(p.physicalMove)} / фьючерса ${pct(p.futuresMove)}.</p><h2>Предварительный вывод</h2><p><b>${escapeHTML(r.title)}</b> — ${escapeHTML(r.description)}</p><div class="stats"><div><span>Контракты</span><strong>${fmt(r.proposedLots)}</strong></div><div><span>Прибыль при стрессе</span><strong>${money(r.selected.targetMargin)}</strong></div><div><span>Условный резерв</span><strong>${money(r.selected.reserve)}</strong></div></div><h2>Сценарная чувствительность</h2><table><tr><th>Сценарий</th><th>Без защиты</th><th>С позицией</th><th>Цель</th></tr>${rows.map(s=>`<tr><td>${escapeHTML(s.name)}</td><td>${money(s.unhedged)}</td><td>${money(s.hedged)}</td><td>${s.minMarginMet?'Выполнена':'Не выполнена'}</td></tr>`).join('')}</table><h2>Ограничения</h2><p>${r.limitations.map(x=>escapeHTML(x)).join('; ')}. Реальная доходность сделки, ликвидность рынка, исторический клиринг и связь поставщика с фьючерсом не подтверждены.</p><p class="foot">Этот файл сформирован локально в браузере. Сервис не передавал данные в ВТБ, брокеру или на сервер. Для печати: Ctrl+P.</p></body></html>`;
 save('StableMargin_analytic_report.html',html,'text/html;charset=utf-8');
}
function bank(){report()}
function renderQueue(){
 $('#queueCounter').textContent=String(savedPurchases.length);
 $('#purchaseQueue').innerHTML=savedPurchases.length?savedPurchases.map(x=>`<div class="queue-item"><div><strong>${escapeHTML(x.product)}</strong><small>${escapeHTML(x.title)} · ${money(x.value)} · ${fmt(x.lots)} контрактов · ${escapeHTML(x.time)}</small></div><div class="queue-actions"><button type="button" data-queue-open="${escapeHTML(x.id)}">Открыть</button><button type="button" data-queue-delete="${escapeHTML(x.id)}">Убрать</button></div></div>`).join(''):'<div class="queue-empty">Здесь пока нет закупок. Задайте параметры слева и нажмите «Сохранить расчёт».</div>';
 $$('[data-queue-open]').forEach(b=>b.addEventListener('click',()=>{
  const entry=savedPurchases.find(x=>x.id===b.dataset.queueOpen);if(!entry)return;
  p={...entry.snapshot};preset=entry.preset;
  $$('[data-preset]').forEach(x=>{const active=x.dataset.preset===preset;x.classList.toggle('is-active',active);x.setAttribute('aria-pressed',String(active))});
  $$('[data-field]').forEach(el=>el.value=p[el.dataset.field]??'');$$('[data-percent]').forEach(el=>el.value=core.round(p[el.dataset.percent]*100,3));$$('[data-check]').forEach(el=>el.checked=!!p[el.dataset.check]);
  $('#quantityUnit').textContent=p.unit;$('#lotUnit').textContent=p.unit;$('#sourceLine').textContent='Источник параметров: '+p.reference+'. Не подключено к бирже.';update();
  document.querySelector('[data-tab="decision"]').click();toast('Закупка открыта из рабочего списка')
 }));
 $$('[data-queue-delete]').forEach(b=>b.addEventListener('click',()=>{savedPurchases=savedPurchases.filter(x=>x.id!==b.dataset.queueDelete);renderQueue()}));
}
function savePurchase(){if(!latest?.valid){toast('Сначала исправьте ошибки ввода');return}if(savedPurchases.length>=12){toast('В рабочем списке можно сохранить до 12 закупок');return}
 savedPurchases.push({id:'p'+Date.now()+'_'+savedPurchases.length,product:p.product,title:latest.title,value:latest.economics.baseCost,lots:latest.proposedLots,time:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),snapshot:{...p},preset});renderQueue();toast('Закупка добавлена в рабочий список')}
function exportQueue(){if(!savedPurchases.length){toast('Список закупок пока пуст');return}const header=['Наименование','Стоимость закупки ₽','Статус оценки','Контракты','Время'];const rows=savedPurchases.map(x=>[x.product,x.value,x.title,x.lots,x.time]);const content='\uFEFF'+[header,...rows].map(a=>a.map(csvCell).join(';')).join('\r\n');save('StableMargin_purchase_register.csv',content,'text/csv;charset=utf-8')}

$$('[data-preset]').forEach(b=>b.addEventListener('click',()=>{setPreset(b.dataset.preset);toast('Загружен пример: '+b.querySelector('strong').textContent)}));
$$('[data-field],[data-percent],[data-check]').forEach(el=>{el.addEventListener('input',update);el.addEventListener('change',update)});
$$('[data-coffee]').forEach(el=>{el.addEventListener('input',coffee);el.addEventListener('change',coffee)});
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{const tab=b.dataset.tab;$$('[data-tab]').forEach(x=>{const a=x.dataset.tab===tab;x.classList.toggle('active',a);x.setAttribute('aria-selected',String(a))});$$('[data-pane]').forEach(x=>x.classList.toggle('active',x.dataset.pane===tab))}));
$('#startTour').addEventListener('click',startTour);
$('#heroTour').addEventListener('click',startTour);
$('#tourClose').addEventListener('click',closeTour);
$('#tourNext').addEventListener('click',()=>tourIndex>=tourSteps.length-1?closeTour():showTourStep(tourIndex+1));
$('#tourPrev').addEventListener('click',()=>showTourStep(tourIndex-1));
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&tourIndex!==-1)closeTour()});
$('#savePurchase').addEventListener('click',savePurchase);$('#queueExport').addEventListener('click',exportQueue);
$('#reset').addEventListener('click',()=>{setPreset(preset);toast('Исходный пример восстановлен')});
$('#exportReport').addEventListener('click',report);$('#exportCsv').addEventListener('click',csv);$('#exportJson').addEventListener('click',json);$('#exportBank').addEventListener('click',bank);
$$('[data-coffee]').forEach(x=>x.value=coffeeVals[x.dataset.coffee]);setPreset('cocoa');coffee();renderQueue();
})();
