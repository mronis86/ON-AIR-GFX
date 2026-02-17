const { InstanceBase, runEntrypoint, InstanceStatus, combineRgb } = require('@companion-module/base');
const UpgradeScripts = require('./upgrades');
const UpdateActions = require('./actions');
const UpdateFeedbacks = require('./feedbacks');
const UpdateVariableDefinitions = require('./variables');
const UpdatePresets = require('./presets');

class OnAirGfxInstance extends InstanceBase {
	constructor(internal) {
		super(internal);
		this.events = [];
		this.polls = [];
		this.qaSessions = [];
		this.qaQuestions = [];
		this.pollInterval = null;
	}

	async init(config) {
		this.config = config;
		const baseUrl = this.getApiUrl();
		if (baseUrl) this.log('info', `Using API base: ${baseUrl}`);
		this.updateStatus(InstanceStatus.Connecting);
		await this.fetchData();
		this.updateActions();
		this.updateFeedbacks();
		this.updateVariableDefinitions();
		this.updateVariableValues();
		this.checkAllFeedbacks();
		this.startPolling();
		this.updateStatus(InstanceStatus.Ok);
	}

	async destroy() {
		if (this.pollInterval) clearInterval(this.pollInterval);
	}

	async configUpdated(config) {
		this.config = config;
		this.updateStatus(InstanceStatus.Connecting);
		await this.fetchData();
		this.startPolling();
		this.updateActions();
		this.updateFeedbacks();
		this.updateVariableDefinitions();
		this.updateVariableValues();
		this.checkAllFeedbacks();
		this.updateStatus(InstanceStatus.Ok);
	}

	getApiUrl() {
		let url = (this.config?.apiUrl || '').trim().replace(/\/+$/, '');
		if (!url) return '';
		// If user entered just the Railway root (e.g. https://xxx.up.railway.app), append /companion-api
		if (!/\/companion-api$/i.test(url)) {
			url = url + '/companion-api';
		}
		return url;
	}

	async fetch(url, options = {}) {
		const baseUrl = this.getApiUrl();
		if (!baseUrl) throw new Error('API URL not configured');
		const fullUrl = url.startsWith('http') ? url : `${baseUrl}/${url.replace(/^\//, '')}`;
		const headers = { 'Content-Type': 'application/json', ...options.headers };
		try {
			const res = await fetch(fullUrl, { ...options, headers });
			if (!res.ok) {
				this.log('error', `API request failed: HTTP ${res.status} – URL: ${fullUrl}`);
				throw new Error(`HTTP ${res.status}`);
			}
			const text = await res.text();
			return text ? JSON.parse(text) : null;
		} catch (err) {
			this.log('error', `API request failed: ${err.message} – URL: ${fullUrl}`);
			throw err;
		}
	}

	async fetchEvents() {
		const data = await this.fetch('events');
		this.events = Array.isArray(data) ? data : [];
		return this.events;
	}

	async fetchPolls(eventId) {
		if (!eventId) {
			this.polls = [];
			return [];
		}
		const data = await this.fetch(`events/${eventId}/polls`);
		this.polls = Array.isArray(data) ? data : [];
		return this.polls;
	}

	async fetchQa(eventId) {
		if (!eventId) {
			this.qaSessions = [];
			this.qaQuestions = [];
			return { sessions: [], questions: [] };
		}
		const data = await this.fetch(`events/${eventId}/qa`);
		this.qaSessions = Array.isArray(data?.sessions) ? data.sessions : [];
		this.qaQuestions = Array.isArray(data?.questions) ? data.questions : [];
		return { sessions: this.qaSessions, questions: this.qaQuestions };
	}

	async fetchData() {
		const eventId = this.config?.eventId;
		if (!eventId) {
			this.events = [];
			this.polls = [];
			this.qaSessions = [];
			this.qaQuestions = [];
			return;
		}
		try {
			await this.fetchEvents();
			await this.fetchPolls(eventId);
			await this.fetchQa(eventId);
		} catch (err) {
			this.log('error', `Failed to fetch: ${err.message}`);
		}
	}

	startPolling() {
		if (this.pollInterval) clearInterval(this.pollInterval);
		this.pollInterval = null;
		const seconds = Math.max(10, Math.min(120, parseInt(this.config?.pollIntervalSeconds, 10) || 30));
		const self = this;
		this.pollInterval = setInterval(function tick() {
			if (!self.config?.eventId) return;
			self.fetchData()
				.then(() => {
					self.updateActions();
					self.updateFeedbacks();
					self.updateVariableDefinitions();
					self.updateVariableValues();
					self.checkAllFeedbacks();
				})
				.catch(() => {});
		}, seconds * 1000);
	}

	async apiPost(path, body = {}) {
		const baseUrl = this.getApiUrl();
		if (!baseUrl) throw new Error('API URL not configured');
		const fullUrl = `${baseUrl}/${path.replace(/^\//, '')}`;
		const headers = { 'Content-Type': 'application/json' };
		const res = await fetch(fullUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			const err = await res.text();
			throw new Error(err || `HTTP ${res.status}`);
		}
		return res.json().catch(() => ({}));
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'apiUrl',
				label: 'Railway API URL',
				width: 12,
				default: '',
				tooltip: 'Railway app URL (e.g. https://on-air-gfx-production.up.railway.app). You can add /companion-api or leave it off – the module will use the Companion API path.',
			},
			{
				type: 'textinput',
				id: 'eventId',
				label: 'Event ID',
				width: 12,
				tooltip: 'Paste the event ID from the ON-AIR-GFX web app (Event detail or Operators page)',
			},
			{
				type: 'number',
				id: 'pollIntervalSeconds',
				label: 'Poll interval (seconds)',
				width: 6,
				default: 30,
				min: 10,
				max: 120,
			},
		];
	}

	updateActions() {
		UpdateActions(this);
		UpdatePresets(this);
	}

	updateFeedbacks() {
		UpdateFeedbacks(this);
	}

	checkAllFeedbacks() {
		this.checkFeedbacks(
			'poll_active',
			'poll_public',
			'poll_csv_source',
			'qa_session_public',
			'qa_session_csv_source',
			'question_active',
			'question_cued',
			'has_active_poll',
			'has_active_question',
			'has_cued_question',
			'has_active_or_cued_question'
		);
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this);
	}

	updateVariableValues() {
		const eventId = this.config?.eventId;
		const event = this.events.find((e) => String(e.id) === String(eventId));
		const activePoll = this.polls.find((p) => p.isActive);
		const activeQuestion = this.qaQuestions.find((q) => q.isActive);
		const cuedQuestion = this.qaQuestions.find((q) => q.isNext);
		this.setVariableValues({
			event_name: event?.name ?? '—',
			active_poll_title: activePoll?.title ?? '—',
			active_poll_id: activePoll?.id ?? '—',
			active_question_text: activeQuestion?.question ?? '—',
			active_question_name: activeQuestion?.submitterName ?? '—',
			active_question_id: activeQuestion?.id ?? '—',
			cued_question_text: cuedQuestion?.question ?? '—',
			cued_question_name: cuedQuestion?.submitterName ?? '—',
			cued_question_id: cuedQuestion?.id ?? '—',
			has_active_poll: activePoll ? 'Yes' : 'No',
			has_active_question: activeQuestion ? 'Yes' : 'No',
			has_cued_question: cuedQuestion ? 'Yes' : 'No',
		});
	}
}

runEntrypoint(OnAirGfxInstance, UpgradeScripts);
