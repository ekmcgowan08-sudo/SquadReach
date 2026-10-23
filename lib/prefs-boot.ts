/* Shared by the root layout (server) and lib/prefs.ts (client). Kept out of
   the 'use client' module so the layout receives the plain string. */
export const PREFS_KEY = 'squadrise_prefs_v1';

/** Runs before first paint so a light-theme phone never flashes dark. */
export const PREFS_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem('${PREFS_KEY}')||'{}');var e=document.documentElement;e.dataset.theme=p.theme==='light'?'light':'dark';e.style.colorScheme=e.dataset.theme;if(p.reduceMotion)e.dataset.motion='reduce'}catch(_){}`;
