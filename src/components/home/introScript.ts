import { LOCALES } from '@/config/journey';

/** Marca de sesión: la entrada ya se vio en esta pestaña. */
export const INTRO_SESSION_KEY = 'kyoto:intro';

/**
 * Script en línea, antes de pintar: marca `<html data-intro="on">` sólo si la
 * Home va a ver su entrada, para que el CSS esconda el cartel desde el primer
 * píxel en vez de mostrarlo, quitarlo y animarlo. Condiciones que se pueden
 * saber sin el JS de React: es la Home, no se vio en esta pestaña (sin
 * almacenamiento cuenta como primera vez), no hay movimiento reducido y el
 * modo 静 guardado no está activo (`kyoto:prefs` es el `persist` del store).
 * La WebGL la comprueba HomeIntro.
 */
export function introScript(): string {
  return `(function(){try{
var parts=location.pathname.split("/").filter(Boolean);
if(parts.length!==1||${JSON.stringify(LOCALES)}.indexOf(parts[0])<0)return;
var seen=false;try{seen=!!sessionStorage.getItem('${INTRO_SESSION_KEY}');}catch(e){}
if(seen)return;
if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var prefs=null;try{prefs=JSON.parse(localStorage.getItem('kyoto:prefs')||'null');}catch(e){}
if(prefs&&prefs.state&&prefs.state.stillMode)return;
document.documentElement.setAttribute('data-intro','on');
}catch(e){}})();`;
}
