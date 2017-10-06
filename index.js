/**
 * Copyright Arve Seljebu
 *
 * http://jsbin.com/dafocu/edit
 */

var state = State();
var container = document.getElementsByClassName('container')[0];
var form = document.getElementsByTagName('form')[0];

if (isStartPage()) {
  var btn = document.getElementById('start');
  btn.onclick = function () {
    var settings = readGameSettings();
    state.set('settings', settings);

    if (settings.names.length) {
      location.hash = '#' + b64Encode(JSON.stringify(state.get('settings')));
      startGame();
    }
  };
  form.addEventListener('click', preview);
  form.addEventListener('keyup', preview);
  setGameSettings(state.get('settings'));
  preview();
} else {
  // If hash upon load -> start game with given settings in hash
  loadHash();
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
  if (isStartPage()) {
    location.reload();
  } else {
    loadHash();
  }
});

function loadHash () {
  try {
    var settings = JSON.parse(b64Decode(location.hash.slice(1)));
    if (!settings.names.length) {
      throw new Error();
    }
    state.set('settings', settings);
    startGame();
  } catch (e) {
    // failed -> reset, hashchange event will reload page
    console.error(e);
    setTimeout(() => location.hash = '', 1000);
  }
}

// { comma: true, growth: true, reverse: false, from: 0, to: 100 }
function readGameSettings () {
  var inputs = ['comma', 'growth', 'reverse', 'from', 'to', 'timeout'];
  var settings = {};
  inputs.forEach((key) => {
    var el = document.getElementById(key);
    if (el.type === 'checkbox') {
      settings[key] = el.checked;
    } else if (el.type === 'number') {
      settings[key] = parseFloat(el.value);
    } else {
      settings[key] = el.value;
    }
  });

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

  el.appendChild(ShowBtn());
  el.appendChild(WrongBtn());
  el.appendChild(CorrectBtn());
  el.appendChild(ResetBtn());

  function ShowBtn () {
    var el = document.createElement('button');
    el.innerHTML = 'Vis svar';
    el.classList.add('btn');
    el.classList.add('btn-info');
    el.onclick = question.show;
    return el;
  }

  function WrongBtn () {
    var el = document.createElement('button');
    el.innerHTML = 'Feil';
    el.classList.add('btn');
    el.classList.add('btn-danger');
    el.onclick = question.wrong;
    return el;
  }

  function CorrectBtn () {
    var el = document.createElement('button');
    el.innerHTML = 'Riktig';
    el.classList.add('btn');
    el.classList.add('btn-success');
    el.onclick = question.correct;
    return el;
  }

  function ResetBtn () {
    var el = document.createElement('button');
    el.innerHTML = 'Start nytt spill';
    el.classList.add('btn');
    el.classList.add('btn-primary');
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
    setTimeout(next, 2000);
  }

  // avoid double registration
  var debounce = Date.now() - 2000;
  function debounceOK () {
    if (Date.now() - debounce > 2000) {
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

  function show () {
    if (debounceOK()) {
      el.innerHTML = QuestionHTML(question, question.answer);
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
    if (event.keyCode === 86) {
      // v -> vis
      show();
    }
  });

  return { el, correct, wrong, show };
}

function generateQuestion (retries) {
  if (retries > 100) {
    throw new Error('Unable to generate question, tried 100 times.');
  }
  var settings = state.get('settings');

  var factorType = settings.growth ? 'vekst':'prosent';
  var title = `Hva er ${factorType}faktoren?`;

  var namesRemaining = getNamesRemaining(settings.names)
  var lucky = pick(namesRemaining);

  // avoid several increases upon multiple keydowns / button clicks
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
  if (answer < 0) {
    console.warn('Answer below zero, generating new question');
    // try again, recursive
    return generateQuestion(++retries || 1);
  }
  answer = settings.comma ? answer.toFixed(3) : answer.toFixed(2);

  if (settings.reverse) {
    var temp = answer;
    answer = text;
    text = temp;
    title = `Hva er ${factorType}en til faktoren?`;
  }

  return { who: lucky.name, lucky, title, text, answer, correct, namesRemaining };
}

function QuestionHTML (question, answer = '') {
  return `<div>
    <h1>${question.title}</h1><br>
    <h1>${question.who}</h1><br>
    <h1>${question.text} = ${answer}</h1><br>
    <span>Gjenstår: ${question.namesRemaining.map(n => n.name).join(', ')}.</span>
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

function getNamesRemaining (arr) {
  var counts = arr.map(item => item.count);
  var min = counts.reduce((m, c) => c < m ? c : m, counts[0]);
  return arr.filter(item => item.count === min);
}

function pick (arr) {
  var r = Math.random() * arr.length;
  var lucky = arr[Math.floor(r)];
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

function isStartPage () {
  return !location.hash || location.hash === '' || location.hash === '#';
}

function b64Encode (str) {
    // first we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    }));
}

function b64Decode (str) {
    // Going backwards: from bytestream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}
