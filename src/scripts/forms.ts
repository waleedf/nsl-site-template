// Sends both forms to the lead endpoint and reports only what really happened.
// Entered values stay in the form on every failure. Without JavaScript the
// form posts normally and the Worker redirects back with ?sent / ?error.

const say = (form: HTMLFormElement, state: string, text: string) => {
  const el = form.querySelector<HTMLElement>('.status');
  if (!el) return;
  el.dataset.state = state;
  el.textContent = text;
};

function problem(form: HTMLFormElement): string | null {
  const data = new FormData(form);
  const email = String(data.get('email') ?? '').trim();
  if (form.dataset.form === 'inquiry') {
    if (!String(data.get('name') ?? '').trim()) return 'Add your name.';
    if (String(data.get('phone') ?? '').replace(/\D/g, '').length < 10) return 'Add a phone number with area code.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Check the email address.';
    if (!String(data.get('message') ?? '').trim()) return 'Tell us briefly what you need.';
  } else {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Add your email address.';
    if (!data.get('consent')) return 'Tick the box so we can email you.';
  }
  return null;
}

async function submit(form: HTMLFormElement, button: HTMLButtonElement | null) {
  const phone = form.dataset.phone;
  const callLine = phone ? ` or call ${phone}` : '';
  const issue = problem(form);
  if (issue) return say(form, 'error', issue);
  const body = Object.fromEntries(new FormData(form)) as Record<string, string>;
  body.page = location.href;
  if (button) button.disabled = true;
  say(form, 'pending', 'Sending…');
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (res.ok && out.ok) {
      form.reset();
      say(form, 'ok', form.dataset.form === 'inquiry' ? 'Sent. We got your request and will get back to you.' : "You're in. Check your inbox.");
    } else if (res.status === 503 && out.reason === 'not-connected') {
      say(form, 'offline', `This form isn't connected yet, so nothing was sent${phone ? `. Please call ${phone}.` : '.'}`);
    } else if (res.status === 400 && out.error) {
      say(form, 'error', out.error);
    } else {
      say(form, 'error', `That didn't send. Your details are still here. Try again${callLine}.`);
    }
  } catch {
    say(form, 'error', `That didn't send. Your details are still here. Try again${callLine}.`);
  } finally {
    if (button) button.disabled = false;
  }
}

export function wireForms() {
  const params = new URLSearchParams(location.search);
  document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach((form) => {
    if (form.dataset.wired) return;
    form.dataset.wired = '1';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit(form, form.querySelector('button[type="submit"]'));
    });
    // Context carried from a guide or index link: /contact/?service=…&location=…
    if (form.dataset.form === 'inquiry') {
      for (const name of ['service', 'location']) {
        const v = params.get(name);
        const select = form.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
        if (v && select && [...select.options].some((o) => o.value === v)) select.value = v;
      }
    }
    // Result of a no-JavaScript post.
    if (params.get('form') === form.dataset.form) {
      if (params.has('sent')) say(form, 'ok', 'Sent. We got your request.');
      else if (params.get('error') === 'not-connected') say(form, 'offline', "This form isn't connected yet, so nothing was sent.");
      else if (params.has('error')) say(form, 'error', "That didn't send. Please try again.");
    }
  });
}
