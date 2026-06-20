(() => {
  'use strict';

  const DATA_PATHS = {
    academic: '../data/ielts-academic/reading/short-answer.json',
    general: '../data/ielts-general/reading/short-answer.json'
  };

  const EXAM_CONFIG = {
    academic: {
      name: 'IELTS Academic',
      modeName: 'Academic',
      title: 'Academic Reading Short Answer Questions',
      hub: '../pages/ielts-academic.html',
      hubLabel: 'Back to IELTS Academic Hub',
      prefix: 'ielts-ac-sa-'
    },
    general: {
      name: 'IELTS General Training',
      modeName: 'General Training',
      title: 'General Training Reading Short Answer Questions',
      hub: '../pages/ielts-general.html',
      hubLabel: 'Back to IELTS General Hub',
      prefix: 'ielts-gt-sa-'
    }
  };

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
    sessionTitle: document.querySelector('#sa-session-title'),
    examName: document.querySelector('#sa-exam-name'),
    setCounter: document.querySelector('#sa-set-counter'),
    scoreCount: document.querySelector('#sa-score-count'),
    progress: document.querySelector('#sa-progress'),
    progressBar: document.querySelector('#sa-progress-bar'),
    area: document.querySelector('#sa-question-area'),
    feedback: document.querySelector('#sa-feedback'),
    check: document.querySelector('#sa-check-answer'),
    next: document.querySelector('#sa-next-set'),
    restart: document.querySelector('#sa-restart'),
    hub: document.querySelector('#sa-hub-link'),
    hubLabel: document.querySelector('#sa-hub-label')
  };

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const sets = () => state.datasets[state.exam] || [];
  const currentSet = () => sets()[state.currentSetIndex];
  const normalizeAnswer = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

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
    el.sessionTitle.textContent = config.title;
    el.examName.textContent = config.name;
    el.hub.href = config.hub;
    el.hubLabel.textContent = config.hubLabel;
  };

  const allAnswered = () => {
    const set = currentSet();
    return Boolean(set && set.questions.every((question) => normalizeAnswer(state.selectedAnswers[question.id])));
  };

  const updateCheckButton = () => {
    el.check.disabled = state.answered || !allAnswered();
  };

  const questionRow = (question, index) => {
    const row = make('section', 'completion-blank-row');
    row.dataset.question = question.id;

    const heading = make('div', 'completion-blank-heading');
    heading.append(make('span', 'completion-blank-number', String(index + 1)), make('p', 'completion-prompt', question.question));

    const inputId = `short-answer-${state.currentSetIndex + 1}-${question.id}`;
    const field = make('div', 'completion-field');
    const label = make('label', null, `Answer for question ${index + 1}`);
    label.htmlFor = inputId;
    const input = make('input', 'completion-input');
    input.id = inputId;
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.question = question.id;
    input.placeholder = 'Type your answer';
    input.addEventListener('input', () => {
      state.selectedAnswers[question.id] = input.value;
      updateCheckButton();
    });
    field.append(label, input);
    row.append(heading, field);
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

    const top = make('div', 'completion-content-top');
    top.append(
      make('span', 'completion-difficulty', set.difficulty),
      make('span', 'completion-type', 'Short answer'),
      make('span', 'completion-word-limit', set.wordLimit)
    );

    const passage = make('section', 'completion-passage-card');
    passage.setAttribute('aria-labelledby', 'current-short-answer-passage');
    passage.append(
      make('span', 'section-kicker', 'Reading passage'),
      make('h3', 'completion-passage-title', set.passageTitle),
      make('p', 'completion-passage-text', set.passage)
    );
    passage.querySelector('h3').id = 'current-short-answer-passage';

    const task = make('section', 'completion-task-card');
    const taskHeader = make('header', 'completion-task-header');
    const taskCopy = make('div');
    taskCopy.append(make('span', null, 'Short answer'), make('h3', null, 'Answer the questions below'));
    const limit = make('div', 'completion-limit-box');
    limit.append(make('span', null, 'Word limit'), make('strong', null, set.wordLimit));
    taskHeader.append(taskCopy, limit);
    task.append(taskHeader, make('p', 'completion-instructions', set.instructions));

    const questions = make('div', 'completion-blank-list');
    set.questions.forEach((question, index) => questions.append(questionRow(question, index)));
    task.append(questions);
    el.area.replaceChildren(top, passage, task);
  };

  const correctAnswerText = (question) => question.answers.join(' / ');

  const checkAnswers = () => {
    if (state.answered || el.check.disabled) return;
    const set = currentSet();
    let setScore = 0;
    state.answered = true;

    set.questions.forEach((question, index) => {
      const selectedAnswer = String(state.selectedAnswers[question.id] ?? '').trim();
      const acceptedAnswers = question.answers.map(normalizeAnswer);
      const normalizedSelected = normalizeAnswer(selectedAnswer);
      const correct = acceptedAnswers.includes(normalizedSelected);
      if (correct) {
        state.score += 1;
        setScore += 1;
      } else {
        state.wrongAnswers.push({
          setNumber: state.currentSetIndex + 1,
          questionNumber: index + 1,
          passageTitle: set.passageTitle,
          question: question.question,
          studentAnswer: selectedAnswer,
          correctAnswer: correctAnswerText(question),
          evidence: question.evidence,
          explanation: question.explanation
        });
      }
      state.totalAnswered += 1;

      const row = el.area.querySelector(`.completion-blank-row[data-question="${CSS.escape(question.id)}"]`);
      const input = row.querySelector('.completion-input');
      row.classList.add(correct ? 'correct' : 'wrong');
      input.classList.add(correct ? 'correct' : 'wrong');
      input.readOnly = true;
      input.setAttribute('aria-invalid', String(!correct));

      const note = make('div', 'completion-answer-note');
      note.append(make('strong', null, correct ? 'Correct answer' : `Correct answer: ${correctAnswerText(question)}`));
      const evidence = make('div', 'completion-evidence');
      evidence.append(make('span', null, 'Evidence'), make('p', null, question.evidence));
      const explanation = make('div', 'completion-explanation');
      explanation.append(make('span', null, 'Why it works'), make('p', null, question.explanation));
      row.append(note, evidence, explanation);
    });

    el.scoreCount.textContent = `${state.score} / ${state.totalAnswered}`;
    setProgress(((state.currentSetIndex + 1) / sets().length) * 100);
    el.feedback.replaceChildren(
      make('strong', null, `${setScore} of ${set.questions.length} answers correct.`),
      make('span', null, 'Review the exact wording, spelling, and evidence before continuing.')
    );
    el.feedback.hidden = false;
    el.check.hidden = true;
    el.next.hidden = false;
    el.next.textContent = state.currentSetIndex === sets().length - 1 ? 'View Results →' : 'Next Set →';
    el.next.focus();
  };

  const teacherMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent precision. You are finding short answers quickly and controlling spelling very well.';
    if (percentage >= 70) return 'Strong work. Review the few answers where wording or small spelling slips caused trouble.';
    if (percentage >= 50) return 'A useful start. Return to the evidence sentence and compare each word before you type.';
    return 'Keep building the method. Find the matching phrase first, then type it exactly as the passage gives it.';
  };

  const stat = (label, value, className = '') => {
    const item = make('div', `completion-review-stat ${className}`.trim());
    item.append(make('span', null, label), make('strong', null, String(value)));
    return item;
  };

  const mistakeCard = (mistake) => {
    const card = make('article', 'completion-mistake-card');
    const meta = make('div', 'completion-mistake-meta');
    meta.append(make('span', null, `Set ${mistake.setNumber} · Question ${mistake.questionNumber}`), make('span', null, mistake.passageTitle));
    const question = make('p', 'completion-prompt');
    question.textContent = mistake.question;
    const answers = make('div', 'completion-mistake-answers');
    const student = make('div');
    student.append(make('span', null, 'Your answer'), make('strong', 'wrong', mistake.studentAnswer || 'No answer'));
    const correct = make('div');
    correct.append(make('span', null, 'Correct answer'), make('strong', 'correct', mistake.correctAnswer));
    answers.append(student, correct);
    const evidence = make('p', 'completion-mistake-evidence');
    evidence.append(make('strong', null, 'Evidence: '), document.createTextNode(mistake.evidence));
    const explanation = make('p', 'completion-mistake-explanation');
    explanation.append(make('strong', null, 'Explanation: '), document.createTextNode(mistake.explanation));
    card.append(meta, question, answers, evidence, explanation);
    return card;
  };

  const showResults = () => {
    const total = sets().reduce((sum, set) => sum + set.questions.length, 0);
    const percentage = total ? Math.round((state.score / total) * 100) : 0;
    el.setCounter.textContent = 'Session complete';
    el.scoreCount.textContent = `${state.score} / ${total}`;
    setProgress(100);

    const result = make('div', 'completion-result');
    result.append(
      make('span', 'section-kicker', 'Short answer sets complete'),
      make('strong', 'completion-result-score', `${state.score}/${total}`),
      make('h3', null, `${percentage}% correct`),
      make('small', null, 'Restart to practise the same passages and questions again.')
    );

    const review = make('section', 'completion-review');
    review.setAttribute('aria-label', 'Practice session review');
    review.append(make('h4', null, 'Session Review'));
    const grid = make('div', 'completion-review-grid');
    grid.append(
      stat('Total questions', total),
      stat('Correct answers', state.score, 'correct'),
      stat('Wrong answers', state.wrongAnswers.length, 'wrong'),
      stat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(grid, make('p', 'completion-review-message', teacherMessage(percentage)));
    if (state.wrongAnswers.length) {
      const list = make('div', 'completion-mistake-list');
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
  };

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

    const requiredFields = ['id', 'examKey', 'exam', 'section', 'questionType', 'interfaceType', 'difficulty', 'passageTitle', 'passage', 'instructions', 'wordLimit', 'questions', 'status'];
    data.forEach((set, index) => {
      const label = set?.id || `set ${index + 1}`;
      if (set?.status !== 'active') throw new Error(`Invalid dataset: ${label} must have status active.`);
      if (set?.examKey !== exam || set?.interfaceType !== 'short-answer') {
        throw new Error(`Dataset mismatch: ${config.modeName} short-answer mode received different data. Please check ${path}.`);
      }
      const missing = requiredFields.filter((field) => set?.[field] === undefined || set?.[field] === null || set?.[field] === '');
      if (missing.length) throw new Error(`Invalid dataset: ${label} is missing ${missing.join(', ')}.`);
      if (set.questionType !== 'Short Answer Questions') throw new Error(`Invalid dataset: ${label} has the wrong questionType.`);
      if (!set.id.startsWith(config.prefix)) throw new Error(`Invalid dataset: ${label} has the wrong id prefix.`);
      if (!Array.isArray(set.questions)) throw new Error(`Invalid dataset: ${label} questions must be an array.`);
      if (set.questions.length !== 4) throw new Error(`Invalid dataset: ${label} must contain exactly 4 questions.`);

      const questionIds = new Set();
      set.questions.forEach((question, questionIndex) => {
        const questionLabel = `${label} question ${questionIndex + 1}`;
        const questionFields = ['id', 'question', 'answers', 'evidence', 'explanation'];
        const missingQuestionFields = questionFields.filter((field) => question?.[field] === undefined || question?.[field] === null || question?.[field] === '');
        if (missingQuestionFields.length) throw new Error(`Invalid dataset: ${questionLabel} is missing ${missingQuestionFields.join(', ')}.`);
        if (questionIds.has(question.id)) throw new Error(`Invalid dataset: ${label} repeats question id ${question.id}.`);
        questionIds.add(question.id);
        if (!Array.isArray(question.answers) || !question.answers.length || question.answers.some((answer) => !normalizeAnswer(answer))) {
          throw new Error(`Invalid dataset: ${questionLabel} must include at least one accepted answer.`);
        }
        if (question.answers.some((answer) => normalizeAnswer(answer).split(/\s+/).filter(Boolean).length > 3)) {
          throw new Error(`Invalid dataset: ${questionLabel} has an accepted answer that exceeds the three-word limit.`);
        }
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
    loading.append(spinner, make('p', null, `Loading ${EXAM_CONFIG[state.exam].modeName} short-answer sets…`));
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
      make('h3', null, 'We could not load the short-answer sets.'),
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
      console.error('Exam Verse IELTS Short Answer dataset validation failed:', error);
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
