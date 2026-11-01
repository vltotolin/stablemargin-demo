/* StableMargin 2.2 | Scenario and risk assessment engine.
   Public offline demonstration. No quotes, brokerage integration, execution, or advice. */
(function(root){
'use strict';
const round=(x,p=2)=>Number(Number(x).toFixed(p));
const number=x=>{if(x===null||x===undefined||String(x).trim()==='')return NaN;const y=Number(String(x).trim().replace(',','.'));return Number.isFinite(y)?y:NaN};
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const META={version:'2.2.0',demo:true,marketData:'MANUAL',tradeExecution:false,brokerConnected:false,valuation:'scenarios-not-forecasts'};
const fields=['quantity','purchasePrice','futuresPrice','lot','revenue','otherCosts','minMargin','cashLimit','guarantee','stressDrawdownPerUnit','feePerContract','physicalMove','futuresMove','daysToPurchase','daysToExpiry'];
function normalize(input){const p={...input};for(const key of fields)p[key]=number(p[key]);return p}
function validate(p){
 for(const key of fields)if(!Number.isFinite(p[key]))return {ok:false,message:'Укажите корректное число в поле «'+key+'».'};
 if([p.quantity,p.purchasePrice,p.futuresPrice,p.lot].some(v=>v<=0))return {ok:false,message:'Объём, цены и размер лота должны быть положительными.'};
 if([p.revenue,p.otherCosts,p.minMargin,p.cashLimit,p.guarantee,p.stressDrawdownPerUnit,p.feePerContract].some(v=>v<0))return {ok:false,message:'Денежные величины и издержки не могут быть отрицательными.'};
 if(p.physicalMove< -1||p.futuresMove< -1||p.physicalMove>2||p.futuresMove>2)return {ok:false,message:'Изменение цен допускается от −100% до +200%.'};
 if(p.daysToPurchase<0||p.daysToExpiry<0||p.daysToPurchase>3650||p.daysToExpiry>3650)return {ok:false,message:'Сроки должны быть в пределах 0–3650 дней.'};
 if(p.quantity*p.purchasePrice>1e13 || p.revenue>1e13 || p.lot>1e9 || p.cashLimit>1e13)return {ok:false,message:'Слишком большое значение для демонстрационной модели.'};
 return {ok:true};
}
function economics(p){
 const baseCost=p.quantity*p.purchasePrice,baseMargin=p.revenue-p.otherCosts-baseCost;
 const allowedDeterioration=baseMargin-p.minMargin;
 const maxLots=Math.floor((p.quantity+1e-8)/p.lot);
 const perLotReserve=p.guarantee+p.lot*p.stressDrawdownPerUnit+p.feePerContract;
 const maxCashLots=perLotReserve>0?Math.floor((p.cashLimit+1e-8)/perLotReserve):maxLots;
 const affordableLots=Math.max(0,Math.min(maxLots,maxCashLots));
 const priceLoss=baseCost*p.physicalMove;
 const hedgePerLot=p.lot*p.futuresPrice*p.futuresMove-p.feePerContract;
 const requiredLots=priceLoss<=allowedDeterioration?0:hedgePerLot>0?Math.max(0,Math.ceil((priceLoss-allowedDeterioration-1e-8)/hedgePerLot)):Infinity;
 return {baseCost,baseMargin,allowedDeterioration,maxLots,perLotReserve,maxCashLots,affordableLots,priceLoss,hedgePerLot,requiredLots};
}
function scenarioSet(p){
 const phys=p.physicalMove,fut=p.futuresMove;
 return [
  {id:'target',name:'Заданный сценарий',detail:'Стресс клиента',physicalMove:phys,futuresMove:fut},
  {id:'weak',name:'Биржа реагирует слабее',detail:'Товарный базис',physicalMove:phys,futuresMove:round(fut*.667,4)},
  {id:'divergence',name:'Расхождение цен',detail:'Биржа идёт против закупки',physicalMove:phys,futuresMove:-.10},
  {id:'sharp',name:'Удорожание сильнее',detail:'Усиленный стресс',physicalMove:clamp(phys+Math.max(.1,Math.abs(phys)*.4),-1,2),futuresMove:round(fut*.75,4)},
  {id:'fall',name:'Сырьё дешевеет',detail:'Риск излишнего хеджа',physicalMove:-.2,futuresMove:-.2},
 ];
}
function scenarioResult(p,lots,s){
 const base=p.revenue-p.otherCosts-p.quantity*p.purchasePrice;
 const physicalLoss=p.quantity*p.purchasePrice*s.physicalMove;
 const futuresPnl=lots*p.lot*p.futuresPrice*s.futuresMove;
 const fees=lots*p.feePerContract;
 const unhedged=base-physicalLoss,hedged=unhedged+futuresPnl-fees;
 return {id:s.id,name:s.name,detail:s.detail,physicalMove:s.physicalMove,futuresMove:s.futuresMove,
  unhedged:round(unhedged),hedged:round(hedged),benefit:round(hedged-unhedged),futuresPnl:round(futuresPnl),fees:round(fees),
  minMarginMet:hedged+1e-8>=p.minMargin,shortfall:round(Math.max(0,p.minMargin-hedged))};
}
function position(p,lots,scenarios){
 const e=economics(p),n=Number(lots);
 const rows=scenarios.map(s=>scenarioResult(p,n,s));
 return {lots:n,coverage:round(n*p.lot/p.quantity*100,1),reserve:round(n*e.perLotReserve),
  withinReserve:n<=e.affordableLots,withinVolume:n<=e.maxLots,
  passed:rows.filter(s=>s.minMarginMet).length,total:rows.length,
  worstMargin:Math.min(...rows.map(r=>r.hedged)),scenarioRows:rows,
  targetMargin:rows[0].hedged,netBenefitTarget:rows[0].benefit};
}
function evaluate(input){
 const p=normalize(input),v=validate(p);
 if(!v.ok)return {status:'INPUT_ERROR',title:'Проверьте исходные данные',description:v.message,valid:false,product:p.product||'',input:p,meta:META};
 const e=economics(p),scenarios=scenarioSet(p);
 const checks=[{id:'hasDocument',label:'Подтверждение будущей закупки',ok:!!p.hasDocument},
 {id:'basisChecked',label:'Связь закупочной цены с инструментом',ok:!!p.basisChecked},
 {id:'quoteFresh',label:'Актуальность котировки',ok:!!p.quoteFresh},
 {id:'liquidityChecked',label:'Ликвидность контракта',ok:!!p.liquidityChecked}];
 let status='SCENARIO',title='Предварительный сценарный расчёт',description='Объём рассчитан для введённых предположений. Это не торговая рекомендация.';
 let proposedLots=0;
 if(e.allowedDeterioration<0){status='UNVIABLE';title='Исходная экономика не соответствует цели';description='Маржа до изменения цены уже ниже минимально допустимой.'}
 else if(checks.some(c=>!c.ok)){status='NEED_DATA';title='Для решения не хватает подтверждений';description='Отметки ниже пока не заменяют проверку документов и рыночных данных.'}
 else if(p.daysToExpiry<p.daysToPurchase){status='UNAVAILABLE';title='Контракт истекает раньше закупки';description='Срок инструмента не перекрывает срок закупки. Перенос позиции на другую серию не моделируется.'}
 else if(e.priceLoss<=e.allowedDeterioration+1e-8){status='NO_HEDGE';title='В выбранном стрессе защита не требуется';description='Результат без хеджа остаётся выше минимально допустимого.'}
 else if(e.maxLots<1){status='UNAVAILABLE';title='Закупка меньше одного лота';description='Номинальный объём контракта не помещается в закупку.'}
 else if(e.hedgePerLot<=0){status='UNAVAILABLE';title='В этом сценарии защита не работает';description='Результат фьючерса на лот не компенсирует его издержки.'}
 else if(e.requiredLots>e.maxLots){status='UNAVAILABLE';title='Не хватает доступного объёма контрактов';description='Даже номинальное покрытие всей закупки не выполняет выбранную цель.'}
 else if(e.requiredLots>e.affordableLots){status='UNAVAILABLE';title='Защита не укладывается в денежный лимит';description:'Нужное количество контрактов превышает лимит с учётом условного денежного резерва.'}
 else {proposedLots=e.requiredLots;status='SCENARIO';}
 const candidates=[{id:'none',name:'Без хеджирования',lots:0}];
 if(e.requiredLots>0&&Number.isFinite(e.requiredLots)&&e.requiredLots<=e.maxLots)candidates.push({id:'minimum',name:'Минимально достаточно',lots:e.requiredLots});
 if(e.affordableLots>0)candidates.push({id:'affordable',name:'Максимум по резерву',lots:e.affordableLots});
 if(e.maxLots>0)candidates.push({id:'full',name:'Номинальное покрытие',lots:e.maxLots});
 const seen=new Set();const unique=candidates.filter(c=>{if(seen.has(c.lots))return false;seen.add(c.lots);return true});
 const strategies=unique.map(c=>({...c,...position(p,c.lots,scenarios)}));
 const selected=position(p,proposedLots,scenarios);
 // Manual checks are demo declarations, never automated validation.
 return {valid:true,meta:META,input:p,economics:e,checks,status,title,description,proposedLots,
  selected,strategies,scenarios: selected.scenarioRows,
  scenarioPass: selected.passed,scenarioTotal:selected.total,
  selectedRobust:selected.passed===selected.total,
  hasCriticalIssue:checks.some(c=>!c.ok)||selected.reserve>p.cashLimit+1e-8,
  limitations:['Цены и гарантии вводятся вручную','Проверки данных показаны учебными переключателями','Клиринг и базис не подтверждены системой','Выбранные стрессы не являются прогнозом','Исполнение сделки отсутствует']};
}
function sensitivityGrid(input,lots){
 const p=normalize(input),v=validate(p);if(!v.ok)return [];
 const physicalShocks=[-.10,0,round(p.physicalMove*.5,4),p.physicalMove,clamp(round(p.physicalMove*1.5,4),-1,2)];
 const futuresShocks=[-.15,0,round(p.futuresMove*.5,4),p.futuresMove,clamp(round(p.futuresMove*1.3,4),-1,2)];
 return physicalShocks.map(ph=>({physicalMove:ph,cells:futuresShocks.map(fu=>{
   const result=scenarioResult(p,lots,{id:'matrix',name:'Ячейка',physicalMove:ph,futuresMove:fu});
   return {futuresMove:fu,profit:result.hedged,meetsTarget:result.minMarginMet};
 })}));
}
function requiredFuturesMove(input,lots,physicalMove){
 const p=normalize(input),v=validate(p);if(!v.ok||lots<=0)return null;
 const e=economics(p),change=Number.isFinite(physicalMove)?physicalMove:p.physicalMove;
 return (e.baseCost*change-e.allowedDeterioration+lots*p.feePerContract)/(lots*p.lot*p.futuresPrice);
}
function coffeeDecomposition({kg=500,usdStart=10.95,usdEnd=9.9,fxStart=78.3987,fxEnd=85.4173}={}){
 const vals=[kg,usdStart,usdEnd,fxStart,fxEnd].map(number);
 if(vals.some(x=>!Number.isFinite(x)||x<=0))return {ok:false,error:'Все пять параметров должны быть положительными числами.'};
 const [q,p0,p1,r0,r1]=vals, start=q*p0*r0,end=q*p1*r1;
 const commodity=(p1-p0)*q*r0,currency=(r1-r0)*q*p1;
 return {ok:true,kg:q,usdStart:p0,usdEnd:p1,fxStart:r0,fxEnd:r1,
  start:round(start),end:round(end),delta:round(end-start),commodity:round(commodity),currency:round(currency),
  pricePct:round((p1/p0-1)*100,2),fxPct:round((r1/r0-1)*100,2),rubPct:round((end/start-1)*100,2),
  identityError:round((commodity+currency)-(end-start),6)};
}
function passport(p,r){if(!r?.valid)return null;
 return {name:'StableMargin',version:META.version,createdAt:new Date().toISOString(),
 status:'СЦЕНАРНЫЙ АНАЛИЗ, НЕ ИНСТРУКЦИЯ К СДЕЛКЕ',bankStatus:'НЕ ПЕРЕДАВАЛОСЬ В БАНК',
 purchase:{product:p.product,unit:p.unit,quantity:r.input.quantity,purchasePriceRub:r.input.purchasePrice,revenueRub:r.input.revenue,otherCostsRub:r.input.otherCosts},
 scenario:{daysToPurchase:r.input.daysToPurchase,daysToExpiry:r.input.daysToExpiry,priceChangePct:round(r.input.physicalMove*100),futureChangePct:round(r.input.futuresMove*100),futurePriceRub:r.input.futuresPrice,symbol:p.symbol,source:p.reference},
 limits:{minimumMarginRub:r.input.minMargin,cashLimitRub:r.input.cashLimit},
 validation:r.checks.map(c=>({label:c.label,checkedInDemo:c.ok,independentlyVerified:false})),
 decision:{status:r.status,title:r.title,conditionalLots:r.proposedLots,coveragePct:r.selected.coverage,cashReserveRub:r.selected.reserve,scenarioMarginRub:r.selected.targetMargin,scenarioPassCount:r.scenarioPass,scenarioCount:r.scenarioTotal},
 alternatives:r.strategies.map(s=>({name:s.name,lots:s.lots,reserveRub:s.reserve,targetMarginRub:s.targetMargin,stressPassed:s.passed,stressTotal:s.total})),
 limitations:r.limitations};
}
const templates={
 cocoa:{key:'cocoa',product:'Партия какао',symbol:'CCX6 (историческая серия)',unit:'кг',quantity:500,purchasePrice:450,futuresPrice:455.2,lot:10,revenue:360000,otherCosts:75000,minMargin:15000,cashLimit:60000,guarantee:1851.29,stressDrawdownPerUnit:65.3,feePerContract:30,physicalMove:.3,futuresMove:.3,daysToPurchase:30,daysToExpiry:45,hasDocument:true,basisChecked:true,quoteFresh:true,liquidityChecked:true,reference:'Сценарные параметры; исторический срез CCX6 на 30.10.2026'},
 cocoaStrict:{key:'cocoaStrict',product:'Какао: повышенная требуемая маржа',symbol:'CCX6 (историческая серия)',unit:'кг',quantity:500,purchasePrice:450,futuresPrice:455.2,lot:10,revenue:360000,otherCosts:75000,minMargin:25000,cashLimit:60000,guarantee:1851.29,stressDrawdownPerUnit:65.3,feePerContract:30,physicalMove:.3,futuresMove:.3,daysToPurchase:30,daysToExpiry:45,hasDocument:true,basisChecked:true,quoteFresh:true,liquidityChecked:true,reference:'Условный пример с более строгим требованием'},
 cocoaBasis:{key:'cocoaBasis',product:'Какао: неизвестная связь цен',symbol:'CCX6 (историческая серия)',unit:'кг',quantity:500,purchasePrice:450,futuresPrice:455.2,lot:10,revenue:360000,otherCosts:75000,minMargin:15000,cashLimit:60000,guarantee:1851.29,stressDrawdownPerUnit:65.3,feePerContract:30,physicalMove:.3,futuresMove:.3,daysToPurchase:30,daysToExpiry:45,hasDocument:true,basisChecked:false,quoteFresh:true,liquidityChecked:true,reference:'Закупочная цена не сверена с CCX6'},
 cny:{key:'cny',product:'Платёж поставщику в юанях',symbol:'CNY/RUB (учебный контракт)',unit:'CNY',quantity:100000,purchasePrice:10.83,futuresPrice:10.85,lot:1000,revenue:1650000,otherCosts:250000,minMargin:200000,cashLimit:60000,guarantee:1200,stressDrawdownPerUnit:.25,feePerContract:25,physicalMove:.16,futuresMove:.16,daysToPurchase:60,daysToExpiry:90,hasDocument:true,basisChecked:true,quoteFresh:true,liquidityChecked:true,reference:'Все значения контракта учебные, не действующая серия биржи'},
 coffee:{key:'coffee',product:'Закупка зелёного кофе',symbol:'COFFEE (условные параметры)',unit:'кг',quantity:500,purchasePrice:845.63,futuresPrice:850,lot:4.5359,revenue:700000,otherCosts:125000,minMargin:30000,cashLimit:85000,guarantee:1800,stressDrawdownPerUnit:100,feePerContract:40,physicalMove:.25,futuresMove:.2,daysToPurchase:45,daysToExpiry:65,hasDocument:true,basisChecked:false,quoteFresh:false,liquidityChecked:false,reference:'Учебная спецификация; рублёвая цена получена пересчётом прайса по курсу ЦБ'}
};
const api={META,number,round,normalize,validate,economics,scenarioSet,scenarioResult,position,evaluate,sensitivityGrid,requiredFuturesMove,coffeeDecomposition,passport,templates};
root.StableMarginCore=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
