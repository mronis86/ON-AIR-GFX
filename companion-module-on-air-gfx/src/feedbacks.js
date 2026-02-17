const { combineRgb } = require('@companion-module/base');

module.exports = async function (self) {
	const pollChoices = (self.polls || []).map((p) => ({ id: p.id, label: p.title }));
	const qaSessionChoices = (self.qaSessions || []).map((q) => ({ id: q.id, label: q.name || q.id }));
	const qaQuestionChoices = (self.qaQuestions || []).map((q) => ({
		id: q.id,
		label: (q.question || '').slice(0, 50) + (q.question && q.question.length > 50 ? '…' : ''),
	}));
	const noChoice = [{ id: '', label: 'No items - set Event ID first' }];

	// All feedbacks use defaultStyle with bgcolor (and color) so buttons change background when true.
	self.setFeedbackDefinitions({
		poll_active: {
			name: 'Poll is active (on output)',
			type: 'boolean',
			label: 'Poll active',
			defaultStyle: { bgcolor: combineRgb(0, 180, 0), color: combineRgb(255, 255, 255) },
			options: [
				{
					id: 'pollId',
					type: 'dropdown',
					label: 'Poll',
					default: '',
					choices: pollChoices.length ? pollChoices : noChoice,
				},
			],
			callback: (feedback) => {
				const p = self.polls.find((x) => x.id === feedback.options.pollId);
				return p ? p.isActive === true : false;
			},
		},
		poll_public: {
			name: 'Poll is public (audience can vote)',
			type: 'boolean',
			label: 'Poll public',
			defaultStyle: { bgcolor: combineRgb(50, 100, 200), color: combineRgb(255, 255, 255) },
			options: [
				{
					id: 'pollId',
					type: 'dropdown',
					label: 'Poll',
					default: '',
					choices: pollChoices.length ? pollChoices : noChoice,
				},
			],
			callback: (feedback) => {
				const p = self.polls.find((x) => x.id === feedback.options.pollId);
				return p ? p.isActiveForPublic === true : false;
			},
		},
		poll_csv_source: {
			name: 'Poll is CSV source',
			type: 'boolean',
			label: 'Poll CSV source',
			defaultStyle: { bgcolor: combineRgb(0, 140, 120), color: combineRgb(255, 255, 255) },
			options: [
				{
					id: 'pollId',
					type: 'dropdown',
					label: 'Poll',
					default: '',
					choices: pollChoices.length ? pollChoices : noChoice,
				},
			],
			callback: (feedback) => {
				const p = self.polls.find((x) => x.id === feedback.options.pollId);
				return p ? p.isCsvSource === true : false;
			},
		},
		qa_session_public: {
			name: 'Q&A session is public',
			type: 'boolean',
			label: 'Q&A session public',
			defaultStyle: { bgcolor: combineRgb(80, 80, 180), color: combineRgb(255, 255, 255) },
			options: [
				{
					id: 'qaId',
					type: 'dropdown',
					label: 'Q&A Session',
					default: '',
					choices: qaSessionChoices.length ? qaSessionChoices : noChoice,
				},
			],
			callback: (feedback) => {
				const q = self.qaSessions.find((x) => x.id === feedback.options.qaId);
				return q ? q.isActiveForPublic === true : false;
			},
		},
		qa_session_csv_source: {
			name: 'Q&A session is CSV source (live Q&A CSV)',
			type: 'boolean',
			label: 'Q&A session CSV source',
			defaultStyle: { bgcolor: combineRgb(0, 140, 120), color: combineRgb(255, 255, 255) },
			options: [
				{
					id: 'qaId',
					type: 'dropdown',
					label: 'Q&A Session',
					default: '',
					choices: qaSessionChoices.length ? qaSessionChoices : noChoice,
				},
			],
			callback: (feedback) => {
				const q = self.qaSessions.find((x) => x.id === feedback.options.qaId);
				return q ? q.isCsvSource === true : false;
			},
		},
		question_active: {
			name: 'Question is live',
			type: 'boolean',
			label: 'Question active',
			defaultStyle: { bgcolor: combineRgb(0, 100, 0), color: combineRgb(255, 255, 255) },
			options: [
				{
					id: 'questionId',
					type: 'dropdown',
					label: 'Question',
					default: '',
					choices: qaQuestionChoices.length ? qaQuestionChoices : noChoice,
				},
			],
			callback: (feedback) => {
				const q = self.qaQuestions.find((x) => x.id === feedback.options.questionId);
				return q ? q.isActive === true : false;
			},
		},
		question_cued: {
			name: 'Question is cued (next)',
			type: 'boolean',
			label: 'Question cued',
			defaultStyle: { bgcolor: combineRgb(180, 120, 0), color: combineRgb(255, 255, 255) },
			options: [
				{
					id: 'questionId',
					type: 'dropdown',
					label: 'Question',
					default: '',
					choices: qaQuestionChoices.length ? qaQuestionChoices : noChoice,
				},
			],
			callback: (feedback) => {
				const q = self.qaQuestions.find((x) => x.id === feedback.options.questionId);
				return q ? q.isNext === true : false;
			},
		},
		has_active_poll: {
			name: 'Any poll is active (on output)',
			type: 'boolean',
			label: 'Has active poll',
			defaultStyle: { bgcolor: combineRgb(0, 180, 0), color: combineRgb(255, 255, 255) },
			options: [],
			callback: () => self.polls.some((p) => p.isActive === true),
		},
		has_active_question: {
			name: 'Any Q&A question is live',
			type: 'boolean',
			label: 'Has active question',
			defaultStyle: { bgcolor: combineRgb(0, 100, 0), color: combineRgb(255, 255, 255) },
			options: [],
			callback: () => self.qaQuestions.some((q) => q.isActive === true),
		},
		has_cued_question: {
			name: 'Any Q&A question is cued (next)',
			type: 'boolean',
			label: 'Has cued question (NEXT)',
			defaultStyle: { bgcolor: combineRgb(148, 0, 211), color: combineRgb(255, 255, 255) },
			options: [],
			callback: () => self.qaQuestions.some((q) => q.isNext === true),
		},
		has_active_or_cued_question: {
			name: 'Any Q&A question is ACTIVE (live) or CUE (cued)',
			type: 'boolean',
			label: 'Has active or cued question',
			defaultStyle: { bgcolor: combineRgb(0, 100, 0), color: combineRgb(255, 255, 255) },
			options: [],
			callback: () =>
				self.qaQuestions.some((q) => q.isActive === true || q.isNext === true),
		},
	});
};
