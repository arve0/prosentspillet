/**
 * Copyright Arve Seljebu
 *
 * http://jsbin.com/dafocu/edit
 */

var state = State();
var container = document.getElementsByClassName('container')[0];
var form = document.getElementsByTagName('form')[0];

// If hash upon load -> start game with given settings in hash
if (location.hash !== '') {
  loadHash();
} else {
  var btn = document.getElementById('start');
  btn.onclick = function () {
    var settings = readGameSettings();
    state.set('settings', settings);

    if (settings.names.length) {
      location.hash = '#' + btoa(JSON.stringify(state.get('settings')));
      startGame();
    }
  };
  form.addEventListener('click', preview);
  form.addEventListener('keyup', preview);
  preview();
  setGameSettings(state.get('settings'));
}

function preview () {
  state.set('settings', readGameSettings());
  var preview = document.getElementById('preview');
  var question = generateQuestion();
  question.title = 'Forhåndsvisning</h1><h1>' + question.title;
  preview.innerHTML = QuestionHTML(question, question.answer);
  preview.className = 'jumbotron';
}

// Any hashchange should reload game
window.addEventListener('hashchange', () => {
  if (location.hash === '') {
    location.reload();
  } else {
    loadHash();
  }
});

function loadHash () {
  try {
    var settings = JSON.parse(atob(location.hash.slice(1)));
    if (!settings.names.length) {
      throw new Error();
    }
    state.set('settings', settings);
    startGame();
  } catch (e) {
    // failed -> reset, hashchange event will reload page
    location.hash = '';
  }
}

// { comma: true, growth: true, reverse: false, from: 0, to: 100 }
function readGameSettings () {
  var inputs = ['comma', 'growth', 'reverse', 'from', 'to', 'timeout'];
  var settings = {};
  for (var key of inputs) {
    var el = document.getElementById(key);
    if (el.type === 'checkbox') {
      settings[key] = el.checked;
    } else if (el.type === 'number') {
      settings[key] = parseFloat(el.value);
    } else {
      settings[key] = el.value;
    }
  }

  // 'arve, knut' => [ {name: arve, count:0}, {name: knut, count:0} ]
  var input = document.getElementById('names');
  var names = input.value.split(/[,\n]/).map(n => n.trim()).filter(n => n !== '');
  names = names.map(n => ({ name: n, count: 0 }));
  settings.names = names;

  return settings;
}

/**
 * @param settings {object} Properties: comma, growth, reverse, from, to.
 */
function setGameSettings (settings) {
  for (var key in settings) {
    if (!settings.hasOwnProperty(key)) {
      continue;
    }
    try {
      if (typeof settings[key] === 'boolean') {
        document.getElementById(key).checked = settings[key];
      } else if (key === 'names') {
        document.getElementById(key).innerHTML = settings[key].map(n => n.name).join('\n');
      } else {
        document.getElementById(key).value = settings[key];
      }
    } catch (e) {
      // if document.getElementById returns null
      console.error(e);
    }
  }
}

function startGame () {
  form.removeEventListener('click', preview);
  form.removeEventListener('keyup', preview);
  container.innerHTML = '';
  container.appendChild(Game());
}

function Game () {
  var el = document.createElement('div');

  var question = Question();
  el.appendChild(question.el);

  el.appendChild(WrongBtn());
  el.appendChild(CorrectBtn());
  el.appendChild(ResetBtn());

  function WrongBtn () {
    var el = document.createElement('button');
    el.innerHTML = 'Feil';
    el.classList = 'btn btn-danger';
    el.onclick = question.wrong;
    return el;
  }

  function CorrectBtn () {
    var el = document.createElement('button');
    el.innerHTML = 'Riktig';
    el.classList = 'btn btn-success';
    el.onclick = question.correct;
    return el;
  }

  function ResetBtn () {
    var el = document.createElement('button');
    el.innerHTML = 'Start nytt spill';
    el.classList = 'btn btn-primary';
    el.onclick = () => location.hash = '';
    return el;
  }

  return el;
}

function Question () {
  var settings = state.get('settings');
  var el = document.createElement('div');
  el.className = 'jumbotron';

  var question, answerTimeout;
  function next () {
    el.style.backgroundColor = '';
    question = generateQuestion();
    el.innerHTML = QuestionHTML(question);
    answerTimeout = setTimeout(wrong, settings.timeout * 1000);
  }

  function showAnswer () {
    clearTimeout(answerTimeout);  // if correct, cancel answer timeout
    el.innerHTML = QuestionHTML(question, question.answer);
    setTimeout(next, 1500);
  }

  // avoid double registration
  var debounce = Date.now() - 1500;
  function debounceOK () {
    if (Date.now() - debounce > 1500) {
      debounce = Date.now();
      return true;
    }
    return false;
  }

  function correct () {
    if (debounceOK()) {
      showAnswer();
      question.correct();
      el.style.backgroundColor = 'lightgreen';
    }
  }

  function wrong () {
    if (debounceOK()) {
      showAnswer();
      el.style.backgroundColor = '#f77';  // light red
    }
  }

  next();
  window.addEventListener('keydown', (event) => {
    if (event.keyCode === 82) {
      // r -> correct
      correct();
    }
    if (event.keyCode === 70) {
      // f -> wrong
      wrong();
    }
  });

  return { el, correct, wrong };
}

function generateQuestion () {
  var settings = state.get('settings');

  var factorType = settings.growth ? 'vekst':'prosent';
  var title = `Hva er ${factorType}faktoren?`;

  var lucky = pick(settings.names);

  // avoid several increases upon several keydown
  var countIfCorrect = lucky.count + 1;
  function correct () {
    lucky.count = countIfCorrect;
  }

  var percent = randomInteger(settings.from, settings.to);
  var text = percent;
  if (settings.comma) {
    percent += randomInteger(1, 9) / 10;
    text = percent;
  }
  text += ' %';

  var answer = percent / 100;
  if (settings.growth) {
    // vekstfaktor
    var up = randomInteger(0, 1);
    text += up ? ' oppgang' : ' nedgang';
    answer = up ? 1 + answer : 1 - answer;
  }
  answer = settings.comma ? answer.toFixed(3) : answer.toFixed(2);

  if (settings.reverse) {
    var temp = answer;
    answer = text;
    text = temp;
    title = `Hva er ${factorType}en til faktoren?`;
  }

  return { who: lucky.name, lucky, title, text, answer, correct };
}

function QuestionHTML (question, answer = '') {
  return `<div>
    <h1>${question.title}</h1><br>
    <h1>${question.who}</h1><br>
    <h1>${question.text} = ${answer}</h1><br>
  </div>`;
}

function State () {
  var state = retrieve();

  function retrieve () {
    try {
      return JSON.parse(localStorage.getItem('state')) || {};
    } catch (e) {
      return {};
    }
  }

  function set (key, val) {
    state[key] = val;
    localStorage.setItem('state', JSON.stringify(state));
  }

  function get (key) {
    return state[key];
  }

  return { retrieve: retrieve, set: set, get: get };
}

function pick (arr) {
  var counts = arr.map(item => item.count);
  var min = counts.reduce((m, c) => c < m ? c : m, counts[0]);
  var filtered = arr.filter(item => item.count === min);
  var r = Math.random() * filtered.length;
  var lucky = filtered[Math.floor(r)];
  return lucky;
}

/**
 * Range is including from and to.
 */
function randomInteger (from, to) {
  var diff = Math.abs(to - from ) + 1;
  var r = Math.random() * diff + from;
  return Math.floor(r);
}
