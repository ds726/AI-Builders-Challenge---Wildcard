'use strict';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
var SCENARIO_CONFIG = {
  workload: {
    title: 'Workload & Capacity - Talk to Your Manager',
    persona: 'Your Manager'
  },
  mentalhealth: {
    title: 'Mental Health & Burnout - Talk to Your Manager',
    persona: 'Your Manager'
  },
  conflict: {
    title: 'Colleague Conflict - Talk to Your Colleague',
    persona: 'Your Colleague'
  }
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
var scenario = '';
var persona = '';
var messages = []; // [{ role: 'user'|'assistant', content: string }]
var isSending = false;

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
var scenarioTitle    = document.getElementById('scenarioTitle');
var disclaimerBanner = document.getElementById('disclaimerBanner');
var btnDismiss       = document.getElementById('btnDismiss');
var chatMessages     = document.getElementById('chatMessages');
var typingRow        = document.getElementById('typingRow');
var chatInput        = document.getElementById('chatInput');
var btnSend          = document.getElementById('btnSend');
var btnEnd           = document.getElementById('btnEnd');
var errorMsg         = document.getElementById('errorMsg');

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
(function init() {
  var params = new URLSearchParams(window.location.search);
  scenario = params.get('scenario') || '';

  var config = SCENARIO_CONFIG[scenario];
  if (!config) {
    scenarioTitle.textContent = 'Unknown scenario';
    showError('Invalid scenario. Please go back and choose one.');
    return;
  }

  scenarioTitle.textContent = config.title;
  persona = config.persona;

  if (scenario === 'mentalhealth') {
    disclaimerBanner.classList.remove('hidden');
    // Keep input locked until user dismisses
  } else {
    enableInput();
  }
})();

// ---------------------------------------------------------------------------
// Disclaimer dismiss
// ---------------------------------------------------------------------------
btnDismiss.addEventListener('click', function () {
  disclaimerBanner.classList.add('hidden');
  enableInput();
});

// ---------------------------------------------------------------------------
// Send message
// ---------------------------------------------------------------------------
btnSend.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-grow textarea
chatInput.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

function sendMessage() {
  var text = chatInput.value.trim();
  if (!text || isSending) return;

  appendBubble('user', 'You', text);
  messages.push({ role: 'user', content: text });
  chatInput.value = '';
  chatInput.style.height = 'auto';

  setLoading(true);
  hideError();

  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: scenario, messages: messages })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      setLoading(false);
      if (data.error) {
        showError(data.error);
      } else {
        appendBubble('ai', persona, data.reply);
        messages.push({ role: 'assistant', content: data.reply });
      }
    })
    .catch(function () {
      setLoading(false);
      showError('Could not reach the server. Please check your connection and try again.');
    });
}

// ---------------------------------------------------------------------------
// End conversation
// ---------------------------------------------------------------------------
btnEnd.addEventListener('click', function () {
  if (messages.length === 0) {
    if (!confirm('You haven\'t sent any messages yet. Are you sure you want to end?')) return;
  }
  sessionStorage.setItem('cc_messages', JSON.stringify(messages));
  sessionStorage.setItem('cc_scenario', scenario);
  window.location.href = 'reflection.html';
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function appendBubble(type, sender, text) {
  var isUser = type === 'user';

  var row = document.createElement('div');
  row.className = 'bubble-row' + (isUser ? ' bubble-row--user' : '');

  var col = document.createElement('div');
  col.className = 'bubble-col';

  var senderEl = document.createElement('div');
  senderEl.className = 'bubble-sender';
  senderEl.textContent = sender;

  var bubble = document.createElement('div');
  bubble.className = 'bubble ' + (isUser ? 'bubble--user' : 'bubble--ai');
  bubble.textContent = text;

  col.appendChild(senderEl);
  col.appendChild(bubble);
  row.appendChild(col);

  // Insert before the typing row
  chatMessages.insertBefore(row, typingRow);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setLoading(loading) {
  isSending = loading;
  typingRow.style.display = loading ? 'flex' : 'none';
  chatInput.disabled = loading;
  btnSend.disabled = loading;
  if (!loading) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.focus();
  }
}

function enableInput() {
  chatInput.disabled = false;
  btnSend.disabled = false;
  chatInput.focus();
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
}
