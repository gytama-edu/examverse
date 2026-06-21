(() => {
  'use strict';

  const DATA_PATH = '../data/toefl-ibt/reading/read-in-daily-life.json';
  const HUB_URL = '../pages/toefl-ibt.html';

  const state = {
    data: [],
    currentSetIndex: 0,
    selectedAnswers: {},
    locked: false,
    loaded: false,
    sessionScore: 0,
    sessionAnswered: 0,
    setResults: [],
    wrongAnswers: []
  };

  const el = {
    sessionTitle: document.querySelector('#daily-life-session-title'),
    examName: document.querySelector('#dl-exam-name'),
    setCounter: document.querySelector('#dl-set-counter'),
    scoreCount: document.querySelector('#dl-score-count'),
    progress: document.querySelector('#dl-progress'),
    progressBar: document.querySelector('#dl-progress-bar'),
    questionArea: document.querySelector('#dl-question-area'),
    feedback: document.querySelector('#dl-feedback'),
    check: document.querySelector('#dl-check'),
    next: document.querySelector('#dl-next'),
    restart: document.querySelector('#dl-restart'),
    hubLink: document.querySelector('#dl-hub-link'),
    hubLabel: document.querySelector('#dl-hub-label')
  };

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const currentSets = () => state.data;
  const currentSet = () => currentSets()[state.currentSetIndex];

  const setProgress = (value) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    el.progressBar.style.width = `${safeValue}%`;
    el.progress.setAttribute('aria-valuenow', String(safeValue));
  };

  const answerTextFor = (question, optionId) => question.options.find((option) => option.id === optionId)?.text || optionId;

  const updateCheckState = () => {
    const set = currentSet();
    const allAnswered = Boolean(set && set.questions.every((question) => normalize(state.selectedAnswers[question.id])));
    el.check.disabled = state.locked || !allAnswered;
  };

  const updateHeader = () => {
    const set = currentSet();
    if (!set) return;
    el.sessionTitle.textContent = set.title;
    el.examName.textContent = `${set.textType} - ${set.difficulty}`;
    el.setCounter.textContent = `Set ${state.currentSetIndex + 1} of ${currentSets().length}`;
    el.scoreCount.textContent = `0 / ${set.questions.length}`;
    el.hubLink.href = HUB_URL;
    el.hubLabel.textContent = 'Back to TOEFL iBT 2026 Hub';
    setProgress((state.currentSetIndex / currentSets().length) * 100);
  };

  const selectAnswer = (questionId, optionId) => {
    if (state.locked) return;
    state.selectedAnswers[questionId] = optionId;
    const questionCard = el.questionArea.querySelector(`.daily-life-question-card[data-question-id="${questionId}"]`);
    if (questionCard) {
      questionCard.querySelectorAll('.daily-life-option').forEach((button) => {
        const isSelected = button.dataset.optionId === optionId;
        button.classList.toggle('selected', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));
      });
    }
    updateCheckState();
  };

  const makeOptionButton = (question, option) => {
    const button = create('button', 'daily-life-option');
    button.type = 'button';
    button.dataset.optionId = option.id;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `Question ${question.number} option ${option.id}: ${option.text}`);
    button.append(
      create('span', 'daily-life-option-key', option.id),
      create('span', 'daily-life-option-text', option.text)
    );
    button.addEventListener('click', () => selectAnswer(question.id, option.id));
    return button;
  };

  const renderQuestionCard = (question) => {
    const card = create('article', 'daily-life-question-card');
    card.dataset.questionId = question.id;

    const header = create('div', 'daily-life-question-header');
    header.append(
      create('span', 'daily-life-question-number', `Question ${question.number}`),
      create('h3', null, question.prompt)
    );

    const optionGrid = create('div', 'daily-life-option-grid');
    question.options.forEach((option) => optionGrid.append(makeOptionButton(question, option)));

    const response = create('div', 'daily-life-response');
    response.hidden = true;

    card.append(header, optionGrid, response);
    return card;
  };

  const renderSet = () => {
    const set = currentSet();
    if (!set) {
      showResults();
      return;
    }

    state.selectedAnswers = {};
    state.locked = false;
    updateHeader();
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
    el.check.hidden = false;
    el.check.disabled = true;
    el.next.hidden = true;
    el.next.textContent = 'Next Set ->';

    const top = create('div', 'completion-content-top');
    top.append(
      create('span', 'completion-difficulty', set.difficulty),
      create('span', 'completion-type', set.textType),
      create('span', 'completion-word-limit', '3 questions')
    );

    const passageCard = create('section', 'completion-passage-card daily-life-text-card');
    passageCard.append(
      create('span', 'section-kicker', 'Daily-life text'),
      create('h3', 'completion-passage-title', set.title),
      create('p', 'daily-life-context', set.context),
      create('p', 'daily-life-passage', set.passage)
    );

    const questionList = create('section', 'daily-life-question-list');
    set.questions.forEach((question) => questionList.append(renderQuestionCard(question)));

    el.questionArea.replaceChildren(top, passageCard, questionList);
    updateCheckState();
  };

  const buildResponseBlock = (question, selectedId, correctId, isCorrect) => {
    const response = create('div', 'daily-life-response');
    const status = create('div', `daily-life-response-status ${isCorrect ? 'correct' : 'wrong'}`, isCorrect ? 'Correct' : 'Not quite');
    const answers = create('div', 'daily-life-response-answers');
    const yourAnswer = create('div');
    yourAnswer.append(create('span', null, 'Your answer'), create('strong', isCorrect ? 'correct' : 'wrong', selectedId ? answerTextFor(question, selectedId) : 'No answer'));
    const correctAnswer = create('div');
    correctAnswer.append(create('span', null, 'Correct answer'), create('strong', 'correct', answerTextFor(question, correctId)));
    answers.append(yourAnswer, correctAnswer);

    const evidence = create('p', 'daily-life-response-evidence');
    evidence.append(create('strong', null, 'Evidence: '), document.createTextNode(question.evidence));
    const explanation = create('p', 'daily-life-response-explanation');
    explanation.append(create('strong', null, 'Explanation: '), document.createTextNode(question.explanation));

    response.append(status, answers, evidence, explanation);
    return response;
  };

  const checkAnswers = () => {
    if (state.locked || el.check.disabled) return;
    const set = currentSet();
    if (!set) return;

    state.locked = true;
    let setScore = 0;

    set.questions.forEach((question, questionIndex) => {
      const selectedId = state.selectedAnswers[question.id];
      const correctId = question.answer;
      const isCorrect = selectedId === correctId;
      const card = el.questionArea.querySelector(`.daily-life-question-card[data-question-id="${question.id}"]`);
      const response = card?.querySelector('.daily-life-response');

      if (isCorrect) {
        setScore += 1;
        state.sessionScore += 1;
      } else {
        state.wrongAnswers.push({
          setNumber: state.currentSetIndex + 1,
          questionNumber: question.number,
          passageTitle: set.title,
          prompt: question.prompt,
          studentAnswer: selectedId ? answerTextFor(question, selectedId) : 'No answer',
          correctAnswer: answerTextFor(question, correctId),
          evidence: question.evidence,
          explanation: question.explanation
        });
      }
      state.sessionAnswered += 1;

      if (card) {
        card.classList.add(isCorrect ? 'correct' : 'wrong');
        card.querySelectorAll('.daily-life-option').forEach((button) => {
          const optionId = button.dataset.optionId;
          button.disabled = true;
          button.classList.toggle('selected', optionId === selectedId);
          button.classList.toggle('correct', optionId === correctId);
          button.classList.toggle('wrong', optionId === selectedId && !isCorrect);
        });
      }

      if (response) {
        response.hidden = false;
        response.replaceChildren(buildResponseBlock(question, selectedId, correctId, isCorrect));
      }
    });

    state.setResults.push({
      setNumber: state.currentSetIndex + 1,
      title: set.title,
      score: setScore,
      total: set.questions.length
    });

    el.scoreCount.textContent = `${setScore} / ${set.questions.length}`;
    setProgress(((state.currentSetIndex + 1) / currentSets().length) * 100);
    el.feedback.replaceChildren(
      create('strong', null, `${setScore} of ${set.questions.length} correct.`),
      create('span', null, 'Check the evidence and explanation before moving to the next text.')
    );
    el.feedback.hidden = false;
    el.check.hidden = true;
    el.next.hidden = false;
    el.next.textContent = state.currentSetIndex === currentSets().length - 1 ? 'View Results ->' : 'Next Set ->';
    el.next.focus();
  };

  const makeStat = (label, value, className = '') => {
    const stat = create('div', `daily-life-review-stat ${className}`.trim());
    stat.append(create('span', null, label), create('strong', null, value));
    return stat;
  };

  const buildMistakeCard = (mistake) => {
    const card = create('article', 'daily-life-mistake-card');
    const meta = create('div', 'daily-life-mistake-meta');
    meta.append(
      create('span', null, `Set ${mistake.setNumber} - Question ${mistake.questionNumber}`),
      create('span', null, mistake.passageTitle)
    );

    const prompt = create('p', 'daily-life-mistake-prompt', mistake.prompt);
    const answers = create('div', 'daily-life-mistake-answers');
    const student = create('div');
    student.append(create('span', null, 'Your answer'), create('strong', 'wrong', mistake.studentAnswer || 'No answer'));
    const correct = create('div');
    correct.append(create('span', null, 'Correct answer'), create('strong', 'correct', mistake.correctAnswer));
    answers.append(student, correct);

    const evidence = create('p', 'daily-life-mistake-evidence');
    evidence.append(create('strong', null, 'Evidence: '), document.createTextNode(mistake.evidence));
    const explanation = create('p', 'daily-life-mistake-explanation');
    explanation.append(create('strong', null, 'Explanation: '), document.createTextNode(mistake.explanation));

    card.append(meta, prompt, answers, evidence, explanation);
    return card;
  };

  const buildReview = (totalQuestions, percentage) => {
    const review = create('section', 'daily-life-review');
    review.append(create('h4', null, 'Session Review'));

    const stats = create('div', 'daily-life-review-grid');
    stats.append(
      makeStat('Total questions', String(totalQuestions)),
      makeStat('Correct answers', String(state.sessionScore), 'correct'),
      makeStat('Wrong answers', String(state.wrongAnswers.length), 'wrong'),
      makeStat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(stats, create('p', 'daily-life-review-message', resultMessage(percentage)));

    if (state.wrongAnswers.length) {
      const list = create('div', 'daily-life-mistake-list');
      list.append(create('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach((mistake) => list.append(buildMistakeCard(mistake)));
      review.append(list);
    }
    return review;
  };

  const resultMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent work. You are reading the purpose, detail, and implied meaning very reliably.';
    if (percentage >= 70) return 'Strong work. Review the few choices where you needed a more precise clue from the text.';
    if (percentage >= 50) return 'A useful start. Re-read the sentence around each clue and compare the answer choices more carefully.';
    return 'Keep building the method. Read for purpose first, then use the exact detail in the text to guide your answer.';
  };

  const showResults = () => {
    const totalQuestions = currentSets().reduce((sum, set) => sum + set.questions.length, 0);
    const percentage = totalQuestions ? Math.round((state.sessionScore / totalQuestions) * 100) : 0;

    el.sessionTitle.textContent = 'Session review';
    el.examName.textContent = 'Finished';
    el.setCounter.textContent = 'Complete';
    el.scoreCount.textContent = `${state.sessionScore} / ${totalQuestions}`;
    setProgress(100);

    const result = create('div', 'completion-result');
    result.append(
      create('span', 'section-kicker', 'Daily-life sets complete'),
      create('strong', 'completion-result-score', `${state.sessionScore}/${totalQuestions}`),
      create('h3', null, `${percentage}% correct`),
      create('small', null, 'Restart to practise the same daily-life texts again.')
    );

    el.questionArea.replaceChildren(result, buildReview(totalQuestions, percentage));
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
    el.check.hidden = true;
    el.next.hidden = true;
    el.restart.focus();
  };

  const resetSession = () => {
    state.currentSetIndex = 0;
    state.selectedAnswers = {};
    state.locked = false;
    state.sessionScore = 0;
    state.sessionAnswered = 0;
    state.setResults = [];
    state.wrongAnswers = [];
    renderSet();
    el.restart.disabled = false;
  };

  const showLoadingState = () => {
    el.restart.disabled = true;
    el.sessionTitle.textContent = 'Loading practice...';
    el.examName.textContent = 'Preparing data';
    el.setCounter.textContent = 'Set -';
    el.scoreCount.textContent = '0 / 3';
    setProgress(0);
    const loading = create('div', 'practice-loading');
    loading.append(create('span', 'practice-loader'), create('p', null, 'Loading your daily-life reading texts...'));
    el.questionArea.replaceChildren(loading);
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
    el.check.hidden = true;
    el.next.hidden = true;
  };

  const showLoadingError = (error) => {
    el.restart.disabled = true;
    el.sessionTitle.textContent = 'Practice data unavailable';
    el.examName.textContent = 'Please retry';
    el.setCounter.textContent = 'Not loaded';
    el.scoreCount.textContent = '0 / 0';
    setProgress(0);

    const box = create('div', 'practice-load-error');
    box.append(
      create('span', 'practice-load-error-icon', '!'),
      create('h3', null, 'We could not load the daily-life reading sets.'),
      create('p', null, error?.message || 'Please check the dataset and try again.')
    );
    const retry = create('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', loadDataset);
    box.append(retry);
    el.questionArea.replaceChildren(box);
    el.feedback.hidden = true;
    el.check.hidden = true;
    el.next.hidden = true;
  };

  const validateDataset = (data) => {
    if (!Array.isArray(data)) throw new Error('Invalid dataset: read-in-daily-life.json must contain an array.');
    if (!data.length) throw new Error('Invalid dataset: read-in-daily-life.json is empty.');

    const requiredSetFields = ['id', 'examKey', 'exam', 'section', 'taskType', 'interfaceType', 'difficulty', 'title', 'textType', 'context', 'passage', 'questions', 'status'];
    const requiredQuestionFields = ['id', 'number', 'prompt', 'options', 'answer', 'evidence', 'explanation'];
    const requiredOptionFields = ['id', 'text'];

    data.forEach((set, index) => {
      const label = set?.id || `set ${index + 1}`;
      if (set?.status !== 'active') throw new Error(`Invalid dataset: ${label} must have status "active".`);
      if (set?.examKey !== 'toefl-ibt') throw new Error(`Invalid dataset: ${label} must use examKey "toefl-ibt".`);
      if (set?.section !== 'reading') throw new Error(`Invalid dataset: ${label} must use section "reading".`);
      if (set?.taskType !== 'read-in-daily-life') throw new Error(`Invalid dataset: ${label} must use taskType "read-in-daily-life".`);
      if (set?.interfaceType !== 'daily-life-reading') throw new Error(`Invalid dataset: ${label} must use interfaceType "daily-life-reading".`);

      const missingFields = requiredSetFields.filter((field) => set?.[field] === undefined || set?.[field] === null || set?.[field] === '');
      if (missingFields.length) throw new Error(`Invalid dataset: ${label} is missing ${missingFields.join(', ')}.`);
      if (!Array.isArray(set.questions) || set.questions.length !== 3) throw new Error(`Invalid dataset: ${label} must include exactly 3 questions.`);

      const questionNumbers = new Set();
      set.questions.forEach((question, questionIndex) => {
        const questionLabel = question?.id || `question ${questionIndex + 1}`;
        const missingQuestionFields = requiredQuestionFields.filter((field) => question?.[field] === undefined || question?.[field] === null || question?.[field] === '');
        if (missingQuestionFields.length) throw new Error(`Invalid dataset: ${label}, ${questionLabel} is missing ${missingQuestionFields.join(', ')}.`);
        if (question.number !== questionIndex + 1) throw new Error(`Invalid dataset: ${label}, ${questionLabel} must use question number ${questionIndex + 1}.`);
        if (questionNumbers.has(question.number)) throw new Error(`Invalid dataset: ${label} repeats question number ${question.number}.`);
        questionNumbers.add(question.number);
        if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error(`Invalid dataset: ${label}, ${questionLabel} must include exactly 4 options.`);

        const optionIds = new Set();
        question.options.forEach((option, optionIndex) => {
          const optionLabel = option?.id || `option ${optionIndex + 1}`;
          const missingOptionFields = requiredOptionFields.filter((field) => option?.[field] === undefined || option?.[field] === null || option?.[field] === '');
          if (missingOptionFields.length) throw new Error(`Invalid dataset: ${label}, ${questionLabel}, ${optionLabel} is missing ${missingOptionFields.join(', ')}.`);
          if (optionIds.has(option.id)) throw new Error(`Invalid dataset: ${label}, ${questionLabel} repeats option id ${option.id}.`);
          optionIds.add(option.id);
        });

        if (!optionIds.has(question.answer)) throw new Error(`Invalid dataset: ${label}, ${questionLabel} answer must match one option id.`);
      });
    });

    return data;
  };

  async function loadDataset() {
    showLoadingState();
    try {
      const response = await fetch(DATA_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${DATA_PATH} (${response.status}).`);
      state.data = validateDataset(await response.json());
      state.loaded = true;
      el.restart.disabled = false;
      resetSession();
    } catch (error) {
      console.error('Exam Verse TOEFL iBT Read in Daily Life dataset validation failed:', error);
      showLoadingError(error);
    }
  }

  const nextSet = () => {
    if (!state.locked) return;
    if (state.currentSetIndex >= currentSets().length - 1) {
      showResults();
      return;
    }

    state.currentSetIndex += 1;
    renderSet();
    el.questionArea.focus();
  };

  el.check.addEventListener('click', checkAnswers);
  el.next.addEventListener('click', nextSet);
  el.restart.addEventListener('click', resetSession);

  updateCheckState();
  loadDataset();
})();
