(() => {
  'use strict';

  const DATA_PATHS = {
    'sentence-completion': '../data/toefl-itp/structure/sentence-completion.json',
    'error-recognition': '../data/toefl-itp/structure/error-recognition.json'
  };

  const MODE_LABELS = {
    'sentence-completion': 'Sentence Completion',
    'error-recognition': 'Error Recognition'
  };

  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get('mode');
  const initialMode = Object.prototype.hasOwnProperty.call(MODE_LABELS, requestedMode)
    ? requestedMode
    : 'sentence-completion';

  const state = {
    datasets: {},
    mode: initialMode,
    currentIndex: 0,
    selectedAnswer: null,
    score: 0,
    answered: false,
    loaded: false,
    wrongAnswers: []
  };

  const elements = {
    modeCards: [...document.querySelectorAll('[data-mode]')],
    startLinks: [...document.querySelectorAll('[data-start-mode]')],
    sessionTitle: document.querySelector('#session-title'),
    modeName: document.querySelector('#practice-mode-name'),
    questionCounter: document.querySelector('#question-counter'),
    scoreCount: document.querySelector('#score-count'),
    progress: document.querySelector('#practice-progress'),
    progressBar: document.querySelector('#practice-progress-bar'),
    questionCard: document.querySelector('#practice-question-card'),
    feedback: document.querySelector('#practice-feedback'),
    checkButton: document.querySelector('#check-answer'),
    nextButton: document.querySelector('#next-question'),
    restartButton: document.querySelector('#restart-practice')
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const currentQuestions = () => state.datasets[state.mode] || [];
  const currentQuestion = () => currentQuestions()[state.currentIndex];

  const answerTextFor = (question, key) => {
    const answers = question.options || question.segments || [];
    const answer = answers.find((item) => item.key === key);
    return answer ? `${key}. ${answer.text}` : key;
  };

  const updateModeUrl = (mode) => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    url.hash = 'practice-shell';
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const setProgress = (value) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    elements.progressBar.style.width = `${safeValue}%`;
    elements.progress.setAttribute('aria-valuenow', String(safeValue));
  };

  const updateModeControls = () => {
    elements.modeCards.forEach((card) => {
      const isActive = card.dataset.mode === state.mode;
      card.classList.toggle('active', isActive);
      card.setAttribute('aria-pressed', String(isActive));
    });
    elements.sessionTitle.textContent = `${MODE_LABELS[state.mode]} Practice`;
    elements.modeName.textContent = MODE_LABELS[state.mode];
  };

  const selectAnswer = (key) => {
    if (state.answered) return;
    state.selectedAnswer = key;
    elements.questionCard.querySelectorAll('.practice-answer-btn').forEach((button) => {
      const isSelected = button.dataset.key === key;
      button.classList.toggle('selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
    elements.checkButton.disabled = false;
  };

  const makeAnswerButton = (option, interfaceType) => {
    const button = createElement('button', 'practice-answer-btn');
    button.type = 'button';
    button.dataset.key = option.key;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `Option ${option.key}: ${option.text}`);
    if (interfaceType === 'error-recognition') button.classList.add('practice-segment-btn');

    button.append(
      createElement('span', 'practice-answer-key', option.key),
      createElement('span', 'practice-answer-text', option.text)
    );
    button.addEventListener('click', () => selectAnswer(option.key));
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
    updateModeControls();

    elements.questionCounter.textContent = `Question ${state.currentIndex + 1} of ${questions.length}`;
    elements.scoreCount.textContent = `${state.score} / ${state.currentIndex}`;
    setProgress((state.currentIndex / questions.length) * 100);

    elements.feedback.hidden = true;
    elements.feedback.replaceChildren();
    elements.checkButton.hidden = false;
    elements.checkButton.disabled = true;
    elements.nextButton.hidden = true;
    elements.nextButton.textContent = 'Next Question →';

    const questionTop = createElement('div', 'practice-question-top');
    const topic = createElement('span', 'practice-topic-pill', question.topic);
    const difficulty = createElement('span', 'practice-difficulty', question.difficulty);
    questionTop.append(topic, difficulty);

    const instruction = createElement(
      'p',
      'practice-instruction',
      state.mode === 'sentence-completion'
        ? 'Choose the best word or phrase to complete the sentence.'
        : 'Choose the labelled segment that contains the error.'
    );

    const prompt = createElement(
      state.mode === 'sentence-completion' ? 'h3' : 'p',
      state.mode === 'sentence-completion' ? 'practice-question-sentence' : 'practice-error-sentence',
      state.mode === 'sentence-completion'
        ? question.question
        : question.sentence
    );

    const answers = createElement('div', 'practice-answer-grid');
    if (state.mode === 'error-recognition') answers.classList.add('practice-segment-grid');
    const options = state.mode === 'sentence-completion' ? question.options : question.segments;
    options.forEach((option) => answers.append(makeAnswerButton(option, question.interfaceType)));

    elements.questionCard.replaceChildren(questionTop, instruction, prompt, answers);
  };

  const showFeedback = (question, isCorrect) => {
    const status = createElement(
      'div',
      `practice-feedback-status ${isCorrect ? 'correct' : 'wrong'}`,
      isCorrect ? 'Correct' : 'Not quite'
    );
    const title = createElement('h3', null, isCorrect ? 'Good grammar choice.' : `The correct answer is ${question.answer}.`);
    const explanation = createElement('p', null, question.explanation);
    elements.feedback.replaceChildren(status, title, explanation);

    if (state.mode === 'error-recognition' && question.correctedSentence) {
      const correction = createElement('div', 'practice-correction');
      correction.append(
        createElement('span', null, 'Corrected sentence'),
        createElement('strong', null, question.correctedSentence)
      );
      elements.feedback.append(correction);
    }

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
        topic: question.topic,
        questionText: question.question || question.sentence,
        selectedAnswer: state.selectedAnswer,
        selectedAnswerText: answerTextFor(question, state.selectedAnswer),
        correctAnswer: question.answer,
        correctAnswerText: answerTextFor(question, question.answer),
        explanation: question.explanation
      });
    }

    elements.questionCard.querySelectorAll('.practice-answer-btn').forEach((button) => {
      const key = button.dataset.key;
      button.disabled = true;
      if (key === question.answer) button.classList.add('correct');
      if (key === state.selectedAnswer && !isCorrect) button.classList.add('wrong');
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
    elements.questionCard.focus?.();
  };

  const resultMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent control. You are recognizing these grammar patterns very reliably.';
    if (percentage >= 70) return 'Strong work. Review the explanations for the patterns that still slowed you down.';
    if (percentage >= 50) return 'A useful start. Repeat the set and focus on why each correct answer works.';
    return 'Keep building the foundation. Study one grammar pattern at a time, then try the set again.';
  };

  const makeReviewStat = (label, value, accentClass = '') => {
    const stat = createElement('div', `practice-review-stat ${accentClass}`.trim());
    stat.append(createElement('span', null, label), createElement('strong', null, value));
    return stat;
  };

  const buildMistakeCard = (mistake) => {
    const card = createElement('article', 'practice-mistake-card');
    const meta = createElement('div', 'practice-mistake-meta');
    meta.append(
      createElement('span', null, `Question ${mistake.questionNumber}`),
      createElement('span', null, mistake.topic)
    );

    const question = createElement('p', 'practice-mistake-question', mistake.questionText);
    const answers = createElement('div', 'practice-mistake-answer');
    const studentAnswer = createElement('div');
    studentAnswer.append(
      createElement('span', null, 'Your answer'),
      createElement('strong', 'wrong', mistake.selectedAnswerText)
    );
    const correctAnswer = createElement('div');
    correctAnswer.append(
      createElement('span', null, 'Correct answer'),
      createElement('strong', 'correct', mistake.correctAnswerText)
    );
    answers.append(studentAnswer, correctAnswer);

    const explanation = createElement('p', 'practice-mistake-explanation', mistake.explanation);
    card.append(meta, question, answers, explanation);
    return card;
  };

  const buildReview = (total, percentage) => {
    const review = createElement('section', 'practice-review practice-review-card');
    review.setAttribute('aria-label', 'Practice session review');
    review.append(createElement('h4', null, 'Session Review'));

    const stats = createElement('div', 'practice-review-grid');
    stats.append(
      makeReviewStat('Total questions', String(total)),
      makeReviewStat('Correct answers', String(state.score), 'correct'),
      makeReviewStat('Wrong answers', String(state.wrongAnswers.length), 'wrong'),
      makeReviewStat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(stats, createElement('p', 'practice-review-message', resultMessage(percentage)));

    if (state.wrongAnswers.length) {
      const mistakes = createElement('div', 'practice-mistake-list');
      mistakes.append(createElement('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach((mistake) => mistakes.append(buildMistakeCard(mistake)));
      review.append(mistakes);
    }
    return review;
  };

  const showResults = () => {
    const total = currentQuestions().length;
    const percentage = total ? Math.round((state.score / total) * 100) : 0;
    elements.questionCounter.textContent = 'Session complete';
    elements.scoreCount.textContent = `${state.score} / ${total}`;
    setProgress(100);

    const result = createElement('div', 'practice-result');
    const label = createElement('span', 'section-kicker', 'Practice complete');
    const score = createElement('strong', 'practice-result-score', `${state.score}/${total}`);
    const heading = createElement('h3', null, `${percentage}% correct`);
    const hint = createElement('small', null, 'Restart this mode to review the same core patterns again.');
    result.append(label, score, heading, hint);
    elements.questionCard.replaceChildren(result, buildReview(total, percentage));

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

  const switchMode = (mode) => {
    if (!MODE_LABELS[mode]) return;
    state.mode = mode;
    updateModeUrl(mode);
    updateModeControls();
    if (state.loaded) resetSession();
  };

  const showLoadingError = () => {
    elements.restartButton.disabled = true;
    elements.sessionTitle.textContent = 'Practice data unavailable';
    elements.modeName.textContent = 'Please retry';
    elements.questionCounter.textContent = 'Not loaded';
    elements.scoreCount.textContent = '0 / 0';
    setProgress(0);

    const error = createElement('div', 'practice-load-error');
    error.append(
      createElement('span', 'practice-load-error-icon', '!'),
      createElement('h3', null, 'We could not load the questions.'),
      createElement('p', null, 'Please check your connection or run Exam Verse through a local web server, then try again.')
    );
    const retry = createElement('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', loadPracticeData);
    error.append(retry);
    elements.questionCard.replaceChildren(error);
    elements.feedback.hidden = true;
    elements.checkButton.hidden = true;
    elements.nextButton.hidden = true;
  };

  const loadJson = async (path) => {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${path}`);
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) throw new Error(`No questions found in ${path}`);
    const activeQuestions = data.filter((item) => item.status === 'active');
    if (!activeQuestions.length) throw new Error(`No active questions found in ${path}`);
    return activeQuestions;
  };

  async function loadPracticeData() {
    state.loaded = false;
    elements.restartButton.disabled = true;
    elements.sessionTitle.textContent = 'Loading practice…';
    elements.modeName.textContent = 'Preparing data';
    try {
      const [sentenceCompletion, errorRecognition] = await Promise.all([
        loadJson(DATA_PATHS['sentence-completion']),
        loadJson(DATA_PATHS['error-recognition'])
      ]);
      state.datasets = {
        'sentence-completion': sentenceCompletion,
        'error-recognition': errorRecognition
      };
      state.loaded = true;
      elements.restartButton.disabled = false;
      resetSession();
    } catch (error) {
      console.error('Exam Verse practice loading error:', error);
      showLoadingError();
    }
  }

  elements.modeCards.forEach((card) => {
    card.addEventListener('click', () => {
      switchMode(card.dataset.mode);
      document.querySelector('#practice-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.startLinks.forEach((link) => link.addEventListener('click', () => switchMode(link.dataset.startMode)));
  elements.checkButton.addEventListener('click', checkAnswer);
  elements.nextButton.addEventListener('click', nextQuestion);
  elements.restartButton.addEventListener('click', resetSession);

  updateModeControls();
  loadPracticeData();
})();
