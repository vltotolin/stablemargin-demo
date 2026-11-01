'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {evaluate,stressOutcomes,passport,templates}=require('./core.js');
const p={...templates.cocoa};
const check=(overrides)=>evaluate({...p,...overrides});
test('Базовый сценарий какао: 17 контрактов, конечная маржа и резерв',()=>{const r=check({});assert.equal(r.status,'CANDIDATE');assert.equal(r.lots,17);assert.equal(r.coverage,34);assert.equal(r.cashRequired,43082.93);assert.equal(r.scenarioMargin,15205.2);assert.equal(r.maximumLoss,45000)});
test('Проверка исходной маржи: 60 000 ₽',()=>assert.equal(check({}).baseMargin,60000));
test('Номинальное покрытие не превышает объём закупки',()=>{const r=check({});assert.ok(r.lots*r.input.lot<=r.input.quantity)});
test('Строгий предел: нужно 25, доступно 23',()=>{const r=check({minMargin:25000});assert.equal(r.status,'NOT_FEASIBLE');assert.equal(r.necessaryLots,25);assert.equal(r.affordableLots,23);assert.equal(r.lots,0)});
test('Нет договора: решение блокируется',()=>assert.equal(check({hasDocument:false}).status,'NEED_DATA'));
test('Неподтверждённый базис: решение блокируется',()=>assert.equal(check({basisChecked:false}).status,'NEED_DATA'));
test('Неактуальная котировка: решение блокируется',()=>assert.equal(check({quoteFresh:false}).status,'NEED_DATA'));
test('Непроверенная ликвидность: решение блокируется',()=>assert.equal(check({liquidityChecked:false}).status,'NEED_DATA'));
test('Лимит на 1 ₽ ниже резерва 17 контрактов: запрет позиции',()=>{const r=check({cashLimit:43081.93});assert.equal(r.status,'NOT_FEASIBLE');assert.equal(r.lots,0)});
test('Точный резерв 17 контрактов допускает минимальную позицию',()=>{const r=check({cashLimit:43082.93});assert.equal(r.status,'CANDIDATE');assert.equal(r.lots,17)});
test('Достаточно сохраняется без защиты: NO_HEDGE',()=>assert.equal(check({physicalMove:.05}).status,'NO_HEDGE'));
test('Падение закупочной цены: NO_HEDGE',()=>assert.equal(check({physicalMove:-.2,futuresMove:-.2}).status,'NO_HEDGE'));
test('Комиссия превышает результат на лот: нет допустимого решения',()=>assert.equal(check({feePerContract:2000}).status,'NOT_FEASIBLE'));
test('Неправильное совпадение динамики: хедж экономически не помогает',()=>assert.equal(check({futuresMove:-.1}).status,'NOT_FEASIBLE'));
test('Слабый рост фьючерса не обеспечивает требуемую защиту',()=>assert.equal(check({futuresMove:.2}).status,'NOT_FEASIBLE'));
test('Меньше одного лота: нет допустимого решения',()=>assert.equal(check({quantity:5,minMargin:282500}).status,'NOT_FEASIBLE'));
test('Плановая маржа уже меньше минимальной: отдельный отказ',()=>assert.equal(check({minMargin:70000}).status,'BASELINE_UNVIABLE'));
test('Отрицательное обеспечение не допускается',()=>assert.equal(check({guarantee:-1}).status,'INPUT_ERROR'));
test('Нулевая цена закупки не допускается',()=>assert.equal(check({purchasePrice:0}).status,'INPUT_ERROR'));
test('Потерянное число не допускается',()=>assert.equal(check({quantity:'нет'}).status,'INPUT_ERROR'));
test('Падение цены ниже нуля не допускается',()=>assert.equal(check({futuresMove:-1.2}).status,'INPUT_ERROR'));
test('Валютный пример: отдельная логика единиц',()=>{const r=evaluate(templates.cny);assert.equal(r.status,'CANDIDATE');assert.equal(r.lots,33);assert.equal(r.cashRequired,48675);assert.equal(r.scenarioMargin,200183)});
test('Сценарии сохраняют разницу, равную P&L минус комиссии',()=>{const rows=stressOutcomes(p,17);assert.equal(rows.length,4);for (const x of rows)assert.ok(Math.abs((x.with-x.without)-x.difference)<.001)});
test('Документ банка: запрещает утверждать реальную передачу',()=>{const r=check({});const x=passport(p,r);assert.equal(x.bankStatus,'НЕ ПЕРЕДАВАЛОСЬ В ВТБ');assert.equal(x.decision.conditionalContracts,17);assert.equal(x.restrictions.length,4)});
test('Критические ограничения: 500 вариаций не выпускают недопустимые позиции',()=>{
 let seed=101;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646}
 for(let i=0;i<500;i++){
  const z={...p,minMargin:Math.round(rand()*80000),cashLimit:Math.round(rand()*150000),feePerContract:Math.round(rand()*300),
  physicalMove:Math.round(rand()*50)/100, futuresMove:Math.round((rand()*.65-.15)*100)/100,
  hasDocument:rand()>.12,basisChecked:rand()>.12,quoteFresh:rand()>.12,liquidityChecked:rand()>.12};
  const r=evaluate(z);
  if(r.status==='CANDIDATE'){
   assert.ok(r.cashRequired<=z.cashLimit+.011,'cash check #'+i);assert.ok(r.residualLoss<=r.maximumLoss+.011,'risk #'+i);
   assert.ok(r.lots<=r.fullLots,'lot #'+i);
   assert.ok(z.hasDocument&&z.basisChecked&&z.quoteFresh&&z.liquidityChecked,'evidence #'+i);
  }
 }
});

test('Пустые числовые поля не превращаются в ноль',()=>{
 assert.equal(check({revenue:''}).status,'INPUT_ERROR');
 assert.equal(check({feePerContract:' '}).status,'INPUT_ERROR');
 assert.equal(check({otherCosts:null}).status,'INPUT_ERROR');
});
