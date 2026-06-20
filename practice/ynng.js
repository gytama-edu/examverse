(() => {
  'use strict';

  const DATA_PATHS = {
    academic: '../data/ielts-academic/reading/yes-no-not-given.json',
    general: '../data/ielts-general/reading/yes-no-not-given.json'
  };

  const EXAM_CONFIG = {
    academic: {
      name: 'IELTS Academic',
      mode: 'Academic',
      title: 'Academic Yes / No / Not Given',
      hub: '../pages/ielts-academic.html',
      hubLabel: 'Back to IELTS Academic Hub',
      prefix: 'ielts-ac-ynng-'
    },
    general: {
      name: 'IELTS General Training',
      mode: 'General Training',
      title: 'General Training Yes / No / Not Given',
      hub: '../pages/ielts-general.html',
      hubLabel: 'Back to IELTS General Hub',
      prefix: 'ielts-gt-ynng-'
    }
  };

  const ANSWERS = ['YES', 'NO', 'NOT GIVEN'];
  const requestedExam = new URLSearchParams(window.location.search).get('exam');
  const initialExam = Object.prototype.hasOwnProperty.call(EXAM_CONFIG, requestedExam) ? requestedExam : 'academic';

  const state = {
    datasets: {},
    exam: initialExam,
    currentSetIndex: 0,
    selectedAnswers: {},
    score: 0,
    totalAnswered: 0,
    answered: false,
    wrongAnswers: [],
    loadVersion: 0
  };

  const el = {
    examCards: [...document.querySelectorAll('[data-exam]')],
    sessionTitle: document.querySelector('#ynng-session-title'),
    examName: document.querySelector('#ynng-exam-name'),
    setCounter: document.querySelector('#ynng-set-counter'),
    scoreCount: document.querySelector('#ynng-score-count'),
    progress: document.querySelector('#ynng-progress'),
    progressBar: document.querySelector('#ynng-progress-bar'),
    area: document.querySelector('#ynng-question-area'),
    feedback: document.querySelector('#ynng-feedback'),
    check: document.querySelector('#ynng-check-answer'),
    next: document.querySelector('#ynng-next-set'),
    restart: document.querySelector('#ynng-restart'),
    hub: document.querySelector('#ynng-hub-link'),
    hubLabel: document.querySelector('#ynng-hub-label')
  };

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const sets = () => state.datasets[state.exam] || [];
  const currentSet = () => sets()[state.currentSetIndex];

  const setProgress = (value) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    el.progressBar.style.width = `${safeValue}%`;
    el.progress.setAttribute('aria-valuenow', String(safeValue));
  };

  const updateUrl = (exam) => {
    const url = new URL(window.location.href);
    url.searchParams.set('exam', exam);
    url.hash = 'practice-shell';
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const updateExamUi = () => {
    const config = EXAM_CONFIG[state.exam];
    el.examCards.forEach((card) => {
      const active = card.dataset.exam === state.exam;
      card.classList.toggle('active', active);
      card.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.primary-nav a[href="../pages/ielts-academic.html"], .primary-nav a[href="../pages/ielts-general.html"]').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === config.hub);
    });
    el.sessionTitle.textContent = config.title;
    el.examName.textContent = config.name;
    el.hub.href = config.hub;
    el.hubLabel.textContent = config.hubLabel;
  };

  const allAnswered = () => {
    const set = currentSet();
    return Boolean(set && set.statements.every((statement) => state.selectedAnswers[statement.id]));
  };

  const updateCheckButton = () => {
    el.check.disabled = state.answered || !allAnswered();
  };

  const selectAnswer = (statementId, answer) => {
    if (state.answered) return;
    state.selectedAnswers[statementId] = answer;
    const row = el.area.querySelector(`.ynng-statement-row[data-statement-id="${CSS.escape(statementId)}"]`);
    if (row) {
      row.querySelectorAll('.ynng-choice-btn').forEach((button) => {
        const selected = button.dataset.answer === answer;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    }
    updateCheckButton();
  };

  const choiceButton = (statement, answer, statementNumber) => {
    const button = make('button', 'ynng-choice-btn');
    button.type = 'button';
    button.dataset.answer = answer;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `Choose ${answer} for statement ${statementNumber}`);
    const code = answer === 'NOT GIVEN' ? 'NG' : answer.charAt(0);
    button.append(make('span', null, code), make('strong', null, answer));
    button.addEventListener('click', () => selectAnswer(statement.id, answer));
    return button;
  };

  const renderPassage = (set) => {
    const card = make('section', 'ynng-passage-card');
    card.setAttribute('aria-label', `Reading passage: ${set.passageTitle}`);
    card.append(make('span', 'ynng-passage-label', 'Writer’s viewpoint passage'), make('h3', 'ynng-passage-title', set.passageTitle));
    const passageText = make('div', 'ynng-passage-text');
    set.passage.split(/\n\n/).forEach((paragraph) => passageText.append(make('p', null, paragraph)));
    card.append(passageText);
    return card;
  };

  const renderStatement = (statement, index) => {
    const row = make('article', 'ynng-statement-row');
    row.dataset.statementId = statement.id;
    const prompt = make('div', 'ynng-statement-prompt');
    prompt.append(make('span', null, String(index + 1)), make('p', null, statement.text));
    const choices = make('div', 'ynng-choice-grid');
    choices.setAttribute('aria-label', `Answer choices for statement ${index + 1}`);
    ANSWERS.forEach((answer) => choices.append(choiceButton(statement, answer, index + 1)));
    row.append(prompt, choices);
    return row;
  };

  const renderSet = () => {
    const collection = sets();
    const set = currentSet();
    if (!set) {
      showResults();
      return;
    }

    state.selectedAnswers = {};
    state.answered = false;
    updateExamUi();
    el.setCounter.textContent = `Set ${state.currentSetIndex + 1} of ${collection.length}`;
    el.scoreCount.textContent = `${state.score} / ${state.totalAnswered}`;
    setProgress((state.currentSetIndex / collection.length) * 100);
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
    el.check.hidden = false;
    el.check.disabled = true;
    el.next.hidden = true;
    el.next.textContent = 'Next Set →';

    const top = make('div', 'ynng-content-top');
    top.append(make('span', 'ynng-difficulty', set.difficulty), make('span', 'ynng-question-type', 'Writer’s views'));
    const task = make('section', 'ynng-task-card');
    task.append(make('p', 'ynng-instructions', set.instructions));
    const statementList = make('div', 'ynng-statement-list');
    set.statements.forEach((statement, index) => statementList.append(renderStatement(statement, index)));
    task.append(statementList);
    el.area.replaceChildren(top, renderPassage(set), task);
  };

  const answerExplanation = (statement, selected, correct) => {
    const box = make('div', 'ynng-explanation');
    box.append(make('strong', null, correct ? `Correct: ${statement.answer}` : `Correct answer: ${statement.answer}`), make('p', null, statement.explanation));
    const evidence = make('div', 'ynng-evidence');
    evidence.append(make('span', null, 'Evidence'), make('p', null, statement.evidence));
    return [box, evidence];
  };

  const checkAnswers = () => {
    if (state.answered || !allAnswered()) return;
    const set = currentSet();
    let gained = 0;
    state.answered = true;

    set.statements.forEach((statement) => {
      const selected = state.selectedAnswers[statement.id];
      const correct = selected === statement.answer;
      if (correct) {
        state.score += 1;
        gained += 1;
      } else {
        state.wrongAnswers.push({
          setNumber: state.currentSetIndex + 1,
          passageTitle: set.passageTitle,
          statement: statement.text,
          selectedAnswer: selected,
          correctAnswer: statement.answer,
          evidence: statement.evidence,
          explanation: statement.explanation
        });
      }
      state.totalAnswered += 1;

      const row = el.area.querySelector(`.ynng-statement-row[data-statement-id="${CSS.escape(statement.id)}"]`);
      row.classList.add(correct ? 'correct' : 'wrong');
      row.querySelectorAll('.ynng-choice-btn').forEach((button) => {
        button.disabled = true;
        if (button.dataset.answer === statement.answer) button.classList.add('correct');
        if (!correct && button.dataset.answer === selected) button.classList.add('wrong');
      });
      row.append(...answerExplanation(statement, selected, correct));
    });

    el.scoreCount.textContent = `${state.score} / ${state.totalAnswered}`;
    setProgress(((state.currentSetIndex + 1) / sets().length) * 100);
    el.feedback.replaceChildren(
      make('strong', null, `${gained} of ${set.statements.length} statements correct.`),
      make('span', null, 'Review the writer’s exact position before continuing.')
    );
    el.feedback.hidden = false;
    el.check.hidden = true;
    el.next.hidden = false;
    el.next.textContent = state.currentSetIndex === sets().length - 1 ? 'View Results →' : 'Next Set →';
    el.next.focus();
  };

  const teacherMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent viewpoint control. You are distinguishing the writer’s position from surrounding detail with precision.';
    if (percentage >= 70) return 'Strong work. Revisit the few claims where contradiction and missing opinion felt close.';
    if (percentage >= 50) return 'A useful foundation. Anchor each choice in what the writer accepts, rejects, or leaves unaddressed.';
    return 'Keep practising the three-way decision. Find the writer’s stance before judging the statement.';
  };

  const stat = (label, value, className = '') => {
    const item = make('div', `ynng-review-stat ${className}`.trim());
    item.append(make('span', null, label), make('strong', null, String(value)));
    return item;
  };

  const mistakeCard = (mistake) => {
    const card = make('article', 'ynng-mistake-card');
    const meta = make('div', 'ynng-mistake-meta');
    meta.append(make('span', null, `Set ${mistake.setNumber}`), make('span', null, mistake.passageTitle));
    const answers = make('div', 'ynng-mistake-answers');
    const student = make('div');
    student.append(make('span', null, 'Your answer'), make('strong', 'wrong', mistake.selectedAnswer));
    const correct = make('div');
    correct.append(make('span', null, 'Correct answer'), make('strong', 'correct', mistake.correctAnswer));
    answers.append(student, correct);
    card.append(
      meta,
      make('p', 'ynng-mistake-statement', mistake.statement),
      answers,
      make('p', 'ynng-mistake-evidence', `Evidence: ${mistake.evidence}`),
      make('p', 'ynng-mistake-explanation', mistake.explanation)
    );
    return card;
  };

  function showResults() {
    const total = sets().reduce((sum, set) => sum + set.statements.length, 0);
    const percentage = total ? Math.round((state.score / total) * 100) : 0;
    el.setCounter.textContent = 'Session complete';
    el.scoreCount.textContent = `${state.score} / ${total}`;
    setProgress(100);

    const result = make('div', 'ynng-result');
    result.append(
      make('span', 'section-kicker', 'Writer’s views sets complete'),
      make('strong', 'ynng-result-score', `${state.score}/${total}`),
      make('h3', null, `${percentage}% correct`)
    );
    const review = make('section', 'ynng-review');
    review.setAttribute('aria-label', 'Practice session review');
    review.append(make('h4', null, 'Session Review'));
    const grid = make('div', 'ynng-review-grid');
    grid.append(
      stat('Total statements', total),
      stat('Correct answers', state.score, 'correct'),
      stat('Wrong answers', state.wrongAnswers.length, 'wrong'),
      stat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(grid, make('p', 'ynng-review-message', teacherMessage(percentage)));
    if (state.wrongAnswers.length) {
      const list = make('div', 'ynng-mistake-list');
      list.append(make('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach((mistake) => list.append(mistakeCard(mistake)));
      review.append(list);
    }
    el.area.replaceChildren(result, review);
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
    el.check.hidden = true;
    el.next.hidden = true;
    el.restart.focus();
  }

  const nextSet = () => {
    if (!state.answered) return;
    if (state.currentSetIndex >= sets().length - 1) {
      showResults();
      return;
    }
    state.currentSetIndex += 1;
    renderSet();
    el.area.focus();
  };

  const resetSession = () => {
    state.currentSetIndex = 0;
    state.selectedAnswers = {};
    state.score = 0;
    state.totalAnswered = 0;
    state.answered = false;
    state.wrongAnswers = [];
    renderSet();
  };

  const validateDataset = (exam, data) => {
    const path = DATA_PATHS[exam].replace('../', '');
    const config = EXAM_CONFIG[exam];
    if (!Array.isArray(data)) throw new Error(`Invalid dataset: ${path} must contain an array.`);
    if (!data.length) throw new Error(`Invalid dataset: ${path} is empty.`);

    const requiredFields = ['id', 'examKey', 'exam', 'section', 'questionType', 'interfaceType', 'difficulty', 'passageTitle', 'passage', 'instructions', 'statements', 'status'];
    data.forEach((set, index) => {
      const label = set?.id || `set ${index + 1}`;
      if (set?.status !== 'active') throw new Error(`Invalid dataset: ${label} must have status active.`);
      if (set?.examKey !== exam || set?.interfaceType !== 'ynng') {
        throw new Error(`Dataset mismatch: ${config.mode} YNNG mode received different data. Please check ${path}.`);
      }
      const missing = requiredFields.filter((field) => set?.[field] === undefined || set?.[field] === null || set?.[field] === '');
      if (missing.length) throw new Error(`Invalid dataset: ${label} is missing ${missing.join(', ')}.`);
      if (set.questionType !== 'Yes / No / Not Given') throw new Error(`Invalid dataset: ${label} has the wrong questionType.`);
      if (!set.id.startsWith(config.prefix)) throw new Error(`Invalid dataset: ${label} has the wrong id prefix.`);
      if (!Array.isArray(set.statements)) throw new Error(`Invalid dataset: ${label} statements must be an array.`);
      if (set.statements.length < 5 || set.statements.length > 7) throw new Error(`Invalid dataset: ${label} must contain 5 to 7 statements.`);

      const statementIds = new Set();
      set.statements.forEach((statement, statementIndex) => {
        const statementLabel = `${label} statement ${statementIndex + 1}`;
        const statementFields = ['id', 'text', 'answer', 'evidence', 'explanation'];
        const missingStatementFields = statementFields.filter((field) => statement?.[field] === undefined || statement?.[field] === null || statement?.[field] === '');
        if (missingStatementFields.length) throw new Error(`Invalid dataset: ${statementLabel} is missing ${missingStatementFields.join(', ')}.`);
        if (!ANSWERS.includes(statement.answer)) throw new Error(`Invalid dataset: ${statementLabel} has unsupported answer ${statement.answer}.`);
        if (statementIds.has(statement.id)) throw new Error(`Invalid dataset: ${label} repeats statement id ${statement.id}.`);
        statementIds.add(statement.id);
      });
    });
    return data;
  };

  const showLoading = () => {
    updateExamUi();
    el.restart.disabled = true;
    el.setCounter.textContent = 'Loading sets';
    el.scoreCount.textContent = '0 / 0';
    setProgress(0);
    const loading = make('div', 'practice-loading');
    const spinner = make('span', 'practice-loader');
    spinner.setAttribute('aria-hidden', 'true');
    loading.append(spinner, make('p', null, `Loading ${EXAM_CONFIG[state.exam].mode} writer’s-view sets…`));
    el.area.replaceChildren(loading);
    el.feedback.hidden = true;
    el.check.hidden = true;
    el.next.hidden = true;
  };

  const showLoadingError = (exam, error) => {
    if (state.exam !== exam) return;
    updateExamUi();
    el.restart.disabled = true;
    el.sessionTitle.textContent = 'Practice data unavailable';
    el.examName.textContent = 'Please retry';
    el.setCounter.textContent = 'Not loaded';
    el.scoreCount.textContent = '0 / 0';
    setProgress(0);
    const box = make('div', 'practice-load-error');
    box.append(
      make('span', 'practice-load-error-icon', '!'),
      make('h3', null, 'We could not load the Yes / No / Not Given sets.'),
      make('p', null, error?.message || 'Please check the selected dataset and try again.')
    );
    const retry = make('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', () => loadExam(exam));
    box.append(retry);
    el.area.replaceChildren(box);
    el.feedback.hidden = true;
    el.check.hidden = true;
    el.next.hidden = true;
  };

  async function loadExam(exam) {
    const requestVersion = ++state.loadVersion;
    showLoading();
    try {
      const response = await fetch(DATA_PATHS[exam], { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${DATA_PATHS[exam]} (${response.status}).`);
      const data = validateDataset(exam, await response.json());
      if (requestVersion !== state.loadVersion || state.exam !== exam) return;
      state.datasets[exam] = data;
      el.restart.disabled = false;
      resetSession();
    } catch (error) {
      if (requestVersion !== state.loadVersion || state.exam !== exam) return;
      console.error('Exam Verse YNNG loading or validation error:', error);
      showLoadingError(exam, error);
    }
  }

  const switchExam = (exam) => {
    if (!EXAM_CONFIG[exam] || exam === state.exam) return;
    state.exam = exam;
    updateUrl(exam);
    updateExamUi();
    if (state.datasets[exam]) {
      state.loadVersion += 1;
      el.restart.disabled = false;
      resetSession();
    } else {
      loadExam(exam);
    }
  };

  el.examCards.forEach((card) => {
    card.addEventListener('click', () => {
      switchExam(card.dataset.exam);
      document.querySelector('#practice-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  el.check.addEventListener('click', checkAnswers);
  el.next.addEventListener('click', nextSet);
  el.restart.addEventListener('click', resetSession);

  updateExamUi();
  loadExam(state.exam);
})();
