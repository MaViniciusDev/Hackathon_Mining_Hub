// Simple i18n loader and runtime
(function(){
  let translations = {};
  let currentLang = localStorage.getItem('siteLang') || (navigator.language && navigator.language.startsWith('en') ? 'en' : 'pt');

  async function load() {
    try {
      const res = await fetch('translations.json');
      translations = await res.json();
    } catch (e) {
      console.warn('i18n: could not load translations.json', e);
      translations = { pt: {}, en: {} };
    }
  }

  function t(key, vars) {
    const langPack = translations[currentLang] || {};
    let v = langPack[key] || key;
    if (vars) {
      Object.keys(vars).forEach(k => { v = v.replace(new RegExp('\{' + k + '\}','g'), vars[k]); });
    }
    return v;
  }

  function translateElement(el) {
    const key = el.getAttribute('data-i18n');
    if (key) {
      // keep HTML when container; default to text
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = t(key);
      else el.textContent = t(key);
    }
    const ph = el.getAttribute('data-i18n-placeholder');
    if (ph) el.setAttribute('placeholder', t(ph));
    const titleKey = el.getAttribute('data-i18n-title');
    if (titleKey) el.setAttribute('title', t(titleKey));
  }

  function translatePage() {
    document.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title]').forEach(translateElement);
    // set lang attribute
    document.documentElement.lang = currentLang === 'en' ? 'en' : 'pt-BR';
  }

  function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('siteLang', lang);
    translatePage();
    // emit event
    document.dispatchEvent(new CustomEvent('i18n:languageChanged', { detail: { lang } }));
  }

  // init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', async () => {
    await load();
    // setup language selector if present
    const sel = document.getElementById('langSelect');
    if (sel) {
      sel.value = currentLang;
      sel.addEventListener('change', (e) => setLanguage(e.target.value));
    }
    // also attach possible buttons .lang-btn
    document.querySelectorAll('.lang-btn').forEach(b => {
      b.addEventListener('click', () => setLanguage(b.getAttribute('data-lang')));
    });
    // setup visual language switcher if present
    const switcher = document.getElementById('langSwitcher');
    if (switcher) {
      const current = switcher.querySelector('.lang-current');
      const menu = switcher.querySelector('.lang-menu');
      const setCurrent = (lang) => {
        const flag = lang === 'en' ? '🇺🇸' : '🇧🇷';
        const label = lang === 'en' ? 'EN' : 'PT';
        if (current) {
          const f = current.querySelector('.flag'); if (f) f.textContent = flag;
          const l = current.querySelector('.label'); if (l) l.textContent = label;
        }
      };
      // initialize display
      setCurrent(currentLang);
      // toggle menu
      if (current) current.addEventListener('click', (e) => {
        const expanded = current.getAttribute('aria-expanded') === 'true';
        current.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        menu.classList.toggle('hidden');
      });
      // close on outside click
      document.addEventListener('click', (e) => {
        if (!switcher.contains(e.target)) {
          menu.classList.add('hidden');
          if (current) current.setAttribute('aria-expanded', 'false');
        }
      });
      // close on selecting a lang button
      switcher.querySelectorAll('.lang-btn').forEach(b => {
        b.addEventListener('click', () => {
          menu.classList.add('hidden');
          if (current) current.setAttribute('aria-expanded', 'false');
          setCurrent(b.getAttribute('data-lang'));
        });
      });
      // update display whenever language changes programmatically
      document.addEventListener('i18n:languageChanged', (ev) => setCurrent(ev.detail.lang));
    }
    translatePage();
    // expose helpers
    window.t = t;
    window.setLanguage = setLanguage;
  });

  // expose immediately so other scripts can call t() after load
  window.t = (...args) => { console.warn('i18n: not ready yet'); return args[0]; };
  window.setLanguage = (lang) => { localStorage.setItem('siteLang', lang); };
})();
