export const pages = ['about', 'goodnotes', 'config', 'world-building', 'labradoodle'];

export function readRoute(location) {
  const slug = location.pathname.replace(/^\/|\/$/g, '');
  const index = pages.indexOf(slug);
  return {
    index: index < 0 ? null : index,
    mode: new URLSearchParams(location.search).get('mode') === 'gameboy' ? 'gameboy' : 'reader',
  };
}

export function routeUrl(route, location) {
  const url = new URL(location.href);
  url.pathname = route.index === null ? '/' : `/${pages[route.index]}`;
  url.searchParams.delete('mode');
  if (route.index !== null && route.mode === 'gameboy') url.searchParams.set('mode', 'gameboy');
  url.hash = '';
  return url.pathname + url.search;
}

export function createRouteHistory(browser) {
  let pending;
  let scheduled = false;
  return {
    write(route) {
      pending = route;
      if (scheduled) return;
      scheduled = true;
      // Closing a reader and ejecting happen together: record just the final destination.
      queueMicrotask(() => {
        scheduled = false;
        const next = routeUrl(pending, browser.location);
        if (next !== browser.location.pathname + browser.location.search) {
          browser.history.pushState(null, '', next);
        }
      });
    },
  };
}
