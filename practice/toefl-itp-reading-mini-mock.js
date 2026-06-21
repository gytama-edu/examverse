(() => {
  'use strict';

  const DATA_PATH = '../data/toefl-itp/reading/reading-comprehension.json';
  const HUB_URL = '../pages/toefl-itp.html';
  const PASSAGE_URL = 'toefl-itp-reading.html#practice-shell';
  const TOTAL_TIME = 20 * 60;

  const state = {
    sets: [],
    currentSetIndex: 0,
    answers: {},
    submitted: false,
    remainingSeconds: TOTAL_TIME,
    timerId: null,
    started: false,
    loaded: false,
    reviewOpen: false,
    confirmOpen: false,
    focusQuestionId: null
  };

  const el = {
    sessionTitle: document.querySelector('#mock-session-title'),
    statusPill: document.querySelector('#mock-status-pill'),
    intro: document.querySelector('#mock-intro'),
    test: document.querySelector('#mock-test'),
    results: document.querySelector('#mock-results'),
    error: document.querySelector('#mock-error'),
    errorMessage: document.querySelector('#mock-error-message'),
    start: document.querySelector('#start-mini-mock'),
    timerDisplay: document.querySelector('#mock-timer-display'),
    timerStatus: document.querySelector('#mock-timer-status'),
    passageDisplay: document.querySelector('#mock-passage-display'),
    passageSubtitle: document.querySelector('#mock-passage-subtitle'),
    answeredDisplay: document.querySelector('#mock-answered-display'),
    progress: document.querySelector('#mock-progress'),
    progressBar: document.querySelector('#mock-progress-bar'),
    progressLabel: document.querySelector('#mock-progress-label'),
    navigator: document.querySelector('#mock-navigator'),
    passageDifficulty: document.querySelector('#mock-passage-difficulty'),
    passageDiscipline: document.querySelector('#mock-passage-discipline'),
    passageCount: document.querySelector('#mock-passage-count'),
    passageCard: document.querySelector('#mock-passage-card'),
    questionList: document.querySelector('#mock-question-list'),
    prev: document.querySelector('#mock-prev'),
    next: document.querySelector('#mock-next'),
    restart: document.querySelector('#mock-restart'),
    submit: document.querySelector('#mock-submit'),
    reviewButton: document.querySelector('#review-answers-btn'),
    reviewPanel: document.querySelector('#mock-review-panel'),
    confirmPanel: document.querySelector('#mock-confirm-panel'),
    confirmText: document.querySelector('#mock-confirm-text'),
    continueButton: document.querySelector('#mock-continue'),
    submitNowButton: document.querySelector('#mock-submit-now'),
    retry: document.querySelector('#mock-retry'),
    stage: document.querySelector('#mock-stage')
  };

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const formatTime = (seconds) => {
    const safe = Math.max(0, seconds);
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const currentSet = () => state.sets[state.currentSetIndex];
  const allQuestions = () => state.sets.flatMap((set, setIndex) => set.questions.map((question, questionIndex) => ({
    ...question,
    setIndex,
    setTitle: set.title,
    discipline: set.discipline,
    difficulty: set.difficulty,
    passage: set.passage,
    globalNumber: setIndex * 5 + questionIndex + 1
  })));
  const questionById = (questionId) => allQuestions().find((question) => question.id === questionId);
  const answeredCount = () => allQuestions().filter((question) => normalize(state.answers[question.id])).length;
  const unansweredCount = () => allQuestions().length - answeredCount();
  const answerTextFor = (question, id) => question.options.find((option) => option.id === id)?.text || id || 'No answer';

  const setVisible = (section, visible) => {
    section.hidden = !visible;
  };

  const stopTimer = () => {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  };

  const updateTimerState = () => {
    el.timerDisplay.textContent = formatTime(state.remainingSeconds);
    el.timerDisplay.classList.toggle('mini-mock-timer-warning', state.remainingSeconds <= 300 && state.remainingSeconds > 60);
    el.timerDisplay.classList.toggle('mini-mock-timer-urgent', state.remainingSeconds <= 60);
    el.timerStatus.textContent =
      state.remainingSeconds <= 0 ? 'Time is up' :
      state.remainingSeconds <= 60 ? 'Urgent' :
      state.remainingSeconds <= 300 ? 'Warning' :
      state.started ? 'In progress' : 'Ready to start';
    el.statusPill.textContent =
      state.remainingSeconds <= 0 ? 'Finished' :
      state.remainingSeconds <= 60 ? 'Urgent' :
      state.remainingSeconds <= 300 ? 'Warning' :
      state.started ? 'Timed' : 'Ready';
  };

  const updateProgress = () => {
    const total = allQuestions().length || 15;
    const done = answeredCount();
    const safe = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
    el.progressBar.style.width = `${safe}%`;
    el.progress.setAttribute('aria-valuenow', String(safe));
    el.answeredDisplay.textContent = `${done} / ${total}`;
    el.progressLabel.textContent = done ? `${done} answered` : 'No answers yet';
  };

  const updatePassageHeader = () => {
    const set = currentSet();
    if (!set) return;
    el.sessionTitle.textContent = state.submitted ? 'TOEFL ITP Reading Mini Mock Review' : set.title;
    el.passageDisplay.textContent = `Passage ${state.currentSetIndex + 1} of ${state.sets.length}`;
    el.passageSubtitle.textContent = `${set.discipline} - ${set.difficulty}`;
    el.passageDifficulty.textContent = set.difficulty;
    el.passageDiscipline.textContent = set.discipline;
    el.passageCount.textContent = `${set.questions.length} questions`;
    el.prev.disabled = state.currentSetIndex === 0;
    el.next.disabled = state.currentSetIndex === state.sets.length - 1;
    el.next.textContent = state.currentSetIndex === state.sets.length - 1 ? 'Last Passage' : 'Next Passage';
  };

  const renderParagraphs = (passage) => String(passage)
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => create('p', 'daily-life-passage', part));

  const renderNavigator = () => {
    el.navigator.replaceChildren();
    allQuestions().forEach((question) => {
      const button = create('button', 'mini-mock-nav-btn');
      button.type = 'button';
      const answered = normalize(state.answers[question.id]);
      button.textContent = String(question.globalNumber);
      button.classList.toggle('answered', Boolean(answered));
      button.classList.toggle('unanswered', !answered);
      button.classList.toggle('current-set', question.setIndex === state.currentSetIndex);
      button.classList.toggle('focused', state.focusQuestionId === question.id);
      button.setAttribute('aria-label', `Question ${question.globalNumber} ${answered ? 'answered' : 'unanswered'}`);
      button.addEventListener('click', () => jumpToQuestion(question.id));
      el.navigator.append(button);
    });
  };

  const renderQuestionCard = (question) => {
    const card = create('article', 'daily-life-question-card mini-mock-question-card');
    card.dataset.questionId = question.id;

    const header = create('div', 'daily-life-question-header');
    header.append(
      create('span', 'daily-life-question-number', `Question ${question.globalNumber}`),
      create('span', 'mini-mock-skill', question.skill),
      create('h3', null, question.question)
    );

    const options = create('div', 'daily-life-option-grid');
    question.options.forEach((option) => {
      const button = create('button', 'daily-life-option mini-mock-option');
      button.type = 'button';
      button.dataset.optionId = option.id;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `Question ${question.globalNumber} option ${option.id}: ${option.text}`);
      button.append(
        create('span', 'daily-life-option-key', option.id),
        create('span', 'daily-life-option-text', option.text)
      );
      button.addEventListener('click', () => selectAnswer(question.id, option.id));
      if (normalize(state.answers[question.id]) === normalize(option.id)) {
        button.classList.add('selected');
        button.setAttribute('aria-pressed', 'true');
      }
      options.append(button);
    });

    card.append(header, options);
    return card;
  };

  const updateReviewPanel = () => {
    if (!state.reviewOpen) return;
    const summary = create('div', 'mini-mock-review-summary', `Answered ${answeredCount()} of ${allQuestions().length} questions.`);
    const groups = state.sets.map((set, setIndex) => {
      const group = create('article', 'mini-mock-review-group');
      group.append(create('div', 'mini-mock-review-group-head', `${setIndex + 1}. ${set.title}`));
      const buttons = create('div', 'mini-mock-review-questions');
      set.questions.forEach((question) => {
        const meta = questionById(question.id);
        const button = create('button', 'mini-mock-review-chip');
        button.type = 'button';
        const answered = normalize(state.answers[meta.id]);
        button.textContent = String(meta.globalNumber);
        button.classList.toggle('answered', Boolean(answered));
        button.classList.toggle('unanswered', !answered);
        button.setAttribute('aria-label', `Question ${meta.globalNumber} ${answered ? 'answered' : 'unanswered'}`);
        button.addEventListener('click', () => jumpToQuestion(meta.id));
        buttons.append(button);
      });
      group.append(buttons);
      return group;
    });
    el.reviewPanel.replaceChildren(summary, ...groups);
  };

  const renderCurrentSet = (focusQuestionId = null) => {
    const set = currentSet();
    if (!set) return;
    state.focusQuestionId = focusQuestionId;
    updatePassageHeader();
    updateProgress();
    renderNavigator();

    const top = create('div', 'completion-content-top mini-mock-content-top');
    top.append(
      create('span', 'completion-difficulty', set.difficulty),
      create('span', 'completion-type', set.discipline),
      create('span', 'completion-word-limit', `${set.questions.length} questions`)
    );

    el.passageCard.replaceChildren(
      create('span', 'section-kicker', `Passage ${state.currentSetIndex + 1} of ${state.sets.length}`),
      (() => {
        const title = create('h3', 'completion-passage-title', set.title);
        title.id = 'mock-passage-title';
        return title;
      })(),
      ...renderParagraphs(set.passage)
    );

    el.questionList.replaceChildren(...set.questions.map(renderQuestionCard));
    el.stage.replaceChildren(top, el.passageCard, el.questionList);
    updateReviewPanel();
  };

  const selectAnswer = (questionId, optionId) => {
    if (state.submitted) return;
    state.answers[questionId] = optionId;
    const card = el.questionList.querySelector(`[data-question-id="${questionId}"]`);
    card?.querySelectorAll('.daily-life-option').forEach((button) => {
      const selected = button.dataset.optionId === optionId;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    updateProgress();
    renderNavigator();
    updatePassageHeader();
    if (state.reviewOpen) updateReviewPanel();
  };

  const jumpToQuestion = (questionId) => {
    const question = questionById(questionId);
    if (!question) return;
    state.currentSetIndex = question.setIndex;
    state.focusQuestionId = questionId;
    state.reviewOpen = false;
    el.reviewPanel.hidden = true;
    el.reviewButton.textContent = 'Review Answers';
    renderCurrentSet(questionId);
    const card = el.questionList.querySelector(`[data-question-id="${questionId}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openReviewPanel = () => {
    state.reviewOpen = !state.reviewOpen;
    el.reviewPanel.hidden = !state.reviewOpen;
    el.reviewButton.textContent = state.reviewOpen ? 'Close Review' : 'Review Answers';
    if (state.reviewOpen) updateReviewPanel();
  };

  const openConfirmPanel = () => {
    state.confirmOpen = true;
    el.confirmText.textContent = `You still have ${unansweredCount()} unanswered questions.`;
    el.confirmPanel.hidden = false;
  };

  const closeConfirmPanel = () => {
    state.confirmOpen = false;
    el.confirmPanel.hidden = true;
  };

  const performanceMessage = (score) => {
    if (score >= 13) return 'Excellent control of passage meaning, details, vocabulary, and inference.';
    if (score >= 10) return 'Strong performance with a few areas to review.';
    if (score >= 7) return 'Developing performance. Review evidence and inference questions carefully.';
    return 'More targeted reading practice is recommended before another mini mock.';
  };

  const buildReviewCard = (question, selectedId) => {
    const correctId = question.answer;
    const isCorrect = normalize(selectedId) === normalize(correctId);
    const statusText = selectedId ? (isCorrect ? 'Correct' : 'Incorrect') : 'Not Answered';
    const card = create('article', `mini-mock-review-card ${isCorrect ? 'correct' : selectedId ? 'wrong' : 'unanswered'}`);
    const header = create('div', 'mini-mock-review-header');
    header.append(
      create('span', 'mini-mock-review-number', `Question ${question.globalNumber}`),
      create('span', 'mini-mock-review-skill', question.skill),
      create('span', `mini-mock-review-status ${isCorrect ? 'correct' : selectedId ? 'wrong' : 'unanswered'}`, statusText)
    );
    const questionText = create('p', 'mini-mock-review-question', question.question);
    const answers = create('div', 'mini-mock-review-answers');

    const student = create('div');
    student.append(
      create('span', null, 'Student answer'),
      create('strong', isCorrect ? 'correct' : selectedId ? 'wrong' : 'unanswered', selectedId ? answerTextFor(question, selectedId) : 'No answer')
    );
    const correct = create('div');
    correct.append(create('span', null, 'Correct answer'), create('strong', 'correct', answerTextFor(question, correctId)));
    answers.append(student, correct);

    const evidence = create('p', 'mini-mock-review-evidence');
    evidence.append(create('strong', null, 'Evidence: '), document.createTextNode(question.evidence));
    const explanation = create('p', 'mini-mock-review-explanation');
    explanation.append(create('strong', null, 'Explanation: '), document.createTextNode(question.explanation));

    card.append(header, questionText, answers, evidence, explanation);
    return card;
  };

  const renderResults = () => {
    const total = allQuestions().length;
    const correct = allQuestions().filter((question) => normalize(state.answers[question.id]) === normalize(question.answer)).length;
    const incorrect = allQuestions().filter((question) => normalize(state.answers[question.id]) && normalize(state.answers[question.id]) !== normalize(question.answer)).length;
    const unanswered = total - answeredCount();
    const usedSeconds = TOTAL_TIME - state.remainingSeconds;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;

    el.results.replaceChildren();

    const summary = create('section', 'mini-mock-results-summary');
    summary.append(
      create('span', 'section-kicker', 'Mini mock results'),
      create('h3', null, `${correct} / ${total} correct`),
      create('p', null, `${accuracy}% accuracy`),
      create('p', 'mini-mock-results-message', performanceMessage(correct))
    );

    const grid = create('div', 'mini-mock-results-grid');
    [
      ['Correct answers', String(correct), 'correct'],
      ['Incorrect answers', String(incorrect), 'wrong'],
      ['Unanswered questions', String(unanswered), 'unanswered'],
      ['Time used', formatTime(usedSeconds), 'time']
    ].forEach(([label, value, tone]) => {
      const stat = create('div', `mini-mock-result-stat ${tone}`);
      stat.append(create('span', null, label), create('strong', null, value));
      grid.append(stat);
    });

    const review = create('section', 'mini-mock-final-review');
    review.append(create('h4', null, 'Detailed Review'));
    state.sets.forEach((set, setIndex) => {
      const group = create('article', 'mini-mock-final-group');
      group.append(create('div', 'mini-mock-final-group-head', `${setIndex + 1}. ${set.title}`));
      set.questions.forEach((question) => {
        group.append(buildReviewCard(question, state.answers[question.id]));
      });
      review.append(group);
    });

    const actions = create('div', 'practice-actions mini-mock-result-actions');
    const restart = create('button', 'button', 'Restart Mini Mock');
    restart.type = 'button';
    restart.addEventListener('click', resetMock);
    const practiceLink = create('a', 'button button-secondary', 'Practise Individual Passages');
    practiceLink.href = PASSAGE_URL;
    const hubLink = create('a', 'practice-hub-link', null);
    hubLink.href = HUB_URL;
    hubLink.append(create('span', null, '\u2190'), document.createTextNode(' Back to TOEFL ITP Hub'));
    actions.append(restart, practiceLink, hubLink);

    el.results.append(summary, grid, review, actions);
    setVisible(el.results, true);
    setVisible(el.test, false);
  };

  const finalizeSubmission = (auto = false) => {
    if (state.submitted) return;
    state.submitted = true;
    state.started = false;
    closeConfirmPanel();
    state.reviewOpen = false;
    el.reviewPanel.hidden = true;
    el.reviewButton.textContent = 'Review Answers';
    stopTimer();
    updateTimerState();
    renderResults();
    el.statusPill.textContent = auto ? 'Time up' : 'Submitted';
  };

  const submitTest = (auto = false) => {
    if (state.submitted) return;
    if (!auto) {
      openConfirmPanel();
      return;
    }
    finalizeSubmission(true);
  };

  const startTimer = () => {
    stopTimer();
    state.timerId = window.setInterval(() => {
      state.remainingSeconds -= 1;
      updateTimerState();
      if (state.remainingSeconds <= 0) {
        submitTest(true);
      }
    }, 1000);
  };

  const renderIntro = () => {
    setVisible(el.intro, true);
    setVisible(el.test, false);
    setVisible(el.results, false);
    el.reviewPanel.hidden = true;
    el.confirmPanel.hidden = true;
    el.sessionTitle.textContent = 'Loading mini mock...';
    el.statusPill.textContent = state.loaded ? 'Ready' : 'Preparing data';
    el.start.disabled = !state.loaded;
    el.start.textContent = 'Start Mini Mock';
  };

  const resetMock = () => {
    stopTimer();
    state.currentSetIndex = 0;
    state.answers = {};
    state.submitted = false;
    state.remainingSeconds = TOTAL_TIME;
    state.started = false;
    state.reviewOpen = false;
    state.confirmOpen = false;
    state.focusQuestionId = null;
    el.reviewButton.textContent = 'Review Answers';
    updateTimerState();
    updateProgress();
    renderIntro();
  };

  const startMock = () => {
    if (!state.loaded) return;
    state.started = true;
    state.remainingSeconds = TOTAL_TIME;
    state.submitted = false;
    state.currentSetIndex = 0;
    state.reviewOpen = false;
    state.confirmOpen = false;
    state.focusQuestionId = null;
    el.reviewButton.textContent = 'Review Answers';
    setVisible(el.intro, false);
    setVisible(el.results, false);
    setVisible(el.test, true);
    renderCurrentSet();
    updateTimerState();
    updateProgress();
    startTimer();
    el.statusPill.textContent = 'Timed';
  };

  const validateMockDataset = (data) => {
    if (!Array.isArray(data)) throw new Error('The mini mock dataset must be an array.');
    const activeSets = data.filter((set) => set?.status === 'active');
    if (activeSets.length !== 3) throw new Error('The mini mock must use exactly 3 active passages.');

    const seenSetIds = new Set();
    const seenQuestionIds = new Set();
    let totalQuestions = 0;

    activeSets.forEach((set, setIndex) => {
      const label = set?.id || `passage ${setIndex + 1}`;
      const required = ['id', 'examKey', 'exam', 'section', 'taskType', 'interfaceType', 'difficulty', 'discipline', 'title', 'passage', 'questions', 'status'];
      const missing = required.filter((field) => set?.[field] === undefined || set?.[field] === null || set?.[field] === '');
      if (missing.length) throw new Error(`${label} is missing ${missing.join(', ')}.`);
      if (seenSetIds.has(set.id)) throw new Error(`Duplicate set id found: ${set.id}.`);
      seenSetIds.add(set.id);
      if (set.examKey !== 'toefl-itp' || set.section !== 'reading' || set.taskType !== 'reading-comprehension' || set.interfaceType !== 'toefl-itp-reading-mcq') {
        throw new Error(`${label} has invalid reading metadata.`);
      }
      if (!Array.isArray(set.questions) || set.questions.length !== 5) throw new Error(`${label} must contain exactly five questions.`);

      set.questions.forEach((question, questionIndex) => {
        const questionLabel = `${label}, question ${questionIndex + 1}`;
        const questionRequired = ['id', 'number', 'skill', 'question', 'options', 'answer', 'evidence', 'explanation'];
        const missingQuestion = questionRequired.filter((field) => question?.[field] === undefined || question?.[field] === null || question?.[field] === '');
        if (missingQuestion.length) throw new Error(`${questionLabel} is missing ${missingQuestion.join(', ')}.`);
        if (seenQuestionIds.has(question.id)) throw new Error(`${label} repeats question id ${question.id}.`);
        seenQuestionIds.add(question.id);
        if (question.number !== questionIndex + 1) throw new Error(`${questionLabel} must be numbered ${questionIndex + 1}.`);
        if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error(`${questionLabel} must have exactly four options.`);
        const optionIds = question.options.map((option) => option.id);
        const uniqueOptionIds = new Set(optionIds);
        if (uniqueOptionIds.size !== 4 || !['A', 'B', 'C', 'D'].every((id) => uniqueOptionIds.has(id))) {
          throw new Error(`${questionLabel} must use option ids A, B, C, and D.`);
        }
        if (!question.options.every((option) => option?.text)) throw new Error(`${questionLabel} has an empty option.`);
        if (!uniqueOptionIds.has(question.answer)) throw new Error(`${questionLabel} answer must match one option id.`);
        totalQuestions += 1;
      });
    });

    if (totalQuestions !== 15) throw new Error('The mini mock must contain exactly 15 questions.');
    return activeSets;
  };

  const showError = (error) => {
    setVisible(el.intro, false);
    setVisible(el.test, false);
    setVisible(el.results, false);
    el.error.hidden = false;
    el.errorMessage.textContent = error?.message || 'Please check the dataset and try again.';
    el.sessionTitle.textContent = 'Practice data unavailable';
    el.statusPill.textContent = 'Error';
  };

  async function loadDataset() {
    el.start.disabled = true;
    try {
      const response = await fetch(DATA_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${DATA_PATH} (${response.status}).`);
      state.sets = validateMockDataset(await response.json());
      state.loaded = true;
      el.error.hidden = true;
      resetMock();
    } catch (error) {
      console.error('Exam Verse TOEFL ITP reading mini mock dataset validation failed:', error);
      showError(error);
    }
  }

  el.start.addEventListener('click', startMock);
  el.prev.addEventListener('click', () => {
    if (state.currentSetIndex > 0) {
      state.currentSetIndex -= 1;
      renderCurrentSet();
    }
  });
  el.next.addEventListener('click', () => {
    if (state.currentSetIndex < state.sets.length - 1) {
      state.currentSetIndex += 1;
      renderCurrentSet();
    }
  });
  el.restart.addEventListener('click', resetMock);
  el.submit.addEventListener('click', () => submitTest(false));
  el.reviewButton.addEventListener('click', openReviewPanel);
  el.continueButton.addEventListener('click', closeConfirmPanel);
  el.submitNowButton.addEventListener('click', () => finalizeSubmission(false));
  el.retry.addEventListener('click', loadDataset);

  updateTimerState();
  updateProgress();
  renderIntro();
  loadDataset();
})();
