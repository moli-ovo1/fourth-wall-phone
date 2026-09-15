const KEY = 'moli-phone:world-context:v1';

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : { contactId: '' };
  } catch { return { contactId: '' }; }
}
function write(state) { localStorage.setItem(KEY, JSON.stringify(state)); }

export function getSelectedWorldContactId() {
  return String(read().contactId || '');
}

export function setSelectedWorldContactId(contactId) {
  const state = read();
  state.contactId = String(contactId || '');
  write(state);
  return state.contactId;
}
