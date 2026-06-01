// Slink Gate - Step Sequenced Filter Gate
// Max for Live JavaScript object
// inlets:  0=messages(enable/setall), 1=bpm, 2=smooth(0-100), 3=depth(0-100), 4=base(Hz)
// outlets: 0=[freq rampMs] to line~,  1=current step index
autowatch = 1;

inlets  = 5;
outlets = 2;

var enabled  = 0;
var bpm      = 120;
var smoothing = 35;   // 0-100 %
var depth    = 65;    // 0-100 %
var baseFreq = 2000;  // Hz
var division = 0.25;  // 0.25 = 1/16, 0.5 = 1/8, 1 = 1/4

var currentStep = 0;
var nSteps = 16;

// Trance preset (0-127)
var steps = [127, 6, 92, 6, 127, 6, 92, 6, 127, 6, 92, 6, 127, 45, 83, 6];

var stepTask = null;

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
	var rampMs = Math.max(1, smoothing * 3.0);  // 1-300ms
	outlet(0, [freq, rampMs]);
	outlet(1, currentStep);
	currentStep = (currentStep + 1) % nSteps;
	var nextMs = (60.0 / bpm) * division * 1000.0;
	if (stepTask) stepTask.schedule(nextMs);
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

function divnote(v) { division = v; }  // 0.25/0.5/1.0/0.125

function msg_int(v) {
	if      (inlet == 1) bpm      = Math.max(20, Math.min(300, v));
	else if (inlet == 2) smoothing = Math.max(0,  Math.min(100, v));
	else if (inlet == 3) depth    = Math.max(0,  Math.min(100, v));
	else if (inlet == 4) baseFreq = Math.max(80, Math.min(18000, v));
}

function msg_float(v) { msg_int(v); }

function loadbang() {
	outlet(0, [baseFreq, 1]);
}
