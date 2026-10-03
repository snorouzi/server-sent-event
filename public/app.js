const statusBox = document.getElementById('status');
const statusText = document.getElementById('status-text');
const clientsText = document.getElementById('clients');
const eventsList = document.getElementById('events');
const eventCount = document.getElementById('event-count');
const form = document.getElementById('send-form');
const messageInput = document.getElementById('message');
const typeInput = document.getElementById('type');
const sendButton = document.getElementById('send-button');
const sendStatus = document.getElementById('send-status');

const RECONNECT_DELAY = 3000;

let source = null;
let received = 0;

function setStatus(state, text) {
  statusBox.dataset.state = state;
  statusText.textContent = text;
}

function appendEvent(name, data) {
  const empty = eventsList.querySelector('.empty');
  if (empty) {
    empty.remove();
  }

  const item = document.createElement('li');
  item.className = 'event';

  const header = document.createElement('header');
  const label = document.createElement('span');
  label.className = 'name';
  label.textContent = name;
  const time = document.createElement('span');
  time.textContent = new Date().toLocaleTimeString();
  header.append(label, time);

  const body = document.createElement('pre');
  body.textContent = JSON.stringify(data, null, 2);

  item.append(header, body);
  eventsList.prepend(item);

  received += 1;
  eventCount.textContent = String(received);
}

function parsePayload(event) {
  try {
    return JSON.parse(event.data);
  } catch (error) {
    appendEvent(event.type, { error: 'Invalid JSON payload', raw: event.data });
    return undefined;
  }
}

function setClientCount(data) {
  if (typeof data?.clients === 'number') {
    clientsText.textContent = `clients: ${data.clients}`;
  }
}

function connect() {
  source = new EventSource('/events');

  source.addEventListener('open', () => setStatus('connected', 'Connected'));
  source.addEventListener('error', () => {
    if (source.readyState === EventSource.CLOSED) {
      setStatus('disconnected', 'Disconnected');
      setTimeout(connect, RECONNECT_DELAY);
      return;
    }
    setStatus('reconnecting', 'Reconnecting...');
  });
  source.addEventListener('clients', (event) => {
    const data = parsePayload(event);
    if (data !== undefined) {
      setClientCount(data);
    }
  });
  source.addEventListener('message', (event) => {
    const data = parsePayload(event);
    if (data !== undefined) {
      appendEvent('message', data);
    }
  });
}

function setSendStatus(text, isError = false) {
  sendStatus.textContent = text;
  sendStatus.dataset.error = String(isError);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  sendButton.disabled = true;

  try {
    const response = await fetch('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageInput.value,
        type: typeInput.value,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setSendStatus(`Error: ${result.message}`, true);
      return;
    }

    setSendStatus(
      `Broadcast to ${result.clients} connected client${
        result.clients === 1 ? '' : 's'
      }`,
    );
    messageInput.value = '';
    messageInput.focus();
  } catch (error) {
    setSendStatus(`Error: ${error}`, true);
  } finally {
    sendButton.disabled = false;
  }
});

connect();