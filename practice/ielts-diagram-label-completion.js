(() => {
  'use strict';

  const DATA_PATHS = {
    academic: '../data/ielts-academic/reading/diagram-label-completion.json',
    general: '../data/ielts-general/reading/diagram-label-completion.json'
  };

  const EXAM_CONFIG = {
    academic: {
      name: 'IELTS Academic',
      modeName: 'Academic',
      title: 'Academic Diagram Label Completion',
      hub: '../pages/ielts-academic.html',
      hubLabel: 'Back to IELTS Academic Hub',
      prefix: 'ielts-ac-dlc-'
    },
    general: {
      name: 'IELTS General Training',
      modeName: 'General Training',
      title: 'General Training Diagram Label Completion',
      hub: '../pages/ielts-general.html',
      hubLabel: 'Back to IELTS General Hub',
      prefix: 'ielts-gt-dlc-'
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
    sessionTitle: document.querySelector('#dlc-session-title'),
    examName: document.querySelector('#dlc-exam-name'),
    setCounter: document.querySelector('#dlc-set-counter'),
    scoreCount: document.querySelector('#dlc-score-count'),
    progress: document.querySelector('#dlc-progress'),
    progressBar: document.querySelector('#dlc-progress-bar'),
    area: document.querySelector('#dlc-question-area'),
    feedback: document.querySelector('#dlc-feedback'),
    check: document.querySelector('#dlc-check-answer'),
    next: document.querySelector('#dlc-next-set'),
    restart: document.querySelector('#dlc-restart'),
    hub: document.querySelector('#dlc-hub-link'),
    hubLabel: document.querySelector('#dlc-hub-label')
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
    return Boolean(set && set.labels.every((label) => normalizeAnswer(state.selectedAnswers[label.id])));
  };

  const updateCheckButton = () => {
    el.check.disabled = state.answered || !allAnswered();
  };

  const positionClass = (position) => `diagram-label--${String(position || '').toLowerCase().replace(/\s+/g, '-')}`;

  const labelRow = (label, index) => {
    const row = make('div', `completion-flow-step diagram-label ${positionClass(label.position)}`);
    row.dataset.label = label.id;

    const labelHead = make('div', 'completion-flow-label');
    labelHead.append(make('span', null, String(index + 1)));
    const labelText = make('div', 'diagram-label-text');
    labelText.append(
      make('strong', null, label.labelText),
      make('p', null, `Position: ${label.position.replace(/-/g, ' ')}`)
    );
    labelHead.append(labelText);

    const inputWrap = make('div', 'diagram-label-input-wrap');
    const inputId = `diagram-answer-${state.currentSetIndex + 1}-${label.id}`;
    const input = make('input', 'completion-input diagram-label-input');
    input.id = inputId;
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.labelId = label.id;
    input.placeholder = 'Type label';
    input.setAttribute('aria-label', `Label ${index + 1}: ${label.labelText}`);
    input.addEventListener('input', () => {
      state.selectedAnswers[label.id] = input.value;
      updateCheckButton();
    });
    inputWrap.append(input);

    row.append(labelHead, inputWrap);
    return row;
  };

  const renderDiagram = (set) => {
    const diagram = make('div', 'diagram-card');
    const frame = make('div', `diagram-stage diagram-type-${set.diagramType || 'schematic'}`);
    frame.append(
      make('div', 'diagram-node diagram-node--left', set.diagramTitle),
      make('div', 'diagram-node diagram-node--top', 'Input'),
      make('div', 'diagram-node diagram-node--center', 'SYSTEM'),
      make('div', 'diagram-node diagram-node--bottom', 'Output')
    );
    diagram.append(make('span', 'section-kicker', 'Diagram schematic'), make('h3', 'diagram-title', set.diagramTitle), frame);
    return diagram;
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
      make('span', 'completion-type', 'Diagram'),
      make('span', 'completion-word-limit', set.wordLimit)
    );

    const passage = make('section', 'completion-passage-card');
    passage.setAttribute('aria-labelledby', 'current-diagram-passage');
    passage.append(
      make('span', 'section-kicker', 'Reading passage'),
      make('h3', 'completion-passage-title', set.passageTitle),
      make('p', 'completion-passage-text', set.passage)
    );
    passage.querySelector('h3').id = 'current-diagram-passage';

    const task = make('section', 'completion-task-card');
    const taskHeader = make('header', 'completion-task-header');
    const taskCopy = make('div');
    taskCopy.append(make('span', null, 'Diagram label completion'), make('h3', null, set.diagramTitle));
    const limit = make('div', 'completion-limit-box');
    limit.append(make('span', null, 'Word limit'), make('strong', null, set.wordLimit));
    taskHeader.append(taskCopy, limit);
    task.append(taskHeader, make('p', 'completion-instructions', set.instructions), renderDiagram(set));

    const labelList = make('div', 'diagram-label-list');
    set.labels.forEach((label, index) => labelList.append(labelRow(label, index)));
    task.append(labelList);
    el.area.replaceChildren(top, passage, task);
  };

  const acceptedText = (label) => label.answers[0];

  const checkAnswers = () => {
    if (state.answered || el.check.disabled) return;
    const set = currentSet();
    let setScore = 0;
    state.answered = true;

    set.labels.forEach((label, index) => {
      const selectedAnswer = String(state.selectedAnswers[label.id] ?? '').trim();
      const acceptedAnswers = label.answers.map(normalizeAnswer);
      const normalizedSelected = normalizeAnswer(selectedAnswer);
      const correct = acceptedAnswers.includes(normalizedSelected);
      if (correct) {
        state.score += 1;
        setScore += 1;
      } else {
        state.wrongAnswers.push({
          setNumber: state.currentSetIndex + 1,
          passageTitle: set.passageTitle,
          labelNumber: index + 1,
          labelText: label.labelText,
          studentAnswer: selectedAnswer,
          correctAnswer: acceptedText(label),
          evidence: label.evidence,
          explanation: label.explanation
        });
      }
      state.totalAnswered += 1;

      const row = el.area.querySelector(`.diagram-label[data-label="${CSS.escape(label.id)}"]`);
      const input = row.querySelector('.diagram-label-input');
      row.classList.add(correct ? 'correct' : 'wrong');
      input.classList.add(correct ? 'correct' : 'wrong');
      input.readOnly = true;
      input.setAttribute('aria-invalid', String(!correct));

      const note = make('div', 'completion-answer-note');
      note.append(make('strong', null, correct ? 'Correct answer' : `Correct answer: ${acceptedText(label)}`));
      const evidence = make('div', 'completion-evidence');
      evidence.append(make('span', null, 'Evidence'), make('p', null, label.evidence));
      const explanation = make('div', 'completion-explanation');
      explanation.append(make('span', null, 'Why it works'), make('p', null, label.explanation));
      row.append(note, evidence, explanation);
    });

    el.scoreCount.textContent = `${state.score} / ${state.totalAnswered}`;
    setProgress(((state.currentSetIndex + 1) / sets().length) * 100);
    el.feedback.replaceChildren(
      make('strong', null, `${setScore} of ${set.labels.length} answers correct.`),
      make('span', null, 'Review the diagram zones and the passage wording before continuing.')
    );
    el.feedback.hidden = false;
    el.check.hidden = true;
    el.next.hidden = false;
    el.next.textContent = state.currentSetIndex === sets().length - 1 ? 'View Results →' : 'Next Set →';
    el.next.focus();
  };

  const teacherMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent schematic control. You are tracing the diagram parts and labels accurately.';
    if (percentage >= 70) return 'Strong work. Recheck the few zones where the wording was easy to blur.';
    if (percentage >= 50) return 'A useful start. Follow each diagram section back to the matching sentence.';
    return 'Keep practising the method. Read the diagram first, then search for the exact label in the passage.';
  };

  const stat = (label, value, className = '') => {
    const item = make('div', `completion-review-stat ${className}`.trim());
    item.append(make('span', null, label), make('strong', null, String(value)));
    return item;
  };

  const mistakeCard = (mistake) => {
    const card = make('article', 'completion-mistake-card');
    const meta = make('div', 'completion-mistake-meta');
    meta.append(make('span', null, `Set ${mistake.setNumber} · Label ${mistake.labelNumber}`), make('span', null, mistake.passageTitle));
    const answers = make('div', 'completion-mistake-answers');
    const student = make('div');
    student.append(make('span', null, 'Your answer'), make('strong', 'wrong', mistake.studentAnswer || 'No answer'));
    const correct = make('div');
    correct.append(make('span', null, 'Correct answer'), make('strong', 'correct', mistake.correctAnswer));
    answers.append(student, correct);
    card.append(
      meta,
      make('p', 'diagram-mistake-label', mistake.labelText),
      answers,
      make('p', 'completion-mistake-evidence', `Evidence: ${mistake.evidence}`),
      make('p', 'completion-mistake-explanation', mistake.explanation)
    );
    return card;
  };

  const showResults = () => {
    const total = sets().reduce((sum, set) => sum + set.labels.length, 0);
    const percentage = total ? Math.round((state.score / total) * 100) : 0;
    el.setCounter.textContent = 'Session complete';
    el.scoreCount.textContent = `${state.score} / ${total}`;
    setProgress(100);

    const result = make('div', 'completion-result');
    result.append(
      make('span', 'section-kicker', 'Diagram sets complete'),
      make('strong', 'completion-result-score', `${state.score}/${total}`),
      make('h3', null, `${percentage}% correct`),
      make('small', null, 'Restart to practise the same passages and labels again.')
    );

    const review = make('section', 'completion-review');
    review.setAttribute('aria-label', 'Practice session review');
    review.append(make('h4', null, 'Session Review'));
    const grid = make('div', 'completion-review-grid');
    grid.append(
      stat('Total labels', total),
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

    const requiredFields = ['id', 'examKey', 'exam', 'section', 'questionType', 'interfaceType', 'difficulty', 'passageTitle', 'passage', 'instructions', 'wordLimit', 'diagramTitle', 'diagramType', 'labels', 'status'];
    data.forEach((set, index) => {
      const label = set?.id || `set ${index + 1}`;
      if (set?.status !== 'active') throw new Error(`Invalid dataset: ${label} must have status active.`);
      if (set?.examKey !== exam || set?.interfaceType !== 'diagram-label-completion') {
        throw new Error(`Dataset mismatch: ${config.modeName} diagram label completion mode received different data. Please check ${path}.`);
      }
      const missing = requiredFields.filter((field) => set?.[field] === undefined || set?.[field] === null || set?.[field] === '');
      if (missing.length) throw new Error(`Invalid dataset: ${label} is missing ${missing.join(', ')}.`);
      if (set.questionType !== 'Diagram Label Completion') throw new Error(`Invalid dataset: ${label} has the wrong questionType.`);
      if (!set.id.startsWith(config.prefix)) throw new Error(`Invalid dataset: ${label} has the wrong id prefix.`);
      if (!Array.isArray(set.labels)) throw new Error(`Invalid dataset: ${label} labels must be an array.`);
      if (set.labels.length !== 4) throw new Error(`Invalid dataset: ${label} must contain exactly 4 labels.`);

      const labelIds = new Set();
      set.labels.forEach((entry, entryIndex) => {
        const entryLabel = `${label} label ${entryIndex + 1}`;
        const missingLabelFields = ['id', 'position', 'labelText', 'answers', 'evidence', 'explanation'].filter((field) => entry?.[field] === undefined || entry?.[field] === null || entry?.[field] === '');
        if (missingLabelFields.length) throw new Error(`Invalid dataset: ${entryLabel} is missing ${missingLabelFields.join(', ')}.`);
        if (labelIds.has(entry.id)) throw new Error(`Invalid dataset: ${label} repeats label id ${entry.id}.`);
        labelIds.add(entry.id);
        if (!Array.isArray(entry.answers) || !entry.answers.length || entry.answers.some((answer) => !normalizeAnswer(answer))) {
          throw new Error(`Invalid dataset: ${entryLabel} must include at least one accepted answer.`);
        }
        if (entry.answers.some((answer) => normalizeAnswer(answer).split(/\s+/).filter(Boolean).length > 2)) {
          throw new Error(`Invalid dataset: ${entryLabel} has an accepted answer that exceeds the two-word limit.`);
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
    loading.append(spinner, make('p', null, `Loading ${EXAM_CONFIG[state.exam].modeName} diagram sets…`));
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
      make('h3', null, 'We could not load the diagram sets.'),
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
      console.error('Exam Verse IELTS Diagram Label Completion dataset validation failed:', error);
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
