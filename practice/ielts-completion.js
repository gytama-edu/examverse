(() => {
  'use strict';

  const DATA_PATHS = {
    academic: '../data/ielts-academic/reading/completion.json',
    general: '../data/ielts-general/reading/completion.json'
  };

  const EXAM_CONFIG = {
    academic: {
      name: 'IELTS Academic',
      modeName: 'Academic',
      title: 'Academic Reading Completion',
      hub: '../pages/ielts-academic.html',
      hubLabel: 'Back to IELTS Academic Hub'
    },
    general: {
      name: 'IELTS General Training',
      modeName: 'General Training',
      title: 'General Training Reading Completion',
      hub: '../pages/ielts-general.html',
      hubLabel: 'Back to IELTS General Hub'
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
    loaded: false,
    wrongAnswers: []
  };

  const elements = {
    examCards: [...document.querySelectorAll('[data-exam]')],
    sessionTitle: document.querySelector('#completion-session-title'),
    examName: document.querySelector('#completion-exam-name'),
    setCounter: document.querySelector('#completion-set-counter'),
    scoreCount: document.querySelector('#completion-score-count'),
    progress: document.querySelector('#completion-progress'),
    progressBar: document.querySelector('#completion-progress-bar'),
    content: document.querySelector('#completion-question-area'),
    feedback: document.querySelector('#completion-feedback'),
    check: document.querySelector('#completion-check-answer'),
    next: document.querySelector('#completion-next-set'),
    restart: document.querySelector('#completion-restart'),
    hubLink: document.querySelector('#completion-hub-link'),
    hubLabel: document.querySelector('#completion-hub-label')
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const currentSets = () => state.datasets[state.exam] || [];
  const currentSet = () => currentSets()[state.currentSetIndex];
  const normalizeAnswer = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

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

  const updateCheckState = () => {
    const set = currentSet();
    elements.check.disabled = !set || set.blanks.some(blank => !normalizeAnswer(state.selectedAnswers[blank.id]));
  };

  const createBlankRow = (blank, blankIndex) => {
    const row = createElement('section', 'completion-blank-row');
    row.dataset.blank = blank.id;

    const heading = createElement('div', 'completion-blank-heading');
    heading.append(createElement('span', 'completion-blank-number', String(blankIndex + 1)), createElement('p', 'completion-prompt', blank.prompt));

    const inputId = `completion-answer-${state.currentSetIndex + 1}-${blank.id}`;
    const field = createElement('div', 'completion-field');
    const label = createElement('label', null, `Answer for blank ${blankIndex + 1}`);
    label.htmlFor = inputId;
    const input = createElement('input', 'completion-input');
    input.id = inputId;
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.blank = blank.id;
    input.placeholder = 'Type your answer';
    input.addEventListener('input', () => {
      state.selectedAnswers[blank.id] = input.value;
      updateCheckState();
    });
    field.append(label, input);
    row.append(heading, field);
    return row;
  };

  const renderSet = () => {
    const sets = currentSets();
    const set = currentSet();
    if (!set) {
      showResults();
      return;
    }

    state.selectedAnswers = {};
    state.answered = false;
    updateExamUi();
    elements.setCounter.textContent = `Set ${state.currentSetIndex + 1} of ${sets.length}`;
    elements.scoreCount.textContent = `${state.score} / ${state.totalAnswered}`;
    setProgress((state.currentSetIndex / sets.length) * 100);
    elements.feedback.hidden = true;
    elements.feedback.replaceChildren();
    elements.check.hidden = false;
    elements.check.disabled = true;
    elements.next.hidden = true;
    elements.next.textContent = 'Next Set →';

    const top = createElement('div', 'completion-content-top');
    top.append(
      createElement('span', 'completion-difficulty', set.difficulty),
      createElement('span', 'completion-type', set.completionType),
      createElement('span', 'completion-word-limit', set.wordLimit)
    );

    const passage = createElement('section', 'completion-passage-card');
    passage.setAttribute('aria-labelledby', 'current-completion-passage');
    passage.append(
      createElement('span', 'section-kicker', 'Reading passage'),
      createElement('h3', 'completion-passage-title', set.passageTitle),
      createElement('p', 'completion-passage-text', set.passage)
    );
    passage.querySelector('h3').id = 'current-completion-passage';

    const task = createElement('section', 'completion-task-card');
    const taskHeader = createElement('header', 'completion-task-header');
    const taskCopy = createElement('div');
    taskCopy.append(createElement('span', null, set.completionType), createElement('h3', null, 'Complete the task'));
    const limit = createElement('div', 'completion-limit-box');
    limit.append(createElement('span', null, 'Word limit'), createElement('strong', null, set.wordLimit));
    taskHeader.append(taskCopy, limit);
    task.append(taskHeader, createElement('p', 'completion-instructions', set.instructions));

    const blanks = createElement('div', 'completion-blank-list');
    set.blanks.forEach((blank, blankIndex) => blanks.append(createBlankRow(blank, blankIndex)));
    task.append(blanks);
    elements.content.replaceChildren(top, passage, task);
  };

  const checkAnswers = () => {
    if (state.answered || elements.check.disabled) return;
    const set = currentSet();
    let setScore = 0;
    state.answered = true;

    set.blanks.forEach((blank, blankIndex) => {
      const selectedAnswer = String(state.selectedAnswers[blank.id] ?? '').trim();
      const acceptedAnswers = blank.answers.map(normalizeAnswer);
      const correct = acceptedAnswers.includes(normalizeAnswer(selectedAnswer));
      if (correct) {
        state.score += 1;
        setScore += 1;
      } else {
        state.wrongAnswers.push({
          setNumber: state.currentSetIndex + 1,
          blankNumber: blankIndex + 1,
          passageTitle: set.passageTitle,
          studentAnswer: selectedAnswer,
          correctAnswer: blank.answers[0],
          evidence: blank.evidence,
          explanation: blank.explanation
        });
      }
      state.totalAnswered += 1;

      const row = elements.content.querySelector(`.completion-blank-row[data-blank="${blank.id}"]`);
      const input = row.querySelector('.completion-input');
      row.classList.add(correct ? 'correct' : 'wrong');
      input.classList.add(correct ? 'correct' : 'wrong');
      input.readOnly = true;
      input.setAttribute('aria-invalid', String(!correct));

      const note = createElement('div', 'completion-answer-note');
      note.append(createElement('strong', null, correct ? 'Correct answer' : `Correct answer: ${blank.answers[0]}`));
      const evidence = createElement('div', 'completion-evidence');
      evidence.append(createElement('span', null, 'Evidence'), createElement('p', null, blank.evidence));
      const explanation = createElement('div', 'completion-explanation');
      explanation.append(createElement('span', null, 'Why it works'), createElement('p', null, blank.explanation));
      row.append(note, evidence, explanation);
    });

    elements.scoreCount.textContent = `${state.score} / ${state.totalAnswered}`;
    setProgress(((state.currentSetIndex + 1) / currentSets().length) * 100);
    elements.feedback.replaceChildren(
      createElement('strong', null, `${setScore} of ${set.blanks.length} answers correct.`),
      createElement('span', null, 'Review the evidence and spelling before continuing.')
    );
    elements.feedback.hidden = false;
    elements.check.hidden = true;
    elements.next.hidden = false;
    elements.next.textContent = state.currentSetIndex === currentSets().length - 1 ? 'View Results →' : 'Next Set →';
    elements.next.focus();
  };

  const nextSet = () => {
    if (!state.answered) return;
    if (state.currentSetIndex >= currentSets().length - 1) {
      showResults();
      return;
    }
    state.currentSetIndex += 1;
    renderSet();
    elements.content.focus();
  };

  const resultMessage = percentage => {
    if (percentage >= 90) return 'Excellent precision. You are locating evidence and controlling word form very reliably.';
    if (percentage >= 70) return 'Strong work. Review the few answers where spelling, word limits, or nearby grammar caused trouble.';
    if (percentage >= 50) return 'A useful start. Return to each evidence sentence and notice how the answer fits the blank.';
    return 'Keep building the method. Find the evidence first, then check spelling and grammar before you type.';
  };

  const makeStat = (label, value, className = '') => {
    const stat = createElement('div', `completion-review-stat ${className}`.trim());
    stat.append(createElement('span', null, label), createElement('strong', null, value));
    return stat;
  };

  const buildMistake = mistake => {
    const card = createElement('article', 'completion-mistake-card');
    const meta = createElement('div', 'completion-mistake-meta');
    meta.append(createElement('span', null, `Set ${mistake.setNumber} · Blank ${mistake.blankNumber}`), createElement('span', null, mistake.passageTitle));

    const answers = createElement('div', 'completion-mistake-answers');
    const student = createElement('div');
    student.append(createElement('span', null, 'Your answer'), createElement('strong', 'wrong', mistake.studentAnswer || 'No answer'));
    const correct = createElement('div');
    correct.append(createElement('span', null, 'Correct answer'), createElement('strong', 'correct', mistake.correctAnswer));
    answers.append(student, correct);

    const evidence = createElement('p', 'completion-mistake-evidence');
    evidence.append(createElement('strong', null, 'Evidence: '), document.createTextNode(mistake.evidence));
    const explanation = createElement('p', 'completion-mistake-explanation');
    explanation.append(createElement('strong', null, 'Explanation: '), document.createTextNode(mistake.explanation));
    card.append(meta, answers, evidence, explanation);
    return card;
  };

  const buildReview = (total, percentage) => {
    const review = createElement('section', 'completion-review');
    review.append(createElement('h4', null, 'Session Review'));
    const grid = createElement('div', 'completion-review-grid');
    grid.append(
      makeStat('Total blanks', String(total)),
      makeStat('Correct answers', String(state.score), 'correct'),
      makeStat('Wrong answers', String(state.wrongAnswers.length), 'wrong'),
      makeStat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(grid, createElement('p', 'completion-review-message', resultMessage(percentage)));

    if (state.wrongAnswers.length) {
      const list = createElement('div', 'completion-mistake-list');
      list.append(createElement('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach(mistake => list.append(buildMistake(mistake)));
      review.append(list);
    }
    return review;
  };

  const showResults = () => {
    const total = currentSets().reduce((sum, set) => sum + set.blanks.length, 0);
    const percentage = total ? Math.round((state.score / total) * 100) : 0;
    elements.setCounter.textContent = 'Session complete';
    elements.scoreCount.textContent = `${state.score} / ${total}`;
    setProgress(100);

    const result = createElement('div', 'completion-result');
    result.append(
      createElement('span', 'section-kicker', 'Completion sets complete'),
      createElement('strong', 'completion-result-score', `${state.score}/${total}`),
      createElement('h3', null, `${percentage}% correct`),
      createElement('small', null, 'Restart to practise the same passages and blanks again.')
    );
    elements.content.replaceChildren(result, buildReview(total, percentage));
    elements.feedback.hidden = true;
    elements.feedback.replaceChildren();
    elements.check.hidden = true;
    elements.next.hidden = true;
    elements.restart.focus();
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

  const showLoadingState = () => {
    elements.restart.disabled = true;
    elements.check.hidden = true;
    elements.next.hidden = true;
    elements.setCounter.textContent = 'Loading set…';
    elements.scoreCount.textContent = '0 / 0';
    setProgress(0);
    const loading = createElement('div', 'practice-loading');
    loading.append(createElement('span', 'practice-loader'), createElement('p', null, `Loading ${EXAM_CONFIG[state.exam].name} completion sets…`));
    elements.content.replaceChildren(loading);
    elements.feedback.hidden = true;
  };

  const showLoadingError = (exam, error) => {
    elements.restart.disabled = true;
    elements.sessionTitle.textContent = 'Practice data unavailable';
    elements.examName.textContent = 'Please retry';
    elements.setCounter.textContent = 'Not loaded';
    elements.scoreCount.textContent = '0 / 0';
    setProgress(0);
    const errorBox = createElement('div', 'practice-load-error');
    errorBox.append(
      createElement('span', 'practice-load-error-icon', '!'),
      createElement('h3', null, 'We could not load the completion sets.'),
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
    const expectedPrefix = exam === 'academic' ? 'ielts-ac-comp-' : 'ielts-gt-comp-';
    const dataPath = DATA_PATHS[exam].replace('../', '');
    const requiredSetFields = ['id', 'examKey', 'exam', 'section', 'questionType', 'interfaceType', 'difficulty', 'completionType', 'passageTitle', 'passage', 'instructions', 'wordLimit', 'blanks', 'status'];

    if (!Array.isArray(data)) throw new Error(`Invalid dataset: ${dataPath} must contain a JSON array.`);
    if (!data.length) throw new Error(`Invalid dataset: ${dataPath} is empty.`);

    data.forEach((set, setIndex) => {
      const setLabel = set?.id || `set ${setIndex + 1}`;
      if (set?.status !== 'active') throw new Error(`Invalid dataset: ${setLabel} must have status "active".`);
      if (set?.examKey !== exam) {
        const receivedMode = EXAM_CONFIG[set?.examKey]?.modeName || `unidentified (${set?.examKey ?? 'missing examKey'})`;
        throw new Error(`Dataset mismatch: ${EXAM_CONFIG[exam].modeName} mode received ${receivedMode} data. Please check ${dataPath}.`);
      }

      const missingFields = requiredSetFields.filter(field => {
        const value = set?.[field];
        return value === undefined || value === null || value === '';
      });
      if (missingFields.length) throw new Error(`Invalid dataset: ${setLabel} is missing ${missingFields.join(', ')}.`);
      if (!set.id.startsWith(expectedPrefix)) throw new Error(`Invalid dataset: ${setLabel} must start with "${expectedPrefix}".`);
      if (!Array.isArray(set.blanks) || !set.blanks.length) throw new Error(`Invalid dataset: ${setLabel} must include at least one blank.`);

      set.blanks.forEach((blank, blankIndex) => {
        const blankLabel = blank?.id || `blank ${blankIndex + 1}`;
        if (!blank?.id || !blank?.prompt || !blank?.evidence || !blank?.explanation) {
          throw new Error(`Invalid dataset: ${setLabel}, ${blankLabel} must include id, prompt, evidence, and explanation.`);
        }
        if (!Array.isArray(blank.answers) || !blank.answers.length || blank.answers.some(answer => !normalizeAnswer(answer))) {
          throw new Error(`Invalid dataset: ${setLabel}, ${blankLabel} must include at least one accepted answer.`);
        }
      });
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
      console.error(`Exam Verse IELTS Completion dataset validation failed for ${exam}:`, error);
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
  elements.check.addEventListener('click', checkAnswers);
  elements.next.addEventListener('click', nextSet);
  elements.restart.addEventListener('click', resetSession);

  updateExamUi();
  loadExamDataset(state.exam);
})();
