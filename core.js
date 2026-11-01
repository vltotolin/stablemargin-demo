/* StableMargin 1.0. Offline, deterministic educational prototype.
 * No trading, quotations, customer data access or financial recommendations.
 */
(function (root) {
  'use strict';
  const ROUND = (v, n = 2) => Number(Number(v).toFixed(n));
  const inNum = (x) => {
    if (typeof x === 'number') return x;
    if (x === null || x === undefined) return NaN;
    const value = String(x).trim().replace(',', '.');
    return value === '' ? NaN : Number(value);
  };
  const invalid = (m) => ({ status: 'INPUT_ERROR', label: 'Ошибка исходных данных', reason: m, approved: false });
  const stop = (status, label, reason, detail = {}) => ({status, label, reason, approved: false, ...detail});
  const INFO = {
    version:'1.0.0',
    source:'Демонстрационные сценарии команды «Дихотомия», 01.11.2026',
    offline:true,
    automaticTrading:false,
    externalData:false
  };
  function evaluate(p) {
    const keys=['quantity','purchasePrice','futuresPrice','lot','revenue','otherCosts','minMargin',
      'cashLimit','guarantee','stressDrawdownPerUnit','feePerContract','physicalMove','futuresMove'];
    const v={...p};
    for (const k of keys) {
      v[k]=inNum(p[k]);
      if (!Number.isFinite(v[k])) return invalid('Поле «'+k+'» должно содержать число.');
    }
    if (v.quantity<=0 || v.purchasePrice<=0 || v.futuresPrice<=0 || v.lot<=0) return invalid('Объём, цены и размер контракта должны быть положительными.');
    if ([v.revenue,v.otherCosts,v.minMargin,v.cashLimit,v.guarantee,v.stressDrawdownPerUnit,v.feePerContract].some(x=>x<0)) return invalid('Финансовые лимиты, издержки и обеспечение не могут быть отрицательными.');
    if (Math.abs(v.physicalMove)>2 || Math.abs(v.futuresMove)>2) return invalid('Шок цены ограничен диапазоном от −200% до +200% в демонстрации.');
    if (v.futuresMove < -1 || v.physicalMove < -1) return invalid('Снижение цены не может превышать 100%.');
    const baseCost=v.quantity*v.purchasePrice;
    const baseMargin=v.revenue-v.otherCosts-baseCost;
    const maximumLoss=baseMargin-v.minMargin;
    const stressPhysicalIncrease=baseCost*v.physicalMove;
    const fullLots=Math.floor((v.quantity + 1e-9)/v.lot);
    const perContractReserve=v.guarantee + v.stressDrawdownPerUnit*v.lot+v.feePerContract;
    const maxCashLots=perContractReserve>0?Math.floor((v.cashLimit+1e-9)/perContractReserve):fullLots;
    const affordableLots=Math.max(0,Math.min(fullLots,maxCashLots));
    const hedgingEffectPerLot=v.lot*v.futuresPrice*v.futuresMove-v.feePerContract;
    const common={...INFO, product:v.product||'Сырье',symbol:v.symbol||'DEMO',
      input:v, baseCost:ROUND(baseCost),baseMargin:ROUND(baseMargin),
      maximumLoss:ROUND(maximumLoss),stressPhysicalIncrease:ROUND(stressPhysicalIncrease),
      noHedgeMargin:ROUND(baseMargin-stressPhysicalIncrease),
      fullLots, perContractReserve:ROUND(perContractReserve),maxCashLots,affordableLots,
      hedgingEffectPerLot:ROUND(hedgingEffectPerLot),approved:false};
    const finish=(status,label,reason,extra={})=>{
      const n=extra.lots??0;
      const coverage= v.quantity? n*v.lot/v.quantity : 0;
      return {...common,status,label,reason, lots:n,coverage:ROUND(coverage*100,2),
        cashRequired:ROUND(n*perContractReserve),futuresPnl:ROUND(n*v.lot*v.futuresPrice*v.futuresMove),
        commissions:ROUND(n*v.feePerContract),
        scenarioMargin:ROUND(baseMargin-stressPhysicalIncrease+n*hedgingEffectPerLot),
        residualLoss:ROUND(stressPhysicalIncrease-n*hedgingEffectPerLot),...extra};
    };
    if (maximumLoss < 0) return finish('BASELINE_UNVIABLE','Проблема исходной экономики','Плановая маржа уже ниже обязательного минимума. Хеджирование не исправляет исходную экономику закупки.');
    if (!v.hasDocument) return finish('NEED_DATA','Недостаточно данных','Не подтверждена будущая закупка: нужен договор, заказ или датированный прайс.');
    if (!v.basisChecked) return finish('NEED_DATA','Недостаточно данных','Связь цены поставщика с указанным контрактом не подтверждена. Сервис не рекомендует сделку.');
    if (!v.quoteFresh) return finish('NEED_DATA','Недостаточно данных','Котировка не прошла проверку актуальности.');
    if (!v.liquidityChecked) return finish('NEED_DATA','Недостаточно данных','Ликвидность и условия исполнения контракта не подтверждены.');
    if (stressPhysicalIncrease<=maximumLoss+1e-8) return finish('NO_HEDGE','Защита не требуется','В выбранном сценарии изменение закупочной стоимости не нарушает минимально допустимую маржу.');
    if (v.physicalMove<=0) return finish('NO_HEDGE','Защита не требуется','Неблагоприятное удорожание закупки в выбранном сценарии отсутствует.');
    if (fullLots<=0) return finish('NOT_FEASIBLE','Нет допустимого решения','Объём закупки меньше размера одного контракта.');
    if (hedgingEffectPerLot<=0) return finish('NOT_FEASIBLE','Нет допустимого решения','В заданном сценарии ожидаемая компенсация фьючерса не покрывает издержки на контракт.');
    const necessaryLots=Math.max(0,Math.ceil((stressPhysicalIncrease-maximumLoss-1e-9)/hedgingEffectPerLot));
    if (necessaryLots>affordableLots) return finish('NOT_FEASIBLE','Нет допустимого решения',
      'Для соблюдения минимальной маржи требуется '+necessaryLots+' контрактов; разрешённый резерв допускает не более '+affordableLots+'. Частичный хедж с нарушением цели не предлагается.',
      {necessaryLots,bestAffordableLots:affordableLots, bestAffordableMargin:ROUND(baseMargin-stressPhysicalIncrease+affordableLots*hedgingEffectPerLot)});
    const result=finish('CANDIDATE','Условная стратегия рассчитана','Минимально достаточный объём соответствует заданному стрессу и денежному лимиту. Это сценарный результат, не прогноз рынка.',{lots:necessaryLots,necessaryLots});
    result.scenarioFits=true; // Only the entered demonstration assumptions are satisfied; no trade approval.
    return result;
  }
  function stressOutcomes(p,n){
    const v=Object.fromEntries(Object.entries(p).map(([k,x])=>[k,x]));
    const rows=[
      {name:'Введённый сценарий',physicalMove:inNum(p.physicalMove),futuresMove:inNum(p.futuresMove)},
      {name:'Фьючерс растёт слабее',physicalMove:inNum(p.physicalMove),futuresMove:Math.max(-1,ROUND(inNum(p.futuresMove)*0.667,4))},
      {name:'Расхождение цен',physicalMove:inNum(p.physicalMove),futuresMove:-0.1},
      {name:'Сырьё дешевеет',physicalMove:-0.2,futuresMove:-0.2}
    ];
    return rows.map(s=>{
      const prior=inNum(v.quantity)*inNum(v.purchasePrice), base=inNum(v.revenue)-inNum(v.otherCosts)-prior;
      const physical=prior*s.physicalMove, fut=n*inNum(v.lot)*inNum(v.futuresPrice)*s.futuresMove;
      const fees=n*inNum(v.feePerContract);
      return {...s, without:ROUND(base-physical),with:ROUND(base-physical+fut-fees),futuresPnl:ROUND(fut),fee:ROUND(fees), difference:ROUND(fut-fees)};
    });
  }
  function passport(p,result){
    return {project:'StableMargin',version:INFO.version,documentType:'Демонстрационная карточка закупки, не заявка на сделку',
      generatedAt:new Date().toISOString(),bankStatus:'НЕ ПЕРЕДАВАЛОСЬ В ВТБ',
      purchase:{product:p.product,quantity:Number(p.quantity),unit:p.unit,price:Number(p.purchasePrice),currency:p.currency,
        reference:p.reference || 'Учебные данные', confirmedDocument:!!p.hasDocument},
      limits:{minimumMargin:Number(p.minMargin),cashLimit:Number(p.cashLimit)},
      scenario:{purchaseChangePct:ROUND(Number(p.physicalMove)*100,2),futuresChangePct:ROUND(Number(p.futuresMove)*100,2),
        basisValidated:!!p.basisChecked,quoteFresh:!!p.quoteFresh,liquidityChecked:!!p.liquidityChecked},
      decision:{status:result.status,label:result.label,reason:result.reason,conditionalContracts:result.lots,
        conditionalMargin:result.scenarioMargin,possibleReserve:result.cashRequired},
      restrictions:['Не подключён к бирже или брокеру','Нет реальных котировок','Не выполняет сделки','Не проверяет правовой статус клиента']};
  }
  const templates = {
    cocoa: {key:'cocoa',product:'Какао, условная партия',symbol:'CCX6 (исторический пример)',unit:'кг',currency:'RUB',quantity:500,purchasePrice:450,
      futuresPrice:455.2,lot:10,revenue:360000,otherCosts:75000,minMargin:15000,cashLimit:60000,guarantee:1851.29,
      stressDrawdownPerUnit:65.3,feePerContract:30,physicalMove:.3,futuresMove:.3,
      hasDocument:true,basisChecked:true,quoteFresh:true,liquidityChecked:true,
      reference:'Условные данные, ГО CCX6: справочный срез 30.10.2026'},
    cocoaStrict:{key:'cocoaStrict',product:'Какао, строгий лимит',symbol:'CCX6 (исторический пример)',unit:'кг',currency:'RUB',quantity:500,purchasePrice:450,
      futuresPrice:455.2,lot:10,revenue:360000,otherCosts:75000,minMargin:25000,cashLimit:60000,guarantee:1851.29,
      stressDrawdownPerUnit:65.3,feePerContract:30,physicalMove:.3,futuresMove:.3,
      hasDocument:true,basisChecked:true,quoteFresh:true,liquidityChecked:true,reference:'Условные данные'},
    cocoaBasis:{key:'cocoaBasis',product:'Какао, непроверенный базис',symbol:'CCX6 (исторический пример)',unit:'кг',currency:'RUB',quantity:500,purchasePrice:450,
      futuresPrice:455.2,lot:10,revenue:360000,otherCosts:75000,minMargin:15000,cashLimit:60000,guarantee:1851.29,
      stressDrawdownPerUnit:65.3,feePerContract:30,physicalMove:.3,futuresMove:.3,
      hasDocument:true,basisChecked:false,quoteFresh:true,liquidityChecked:true,reference:'Условные данные; связь с поставщиком не проверена'},
    cny:{key:'cny',product:'Валютный платёж за импорт',symbol:'CNY/RUB (учебный контракт)',unit:'CNY',currency:'RUB',quantity:100000,purchasePrice:10.83,
      futuresPrice:10.85,lot:1000,revenue:1650000,otherCosts:250000,minMargin:200000,cashLimit:60000,guarantee:1200,
      stressDrawdownPerUnit:.25,feePerContract:25,physicalMove:.16,futuresMove:.16,
      hasDocument:true,basisChecked:true,quoteFresh:true,liquidityChecked:true,
      reference:'Все значения, включая ГО, условные; НЕ реальные параметры CRH7'}
  };
  const api={evaluate,stressOutcomes,passport,templates,info:INFO,ROUND};
  root.StableMarginCore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
