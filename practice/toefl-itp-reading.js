(() => {
  'use strict';

  const DATA_PATH = '../data/toefl-itp/reading/reading-comprehension.json';

  const state = {
    data: [],
    currentSetIndex: 0,
    selectedAnswers: {},
    locked: false,
    sessionScore: 0,
    wrongAnswers: []
  };

  const el = {
    sessionTitle: document.querySelector('#reading-session-title'),
    examName: document.querySelector('#reading-exam-name'),
    setCounter: document.querySelector('#reading-set-counter'),
    scoreCount: document.querySelector('#reading-score-count'),
    progress: document.querySelector('#reading-progress'),
    progressBar: document.querySelector('#reading-progress-bar'),
    questionArea: document.querySelector('#reading-question-area'),
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

  const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const currentSet = () => state.data[state.currentSetIndex];
  const answerTextFor = (question, id) => question.options.find((option) => option.id === id)?.text || id || 'No answer';

  const setProgress = (value) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    el.progressBar.style.width = `${safeValue}%`;
    el.progress.setAttribute('aria-valuenow', String(safeValue));
  };

  const updateCheckState = () => {
    const set = currentSet();
    const allAnswered = Boolean(set && set.questions.every((question) => normalize(state.selectedAnswers[question.id])));
    el.check.disabled = state.locked || !allAnswered;
  };

  const updateHeader = () => {
    const set = currentSet();
    if (!set) return;
    el.sessionTitle.textContent = set.title;
    el.examName.textContent = `${set.discipline} - ${set.difficulty}`;
    el.setCounter.textContent = `Set ${state.currentSetIndex + 1} of ${state.data.length}`;
    el.scoreCount.textContent = `0 / ${set.questions.length}`;
    setProgress((state.currentSetIndex / state.data.length) * 100);
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

  const renderParagraphs = (passage, container) => {
    String(passage)
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => container.append(create('p', 'daily-life-passage', part)));
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
      create('h3', null, question.question)
    );

    const optionGrid = create('div', 'daily-life-option-grid');
    question.options.forEach((option) => optionGrid.append(makeOptionButton(question, option)));

    const response = create('div', 'daily-life-response');
    response.hidden = true;

    card.append(header, optionGrid, response);
    return card;
  };

  const buildResponseBlock = (question, selectedId, correctId, isCorrect) => {
    const response = create('div', 'daily-life-response');
    const status = create('div', `daily-life-response-status ${isCorrect ? 'correct' : 'wrong'}`, isCorrect ? 'Correct' : 'Not quite');
    const answers = create('div', 'daily-life-response-answers');

    const yourAnswer = create('div');
    yourAnswer.append(
      create('span', null, 'Your answer'),
      create('strong', isCorrect ? 'correct' : 'wrong', selectedId ? answerTextFor(question, selectedId) : 'No answer')
    );

    const correctAnswer = create('div');
    correctAnswer.append(
      create('span', null, 'Correct answer'),
      create('strong', 'correct', answerTextFor(question, correctId))
    );

    answers.append(yourAnswer, correctAnswer);

    const evidence = create('p', 'daily-life-response-evidence');
    evidence.append(create('strong', null, 'Evidence: '), document.createTextNode(question.evidence));

    const explanation = create('p', 'daily-life-response-explanation');
    explanation.append(create('strong', null, 'Explanation: '), document.createTextNode(question.explanation));

    response.append(status, answers, evidence, explanation);
    return response;
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
    el.next.textContent = 'Next Passage ->';

    const top = create('div', 'completion-content-top');
    top.append(
      create('span', 'completion-difficulty', set.difficulty),
      create('span', 'completion-type', set.discipline),
      create('span', 'completion-word-limit', '5 questions')
    );

    const passageCard = create('section', 'completion-passage-card daily-life-text-card');
    passageCard.append(
      create('span', 'section-kicker', 'Reading passage'),
      create('h3', 'completion-passage-title', set.title)
    );
    renderParagraphs(set.passage, passageCard);

    const questionList = create('section', 'daily-life-question-list');
    set.questions.forEach((question) => questionList.append(renderQuestionCard(question)));

    el.questionArea.replaceChildren(top, passageCard, questionList);
    updateCheckState();
  };

  const checkAnswers = () => {
    if (state.locked || el.check.disabled) return;
    const set = currentSet();
    if (!set) return;

    state.locked = true;
    let setScore = 0;

    set.questions.forEach((question) => {
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
          questionText: question.question,
          studentAnswer: selectedId ? answerTextFor(question, selectedId) : 'No answer',
          correctAnswer: answerTextFor(question, correctId),
          evidence: question.evidence,
          explanation: question.explanation
        });
      }

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

    el.scoreCount.textContent = `${setScore} / ${set.questions.length}`;
    setProgress(((state.currentSetIndex + 1) / state.data.length) * 100);
    el.feedback.replaceChildren(
      create('strong', null, `${setScore} of ${set.questions.length} correct.`),
      create('span', null, 'Review the evidence and explanations before moving to the next passage.')
    );
    el.feedback.hidden = false;
    el.check.hidden = true;
    el.next.hidden = false;
    el.next.textContent = state.currentSetIndex === state.data.length - 1 ? 'View Results ->' : 'Next Passage ->';
    el.next.focus();
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
    result.append(
      create('span', 'section-kicker', 'Reading review'),
      create('strong', 'completion-result-score', `${state.sessionScore}/${total}`),
      create('h3', null, `${percentage}% correct`),
      create('small', null, 'Restart to practice these passages again.')
    );

    const review = create('section', 'daily-life-review');
    const stats = create('div', 'daily-life-review-grid');
    stats.append(
      makeStat('Total questions', String(total)),
      makeStat('Correct answers', String(state.sessionScore), 'correct'),
      makeStat('Wrong answers', String(state.wrongAnswers.length), 'wrong'),
      makeStat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(create('h4', null, 'Session Review'), stats);

    if (state.wrongAnswers.length) {
      const list = create('div', 'daily-life-mistake-list');
      list.append(create('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach((mistake) => {
        const card = create('article', 'daily-life-mistake-card');
        const meta = create('div', 'daily-life-mistake-meta');
        meta.append(
          create('span', null, `Set ${mistake.setNumber} - Question ${mistake.questionNumber}`),
          create('span', null, mistake.passageTitle)
        );
        const answers = create('div', 'daily-life-mistake-answers');
        const yours = create('div');
        yours.append(create('span', null, 'Your answer'), create('strong', 'wrong', mistake.studentAnswer));
        const correct = create('div');
        correct.append(create('span', null, 'Correct answer'), create('strong', 'correct', mistake.correctAnswer));
        answers.append(yours, correct);
        const evidence = create('p', 'daily-life-mistake-evidence');
        evidence.append(create('strong', null, 'Evidence: '), document.createTextNode(mistake.evidence));
        const explanation = create('p', 'daily-life-mistake-explanation');
        explanation.append(create('strong', null, 'Explanation: '), document.createTextNode(mistake.explanation));
        card.append(meta, create('p', 'daily-life-mistake-prompt', mistake.questionText), answers, evidence, explanation);
        list.append(card);
      });
      review.append(list);
    }

    el.questionArea.replaceChildren(result, review);
    el.feedback.hidden = true;
    el.check.hidden = true;
    el.next.hidden = true;
  };

  const validateDataset = (data) => {
    if (!Array.isArray(data)) throw new Error('The reading dataset must be an array.');
    if (!data.length) throw new Error('The reading dataset must not be empty.');

    const seenSetIds = new Set();

    data.forEach((set, setIndex) => {
      const label = set?.id || `set ${setIndex + 1}`;
      const required = ['id', 'examKey', 'exam', 'section', 'taskType', 'interfaceType', 'difficulty', 'discipline', 'title', 'passage', 'questions', 'status'];
      const missing = required.filter((field) => set?.[field] === undefined || set?.[field] === null || set?.[field] === '');
      if (missing.length) throw new Error(`${label} is missing ${missing.join(', ')}.`);
      if (seenSetIds.has(set.id)) throw new Error(`Duplicate set id found: ${set.id}.`);
      seenSetIds.add(set.id);
      if (set.status !== 'active') throw new Error(`${label} must have status "active".`);
      if (set.examKey !== 'toefl-itp' || set.section !== 'reading' || set.taskType !== 'reading-comprehension' || set.interfaceType !== 'toefl-itp-reading-mcq') {
        throw new Error(`${label} has invalid metadata.`);
      }
      if (!Array.isArray(set.questions) || set.questions.length !== 5) throw new Error(`${label} must contain exactly five questions.`);

      const seenQuestionIds = new Set();
      set.questions.forEach((question, questionIndex) => {
        const questionLabel = `${label}, question ${questionIndex + 1}`;
        const questionRequired = ['id', 'number', 'skill', 'question', 'options', 'answer', 'evidence', 'explanation'];
        const missingQuestion = questionRequired.filter((field) => question?.[field] === undefined || question?.[field] === null || question?.[field] === '');
        if (missingQuestion.length) throw new Error(`${questionLabel} is missing ${missingQuestion.join(', ')}.`);
        if (!question.id.startsWith('itp-rc-q-')) throw new Error(`${questionLabel} must use the itp-rc-q- prefix.`);
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
    box.append(
      create('span', 'practice-load-error-icon', '!'),
      create('h3', null, 'We could not load the reading passages.'),
      create('p', null, error?.message || 'Please check the dataset and try again.')
    );
    const retry = create('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', loadDataset);
    box.append(retry);
    el.questionArea.replaceChildren(box);
    el.check.hidden = true;
    el.next.hidden = true;
  };

  function resetSession() {
    state.currentSetIndex = 0;
    state.selectedAnswers = {};
    state.locked = false;
    state.sessionScore = 0;
    state.wrongAnswers = [];
    renderSet();
    el.restart.disabled = false;
  }

  async function loadDataset() {
    el.restart.disabled = true;
    try {
      const response = await fetch(DATA_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${DATA_PATH} (${response.status}).`);
      state.data = validateDataset(await response.json());
      resetSession();
    } catch (error) {
      console.error('Exam Verse TOEFL ITP reading dataset validation failed:', error);
      showError(error);
    }
  }

  const nextPassage = () => {
    if (!state.locked) return;
    if (state.currentSetIndex === state.data.length - 1) {
      showResults();
      return;
    }
    state.currentSetIndex += 1;
    renderSet();
    el.questionArea.focus();
  };

  el.check.addEventListener('click', checkAnswers);
  el.next.addEventListener('click', nextPassage);
  el.restart.addEventListener('click', resetSession);
  loadDataset();
})();
