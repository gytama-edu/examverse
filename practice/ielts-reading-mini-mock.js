(() => {
  'use strict';

  const DATA_PATHS = {
    academic: '../data/ielts-academic/reading/mini-mock.json',
    general: '../data/ielts-general/reading/mini-mock.json'
  };

  const EXAM_CONFIG = {
    academic: {
      name: 'IELTS Academic',
      modeName: 'Academic',
      title: 'Academic Reading Mini Mock',
      hub: '../pages/ielts-academic.html',
      hubLabel: 'Back to IELTS Academic Hub',
      prefix: 'ielts-ac-mini-'
    },
    general: {
      name: 'IELTS General Training',
      modeName: 'General Training',
      title: 'General Training Reading Mini Mock',
      hub: '../pages/ielts-general.html',
      hubLabel: 'Back to IELTS General Hub',
      prefix: 'ielts-gt-mini-'
    }
  };

  const TYPE_LABELS = {
    tfng: 'True / False / Not Given',
    ynng: 'Yes / No / Not Given',
    'multiple-choice': 'Multiple Choice',
    completion: 'Completion',
    'short-answer': 'Short Answer'
  };

  const SELECT_CHOICES = {
    tfng: ['True', 'False', 'Not Given'],
    ynng: ['Yes', 'No', 'Not Given']
  };

  const requestedExam = new URLSearchParams(window.location.search).get('exam');
  const initialExam = Object.prototype.hasOwnProperty.call(EXAM_CONFIG, requestedExam) ? requestedExam : 'academic';

  const state = {
    datasets: {},
    exam: initialExam,
    selectedAnswers: {},
    score: 0,
    answered: false,
    reviewShown: false,
    loadVersion: 0,
    wrongAnswers: []
  };

  const el = {
    examCards: [...document.querySelectorAll('[data-exam]')],
    sessionTitle: document.querySelector('#mini-session-title'),
    examName: document.querySelector('#mini-exam-name'),
    counter: document.querySelector('#mini-counter'),
    score: document.querySelector('#mini-score'),
    progress: document.querySelector('#mini-progress'),
    progressBar: document.querySelector('#mini-progress-bar'),
    area: document.querySelector('#mini-question-area'),
    feedback: document.querySelector('#mini-feedback'),
    check: document.querySelector('#mini-check'),
    restart: document.querySelector('#mini-restart'),
    hub: document.querySelector('#mini-hub-link'),
    hubLabel: document.querySelector('#mini-hub-label')
  };

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const currentMock = () => state.datasets[state.exam]?.[0];
  const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

  const setProgress = (value) => {
    const safe = Math.max(0, Math.min(100, Math.round(value)));
    el.progressBar.style.width = `${safe}%`;
    el.progress.setAttribute('aria-valuenow', String(safe));
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

  const isTyped = (question) => question.type === 'completion' || question.type === 'short-answer';
  const questionTypeLabel = (question) => TYPE_LABELS[question.type] || 'Question';

  const allAnswered = () => {
    const mock = currentMock();
    return Boolean(mock && mock.questions.every((question) => {
      const value = state.selectedAnswers[question.id];
      if (isTyped(question)) return normalize(value);
      return Boolean(value);
    }));
  };

  const updateCheckState = () => {
    el.check.disabled = state.answered || !allAnswered();
  };

  const selectChoice = (questionId, value, card) => {
    if (state.answered) return;
    state.selectedAnswers[questionId] = value;
    if (card) {
      card.querySelectorAll('button[data-choice]').forEach((btn) => {
        const selected = btn.dataset.choice === value;
        btn.classList.toggle('selected', selected);
        btn.setAttribute('aria-pressed', String(selected));
      });
    }
    updateCheckState();
  };

  const renderSelectionButtons = (question) => {
    const wrapper = make('div', question.type === 'multiple-choice' ? 'mc-option-grid' : 'tfng-answer-grid');
    const options = question.type === 'multiple-choice' ? question.options : SELECT_CHOICES[question.type];
    options.forEach((option, index) => {
      const btn = make('button', question.type === 'multiple-choice' ? 'mc-option-btn' : 'tfng-answer-btn');
      btn.type = 'button';
      btn.dataset.choice = option;
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => selectChoice(question.id, option, wrapper.closest('[data-question-id]')));
      if (question.type === 'multiple-choice') {
        const key = make('span', 'mc-option-key', String.fromCharCode(65 + index));
        const text = make('span', 'mc-option-text', option);
        btn.append(key, text);
      } else {
        const code = option === 'Not Given' ? 'NG' : option.charAt(0);
        btn.append(make('span', null, code), make('strong', null, option));
      }
      wrapper.append(btn);
    });
    return wrapper;
  };

  const renderTyped = (question) => {
    const block = make('div', 'completion-blank-list');
    const row = make('div', 'completion-blank-row');
    const heading = make('div', 'completion-blank-heading');
    heading.append(make('span', 'completion-blank-number', String(question.number)), make('p', 'completion-prompt', question.question));
    const field = make('div', 'completion-field');
    const inputId = `mini-answer-${question.id}`;
    const label = make('label', null, `Answer for question ${question.number}`);
    label.htmlFor = inputId;
    const input = make('input', 'completion-input');
    input.id = inputId;
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'Type your answer';
    input.dataset.questionId = question.id;
    input.addEventListener('input', () => {
      state.selectedAnswers[question.id] = input.value;
      updateCheckState();
    });
    field.append(label, input);
    row.append(heading, field);
    block.append(row);
    return block;
  };

  const renderQuestion = (question) => {
    const card = make('article', 'completion-task-card mini-mock-question');
    card.dataset.questionId = question.id;
    const header = make('header', 'completion-task-header');
    const left = make('div');
    left.append(make('span', null, `Question ${question.number}`), make('h3', null, question.question));
    const typeBox = make('div', 'completion-limit-box');
    typeBox.append(make('span', null, 'Type'), make('strong', null, questionTypeLabel(question)));
    header.append(left, typeBox);
    card.append(header);

    const body = make('div', 'mini-mock-question-body');
    if (question.type === 'tfng' || question.type === 'ynng' || question.type === 'multiple-choice') {
      body.append(renderSelectionButtons(question));
    } else {
      body.append(renderTyped(question));
    }
    card.append(body);
    return card;
  };

  const renderMock = () => {
    const mock = currentMock();
    if (!mock) {
      showResultsError(new Error('Mock data unavailable.'));
      return;
    }

    state.selectedAnswers = {};
    state.answered = false;
    state.reviewShown = false;
    state.wrongAnswers = [];
    updateExamUi();
    el.counter.textContent = 'Mock 1 of 1';
    el.score.textContent = '0 / 0';
    setProgress(0);
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
    el.check.hidden = false;
    el.check.disabled = true;
    el.restart.disabled = false;

    const top = make('div', 'completion-content-top');
    top.append(
      make('span', 'completion-difficulty', mock.difficulty),
      make('span', 'completion-type', 'Mixed Mock'),
      make('span', 'completion-word-limit', '10 questions')
    );

    const passageCard = make('section', 'completion-passage-card');
    passageCard.setAttribute('aria-labelledby', 'mini-passage-title');
    passageCard.append(
      make('span', 'section-kicker', 'Reading passage'),
      make('h3', 'completion-passage-title', mock.passageTitle),
      make('p', 'completion-passage-text', mock.passage)
    );
    passageCard.querySelector('h3').id = 'mini-passage-title';

    const taskCard = make('section', 'completion-task-card');
    const taskHeader = make('header', 'completion-task-header');
    const taskLeft = make('div');
    taskLeft.append(make('span', null, mock.mockTitle), make('h3', null, 'Answer all ten questions'));
    const taskRight = make('div', 'completion-limit-box');
    taskRight.append(make('span', null, 'Question mix'), make('strong', null, '2 each'));
    taskHeader.append(taskLeft, taskRight);
    taskCard.append(taskHeader, make('p', 'completion-instructions', mock.instructions));

    const questionList = make('div', 'mini-mock-question-list');
    mock.questions.forEach((question) => questionList.append(renderQuestion(question)));
    taskCard.append(questionList);

    el.area.replaceChildren(top, passageCard, taskCard);
  };

  const questionIsCorrect = (question, selected) => {
    if (question.type === 'tfng' || question.type === 'ynng' || question.type === 'multiple-choice') {
      return normalize(selected) === normalize(question.answer);
    }
    const accepted = [question.answer, ...(question.answers || [])].map(normalize);
    return accepted.includes(normalize(selected));
  };

  const acceptedAnswerText = (question) => {
    if (isTyped(question)) return question.answers?.join(' / ') || question.answer;
    return question.answer;
  };

  const lockSelectionQuestion = (card, question, selected) => {
    const correct = questionIsCorrect(question, selected);
    card.classList.add(correct ? 'correct' : 'wrong');
    const buttons = [...card.querySelectorAll('button[data-choice]')];
    buttons.forEach((btn) => {
      btn.disabled = true;
      if (normalize(btn.dataset.choice) === normalize(question.answer)) btn.classList.add('correct');
      if (!correct && normalize(btn.dataset.choice) === normalize(selected)) btn.classList.add('wrong');
    });
  };

  const lockTypedQuestion = (card, question, selected) => {
    const correct = questionIsCorrect(question, selected);
    card.classList.add(correct ? 'correct' : 'wrong');
    const input = card.querySelector('input');
    input.readOnly = true;
    input.classList.add(correct ? 'correct' : 'wrong');
    input.setAttribute('aria-invalid', String(!correct));
  };

  const addFeedback = (card, question, selected, correct) => {
    const note = make('div', 'completion-answer-note');
    note.append(make('strong', null, correct ? 'Correct answer' : `Correct answer: ${acceptedAnswerText(question)}`));
    const evidence = make('div', 'completion-evidence');
    evidence.append(make('span', null, 'Evidence'), make('p', null, question.evidence));
    const explanation = make('div', 'completion-explanation');
    explanation.append(make('span', null, 'Why it works'), make('p', null, question.explanation));
    card.append(note, evidence, explanation);
  };

  const checkAnswers = () => {
    if (state.answered || el.check.disabled) return;
    const mock = currentMock();
    state.answered = true;
    let correctCount = 0;

    mock.questions.forEach((question) => {
      const card = el.area.querySelector(`[data-question-id="${CSS.escape(question.id)}"]`);
      const selected = state.selectedAnswers[question.id];
      const correct = questionIsCorrect(question, selected);
      if (correct) correctCount += 1;
      else {
        state.wrongAnswers.push({
          number: question.number,
          type: question.type,
          question: question.question,
          studentAnswer: String(selected ?? '').trim(),
          correctAnswer: acceptedAnswerText(question),
          evidence: question.evidence,
          explanation: question.explanation
        });
      }

      if (question.type === 'tfng' || question.type === 'ynng' || question.type === 'multiple-choice') {
        lockSelectionQuestion(card, question, selected);
      } else {
        lockTypedQuestion(card, question, selected);
      }
      addFeedback(card, question, selected, correct);
    });

    state.score = correctCount;
    el.score.textContent = `${state.score} / 10`;
    setProgress(100);
    el.feedback.replaceChildren(
      make('strong', null, `${state.score} of 10 questions correct.`),
      make('span', null, 'Review the evidence and explanations below before restarting.')
    );
    el.feedback.hidden = false;
    el.check.hidden = true;
    el.restart.focus();
    renderReview(mock);
  };

  const reviewMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent work. You kept pace across all the different IELTS question types.';
    if (percentage >= 70) return 'Strong performance. Review the handful of items where wording or choice selection was close.';
    if (percentage >= 50) return 'A useful start. Revisit the evidence carefully and watch the exact wording of each question.';
    return 'Keep practising one question type at a time before returning to the mixed mini mock.';
  };

  const reviewStat = (label, value, className = '') => {
    const item = make('div', `completion-review-stat ${className}`.trim());
    item.append(make('span', null, label), make('strong', null, String(value)));
    return item;
  };

  const renderReview = (mock) => {
    if (state.reviewShown) return;
    state.reviewShown = true;
    const total = mock.questions.length;
    const percentage = Math.round((state.score / total) * 100);

    const review = make('section', 'completion-review mini-mock-review');
    review.setAttribute('aria-label', 'Mini mock review');
    review.append(make('h4', null, 'Session Review'));
    const grid = make('div', 'completion-review-grid');
    grid.append(
      reviewStat('Total questions', total),
      reviewStat('Correct answers', state.score, 'correct'),
      reviewStat('Wrong answers', state.wrongAnswers.length, 'wrong'),
      reviewStat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(grid, make('p', 'completion-review-message', reviewMessage(percentage)));

    if (state.wrongAnswers.length) {
      const list = make('div', 'completion-mistake-list');
      list.append(make('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach((item) => {
        const card = make('article', 'completion-mistake-card');
        const meta = make('div', 'completion-mistake-meta');
        meta.append(make('span', null, `Q${item.number} - ${TYPE_LABELS[item.type]}`), make('span', null, mock.passageTitle));
        const text = make('p', 'diagram-mistake-label', item.question);
        const answers = make('div', 'completion-mistake-answers');
        const student = make('div');
        student.append(make('span', null, 'Your answer'), make('strong', 'wrong', item.studentAnswer || 'No answer'));
        const correct = make('div');
        correct.append(make('span', null, 'Correct answer'), make('strong', 'correct', item.correctAnswer));
        answers.append(student, correct);
        card.append(meta, text, answers, make('p', 'completion-mistake-evidence', `Evidence: ${item.evidence}`), make('p', 'completion-mistake-explanation', item.explanation));
        list.append(card);
      });
      review.append(list);
    }

    el.area.append(review);
  };

  const showLoading = () => {
    updateExamUi();
    el.restart.disabled = true;
    el.counter.textContent = 'Loading mock';
    el.score.textContent = '0 / 0';
    setProgress(0);
    const loading = make('div', 'practice-loading');
    const spinner = make('span', 'practice-loader');
    spinner.setAttribute('aria-hidden', 'true');
    loading.append(spinner, make('p', null, `Loading ${EXAM_CONFIG[state.exam].modeName} mini mock...`));
    el.area.replaceChildren(loading);
    el.feedback.hidden = true;
    el.check.hidden = true;
  };

  const showResultsError = (error) => {
    el.restart.disabled = true;
    el.sessionTitle.textContent = 'Practice data unavailable';
    el.examName.textContent = 'Please retry';
    el.counter.textContent = 'Not loaded';
    el.score.textContent = '0 / 0';
    setProgress(0);
    const box = make('div', 'practice-load-error');
    box.append(
      make('span', 'practice-load-error-icon', '!'),
      make('h3', null, 'We could not load the mini mock.'),
      make('p', null, error?.message || 'Please check the selected dataset and try again.')
    );
    const retry = make('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', () => loadExam(state.exam));
    box.append(retry);
    el.area.replaceChildren(box);
    el.feedback.hidden = true;
    el.check.hidden = true;
  };

  const validateDataset = (exam, data) => {
    const path = DATA_PATHS[exam].replace('../', '');
    const config = EXAM_CONFIG[exam];
    if (!Array.isArray(data)) throw new Error(`Invalid dataset: ${path} must contain an array.`);
    if (data.length !== 1) throw new Error(`Invalid dataset: ${path} must contain exactly one mini mock.`);

    const mock = data[0];
    if (mock?.status !== 'active') throw new Error(`Invalid dataset: ${mock?.id || 'mock'} must have status active.`);
    if (mock?.examKey !== exam || mock?.interfaceType !== 'ielts-reading-mini-mock') {
      throw new Error(`Dataset mismatch: ${config.modeName} mini mock received different data. Please check ${path}.`);
    }

    const requiredFields = ['id', 'examKey', 'exam', 'section', 'interfaceType', 'difficulty', 'mockTitle', 'passageTitle', 'passage', 'instructions', 'questions', 'status'];
    const missing = requiredFields.filter((field) => mock?.[field] === undefined || mock?.[field] === null || mock?.[field] === '');
    if (missing.length) throw new Error(`Invalid dataset: ${mock.id} is missing ${missing.join(', ')}.`);
    if (!mock.id.startsWith(config.prefix)) throw new Error(`Invalid dataset: ${mock.id} has the wrong id prefix.`);
    if (!Array.isArray(mock.questions)) throw new Error(`Invalid dataset: ${mock.id} questions must be an array.`);
    if (mock.questions.length !== 10) throw new Error(`Invalid dataset: ${mock.id} must contain exactly 10 questions.`);

    const ids = new Set();
    mock.questions.forEach((question, index) => {
      const label = `question ${index + 1}`;
      const requiredQuestionFields = ['id', 'number', 'type', 'question', 'answer', 'evidence', 'explanation'];
      const missingQuestionFields = requiredQuestionFields.filter((field) => question?.[field] === undefined || question?.[field] === null || question?.[field] === '');
      if (missingQuestionFields.length) throw new Error(`Invalid dataset: ${label} is missing ${missingQuestionFields.join(', ')}.`);
      if (ids.has(question.id)) throw new Error(`Invalid dataset: ${mock.id} repeats question id ${question.id}.`);
      ids.add(question.id);
      if (question.number !== index + 1) throw new Error(`Invalid dataset: ${label} has an unexpected number.`);
      if (!['tfng', 'ynng', 'multiple-choice', 'completion', 'short-answer'].includes(question.type)) {
        throw new Error(`Invalid dataset: ${label} has an unsupported type ${question.type}.`);
      }
      if (question.type === 'multiple-choice') {
        if (!Array.isArray(question.options) || question.options.length < 3) throw new Error(`Invalid dataset: ${label} must include an options array.`);
      }
      if (isTyped(question)) {
        if (!Array.isArray(question.answers) || !question.answers.length) throw new Error(`Invalid dataset: ${label} must include an answers array.`);
      }
      const accepted = isTyped(question) ? question.answers : [question.answer];
      accepted.forEach((value) => {
        if (!normalize(value)) throw new Error(`Invalid dataset: ${label} has an empty accepted answer.`);
      });
    });

    return data;
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
      renderMock();
    } catch (error) {
      if (requestVersion !== state.loadVersion || state.exam !== exam) return;
      console.error('Exam Verse IELTS Reading Mini Mock dataset validation failed:', error);
      showResultsError(error);
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
      renderMock();
    } else {
      loadExam(exam);
    }
  };

  const resetSession = () => {
    state.selectedAnswers = {};
    state.score = 0;
    state.answered = false;
    state.reviewShown = false;
    state.wrongAnswers = [];
    renderMock();
  };

  el.examCards.forEach((card) => {
    card.addEventListener('click', () => {
      switchExam(card.dataset.exam);
      document.querySelector('#practice-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  el.check.addEventListener('click', checkAnswers);
  el.restart.addEventListener('click', resetSession);

  updateExamUi();
  loadExam(state.exam);
})();
