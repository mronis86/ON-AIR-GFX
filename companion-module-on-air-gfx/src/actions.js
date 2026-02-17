module.exports = function (self) {
	const eventId = self.config?.eventId || '';
	const pollChoices = (self.polls || []).map((p) => ({ id: p.id, label: p.title }));
	const qaSessionChoices = (self.qaSessions || []).map((q) => ({ id: q.id, label: q.name || q.id }));
	const qaQuestionChoices = (self.qaQuestions || []).map((q) => ({
		id: q.id,
		label: (q.question || '').slice(0, 50) + (q.question && q.question.length > 50 ? '…' : ''),
	}));

	const noEvent = [{ id: '', label: 'Set Event ID in config first' }];

	self.setActionDefinitions({
		poll_set_active: {
			name: 'Set poll active (output)',
			options: [
				{
					id: 'pollId',
					type: 'dropdown',
					label: 'Poll',
					default: '',
					choices: pollChoices.length ? pollChoices : noEvent,
				},
				{
					id: 'active',
					type: 'dropdown',
					label: 'Active',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'true', label: 'On' },
						{ id: 'false', label: 'Off' },
					],
				},
			],
			callback: async (event) => {
				const pid = event.options.pollId;
				let active = event.options.active;
				if (!eventId || !pid) {
					self.log('warn', 'Event ID and Poll required');
					return;
				}
				if (active === 'toggle') {
					const p = self.polls.find((x) => x.id === pid);
					active = p ? !p.isActive : true;
				} else {
					active = active === 'true';
				}
				try {
					await self.apiPost(`events/${eventId}/poll/${pid}/active`, { active });
					await self.fetchPolls(eventId);
					self.updateVariableValues();
					self.checkAllFeedbacks();
					self.log('info', `Poll ${active ? 'active' : 'inactive'}`);
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		poll_toggle_active: {
			name: 'Toggle poll active (output)',
			options: [
				{
					id: 'pollId',
					type: 'dropdown',
					label: 'Poll',
					default: '',
					choices: pollChoices.length ? pollChoices : noEvent,
				},
			],
			callback: async (event) => {
				const pid = event.options.pollId;
				if (!eventId || !pid) {
					self.log('warn', 'Event ID and Poll required');
					return;
				}
				const p = self.polls.find((x) => x.id === pid);
				const active = p ? !p.isActive : true;
				try {
					await self.apiPost(`events/${eventId}/poll/${pid}/active`, { active });
					await self.fetchPolls(eventId);
					self.updateVariableValues();
					self.checkAllFeedbacks();
					self.log('info', `Poll ${active ? 'active' : 'inactive'}`);
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		poll_toggle_csv_source: {
			name: 'Toggle poll CSV source',
			options: [
				{
					id: 'pollId',
					type: 'dropdown',
					label: 'Poll',
					default: '',
					choices: pollChoices.length ? pollChoices : noEvent,
				},
			],
			callback: async (event) => {
				if (!eventId) {
					self.log('warn', 'Event ID required');
					return;
				}
				const pid = (event.options?.pollId || '').trim() || null;
				if (!pid) {
					self.log('warn', 'Poll required');
					return;
				}
				const p = self.polls.find((x) => x.id === pid);
				const pollId = p && p.isCsvSource ? null : pid;
				try {
					await self.apiPost(`events/${eventId}/poll/csv-source`, { pollId });
					await self.fetchPolls(eventId);
					self.checkAllFeedbacks();
					self.log('info', pollId ? 'Poll CSV source set' : 'Poll CSV source cleared');
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		poll_set_public: {
			name: 'Set poll public (audience can vote)',
			options: [
				{
					id: 'pollId',
					type: 'dropdown',
					label: 'Poll',
					default: '',
					choices: pollChoices.length ? pollChoices : noEvent,
				},
				{
					id: 'public',
					type: 'dropdown',
					label: 'Public',
					default: 'true',
					choices: [
						{ id: 'true', label: 'On' },
						{ id: 'false', label: 'Off' },
					],
				},
			],
			callback: async (event) => {
				const pid = event.options.pollId;
				const pub = event.options.public === 'true';
				if (!eventId || !pid) {
					self.log('warn', 'Event ID and Poll required');
					return;
				}
				try {
					await self.apiPost(`events/${eventId}/poll/${pid}/public`, { public: pub });
					await self.fetchPolls(eventId);
					self.checkAllFeedbacks();
					self.log('info', `Poll public ${pub ? 'on' : 'off'}`);
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		poll_toggle_public: {
			name: 'Toggle poll public (audience can vote)',
			options: [
				{
					id: 'pollId',
					type: 'dropdown',
					label: 'Poll',
					default: '',
					choices: pollChoices.length ? pollChoices : noEvent,
				},
			],
			callback: async (event) => {
				const pid = event.options.pollId;
				if (!eventId || !pid) {
					self.log('warn', 'Event ID and Poll required');
					return;
				}
				const p = self.polls.find((x) => x.id === pid);
				const pub = p ? !p.isActiveForPublic : true;
				try {
					await self.apiPost(`events/${eventId}/poll/${pid}/public`, { public: pub });
					await self.fetchPolls(eventId);
					self.checkAllFeedbacks();
					self.log('info', `Poll public ${pub ? 'on' : 'off'}`);
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		qa_session_set_public: {
			name: 'Set Q&A session public',
			options: [
				{
					id: 'qaId',
					type: 'dropdown',
					label: 'Q&A Session',
					default: '',
					choices: qaSessionChoices.length ? qaSessionChoices : noEvent,
				},
				{
					id: 'public',
					type: 'dropdown',
					label: 'Public',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'true', label: 'On' },
						{ id: 'false', label: 'Off' },
					],
				},
			],
			callback: async (event) => {
				const qid = event.options.qaId;
				let pub = event.options.public;
				if (!eventId || !qid) {
					self.log('warn', 'Event ID and Q&A session required');
					return;
				}
				if (pub === 'toggle') {
					const q = self.qaSessions.find((x) => x.id === qid);
					pub = q ? !q.isActiveForPublic : true;
				} else {
					pub = pub === 'true';
				}
				try {
					await self.apiPost(`events/${eventId}/qa/${qid}/public`, { public: pub });
					await self.fetchQa(eventId);
					self.checkAllFeedbacks();
					self.log('info', `Q&A session public ${pub ? 'on' : 'off'}`);
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		qa_session_toggle_public: {
			name: 'Toggle Q&A session public',
			options: [
				{
					id: 'qaId',
					type: 'dropdown',
					label: 'Q&A Session',
					default: '',
					choices: qaSessionChoices.length ? qaSessionChoices : noEvent,
				},
			],
			callback: async (event) => {
				const qid = event.options.qaId;
				if (!eventId || !qid) {
					self.log('warn', 'Event ID and Q&A session required');
					return;
				}
				const q = self.qaSessions.find((x) => x.id === qid);
				const pub = q ? !q.isActiveForPublic : true;
				try {
					await self.apiPost(`events/${eventId}/qa/${qid}/public`, { public: pub });
					await self.fetchQa(eventId);
					self.checkAllFeedbacks();
					self.log('info', `Q&A session public ${pub ? 'on' : 'off'}`);
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		qa_session_set_active: {
			name: 'Set Q&A session active (output)',
			options: [
				{
					id: 'qaId',
					type: 'dropdown',
					label: 'Q&A Session',
					default: '',
					choices: qaSessionChoices.length ? qaSessionChoices : noEvent,
				},
				{
					id: 'active',
					type: 'dropdown',
					label: 'Active',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'true', label: 'On' },
						{ id: 'false', label: 'Off' },
					],
				},
			],
			callback: async (event) => {
				if (!eventId) {
					self.log('warn', 'Event ID required');
					return;
				}
				const qid = (event.options?.qaId || '').trim() || null;
				if (!qid) {
					self.log('warn', 'Q&A session required');
					return;
				}
				await self.fetchQa(eventId);
				const hasActive = (self.qaQuestions || []).some((q) => q.isActive === true);
				let turnOn = false;
				const activeOpt = event.options?.active || 'toggle';
				if (activeOpt === 'true') turnOn = true;
				else if (activeOpt === 'false') turnOn = false;
				else turnOn = !hasActive;
				try {
					if (turnOn) {
						await self.apiPost(`events/${eventId}/qa/session/${qid}/play-next`);
					} else {
						await self.apiPost(`events/${eventId}/qa/stop`);
					}
					await self.fetchQa(eventId);
					self.updateVariableValues();
					self.checkAllFeedbacks();
					self.log('info', turnOn ? 'Q&A output on (play)' : 'Q&A output off (stop)');
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		qa_session_set_csv_source: {
			name: 'Set Q&A CSV source',
			options: [
				{
					id: 'qaId',
					type: 'dropdown',
					label: 'Q&A Session',
					default: '',
					choices: [{ id: '', label: '— Clear' }, ...(qaSessionChoices.length ? qaSessionChoices : [])],
				},
				{
					id: 'mode',
					type: 'dropdown',
					label: 'CSV source',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'true', label: 'On' },
						{ id: 'false', label: 'Off' },
					],
				},
			],
			callback: async (event) => {
				if (!eventId) {
					self.log('warn', 'Event ID required');
					return;
				}
				const opts = event.options || {};
				const qid = (opts.qaId || '').trim() || null;
				const mode = opts.mode || 'toggle';
				let sessionId = null;
				if (mode === 'false' || !qid) {
					sessionId = null;
				} else if (mode === 'true') {
					sessionId = qid;
				} else {
					const session = self.qaSessions.find((x) => x.id === qid);
					sessionId = session && session.isCsvSource ? null : qid;
				}
				try {
					await self.apiPost(`events/${eventId}/qa/csv-source`, { sessionId });
					await self.fetchQa(eventId);
					self.checkAllFeedbacks();
					self.log('info', sessionId ? 'Q&A CSV source set' : 'Q&A CSV source cleared');
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		qa_session_play_next: {
			name: 'Play next question in session',
			options: [
				{
					id: 'qaId',
					type: 'dropdown',
					label: 'Q&A Session',
					default: '',
					choices: qaSessionChoices.length ? qaSessionChoices : noEvent,
				},
			],
			callback: async (event) => {
				const opts = event.options || {};
				const sessionId = opts.qaId;
				if (!eventId || !sessionId) {
					self.log('warn', 'Event ID and Q&A session required');
					return;
				}
				try {
					self.log('info', `Play next in session ${sessionId.slice(0, 8)}...`);
					await self.apiPost(`events/${eventId}/qa/session/${sessionId}/play-next`);
					await self.fetchQa(eventId);
					self.updateVariableValues();
					self.checkAllFeedbacks();
					self.log('info', 'Playing next question');
				} catch (err) {
					self.log('error', `Play next failed: ${err.message}`);
					throw err;
				}
			},
		},
		qa_question_play: {
			name: 'Play question (go live)',
			options: [
				{
					id: 'questionId',
					type: 'dropdown',
					label: 'Question',
					default: '',
					choices: qaQuestionChoices.length ? qaQuestionChoices : noEvent,
				},
			],
			callback: async (event) => {
				const qid = event.options.questionId;
				if (!eventId || !qid) {
					self.log('warn', 'Event ID and Question required');
					return;
				}
				try {
					await self.apiPost(`events/${eventId}/qa/question/${qid}/play`);
					await self.fetchQa(eventId);
					self.updateVariableValues();
					self.checkAllFeedbacks();
					self.log('info', 'Question playing');
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		qa_question_cue: {
			name: 'Cue question (set as next)',
			options: [
				{
					id: 'questionId',
					type: 'dropdown',
					label: 'Question',
					default: '',
					choices: qaQuestionChoices.length ? qaQuestionChoices : noEvent,
				},
			],
			callback: async (event) => {
				const qid = event.options.questionId;
				if (!eventId || !qid) {
					self.log('warn', 'Event ID and Question required');
					return;
				}
				try {
					await self.apiPost(`events/${eventId}/qa/question/${qid}/cue`);
					await self.fetchQa(eventId);
					self.updateVariableValues();
					self.checkAllFeedbacks();
					self.log('info', 'Question cued');
				} catch (err) {
					self.log('error', err.message);
				}
			},
		},
		qa_stop: {
			name: 'Stop current Q&A question',
			options: [],
			callback: async () => {
				if (!eventId) {
					self.log('warn', 'Event ID required');
					return;
				}
				try {
					self.log('info', 'Sending Q&A stop...');
					await self.apiPost(`events/${eventId}/qa/stop`);
					await self.fetchQa(eventId);
					self.updateVariableValues();
					self.checkAllFeedbacks();
					self.log('info', 'Q&A stopped');
				} catch (err) {
					self.log('error', `Q&A stop failed: ${err.message}`);
					throw err;
				}
			},
		},
	});
};
