(() => {
  'use strict';

  const DATA_PATHS = {
    academic: '../data/ielts-academic/reading/true-false-not-given.json',
    general: '../data/ielts-general/reading/true-false-not-given.json'
  };

  const EXAM_CONFIG = {
    academic: {
      name: 'IELTS Academic',
      title: 'Academic TFNG Practice',
      hub: '../pages/ielts-academic.html',
      hubLabel: 'Back to IELTS Academic Hub'
    },
    general: {
      name: 'IELTS General Training',
      title: 'General Training TFNG Practice',
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
    selectedAnswer: null,
    score: 0,
    answered: false,
    loaded: false,
    wrongAnswers: []
  };

  const elements = {
    examCards: [...document.querySelectorAll('[data-exam]')],
    sessionTitle: document.querySelector('#tfng-session-title'),
    examName: document.querySelector('#tfng-exam-name'),
    questionCounter: document.querySelector('#tfng-question-counter'),
    scoreCount: document.querySelector('#tfng-score-count'),
    progress: document.querySelector('#tfng-progress'),
    progressBar: document.querySelector('#tfng-progress-bar'),
    questionArea: document.querySelector('#tfng-question-area'),
    feedback: document.querySelector('#tfng-feedback'),
    checkButton: document.querySelector('#tfng-check-answer'),
    nextButton: document.querySelector('#tfng-next-question'),
    restartButton: document.querySelector('#tfng-restart'),
    hubLink: document.querySelector('#tfng-hub-link'),
    hubLabel: document.querySelector('#tfng-hub-label')
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const currentQuestions = () => state.datasets[state.exam] || [];
  const currentQuestion = () => currentQuestions()[state.currentIndex];

  const setProgress = (value) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    elements.progressBar.style.width = `${safeValue}%`;
    elements.progress.setAttribute('aria-valuenow', String(safeValue));
  };

  const updateUrl = (exam) => {
    const url = new URL(window.location.href);
    url.searchParams.set('exam', exam);
    url.hash = 'practice-shell';
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const updateExamUi = () => {
    const config = EXAM_CONFIG[state.exam];
    elements.examCards.forEach((card) => {
      const isActive = card.dataset.exam === state.exam;
      card.classList.toggle('active', isActive);
      card.setAttribute('aria-pressed', String(isActive));
    });
    elements.sessionTitle.textContent = config.title;
    elements.examName.textContent = config.name;
    elements.hubLink.href = config.hub;
    elements.hubLabel.textContent = config.hubLabel;
  };

  const selectAnswer = (answer) => {
    if (state.answered) return;
    state.selectedAnswer = answer;
    elements.questionArea.querySelectorAll('.tfng-answer-btn').forEach((button) => {
      const isSelected = button.dataset.answer === answer;
      button.classList.toggle('selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
    elements.checkButton.disabled = false;
  };

  const makeAnswerButton = (answer, code) => {
    const button = createElement('button', 'tfng-answer-btn');
    button.type = 'button';
    button.dataset.answer = answer;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `Choose ${answer}`);
    button.append(createElement('span', null, code), createElement('strong', null, answer));
    button.addEventListener('click', () => selectAnswer(answer));
    return button;
  };

  const renderQuestion = () => {
    const questions = currentQuestions();
    const question = currentQuestion();
    if (!question) {
      showResults();
      return;
    }

    state.selectedAnswer = null;
    state.answered = false;
    updateExamUi();

    elements.questionCounter.textContent = `Question ${state.currentIndex + 1} of ${questions.length}`;
    elements.scoreCount.textContent = `${state.score} / ${state.currentIndex}`;
    setProgress((state.currentIndex / questions.length) * 100);
    elements.feedback.hidden = true;
    elements.feedback.replaceChildren();
    elements.checkButton.hidden = false;
    elements.checkButton.disabled = true;
    elements.nextButton.hidden = true;
    elements.nextButton.textContent = 'Next Question →';

    const top = createElement('div', 'tfng-question-top');
    top.append(
      createElement('span', 'tfng-topic-pill', question.difficulty),
      createElement('span', 'tfng-question-type', 'True / False / Not Given')
    );

    const passage = createElement('section', 'tfng-passage-card');
    passage.setAttribute('aria-label', `Reading passage: ${question.passageTitle}`);
    passage.append(
      createElement('span', 'tfng-passage-label', 'Reading passage'),
      createElement('h3', 'tfng-passage-title', question.passageTitle),
      createElement('p', 'tfng-passage-text', question.passage)
    );

    const statement = createElement('section', 'tfng-statement-card');
    statement.setAttribute('aria-label', 'Statement to evaluate');
    statement.append(
      createElement('span', null, 'Statement'),
      createElement('p', null, question.statement)
    );

    const answers = createElement('div', 'tfng-answer-grid');
    answers.append(
      makeAnswerButton('True', 'T'),
      makeAnswerButton('False', 'F'),
      makeAnswerButton('Not Given', 'NG')
    );
    elements.questionArea.replaceChildren(top, passage, statement, answers);
  };

  const showFeedback = (question, isCorrect) => {
    const status = createElement('div', `tfng-feedback-status ${isCorrect ? 'correct' : 'wrong'}`, isCorrect ? 'Correct' : 'Not quite');
    const title = createElement('h3', null, isCorrect ? 'Your decision matches the passage.' : `The correct answer is ${question.answer}.`);
    const explanation = createElement('p', null, question.explanation);
    const evidence = createElement('div', 'tfng-evidence');
    evidence.append(createElement('span', null, 'Evidence'), createElement('p', null, question.evidence));
    elements.feedback.replaceChildren(status, title, explanation, evidence);
    elements.feedback.hidden = false;
  };

  const checkAnswer = () => {
    if (!state.selectedAnswer || state.answered) return;
    const question = currentQuestion();
    const isCorrect = state.selectedAnswer === question.answer;
    state.answered = true;

    if (isCorrect) {
      state.score += 1;
    } else {
      state.wrongAnswers.push({
        questionNumber: state.currentIndex + 1,
        passageTitle: question.passageTitle,
        statement: question.statement,
        selectedAnswer: state.selectedAnswer,
        correctAnswer: question.answer,
        evidence: question.evidence,
        explanation: question.explanation
      });
    }

    elements.questionArea.querySelectorAll('.tfng-answer-btn').forEach((button) => {
      button.disabled = true;
      if (button.dataset.answer === question.answer) button.classList.add('correct');
      if (button.dataset.answer === state.selectedAnswer && !isCorrect) button.classList.add('wrong');
    });

    const questions = currentQuestions();
    elements.scoreCount.textContent = `${state.score} / ${state.currentIndex + 1}`;
    setProgress(((state.currentIndex + 1) / questions.length) * 100);
    showFeedback(question, isCorrect);
    elements.checkButton.hidden = true;
    elements.nextButton.hidden = false;
    elements.nextButton.textContent = state.currentIndex === questions.length - 1 ? 'View Results →' : 'Next Question →';
    elements.nextButton.focus();
  };

  const nextQuestion = () => {
    if (!state.answered) return;
    if (state.currentIndex >= currentQuestions().length - 1) {
      showResults();
      return;
    }
    state.currentIndex += 1;
    renderQuestion();
    elements.questionArea.focus();
  };

  const resultMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent evidence control. You are separating passage facts from assumptions very reliably.';
    if (percentage >= 70) return 'Strong reading logic. Review the few statements where the evidence changed your decision.';
    if (percentage >= 50) return 'A useful start. Slow down and ask whether the passage agrees, contradicts, or stays silent.';
    return 'Keep building the method. Find the exact evidence before choosing an answer.';
  };

  const makeStat = (label, value, className = '') => {
    const stat = createElement('div', `tfng-review-stat ${className}`.trim());
    stat.append(createElement('span', null, label), createElement('strong', null, value));
    return stat;
  };

  const buildMistakeCard = (mistake) => {
    const card = createElement('article', 'tfng-mistake-card');
    const meta = createElement('div', 'tfng-mistake-meta');
    meta.append(createElement('span', null, `Question ${mistake.questionNumber}`), createElement('span', null, mistake.passageTitle));
    const statement = createElement('p', 'tfng-mistake-statement', mistake.statement);
    const answers = createElement('div', 'tfng-mistake-answers');
    const student = createElement('div');
    student.append(createElement('span', null, 'Your answer'), createElement('strong', 'wrong', mistake.selectedAnswer));
    const correct = createElement('div');
    correct.append(createElement('span', null, 'Correct answer'), createElement('strong', 'correct', mistake.correctAnswer));
    answers.append(student, correct);
    const evidence = createElement('p', 'tfng-mistake-evidence', `Evidence: ${mistake.evidence}`);
    const explanation = createElement('p', 'tfng-mistake-explanation', mistake.explanation);
    card.append(meta, statement, answers, evidence, explanation);
    return card;
  };

  const buildReview = (total, percentage) => {
    const review = createElement('section', 'tfng-review');
    review.setAttribute('aria-label', 'Practice session review');
    review.append(createElement('h4', null, 'Session Review'));
    const grid = createElement('div', 'tfng-review-grid');
    grid.append(
      makeStat('Total questions', String(total)),
      makeStat('Correct answers', String(state.score), 'correct'),
      makeStat('Wrong answers', String(state.wrongAnswers.length), 'wrong'),
      makeStat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(grid, createElement('p', 'tfng-review-message', resultMessage(percentage)));
    if (state.wrongAnswers.length) {
      const list = createElement('div', 'tfng-mistake-list');
      list.append(createElement('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach((mistake) => list.append(buildMistakeCard(mistake)));
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

    const result = createElement('div', 'tfng-result');
    result.append(
      createElement('span', 'section-kicker', 'Reading set complete'),
      createElement('strong', 'tfng-result-score', `${state.score}/${total}`),
      createElement('h3', null, `${percentage}% correct`),
      createElement('small', null, 'Restart this set to apply the evidence method again.')
    );
    elements.questionArea.replaceChildren(result, buildReview(total, percentage));
    elements.feedback.hidden = true;
    elements.feedback.replaceChildren();
    elements.checkButton.hidden = true;
    elements.nextButton.hidden = true;
    elements.restartButton.focus();
  };

  const resetSession = () => {
    state.currentIndex = 0;
    state.selectedAnswer = null;
    state.score = 0;
    state.answered = false;
    state.wrongAnswers = [];
    renderQuestion();
  };

  const switchExam = (exam) => {
    if (!EXAM_CONFIG[exam]) return;
    state.exam = exam;
    updateUrl(exam);
    updateExamUi();
    if (state.loaded) resetSession();
  };

  const showLoadingError = () => {
    elements.restartButton.disabled = true;
    elements.sessionTitle.textContent = 'Practice data unavailable';
    elements.examName.textContent = 'Please retry';
    elements.questionCounter.textContent = 'Not loaded';
    elements.scoreCount.textContent = '0 / 0';
    setProgress(0);
    const error = createElement('div', 'practice-load-error');
    error.append(
      createElement('span', 'practice-load-error-icon', '!'),
      createElement('h3', null, 'We could not load the IELTS questions.'),
      createElement('p', null, 'Please check your connection or run Exam Verse through a local web server, then try again.')
    );
    const retry = createElement('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', loadPracticeData);
    error.append(retry);
    elements.questionArea.replaceChildren(error);
    elements.feedback.hidden = true;
    elements.checkButton.hidden = true;
    elements.nextButton.hidden = true;
  };

  const loadJson = async (path) => {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${path}`);
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) throw new Error(`No questions found in ${path}`);
    const active = data.filter((item) => item.status === 'active');
    if (!active.length) throw new Error(`No active questions found in ${path}`);
    return active;
  };

  async function loadPracticeData() {
    state.loaded = false;
    elements.restartButton.disabled = true;
    try {
      const [academic, general] = await Promise.all([loadJson(DATA_PATHS.academic), loadJson(DATA_PATHS.general)]);
      state.datasets = { academic, general };
      state.loaded = true;
      elements.restartButton.disabled = false;
      resetSession();
    } catch (error) {
      console.error('Exam Verse IELTS practice loading error:', error);
      showLoadingError();
    }
  }

  elements.examCards.forEach((card) => {
    card.addEventListener('click', () => {
      switchExam(card.dataset.exam);
      document.querySelector('#practice-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.checkButton.addEventListener('click', checkAnswer);
  elements.nextButton.addEventListener('click', nextQuestion);
  elements.restartButton.addEventListener('click', resetSession);

  updateExamUi();
  loadPracticeData();
})();
