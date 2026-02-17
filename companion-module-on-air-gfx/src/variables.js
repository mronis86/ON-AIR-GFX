module.exports = function (self) {
	self.setVariableDefinitions([
		{ variableId: 'event_name', name: 'Event name' },
		{ variableId: 'active_poll_title', name: 'Active poll title' },
		{ variableId: 'active_poll_id', name: 'Active poll ID' },
		{ variableId: 'active_question_text', name: 'Active Q&A question text' },
		{ variableId: 'active_question_name', name: 'Active Q&A submitter name' },
		{ variableId: 'active_question_id', name: 'Active Q&A question ID' },
		{ variableId: 'cued_question_text', name: 'Cued (next) question text' },
		{ variableId: 'cued_question_name', name: 'Cued (next) submitter name' },
		{ variableId: 'cued_question_id', name: 'Cued (next) question ID' },
		{ variableId: 'has_active_poll', name: 'Has active poll (Yes/No)' },
		{ variableId: 'has_active_question', name: 'Has active Q&A question (Yes/No)' },
		{ variableId: 'has_cued_question', name: 'Has cued question (Yes/No)' },
	]);
};
