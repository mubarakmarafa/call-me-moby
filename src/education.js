export const educationArticle = `
  <img class="education-wordmark" src="/images/goodnotes/logo.svg" width="185" height="34" alt="goodnotes">
  <h1>more time to teach.</h1>
  <p>i was the founding designer of goodnotes classroom, now goodnotes education. i led the design from early teacher research to our august 2024 launch, then continued shaping its ai features.</p>
  <p>lesson setup, handwritten work, feedback and grading — connected in one place. built with teachers, around the way they actually teach.</p>
  <h2>answer clustering.</h2>
  <p>i designed the flow for reviewing handwritten answers and grading ai-organised groups. teachers can compare answers with a model, spot shared misunderstandings, move answers between groups and make the final call.</p>
  <img class="education-image" src="/images/goodnotes/answer-clustering.webp" alt="goodnotes answer clustering groups student responses for a teacher to review" width="800" height="600">
  <h2>generate hints.</h2>
  <p>i refined this through teacher research and prompt testing. instead of writing prompts mid-lesson, teachers prepare, edit and approve the support first. students get a hint when they need one, based on their work.</p>
  <p>the part i'm proud of: ai helps, but the teacher stays in charge.</p>
  <h2>at bett.</h2>
  <p>a few pieces from our 2026 booth.</p>
  <div class="education-gallery" data-image-gallery role="region" aria-label="bett booth artwork, scroll sideways to explore six illustrations" tabindex="0">
    <img src="/images/goodnotes/bett/learning.png" width="1400" height="1159" alt="make learning visible — handwritten work, feedback and student avatars">
    <img src="/images/goodnotes/bett/personalise.png" width="1400" height="1140" alt="personalise for every student — individual handwritten answers">
    <img src="/images/goodnotes/bett/admin.png" width="1400" height="1060" alt="reduce time spent on admin — ai groups matching student answers">
    <img src="/images/goodnotes/bett/ai.png" width="1400" height="1010" alt="use ai safely and meaningfully — teacher-approved hints">
    <img src="/images/goodnotes/bett/freeform.png" width="1400" height="1155" alt="combine freeform input and intentional learning">
    <img src="/images/goodnotes/bett/impact.png" width="1400" height="1122" alt="see the impact — teacher and student usage insights">
  </div>
  <h2>beyond the launch.</h2>
  <p>teachers reported less time spent grading and more time to support individual students. today, goodnotes education is free for k–12 schools.</p>
  <p>along the way, i worked with professors at stanford on responsible ai use in classrooms. this sits alongside goodnotes' wider education work, including good future foundation, which helps schools build confidence with ai and close gaps in access.</p>
  <p><a href="https://www.goodfuture.foundation/" target="_blank" rel="noopener noreferrer">good future foundation ↗</a></p>
  <h2>see it in action.</h2>
  <p>i helped shape the product's visual identity with our brand team and art-directed the launch videos. later, wendy liao and i shared the design journey at figma config.</p>
  <button class="education-video-link" data-video="X_L8WtTl10c" data-video-title="goodnotes classroom launch">▷ watch the classroom launch</button>
  <button class="education-video-link" data-video="fLF8dwbC74o" data-video-title="designing goodnotes classroom at config">▷ watch our config talk</button>
  <p class="education-more"><a href="https://www.goodnotes.com/learning/education" target="_blank" rel="noopener noreferrer">explore goodnotes education ↗</a></p>
`;

export function mountEducationVideo(screen) {
  const player = document.createElement('section');
  player.className = 'lcd-video';
  player.hidden = true;
  player.setAttribute('aria-label', 'video player');
  player.innerHTML = '<button class="video-close" aria-label="Close video">← back</button><div class="video-frame"></div><a class="video-external" target="_blank" rel="noopener noreferrer">watch on youtube ↗</a>';
  screen.append(player);
  let trigger;
  const close = (restoreFocus = true) => {
    player.hidden = true;
    player.querySelector('.video-frame').replaceChildren();
    screen.querySelector('.lcd-scroll').inert = false;
    if (restoreFocus && trigger?.isConnected) trigger.focus({preventScroll:true});
  };
  player.querySelector('.video-close').addEventListener('click', () => close());
  player.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !player.classList.contains('standalone-video')) { event.stopPropagation(); close(); }
  });
  const open = (id, title, { standalone = false, button = null } = {}) => {
    trigger = button;
    player.classList.toggle('standalone-video', standalone);
    player.querySelector('.video-close').hidden = standalone;
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`;
    frame.title = title;
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    player.querySelector('.video-frame').replaceChildren(frame);
    player.querySelector('.video-external').href = `https://www.youtube.com/watch?v=${id}`;
    screen.querySelector('.lcd-scroll').inert = true;
    player.hidden = false;
    (standalone ? frame : player.querySelector('.video-close')).focus({preventScroll:true});
  };
  screen.addEventListener('click', event => {
    const button = event.target.closest('[data-video]');
    if (button) open(button.dataset.video, button.dataset.videoTitle, { button });
  });
  return { open, close: () => close(false) };
}
