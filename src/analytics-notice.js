const notice = document.querySelector('.analytics-notice');
const credits = document.querySelector('.credits');

document.querySelector('#dismiss-analytics').addEventListener('click', () => {
  notice.open = false;
  notice.querySelector('summary').focus({ preventScroll: true });
});

credits.addEventListener('toggle', () => {
  if (credits.open) notice.open = false;
});

notice.addEventListener('toggle', () => {
  if (notice.open) credits.open = false;
});
