(() => {
  'use strict';

  const DATA_PATHS = {
    academic: '../data/ielts-academic/reading/multiple-choice.json',
    general: '../data/ielts-general/reading/multiple-choice.json'
  };

  const EXAM_CONFIG = {
    academic: {
      name: 'IELTS Academic',
      modeName: 'Academic',
      title: 'Academic Reading Multiple Choice',
      hub: '../pages/ielts-academic.html',
      hubLabel: 'Back to IELTS Academic Hub'
    },
    general: {
      name: 'IELTS General Training',
      modeName: 'General Training',
      title: 'General Training Reading Multiple Choice',
      hub: '../pages/ielts-general.html',
      hubLabel: 'Back to IELTS General Hub'
    }
  };

  const requestedExam = new URLSearchParams(window.location.search).get('exam');
  const initialExam = Object.prototype.hasOwnProperty.call(EXAM_CONFIG, requestedExam) ? requestedExam : 'academic';

  const state = {
    datasets: {},
    exam: initialExam,
    currentIndex: 0,
    selectedAnswer: [],
    score: 0,
    answered: false,
    loaded: false,
    wrongAnswers: []
  };

  const elements = {
    examCards: [...document.querySelectorAll('[data-exam]')],
    sessionTitle: document.querySelector('#mc-session-title'),
    examName: document.querySelector('#mc-exam-name'),
    questionCounter: document.querySelector('#mc-question-counter'),
    scoreCount: document.querySelector('#mc-score-count'),
    progress: document.querySelector('#mc-progress'),
    progressBar: document.querySelector('#mc-progress-bar'),
    content: document.querySelector('#mc-question-area'),
    feedback: document.querySelector('#mc-feedback'),
    check: document.querySelector('#mc-check-answer'),
    next: document.querySelector('#mc-next-question'),
    restart: document.querySelector('#mc-restart'),
    hubLink: document.querySelector('#mc-hub-link'),
    hubLabel: document.querySelector('#mc-hub-label')
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const currentQuestions = () => state.datasets[state.exam] || [];
  const currentQuestion = () => currentQuestions()[state.currentIndex];
  const normalizedKeys = keys => [...keys].map(String).sort();
  const answersMatch = (selected, answer) => normalizedKeys(selected).join('|') === normalizedKeys(answer).join('|');
  const selectionWord = count => ({ 2: 'TWO', 3: 'THREE' }[count] || String(count));

  const instructionFor = question => {
    if (question.selectionMode === 'single') {
      const keys = question.options.map(option => option.key);
      return `Choose the correct letter, ${keys.slice(0, -1).join(', ')}, or ${keys.at(-1)}.`;
    }
    return `Choose ${selectionWord(question.requiredSelections)} answers.`;
  };

  const setProgress = value => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    elements.progressBar.style.width = `${safeValue}%`;
    elements.progress.setAttribute('aria-valuenow', String(safeValue));
  };

  const updateUrl = exam => {
    const url = new URL(window.location.href);
    url.searchParams.set('exam', exam);
    url.hash = 'practice-shell';
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const updateExamUi = () => {
    const config = EXAM_CONFIG[state.exam];
    elements.examCards.forEach(card => {
      const active = card.dataset.exam === state.exam;
      card.classList.toggle('active', active);
      card.setAttribute('aria-pressed', String(active));
    });
    elements.sessionTitle.textContent = config.title;
    elements.examName.textContent = config.name;
    elements.hubLink.href = config.hub;
    elements.hubLabel.textContent = config.hubLabel;
  };

  const updateSelectionUi = (limitReached = false) => {
    const question = currentQuestion();
    if (!question) return;
    elements.content.querySelectorAll('.mc-option-btn').forEach(button => {
      const selected = state.selectedAnswer.includes(button.dataset.option);
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const selectionStatus = elements.content.querySelector('.mc-selection-count');
    if (selectionStatus) {
      const countText = `Selected ${state.selectedAnswer.length} of ${question.requiredSelections}.`;
      selectionStatus.textContent = limitReached ? `Selection limit reached. ${countText}` : countText;
    }
    elements.check.disabled = state.selectedAnswer.length !== question.requiredSelections;
  };

  const selectOption = key => {
    if (state.answered) return;
    const question = currentQuestion();
    if (question.selectionMode === 'single') {
      state.selectedAnswer = [key];
      updateSelectionUi();
      return;
    }

    if (state.selectedAnswer.includes(key)) {
      state.selectedAnswer = state.selectedAnswer.filter(selected => selected !== key);
      updateSelectionUi();
      return;
    }
    if (state.selectedAnswer.length >= question.requiredSelections) {
      updateSelectionUi(true);
      return;
    }
    state.selectedAnswer = [...state.selectedAnswer, key];
    updateSelectionUi();
  };

  const createOptionButton = option => {
    const button = createElement('button', 'mc-option-btn');
    button.type = 'button';
    button.dataset.option = option.key;
    button.setAttribute('aria-pressed', 'false');
    button.append(createElement('span', 'mc-option-key', option.key), createElement('span', 'mc-option-text', option.text));
    button.addEventListener('click', () => selectOption(option.key));
    return button;
  };

  const renderQuestion = () => {
    const questions = currentQuestions();
    const question = currentQuestion();
    if (!question) {
      showResults();
      return;
    }

    state.selectedAnswer = [];
    state.answered = false;
    updateExamUi();
    elements.questionCounter.textContent = `Question ${state.currentIndex + 1} of ${questions.length}`;
    elements.scoreCount.textContent = `${state.score} / ${state.currentIndex}`;
    setProgress((state.currentIndex / questions.length) * 100);
    elements.feedback.hidden = true;
    elements.feedback.replaceChildren();
    elements.check.hidden = false;
    elements.check.disabled = true;
    elements.next.hidden = true;
    elements.next.textContent = 'Next Question →';

    const top = createElement('div', 'mc-content-top');
    top.append(
      createElement('span', 'mc-difficulty', question.difficulty),
      createElement('span', 'mc-question-mode', question.selectionMode === 'single' ? 'Single answer' : `${selectionWord(question.requiredSelections)} answers`)
    );

    const passage = createElement('section', 'mc-passage-card');
    const passageTitle = createElement('h3', 'mc-passage-title', question.passageTitle);
    passageTitle.id = 'current-mc-passage';
    passage.setAttribute('aria-labelledby', passageTitle.id);
    passage.append(createElement('span', 'section-kicker', 'Reading passage'), passageTitle, createElement('p', 'mc-passage-text', question.passage));

    const questionCard = createElement('section', 'mc-question-card');
    const questionNumber = createElement('span', 'mc-question-number', `Question ${state.currentIndex + 1}`);
    const questionText = createElement('h3', null, question.question);
    questionText.id = 'current-mc-question';
    questionCard.setAttribute('aria-labelledby', questionText.id);
    const instruction = createElement('p', 'mc-instruction', instructionFor(question));
    const optionRange = question.selectionMode === 'multiple'
      ? createElement('small', 'mc-option-range', `Select ${question.requiredSelections} letters from ${question.options[0].key}–${question.options.at(-1).key}.`)
      : null;
    const selectionCount = createElement('span', 'mc-selection-count', `Selected 0 of ${question.requiredSelections}.`);
    selectionCount.setAttribute('aria-live', 'polite');
    const instructionRow = createElement('div', 'mc-instruction-row');
    const instructionCopy = createElement('div');
    instructionCopy.append(instruction);
    if (optionRange) instructionCopy.append(optionRange);
    instructionRow.append(instructionCopy, selectionCount);

    const optionGrid = createElement('div', 'mc-option-grid');
    optionGrid.setAttribute('role', 'group');
    optionGrid.setAttribute('aria-label', instructionFor(question));
    question.options.forEach(option => optionGrid.append(createOptionButton(option)));
    questionCard.append(questionNumber, questionText, instructionRow, optionGrid);
    elements.content.replaceChildren(top, passage, questionCard);
  };

  const checkAnswer = () => {
    if (state.answered || elements.check.disabled) return;
    const question = currentQuestion();
    const correct = answersMatch(state.selectedAnswer, question.answer);
    state.answered = true;
    if (correct) {
      state.score += 1;
    } else {
      state.wrongAnswers.push({
        questionNumber: state.currentIndex + 1,
        passageTitle: question.passageTitle,
        question: question.question,
        studentAnswer: [...state.selectedAnswer],
        correctAnswer: [...question.answer],
        evidence: question.evidence,
        explanation: question.explanation
      });
    }

    elements.content.querySelectorAll('.mc-option-btn').forEach(button => {
      const key = button.dataset.option;
      const isCorrect = question.answer.includes(key);
      const wasSelected = state.selectedAnswer.includes(key);
      if (isCorrect) button.classList.add('correct');
      if (wasSelected && !isCorrect) button.classList.add('wrong');
      button.disabled = true;
    });

    const response = createElement('div', 'mc-response');
    const evidence = createElement('div', 'mc-evidence');
    evidence.append(createElement('span', null, 'Evidence'), createElement('p', null, question.evidence));
    const explanation = createElement('div', 'mc-explanation');
    explanation.append(createElement('span', null, 'Explanation'), createElement('p', null, question.explanation));
    response.append(evidence, explanation);
    elements.content.querySelector('.mc-question-card').append(response);

    elements.scoreCount.textContent = `${state.score} / ${state.currentIndex + 1}`;
    setProgress(((state.currentIndex + 1) / currentQuestions().length) * 100);
    const answerLabel = question.answer.join(', ');
    elements.feedback.replaceChildren(
      createElement('strong', null, correct ? 'Correct answer.' : `Not quite. Correct answer: ${answerLabel}.`),
      createElement('span', null, 'Review the evidence before continuing.')
    );
    elements.feedback.hidden = false;
    elements.check.hidden = true;
    elements.next.hidden = false;
    elements.next.textContent = state.currentIndex === currentQuestions().length - 1 ? 'View Results →' : 'Next Question →';
    elements.next.focus();
  };

  const nextQuestion = () => {
    if (!state.answered) return;
    if (state.currentIndex >= currentQuestions().length - 1) {
      showResults();
      return;
    }
    state.currentIndex += 1;
    renderQuestion();
    elements.content.focus();
  };

  const resultMessage = percentage => {
    if (percentage >= 90) return 'Excellent control. You are matching evidence to options with impressive consistency.';
    if (percentage >= 70) return 'Strong work. Review the distractors that were too broad, too narrow, or only partly supported.';
    if (percentage >= 50) return 'A useful start. Mark the evidence before comparing the final two choices.';
    return 'Keep building the method. Read the question first, locate the evidence, and eliminate one option at a time.';
  };

  const makeStat = (label, value, className = '') => {
    const stat = createElement('div', `mc-review-stat ${className}`.trim());
    stat.append(createElement('span', null, label), createElement('strong', null, value));
    return stat;
  };

  const buildMistake = mistake => {
    const card = createElement('article', 'mc-mistake-card');
    const meta = createElement('div', 'mc-mistake-meta');
    meta.append(createElement('span', null, `Question ${mistake.questionNumber}`), createElement('span', null, mistake.passageTitle));
    const question = createElement('p', 'mc-mistake-question', mistake.question);
    const answers = createElement('div', 'mc-mistake-answers');
    const student = createElement('div');
    student.append(createElement('span', null, 'Student answer'), createElement('strong', 'wrong', mistake.studentAnswer.join(', ')));
    const correct = createElement('div');
    correct.append(createElement('span', null, 'Correct answer'), createElement('strong', 'correct', mistake.correctAnswer.join(', ')));
    answers.append(student, correct);
    const evidence = createElement('p', 'mc-mistake-evidence');
    evidence.append(createElement('strong', null, 'Evidence: '), document.createTextNode(mistake.evidence));
    const explanation = createElement('p', 'mc-mistake-explanation');
    explanation.append(createElement('strong', null, 'Explanation: '), document.createTextNode(mistake.explanation));
    card.append(meta, question, answers, evidence, explanation);
    return card;
  };

  const buildReview = (total, percentage) => {
    const review = createElement('section', 'mc-review');
    review.append(createElement('h4', null, 'Session Review'));
    const grid = createElement('div', 'mc-review-grid');
    grid.append(
      makeStat('Total questions', String(total)),
      makeStat('Correct answers', String(state.score), 'correct'),
      makeStat('Wrong answers', String(state.wrongAnswers.length), 'wrong'),
      makeStat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(grid, createElement('p', 'mc-review-message', resultMessage(percentage)));
    if (state.wrongAnswers.length) {
      const list = createElement('div', 'mc-mistake-list');
      list.append(createElement('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach(mistake => list.append(buildMistake(mistake)));
      review.append(list);
    }
    return review;
  };

  const showResults = () => {
    const total = currentQuestions().length;
    const percentage = total ? Math.round((state.score / total) * 100) : 0;
    elements.questionCounter.textContent = 'Session complete';
    elements.scoreCount.textContent = `${state.score} / ${total}`;
    setProgress(100);
    const result = createElement('div', 'mc-result');
    result.append(
      createElement('span', 'section-kicker', 'Multiple choice complete'),
      createElement('strong', 'mc-result-score', `${state.score}/${total}`),
      createElement('h3', null, `${percentage}% correct`),
      createElement('small', null, 'Restart to practise the same questions again.')
    );
    elements.content.replaceChildren(result, buildReview(total, percentage));
    elements.feedback.hidden = true;
    elements.feedback.replaceChildren();
    elements.check.hidden = true;
    elements.next.hidden = true;
    elements.restart.focus();
  };

  const resetSession = () => {
    state.currentIndex = 0;
    state.selectedAnswer = [];
    state.score = 0;
    state.answered = false;
    state.wrongAnswers = [];
    renderQuestion();
  };

  const showLoadingState = () => {
    elements.restart.disabled = true;
    elements.check.hidden = true;
    elements.next.hidden = true;
    elements.questionCounter.textContent = 'Loading question…';
    elements.scoreCount.textContent = '0 / 0';
    setProgress(0);
    const loading = createElement('div', 'practice-loading');
    loading.append(createElement('span', 'practice-loader'), createElement('p', null, `Loading ${EXAM_CONFIG[state.exam].name} multiple choice questions…`));
    elements.content.replaceChildren(loading);
    elements.feedback.hidden = true;
  };

  const showLoadingError = (exam, error) => {
    elements.restart.disabled = true;
    elements.sessionTitle.textContent = 'Practice data unavailable';
    elements.examName.textContent = 'Please retry';
    elements.questionCounter.textContent = 'Not loaded';
    elements.scoreCount.textContent = '0 / 0';
    setProgress(0);
    const errorBox = createElement('div', 'practice-load-error');
    errorBox.append(
      createElement('span', 'practice-load-error-icon', '!'),
      createElement('h3', null, 'We could not load the multiple choice questions.'),
      createElement('p', null, error?.message || `The ${EXAM_CONFIG[exam].name} dataset could not be loaded.`)
    );
    const retry = createElement('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', () => loadExamDataset(exam));
    errorBox.append(retry);
    elements.content.replaceChildren(errorBox);
    elements.feedback.hidden = true;
    elements.check.hidden = true;
    elements.next.hidden = true;
  };

  const validateDataset = (exam, data) => {
    const expectedPrefix = exam === 'academic' ? 'ielts-ac-mc-' : 'ielts-gt-mc-';
    const dataPath = DATA_PATHS[exam].replace('../', '');
    const requiredFields = ['id', 'examKey', 'exam', 'section', 'questionType', 'interfaceType', 'difficulty', 'passageTitle', 'passage', 'question', 'options', 'selectionMode', 'requiredSelections', 'answer', 'evidence', 'explanation', 'status'];

    if (!Array.isArray(data)) throw new Error(`Invalid dataset: ${dataPath} must contain a JSON array.`);
    if (!data.length) throw new Error(`Invalid dataset: ${dataPath} is empty.`);

    data.forEach((question, questionIndex) => {
      const questionLabel = question?.id || `question ${questionIndex + 1}`;
      if (question?.status !== 'active') throw new Error(`Invalid dataset: ${questionLabel} must have status "active".`);
      if (question?.examKey !== exam) {
        const receivedMode = EXAM_CONFIG[question?.examKey]?.modeName || `unidentified (${question?.examKey ?? 'missing examKey'})`;
        throw new Error(`Dataset mismatch: ${EXAM_CONFIG[exam].modeName} mode received ${receivedMode} data. Please check ${dataPath}.`);
      }

      const missingFields = requiredFields.filter(field => {
        const value = question?.[field];
        return value === undefined || value === null || value === '';
      });
      if (missingFields.length) throw new Error(`Invalid dataset: ${questionLabel} is missing ${missingFields.join(', ')}.`);
      if (!question.id.startsWith(expectedPrefix)) throw new Error(`Invalid dataset: ${questionLabel} must start with "${expectedPrefix}".`);
      if (!['single', 'multiple'].includes(question.selectionMode)) throw new Error(`Invalid dataset: ${questionLabel} has an unsupported selectionMode.`);
      if (!Number.isInteger(question.requiredSelections)) throw new Error(`Invalid dataset: ${questionLabel} requiredSelections must be a whole number.`);
      if (question.selectionMode === 'single' && question.requiredSelections !== 1) throw new Error(`Invalid dataset: ${questionLabel} single mode requires requiredSelections of 1.`);
      if (question.selectionMode === 'multiple' && question.requiredSelections < 2) throw new Error(`Invalid dataset: ${questionLabel} multiple mode requires at least 2 selections.`);
      if (!Array.isArray(question.options) || question.options.length < 4) throw new Error(`Invalid dataset: ${questionLabel} must include at least 4 options.`);

      const optionKeys = [];
      question.options.forEach((option, optionIndex) => {
        if (!option?.key || !option?.text) throw new Error(`Invalid dataset: ${questionLabel}, option ${optionIndex + 1} must include key and text.`);
        if (optionKeys.includes(option.key)) throw new Error(`Invalid dataset: ${questionLabel} contains duplicate option key "${option.key}".`);
        optionKeys.push(option.key);
      });

      if (!Array.isArray(question.answer) || !question.answer.length) throw new Error(`Invalid dataset: ${questionLabel} answer must be a non-empty array.`);
      if (new Set(question.answer).size !== question.answer.length) throw new Error(`Invalid dataset: ${questionLabel} contains duplicate answer keys.`);
      if (question.answer.some(key => !optionKeys.includes(key))) throw new Error(`Invalid dataset: ${questionLabel} has an answer key that does not match an option.`);
      if (question.requiredSelections !== question.answer.length) throw new Error(`Invalid dataset: ${questionLabel} requiredSelections must match the number of correct answers.`);
    });
    return data;
  };

  const loadJson = async (exam, path) => {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
    const data = await response.json();
    return validateDataset(exam, data);
  };

  async function loadExamDataset(exam) {
    if (!EXAM_CONFIG[exam]) return;
    if (state.datasets[exam]) {
      if (state.exam === exam) {
        state.loaded = true;
        elements.restart.disabled = false;
        resetSession();
      }
      return;
    }

    if (state.exam === exam) {
      state.loaded = false;
      showLoadingState();
    }

    try {
      const data = await loadJson(exam, DATA_PATHS[exam]);
      state.datasets[exam] = data;
      if (state.exam !== exam) return;
      state.loaded = true;
      elements.restart.disabled = false;
      resetSession();
    } catch (error) {
      console.error(`Exam Verse IELTS Multiple Choice dataset validation failed for ${exam}:`, error);
      if (state.exam === exam) showLoadingError(exam, error);
    }
  }

  const switchExam = exam => {
    if (!EXAM_CONFIG[exam]) return;
    state.exam = exam;
    updateUrl(exam);
    updateExamUi();
    if (state.datasets[exam]) {
      state.loaded = true;
      elements.restart.disabled = false;
      resetSession();
    } else {
      loadExamDataset(exam);
    }
  };

  elements.examCards.forEach(card => card.addEventListener('click', () => {
    switchExam(card.dataset.exam);
    document.querySelector('#practice-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  elements.check.addEventListener('click', checkAnswer);
  elements.next.addEventListener('click', nextQuestion);
  elements.restart.addEventListener('click', resetSession);

  updateExamUi();
  loadExamDataset(state.exam);
})();
