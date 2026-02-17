const { combineRgb } = require('@companion-module/base');

function shortLabel(str, max = 28) {
	if (!str || typeof str !== 'string') return '—';
	return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

module.exports = function (self) {
	const presets = {};
	const eventId = self.config?.eventId || '';
	const polls = self.polls || [];
	const qaSessions = self.qaSessions || [];
	const qaQuestions = self.qaQuestions || [];

	const gray = combineRgb(80, 80, 80);
	const white = combineRgb(255, 255, 255);
	const green = combineRgb(0, 160, 0);
	const darkGreen = combineRgb(0, 100, 0);
	const orange = combineRgb(180, 120, 0);
	const purple = combineRgb(148, 0, 211);
	const teal = combineRgb(0, 140, 120);
	const blue = combineRgb(50, 100, 200);

	// All preset feedbacks have style.bgcolor set so background changes when feedback is true.
	// --- Polls - Control: one button per poll, name only, toggle active on/off with feedback ---
	polls.forEach((p) => {
		const pid = p.id;
		const name = shortLabel(p.title, 28);
		presets[`poll_control_${pid}`] = {
			type: 'button',
			category: 'Polls - Control',
			name,
			style: { text: name, size: '18', color: white, bgcolor: gray },
			feedbacks: [{ feedbackId: 'poll_active', options: { pollId: pid }, style: { bgcolor: green, color: white } }],
			steps: [
				{ down: [{ actionId: 'poll_set_active', options: { pollId: pid, active: 'toggle' } }], up: [] },
			],
		};
	});

	// --- Polls - Public (toggle audience can vote) ---
	polls.forEach((p) => {
		const pid = p.id;
		const title = shortLabel(p.title, 24);
		presets[`poll_public_${pid}`] = {
			type: 'button',
			category: 'Polls - Public',
			name: `${title} – Toggle public`,
			style: { text: `Public\n${title}`, size: '18', color: white, bgcolor: gray },
			feedbacks: [{ feedbackId: 'poll_public', options: { pollId: pid }, style: { bgcolor: blue, color: white } }],
			steps: [
				{ down: [{ actionId: 'poll_toggle_public', options: { pollId: pid } }], up: [] },
			],
		};
	});

	// --- Polls - CSV: only which poll feeds CSV (does not turn poll on/off) ---
	polls.forEach((p) => {
		const pid = p.id;
		const name = shortLabel(p.title, 28);
		presets[`poll_csv_${pid}`] = {
			type: 'button',
			category: 'Polls - CSV',
			name: `CSV: ${name}`,
			style: { text: `CSV\n${name}`, size: '18', color: white, bgcolor: gray },
			feedbacks: [{ feedbackId: 'poll_csv_source', options: { pollId: pid }, style: { bgcolor: teal, color: white } }],
			steps: [
				{ down: [{ actionId: 'poll_toggle_csv_source', options: { pollId: pid } }], up: [] },
			],
		};
	});

	// --- Q&A - Control: one button per session, Play/Stop only (no CSV). Feedback = output on (any question live). ---
	qaSessions.forEach((s) => {
		const qid = s.id;
		const name = shortLabel(s.name || s.id, 28);
		presets[`qa_control_${qid}`] = {
			type: 'button',
			category: 'Q&A - Control',
			name,
			style: { text: name, size: '18', color: white, bgcolor: gray },
			feedbacks: [{ feedbackId: 'has_active_question', options: {}, style: { bgcolor: darkGreen, color: white } }],
			steps: [
				{ down: [{ actionId: 'qa_session_set_active', options: { qaId: qid, active: 'toggle' } }], up: [] },
			],
		};
	});

	// --- Q&A - Public (toggle audience can submit) — same as Polls - Public ---
	qaSessions.forEach((s) => {
		const qid = s.id;
		const name = shortLabel(s.name || s.id, 24);
		presets[`qa_public_${qid}`] = {
			type: 'button',
			category: 'Q&A - Public',
			name: `${name} – Toggle public`,
			style: { text: `Public\n${name}`, size: '18', color: white, bgcolor: gray },
			feedbacks: [{ feedbackId: 'qa_session_public', options: { qaId: qid }, style: { bgcolor: purple, color: white } }],
			steps: [
				{ down: [{ actionId: 'qa_session_set_public', options: { qaId: qid, public: 'toggle' } }], up: [] },
			],
		};
	});

	// --- Q&A - CSV: only which session feeds Q&A CSV (does not play/stop) ---
	qaSessions.forEach((s) => {
		const qid = s.id;
		const name = shortLabel(s.name || s.id, 28);
		presets[`qa_csv_${qid}`] = {
			type: 'button',
			category: 'Q&A - CSV',
			name: `CSV: ${name}`,
			style: { text: `CSV\n${name}`, size: '18', color: white, bgcolor: gray },
			feedbacks: [{ feedbackId: 'qa_session_csv_source', options: { qaId: qid }, style: { bgcolor: teal, color: white } }],
			steps: [
				{ down: [{ actionId: 'qa_session_set_csv_source', options: { qaId: qid, mode: 'toggle' } }], up: [] },
			],
		};
	});

	// --- Q&A - Question states: ACTIVE/CUE = CUE first (orange), then ACTIVE (green). NEXT = purple (isNext). ---
	presets.qa_state_active_cue = {
		type: 'button',
		category: 'Q&A - Question states',
		name: 'ACTIVE/CUE',
		style: { text: 'ACTIVE/CUE', size: '18', color: white, bgcolor: gray },
		feedbacks: [
			{ feedbackId: 'has_cued_question', options: {}, style: { bgcolor: orange, color: white } },
			{ feedbackId: 'has_active_question', options: {}, style: { bgcolor: darkGreen, color: white } },
		],
		steps: [{ down: [], up: [] }],
	};
	presets.qa_state_next = {
		type: 'button',
		category: 'Q&A - Question states',
		name: 'NEXT',
		style: { text: 'NEXT', size: '18', color: white, bgcolor: gray },
		feedbacks: [{ feedbackId: 'has_next_question', options: {}, style: { bgcolor: purple, color: white } }],
		steps: [{ down: [], up: [] }],
	};

	if (!eventId) {
		presets._placeholder = {
			type: 'button',
			category: 'Setup',
			name: 'Set Event ID and wait for data',
			style: { text: 'Set Event ID\nin config', size: '18', color: white, bgcolor: gray },
			feedbacks: [],
			steps: [{ down: [], up: [] }],
		};
	}

	self.setPresetDefinitions(presets);
};
