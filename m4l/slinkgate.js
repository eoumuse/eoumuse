// Slink Gate v2 - Step Sequenced Filter Gate
// inlets:  0=messages(enable/setall/divnote/trance/wobble/sweep/snake)
//          1=smooth(0-100)  2=depth(0-100)  3=base(Hz)
// outlets: 0=[freq rampMs] to line~,  1=current step index
autowatch = 1;

inlets  = 4;
outlets = 2;

var enabled   = 0;
var smoothing = 35;
var depth     = 65;
var baseFreq  = 2000;
var division  = 0.25;
var bpm       = 120;

var currentStep = 0;
var nSteps      = 16;
var steps = [127, 6, 92, 6, 127, 6, 92, 6, 127, 6, 92, 6, 127, 45, 83, 6];

var stepTask = null;
var tempoApi = null;

function loadbang() {
	// Auto-sync to Ableton's tempo via LiveAPI
	try {
		tempoApi = new LiveAPI(onTempoChanged, "live_set");
		tempoApi.property = "tempo";
		var t = tempoApi.get("tempo");
		if (t && t.length > 0) bpm = parseFloat(t[0]) || 120;
	} catch(e) {
		post("SlinkGate: LiveAPI unavailable, defaulting to 120 BPM\n");
	}
	outlet(0, [baseFreq, 1]);
}

function onTempoChanged() {
	try {
		var t = tempoApi.get("tempo");
		if (t && t.length > 0) bpm = parseFloat(t[0]) || bpm;
	} catch(e) {}
}

function calcFreq(val) {
	var v       = val / 127.0;
	var logMin  = Math.log(80.0)    / Math.LN2;
	var logMax  = Math.log(18000.0) / Math.LN2;
	var logBase = Math.log(Math.max(80, Math.min(18000, baseFreq))) / Math.LN2;
	var half    = (logMax - logMin) * (depth / 100.0) * 0.5;
	var logF    = logBase + (v - 0.5) * 2.0 * half;
	return Math.pow(2.0, Math.max(logMin, Math.min(logMax, logF)));
}

function stepTick() {
	if (!enabled) return;
	var freq   = calcFreq(steps[currentStep]);
	var rampMs = Math.max(1, smoothing * 3.0);
	outlet(0, [freq, rampMs]);
	outlet(1, currentStep);
	currentStep = (currentStep + 1) % nSteps;
	if (stepTask) stepTask.schedule((60.0 / bpm) * division * 1000.0);
}

function enable(v) {
	enabled = v ? 1 : 0;
	if (enabled) {
		currentStep = 0;
		if (stepTask) stepTask.cancel();
		stepTask = new Task(stepTick, this);
		stepTask.schedule(0);
	} else {
		if (stepTask) { stepTask.cancel(); stepTask = null; }
	}
}

function setall() {
	var args = arrayfromargs(arguments);
	for (var i = 0; i < Math.min(args.length, nSteps); i++) {
		steps[i] = Math.max(0, Math.min(127, args[i]));
	}
}

// Presets
function trance() { steps = [127,6,92,6,127,6,92,6,127,6,92,6,127,45,83,6]; }
function wobble()  { steps = [102,64,115,38,96,26,127,19,108,70,121,45,89,32,121,13]; }
function sweep()   { steps = [6,17,28,41,55,70,85,102,117,127,117,102,85,70,55,41]; }
function snake()   { steps = [76,102,51,115,26,96,64,127,38,108,57,89,19,76,45,115]; }

// Division: send "divnote 0.25" etc, or tab index 0-3 via divtab
function divnote(v) { division = v; }
function divtab(idx) {
	var divs = [1.0, 0.5, 0.25, 0.125];
	division = divs[idx] || 0.25;
}

function msg_int(v) {
	if      (inlet == 1) smoothing = Math.max(0,   Math.min(100,   v));
	else if (inlet == 2) depth     = Math.max(0,   Math.min(100,   v));
	else if (inlet == 3) baseFreq  = Math.max(80,  Math.min(18000, v));
}

function msg_float(v) { msg_int(v); }
