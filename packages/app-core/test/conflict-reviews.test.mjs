import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ContextRules, assessConflictPair, canonicalControlToken, filters, hasConflict,
  hasUncertainConflict, indexConflicts, keyOf, rivalsOf, triggerSignatureKey,
  triggerSignatureOf, uncertainRivalsOf,
} from "../dist/index.js";

const fixture = JSON.parse(readFileSync(new URL('./fixtures/notebook-trigger-reviews.json', import.meta.url), 'utf8'));
const rules = new ContextRules(null);
const pending = new Map();
function binding(source, extra = {}) {
  const token = source.input_raw || 'js1_button5';
  const [device, raw] = token.split('_');
  const parts = raw.split('+');
  return {origin:'override', label:null, description:null, device, control:parts.pop(), modifier:parts.join('+') || null,
    actionmap:'spaceship_general',action:'sample',context:'ship_seat',activation_mode:'press',multi_tap:null,
    trigger_attributes:{onPress:'1'},...source,...extra};
}
function review(left, right, verdict = 'false_alarm') {
  return {control:left.input_raw, actions:[left,right].map(item=>({actionmap:item.actionmap,action:item.action,trigger_signature:triggerSignatureOf(item)})),verdict};
}
function checkPair(left, right, expected, reviews = [], contextRules = rules, edits = pending) {
  const index = indexConflicts([left,right],edits,contextRules,reviews);
  assert.equal(assessConflictPair(left,right,edits,contextRules,reviews).level,expected);
  for (const [item,rival] of [[left,right],[right,left]]) {
    assert.equal(hasConflict(item,edits,index),expected === 'probable');
    assert.equal(hasUncertainConflict(item,edits,index),expected === 'uncertain');
    assert.deepEqual(rivalsOf(item,edits,index),expected === 'probable' ? [rival] : []);
    assert.deepEqual(uncertainRivalsOf(item,edits,index),expected === 'uncertain' ? [rival] : []);
  }
  return index;
}

test('les 167 déclencheurs résolus correspondent exactement aux signatures indépendantes du carnet',()=>{
  for (const source of fixture.bindings) {
    const item = binding(source);
    assert.deepEqual(triggerSignatureOf(item),source.signature,`${source.actionmap}/${source.action}/${source.input_raw}`);
  }
});

test('les 129 partages exclus par déclencheur et les 82 faux positifs / 8 conflits réels restent cohérents',()=>{
  const totals = {excluded:0,false_alarm:0,real_conflict:0};
  for (const pair of fixture.pairs) {
    const [left,right] = pair.bindings.map(index=>binding(fixture.bindings[index]));
    if (pair.excluded) { totals.excluded++; checkPair(left,right,'none'); }
    if (pair.verdict) {
      totals[pair.verdict]++;
      checkPair(left,right,pair.verdict === 'real_conflict' ? 'probable' : 'none',[review(left,right,pair.verdict)],new ContextRules([]));
    }
  }
  assert.deepEqual(totals,{excluded:129,false_alarm:82,real_conflict:8});
});

test('les vrais conflits de véhicule observés réapparaissent malgré leur ancienne exclusion globale',()=>{
  const pair = fixture.pairs.find(pair=>pair.verdict === 'real_conflict' && pair.bindings.every(index=>fixture.bindings[index].context === 'ground_vehicle'));
  assert.ok(pair,'conflit véhicule réellement déclaré');
  const [left,right] = pair.bindings.map(index=>binding(fixture.bindings[index]));
  const reviews = [review(left,right,'real_conflict')];
  assert.equal(assessConflictPair(left,right,pending,new ContextRules([]),reviews).reason,'review_real_conflict');
  checkPair(left,right,'probable',reviews,new ContextRules([]));
});

test('une signature compare événements, tous les seuils, délais et multi-appuis',()=>{
  const a = binding({action:'a',input_raw:'js1_button5'});
  for (const attrs of [
    {onPress:'0',onRelease:'1'}, {onHold:'1'}, {pressTriggerThreshold:'.25'},
    {releaseTriggerThreshold:'.25'}, {holdTriggerDelay:'.5'}, {releaseTriggerDelay:'.2'}, {multiTap:'2'},
  ]) {
    const b = binding({action:'b',input_raw:a.input_raw,trigger_attributes:{...a.trigger_attributes,...attrs}});
    checkPair(a,b,'none');
  }
  const alias = binding({action:'alias',input_raw:a.input_raw,activation_mode:'another_spelling',trigger_attributes:{ONPRESS:'true',MULTITAP:'1.0',retriggerable:'1',multiTapBlock:'0'}});
  checkPair(a,alias,'probable');
});

test('informations absentes, valeurs invalides et axes avec seuil deviennent à vérifier, jamais rouges',()=>{
  const a = binding({action:'a',input_raw:'js1_button5'});
  for (const b of [
    binding({action:'unknown',input_raw:a.input_raw,activation_mode:'future',trigger_attributes:{}}),
    binding({action:'missing',input_raw:a.input_raw,trigger_attributes:undefined}),
    binding({action:'corrupt',input_raw:a.input_raw,multi_tap:'2x'}),
    binding({action:'corruptFlag',input_raw:a.input_raw,trigger_attributes:{onPress:'maybe'}}),
    binding({action:'corruptDelay',input_raw:a.input_raw,trigger_attributes:{onPress:'1',holdTriggerDelay:'NaN'}}),
    binding({action:'emptyEvents',input_raw:a.input_raw,trigger_attributes:{onPress:'0',onHold:'0',onRelease:'0'}}),
  ]) {
    checkPair(a,b,'uncertain');
    assert.equal(assessConflictPair(a,b,pending,rules).reason,'unknown_trigger');
  }
  const axis = binding({action:'axis',input_raw:'gp2_rotx',trigger_attributes:{}});
  assert.deepEqual(triggerSignatureOf(axis),{kind:'continuous_axis'});
  checkPair(axis,binding({...axis,action:'threshold',trigger_attributes:{useAnalogCompare:'1'}}),'uncertain');
});

test('un partage entre deux valeurs par défaut reste préexistant à vérifier ; une édition est réévaluée',()=>{
  const a = binding({action:'a',input_raw:'js1_button5',origin:'game_default'});
  const b = binding({...a,action:'b'});
  checkPair(a,b,'uncertain');
  assert.equal(assessConflictPair(a,b,pending,rules).reason,'preexisting_default');
  checkPair(a,b,'none',[review(a,b)]);
  checkPair(a,b,'probable',[review(a,b,'real_conflict')]);
  const edited = binding({...b,input_raw:'js1_button6',control:'button6'});
  checkPair(a,edited,'probable',[],rules,new Map([[keyOf(edited),a.input_raw]]));
  const distinct = binding({...b,trigger_attributes:{onPress:'1',pressTriggerThreshold:'.5'}});
  checkPair(a,distinct,'none');
});

test('les modificateurs se comparent sans casse ni ordre, sans confondre gauche et droite',()=>{
  assert.equal(canonicalControlToken(' JS2_RSHIFT+LCTRL+Button5 '),'js2_lctrl+rshift+button5');
  const a = binding({action:'a',input_raw:'js2_lctrl+rshift+button5'});
  const b = binding({action:'b',input_raw:'JS2_RSHIFT+LCTRL+BUTTON5'});
  checkPair(a,b,'probable');
  checkPair(a,b,'none',[review(a,b)]);
  checkPair(a,binding({...b,input_raw:'js2_rctrl+rshift+button5'}),'none');
  checkPair(a,binding({...b,input_raw:'js3_lctrl+rshift+button5'}),'none');
});

test('un retour ne couvre que sa paire, son contrôle et chacune de ses signatures',()=>{
  const a = binding({action:'a',input_raw:'js1_button5'});
  const b = binding({action:'b',input_raw:a.input_raw});
  const reviews = [review(a,b)];
  checkPair(a,b,'none',reviews);
  checkPair(a,binding({...b,action:'third'}),'probable',reviews);
  const movedA = binding({...a,input_raw:'js1_button6'}), movedB = binding({...b,input_raw:'js1_button6'});
  checkPair(movedA,movedB,'probable',reviews);
  const changedA = binding({...a,multi_tap:'2'}), changedB = binding({...b,multi_tap:'2'});
  checkPair(changedA,changedB,'probable',reviews);
  checkPair(movedA,movedB,'none',reviews,rules,new Map([[keyOf(movedA),'JS1_BUTTON5'],[keyOf(movedB),'js1_button5']]));
  checkPair(a,b,'none',reviews,rules,new Map([[keyOf(b),null]]));
});

test('un verdict mal formé ou inconnu ne masque pas une alerte et ne couvre pas un déclencheur inconnu',()=>{
  const a = binding({action:'a',input_raw:'js1_button5'}), b = binding({action:'b',input_raw:'js1_button5'});
  assert.equal(triggerSignatureKey({kind:'button'}),null);
  assert.equal(triggerSignatureKey({...triggerSignatureOf(a),holdtriggerdelay:Infinity}),null);
  const malformed = review(a,b); malformed.actions[0].trigger_signature = {kind:'button'};
  checkPair(a,b,'probable',[malformed]);
  checkPair(a,b,'probable',[{...review(a,b),verdict:'unknown'}]);
  checkPair(a,binding({...b,trigger_attributes:{}}),'uncertain',[review(a,b)]);
});

test('le filtre Conflits exclut les paires incertaines du même index',()=>{
  const a = binding({action:'a',input_raw:'js1_button5'}), b = binding({action:'b',input_raw:'js1_button5'});
  const unknown = binding({action:'unknown',input_raw:'js1_button6',trigger_attributes:{}});
  const rival = binding({action:'rival',input_raw:'js1_button6'});
  const items = [a,b,unknown,rival];
  const index = indexConflicts(items,pending,rules);
  assert.deepEqual(filters.apply(items,{...filters.NO_FILTERS,conflictsOnly:true},'all',pending,index),[a,b]);
  assert.deepEqual(filters.apply(items,filters.NO_FILTERS,'all',pending,index),items);
  assert.equal(filters.isFiltering({...filters.NO_FILTERS,conflictsOnly:true}),true);
});

test('le détail réévalue aussi un candidat de geste avant son insertion dans l’index',()=>{
  const a = binding({action:'a',input_raw:'js1_button5'}), b = binding({action:'b',input_raw:'js1_button5'});
  const index = indexConflicts([a,b],pending,rules);
  assert.deepEqual(rivalsOf(binding({...a,multi_tap:'2'}),pending,index),[]);
  const candidate = binding({...a,trigger_attributes:{}});
  assert.deepEqual(rivalsOf(candidate,pending,index),[]);
  assert.deepEqual(uncertainRivalsOf(candidate,pending,index),[b]);
});
