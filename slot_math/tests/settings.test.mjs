import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settings, model, readFixture } from './helpers/settings.mjs';
const { validateGameFiles, settingsFromFiles, simulationOptionsFromFiles, filesFromSettings, parametersFromInputs, parametersFromFile } = settings;
const fresh = () => structuredClone(readFixture());

test('three game files provide the full configuration without browser storage', () => {
  globalThis.localStorage = { getItem() { throw new Error('must not read browser configuration'); }, setItem() { throw new Error('must not save browser configuration'); } };
  const files = validateGameFiles(fresh());
  assert.equal(files.base.length, 600); assert.equal(files.free.length, 350);
  const state = settingsFromFiles(files), options = simulationOptionsFromFiles(files);
  assert.equal(state.inputs.lineCount, '20'); assert.equal(state.inputs.freeSpinTriggerProbability, '0.65');
  assert.deepEqual(options, { count: '1000000000', seed: '42' });
  assert.deepEqual(JSON.parse(JSON.stringify(filesFromSettings(state, options))), files);
});
test('source tables keep fractional values, duplicate rows, order and zero weights', () => {
  const files = fresh(); files.base = [[.1, .125], [.1, 0], [5, 12.34567890123], [0, 2]];
  const state = settingsFromFiles(validateGameFiles(files));
  assert.deepEqual(filesFromSettings(state, simulationOptionsFromFiles(files)).base, files.base);
  state.base.table.rows[0][1] = 9;
  assert.equal(files.base[0][1], .125);
});
test('edited probabilities use numeric 0..1 file units, options and null seeds round trip', () => {
  const files = fresh(), state = settingsFromFiles(files);
  state.inputs.baseSpinWinProbability = '29'; state.inputs.freeSpinTriggerProbability = '0.75';
  const saved = filesFromSettings(state, { count: '100000', seed: '' });
  assert.equal(saved.config.parameters.baseSpinWinProbability, .29);
  assert.equal(saved.config.parameters.freeSpinTriggerProbability, .0075);
  assert.deepEqual(saved.config.simulationOptions, { paidSpins: 100000, seed: null });
  assert.equal(simulationOptionsFromFiles(saved).seed, '');
});
test('both ordinary strategies and derived free ramp survive save and reload', () => {
  const files = fresh(), state = settingsFromFiles(files);
  state.inputs.lossStreakRule.enabled = true; state.inputs.winStreakRule.enabled = true;
  state.inputs.freeTriggerRule.enabled = true;
  state.inputs.freeRetriggerLimitEnabled = true; state.inputs.freeRetriggerLimit = '0';
  const saved = filesFromSettings(state, simulationOptionsFromFiles(files));
  assert.equal(saved.config.parameters.freeRetriggerLimit, 0);
  assert.equal('probability' in saved.config.parameters.freeTriggerRule, false);
  const modelParameters = parametersFromFile(saved.config.parameters);
  assert.ok(Math.abs(modelParameters.freeTriggerRule.probability - .0085) < 1e-14);
  assert.deepEqual(parametersFromInputs(settingsFromFiles(saved).inputs), modelParameters);
});
test('missing, invalid and unsupported files never fall back to built-in values', () => {
  for (const mutate of [f => delete f.base, f => f.free = [], f => f.config.version = 2, f => delete f.config.parameters.lineCount, f => f.config.parameters.lineCount = '20', f => f.config.parameters.baseSpinWinProbability = 2, f => f.config.parameters.freeSpinGuaranteedWin = 'false', f => f.config.parameters.freeTriggerRule.step = -1, f => f.config.parameters.freeSpinAwardWeights = [], f => f.config.simulationOptions.seed = -1, f => f.config.simulationOptions.paidSpins = 0, f => f.config.parameters.freeTriggerRule.probability = .1]) {
    const files = fresh(); mutate(files); assert.throws(() => validateGameFiles(files));
  }
});
test('unfinished and invalid input drafts cannot be written as null or partial config', () => {
  for (const change of [s => s.inputs.lineCount = '', s => s.inputs.baseSpinWinProbability = '-1', s => s.inputs.freeSpinAwards[0].weight = '', s => s.inputs.lossStreakRule = { ...s.inputs.lossStreakRule, enabled: true, start: '' }]) {
    const files = fresh(), state = settingsFromFiles(files); change(state);
    assert.throws(() => filesFromSettings(state, simulationOptionsFromFiles(files)));
  }
});
test('file load and UI conversion retain RTP and variance', () => {
  const files = fresh(), state = settingsFromFiles(files);
  const a = model.calculateModel(state.base.table, state.free.table, parametersFromFile(files.config.parameters));
  const b = model.calculateModel(state.base.table, state.free.table, parametersFromInputs(state.inputs));
  assert.deepEqual(a, b);
  assert.ok(Number.isFinite(a.totalRtp) && a.totalRtp > 0);
});
test('omitted strategies and disabled compensation flags are not replaced with defaults', () => {
  const files = fresh();
  delete files.config.parameters.lossStreakRule;
  delete files.config.parameters.winStreakRule;
  delete files.config.parameters.freeTriggerRule;
  files.config.parameters.lossStreakRtpCompensation = false;
  files.config.parameters.freeTriggerRtpCompensation = false;
  const state = settingsFromFiles(validateGameFiles(files));
  const roundTrip = JSON.parse(JSON.stringify(filesFromSettings(state, simulationOptionsFromFiles(files))));
  assert.deepEqual(roundTrip, files);
});

test('ruleType is explicit game configuration and survives edits and save/reload', () => {
  const files = fresh(), state = settingsFromFiles(validateGameFiles(files));
  assert.equal(state.ruleType, 'ways_cascade_v1');
  state.ruleType = 'paylines_v1';
  const saved = filesFromSettings(state, simulationOptionsFromFiles(files));
  assert.equal(saved.config.ruleType, 'paylines_v1');
  assert.equal(settingsFromFiles(validateGameFiles(saved)).ruleType, 'paylines_v1');
  assert.deepEqual(JSON.parse(JSON.stringify(saved.config.parameters)), files.config.parameters);
  state.ruleType = 'custom_rules_v2';
  assert.equal(filesFromSettings(state, simulationOptionsFromFiles(files)).config.ruleType, 'custom_rules_v2');
  for (const invalid of [undefined, null, '', 'ways', 'ways_v0', 123]) {
    const bad = fresh(); bad.config.ruleType = invalid;
    assert.throws(() => validateGameFiles(bad), /ruleType/);
  }
});
