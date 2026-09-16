window.LJS_CONFIG = {
  SUPABASE_URL: "https://wptorwbmgwsadbuxwyvk.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_VO7mh6MsjflCc8IIUpElPA_8rAaJo89",
  AUTH_PASSWORD_PREFIX: "LJS-",
  TECH_ACCOUNTS: [
    { name: "Roy de Lachaise Emmanuel", email: "emmanuel@ljs.local" },
    { name: "Paterne Adrien", email: "adrien@ljs.local" },
    { name: "Moro Nabil", email: "nabil@ljs.local" }
  ],
  ADMIN_ACCOUNT: { name: "Responsable", email: "responsable@ljs.local" }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('script[data-hours-limits]')) return;
  const script = document.createElement('script');
  script.src = './hours-limits.js?v=20260916-hours-limits-1';
  script.dataset.hoursLimits = '1';
  script.async = false;
  document.head.appendChild(script);
});
