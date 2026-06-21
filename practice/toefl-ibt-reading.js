(() => {
  'use strict';

  const DATA_PATHS = {
    'daily-life': '../data/toefl-ibt/reading/read-in-daily-life.json',
    academic: '../data/toefl-ibt/reading/academic-passage.json'
  };

  const MODE_CONFIG = {
    'daily-life': {
      title: 'TOEFL iBT 2026 Read in Daily Life',
      shortTitle: 'Read in Daily Life',
      taskType: 'read-in-daily-life',
      interfaceType: 'daily-life-reading',
      questionCount: 3,
      eyebrow: 'Short-text reading practice',
      lead: 'Read one practical text at a time, answer three evidence-based questions, and review the exact clue behind each answer.',
      badges: ['Reading', 'Daily Life', '3 Questions', 'Multiple Choice', 'Score / 3'],
      panelLabel: 'DAILY TEXT',
      panelStatus: 'PRACTICAL',
      panelDemo: 'notice',
      passageLabel: 'Daily-life text',
      completeLabel: 'Daily-life sets complete'
    },
    academic: {
      title: 'TOEFL iBT 2026 Read an Academic Passage',
      shortTitle: 'Read an Academic Passage',
      taskType: 'read-an-academic-passage',
      interfaceType: 'academic-passage-reading',
      questionCount: 5,
      eyebrow: 'Academic passage practice',
      lead: 'Read one academic passage at a time, answer five multiple-choice questions, and review the evidence behind every answer.',
      badges: ['Reading', 'Academic Passage', '5 Questions', 'Multiple Choice', 'Score / 5'],
      panelLabel: 'ACADEMIC TEXT',
      panelStatus: 'EVIDENCE',
      panelDemo: 'research',
      passageLabel: 'Academic passage',
      completeLabel: 'Academic sets complete'
    }
  };

  const requestedMode = new URLSearchParams(window.location.search).get('mode');
  const mode = Object.prototype.hasOwnProperty.call(MODE_CONFIG, requestedMode) ? requestedMode : 'daily-life';
  const config = MODE_CONFIG[mode];

  const state = {
    data: [], currentSetIndex: 0, selectedAnswers: {}, locked: false,
    sessionScore: 0, wrongAnswers: []
  };

  const el = {
    titleMode: document.querySelector('#reading-title-mode'),
    breadcrumb: document.querySelector('#reading-breadcrumb'),
    eyebrow: document.querySelector('#reading-eyebrow'),
    lead: document.querySelector('#reading-hero-lead'),
    badges: document.querySelector('#reading-badges'),
    panelLabel: document.querySelector('#reading-panel-label'),
    panelStatus: document.querySelector('#reading-panel-status'),
    panelDemo: document.querySelector('#reading-panel-demo'),
    panelCopy: document.querySelector('#reading-panel-copy'),
    footerLabel: document.querySelector('#reading-footer-label'),
    sessionTitle: document.querySelector('#reading-session-title'),
    examName: document.querySelector('#reading-exam-name'),
    setCounter: document.querySelector('#reading-set-counter'),
    scoreCount: document.querySelector('#reading-score-count'),
    progress: document.querySelector('#reading-progress'),
    progressBar: document.querySelector('#reading-progress-bar'),
    area: document.querySelector('#reading-question-area'),
    feedback: document.querySelector('#reading-feedback'),
    check: document.querySelector('#reading-check'),
    next: document.querySelector('#reading-next'),
    restart: document.querySelector('#reading-restart')
  };

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const currentSet = () => state.data[state.currentSetIndex];
  const answerText = (question, id) => question.options.find((option) => option.id === id)?.text || id || 'No answer';

  const configurePage = () => {
    document.title = `${config.title} | Exam Verse`;
    el.titleMode.textContent = config.shortTitle;
    el.breadcrumb.textContent = config.shortTitle;
    el.eyebrow.textContent = config.eyebrow;
    el.lead.textContent = config.lead;
    el.badges.replaceChildren(...config.badges.map((badge) => create('span', null, badge)));
    el.panelLabel.textContent = config.panelLabel;
    el.panelStatus.textContent = config.panelStatus;
    el.panelDemo.replaceChildren(document.createTextNode(config.panelDemo), create('span', 'completion-cursor'));
    el.panelCopy.textContent = `Each set uses one connected passage with ${config.questionCount} questions and one score out of ${config.questionCount}.`;
    el.footerLabel.textContent = `${config.title} Practice`;
  };

  const setProgress = (value) => {
    const safe = Math.max(0, Math.min(100, Math.round(value)));
    el.progressBar.style.width = `${safe}%`;
    el.progress.setAttribute('aria-valuenow', String(safe));
  };

  const updateCheckState = () => {
    const set = currentSet();
    el.check.disabled = state.locked || !set || !set.questions.every((question) => state.selectedAnswers[question.id]);
  };

  const selectAnswer = (questionId, optionId) => {
    if (state.locked) return;
    state.selectedAnswers[questionId] = optionId;
    const card = el.area.querySelector(`[data-question-id="${questionId}"]`);
    card?.querySelectorAll('.daily-life-option').forEach((button) => {
      const selected = button.dataset.optionId === optionId;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    updateCheckState();
  };

  const renderQuestion = (question) => {
    const card = create('article', 'daily-life-question-card');
    card.dataset.questionId = question.id;
    const header = create('div', 'daily-life-question-header');
    header.append(create('span', 'daily-life-question-number', `Question ${question.number}`), create('h3', null, question.prompt));
    const options = create('div', 'daily-life-option-grid');
    question.options.forEach((option) => {
      const button = create('button', 'daily-life-option');
      button.type = 'button';
      button.dataset.optionId = option.id;
      button.setAttribute('aria-pressed', 'false');
      button.append(create('span', 'daily-life-option-key', option.id), create('span', 'daily-life-option-text', option.text));
      button.addEventListener('click', () => selectAnswer(question.id, option.id));
      options.append(button);
    });
    const response = create('div', 'daily-life-response');
    response.hidden = true;
    card.append(header, options, response);
    return card;
  };

  const renderSet = () => {
    const set = currentSet();
    if (!set) return showResults();
    state.selectedAnswers = {};
    state.locked = false;
    el.sessionTitle.textContent = set.title;
    el.examName.textContent = mode === 'academic' ? `${set.discipline} - ${set.difficulty}` : `${set.textType} - ${set.difficulty}`;
    el.setCounter.textContent = `Set ${state.currentSetIndex + 1} of ${state.data.length}`;
    el.scoreCount.textContent = `0 / ${set.questions.length}`;
    setProgress((state.currentSetIndex / state.data.length) * 100);
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
    el.check.hidden = false;
    el.next.hidden = true;
    el.next.textContent = 'Next Set ->';

    const meta = create('div', 'completion-content-top');
    meta.append(
      create('span', 'completion-difficulty', set.difficulty),
      create('span', 'completion-type', mode === 'academic' ? set.discipline : set.textType),
      create('span', 'completion-word-limit', `${set.questions.length} questions`)
    );
    const passage = create('section', 'completion-passage-card daily-life-text-card');
    passage.append(create('span', 'section-kicker', config.passageLabel), create('h3', 'completion-passage-title', set.title));
    if (set.context) passage.append(create('p', 'daily-life-context', set.context));
    passage.append(create('p', 'daily-life-passage', set.passage));
    const questions = create('section', 'daily-life-question-list');
    set.questions.forEach((question) => questions.append(renderQuestion(question)));
    el.area.replaceChildren(meta, passage, questions);
    updateCheckState();
  };

  const responseBlock = (question, selected, correct, isCorrect) => {
    const block = create('div', 'daily-life-response');
    const answers = create('div', 'daily-life-response-answers');
    const yours = create('div');
    yours.append(create('span', null, 'Your answer'), create('strong', isCorrect ? 'correct' : 'wrong', answerText(question, selected)));
    const expected = create('div');
    expected.append(create('span', null, 'Correct answer'), create('strong', 'correct', answerText(question, correct)));
    answers.append(yours, expected);
    const evidence = create('p', 'daily-life-response-evidence');
    evidence.append(create('strong', null, 'Evidence: '), document.createTextNode(question.evidence));
    const explanation = create('p', 'daily-life-response-explanation');
    explanation.append(create('strong', null, 'Explanation: '), document.createTextNode(question.explanation));
    block.append(create('div', `daily-life-response-status ${isCorrect ? 'correct' : 'wrong'}`, isCorrect ? 'Correct' : 'Not quite'), answers, evidence, explanation);
    return block;
  };

  const checkAnswers = () => {
    if (state.locked || el.check.disabled) return;
    const set = currentSet();
    state.locked = true;
    let score = 0;
    set.questions.forEach((question) => {
      const selected = state.selectedAnswers[question.id];
      const correct = question.answer;
      const isCorrect = selected === correct;
      if (isCorrect) {
        score += 1;
        state.sessionScore += 1;
      } else {
        state.wrongAnswers.push({ set: state.currentSetIndex + 1, title: set.title, prompt: question.prompt, student: answerText(question, selected), correct: answerText(question, correct), evidence: question.evidence, explanation: question.explanation });
      }
      const card = el.area.querySelector(`[data-question-id="${question.id}"]`);
      card?.classList.add(isCorrect ? 'correct' : 'wrong');
      card?.querySelectorAll('.daily-life-option').forEach((button) => {
        button.disabled = true;
        button.classList.toggle('correct', button.dataset.optionId === correct);
        button.classList.toggle('wrong', button.dataset.optionId === selected && !isCorrect);
      });
      const response = card?.querySelector('.daily-life-response');
      if (response) {
        response.hidden = false;
        response.replaceChildren(responseBlock(question, selected, correct, isCorrect));
      }
    });
    el.scoreCount.textContent = `${score} / ${set.questions.length}`;
    setProgress(((state.currentSetIndex + 1) / state.data.length) * 100);
    el.feedback.replaceChildren(create('strong', null, `${score} of ${set.questions.length} correct.`), create('span', null, 'Review the evidence and explanations before continuing.'));
    el.feedback.hidden = false;
    el.check.hidden = true;
    el.next.hidden = false;
    el.next.textContent = state.currentSetIndex === state.data.length - 1 ? 'View Results ->' : 'Next Set ->';
  };

  const makeStat = (label, value, className = '') => {
    const stat = create('div', `daily-life-review-stat ${className}`.trim());
    stat.append(create('span', null, label), create('strong', null, value));
    return stat;
  };

  const showResults = () => {
    const total = state.data.reduce((sum, set) => sum + set.questions.length, 0);
    const percentage = total ? Math.round((state.sessionScore / total) * 100) : 0;
    el.sessionTitle.textContent = 'Session review';
    el.examName.textContent = 'Finished';
    el.setCounter.textContent = 'Complete';
    el.scoreCount.textContent = `${state.sessionScore} / ${total}`;
    setProgress(100);
    const result = create('div', 'completion-result');
    result.append(create('span', 'section-kicker', config.completeLabel), create('strong', 'completion-result-score', `${state.sessionScore}/${total}`), create('h3', null, `${percentage}% correct`), create('small', null, 'Restart to practise these passages again.'));
    const review = create('section', 'daily-life-review');
    const stats = create('div', 'daily-life-review-grid');
    stats.append(makeStat('Total questions', String(total)), makeStat('Correct answers', String(state.sessionScore), 'correct'), makeStat('Wrong answers', String(state.wrongAnswers.length), 'wrong'), makeStat('Accuracy', `${percentage}%`, 'accuracy'));
    review.append(create('h4', null, 'Session Review'), stats);
    if (state.wrongAnswers.length) {
      const list = create('div', 'daily-life-mistake-list');
      list.append(create('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach((mistake) => {
        const card = create('article', 'daily-life-mistake-card');
        const meta = create('div', 'daily-life-mistake-meta');
        meta.append(create('span', null, `Set ${mistake.set}`), create('span', null, mistake.title));
        const answers = create('div', 'daily-life-mistake-answers');
        const yours = create('div'); yours.append(create('span', null, 'Your answer'), create('strong', 'wrong', mistake.student));
        const correct = create('div'); correct.append(create('span', null, 'Correct answer'), create('strong', 'correct', mistake.correct));
        answers.append(yours, correct);
        const evidence = create('p', 'daily-life-mistake-evidence'); evidence.append(create('strong', null, 'Evidence: '), document.createTextNode(mistake.evidence));
        const explanation = create('p', 'daily-life-mistake-explanation'); explanation.append(create('strong', null, 'Explanation: '), document.createTextNode(mistake.explanation));
        card.append(meta, create('p', 'daily-life-mistake-prompt', mistake.prompt), answers, evidence, explanation);
        list.append(card);
      });
      review.append(list);
    }
    el.area.replaceChildren(result, review);
    el.feedback.hidden = true;
    el.check.hidden = true;
    el.next.hidden = true;
  };

  const validateDataset = (data) => {
    if (!Array.isArray(data) || !data.length) throw new Error('The selected reading dataset must be a non-empty array.');
    data.forEach((set, setIndex) => {
      const label = set?.id || `set ${setIndex + 1}`;
      const required = ['id', 'examKey', 'exam', 'section', 'taskType', 'interfaceType', 'difficulty', 'title', 'passage', 'questions', 'status'];
      const missing = required.filter((field) => set?.[field] === undefined || set?.[field] === null || set?.[field] === '');
      if (missing.length) throw new Error(`${label} is missing ${missing.join(', ')}.`);
      if (set.status !== 'active' || set.examKey !== 'toefl-ibt' || set.section !== 'reading') throw new Error(`${label} has invalid routing metadata.`);
      if (set.taskType !== config.taskType || set.interfaceType !== config.interfaceType) throw new Error(`${label} does not match ${mode} mode.`);
      if (mode === 'academic' && (!set.discipline || typeof set.discipline !== 'string')) throw new Error(`${label} must include an academic discipline.`);
      if (!Array.isArray(set.questions) || set.questions.length !== config.questionCount) throw new Error(`${label} must include exactly ${config.questionCount} questions.`);
      const ids = new Set();
      set.questions.forEach((question, questionIndex) => {
        const questionRequired = ['id', 'number', 'prompt', 'options', 'answer', 'evidence', 'explanation'];
        const missingQuestion = questionRequired.filter((field) => question?.[field] === undefined || question?.[field] === null || question?.[field] === '');
        if (missingQuestion.length) throw new Error(`${label}, question ${questionIndex + 1} is missing ${missingQuestion.join(', ')}.`);
        if (ids.has(question.id)) throw new Error(`${label} repeats question id ${question.id}.`);
        ids.add(question.id);
        if (question.number !== questionIndex + 1 || !Array.isArray(question.options) || question.options.length !== 4) throw new Error(`${label}, question ${question.id} has invalid numbering or options.`);
        const optionIds = new Set(question.options.map((option) => option.id));
        if (optionIds.size !== 4 || !question.options.every((option) => option.id && option.text) || !optionIds.has(question.answer)) throw new Error(`${label}, question ${question.id} has invalid answer options.`);
      });
    });
    return data;
  };

  const showError = (error) => {
    el.sessionTitle.textContent = 'Practice data unavailable';
    el.examName.textContent = 'Please retry';
    el.setCounter.textContent = 'Not loaded';
    el.scoreCount.textContent = '0 / 0';
    const box = create('div', 'practice-load-error');
    box.append(create('span', 'practice-load-error-icon', '!'), create('h3', null, 'We could not load the reading sets.'), create('p', null, error?.message || 'Please check the dataset and try again.'));
    const retry = create('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', loadDataset);
    box.append(retry);
    el.area.replaceChildren(box);
    el.check.hidden = true;
    el.next.hidden = true;
  };

  async function loadDataset() {
    el.restart.disabled = true;
    try {
      const response = await fetch(DATA_PATHS[mode], { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${DATA_PATHS[mode]} (${response.status}).`);
      state.data = validateDataset(await response.json());
      resetSession();
      el.restart.disabled = false;
    } catch (error) {
      console.error('Exam Verse TOEFL Reading dataset validation failed:', error);
      showError(error);
    }
  }

  const nextSet = () => {
    if (!state.locked) return;
    if (state.currentSetIndex === state.data.length - 1) return showResults();
    state.currentSetIndex += 1;
    renderSet();
    el.area.focus();
  };
  function resetSession() {
    state.currentSetIndex = 0;
    state.selectedAnswers = {};
    state.locked = false;
    state.sessionScore = 0;
    state.wrongAnswers = [];
    renderSet();
  }

  el.check.addEventListener('click', checkAnswers);
  el.next.addEventListener('click', nextSet);
  el.restart.addEventListener('click', resetSession);
  configurePage();
  loadDataset();
})();
