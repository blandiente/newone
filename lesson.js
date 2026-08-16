import { supabase, requireAuth, renderSidebarUser, showToast } from "./auth.js";

const auth = await requireAuth();
const params = new URLSearchParams(location.search);
const lessonId = params.get("id");
const courseId = params.get("course");

if (auth && lessonId) {
  renderSidebarUser(auth.profile);
  document.getElementById("backLink").innerHTML =
    `<a href="course.html?id=${courseId}" style="color:inherit">← К курсу</a>`;
  await loadLesson(auth.user.id);
}

async function loadLesson(userId) {
  const { data: lesson, error } = await supabase
    .from("lessons").select("*").eq("id", lessonId).single();

  if (error || !lesson) {
    document.getElementById("lessonTitle").textContent = "Урок не найден";
    return;
  }

  document.getElementById("lessonTitle").textContent = lesson.title;
  document.getElementById("lessonContent").innerHTML = formatContent(lesson.content);

  const videoWrap = document.getElementById("videoWrap");
  if (lesson.video_url) {
    videoWrap.innerHTML = isEmbeddable(lesson.video_url)
      ? `<iframe class="lesson-video" src="${toEmbedUrl(lesson.video_url)}" frameborder="0" allowfullscreen></iframe>`
      : `<video class="lesson-video" src="${lesson.video_url}" controls></video>`;
  }

  const { data: existing } = await supabase
    .from("lesson_progress").select("id")
    .eq("user_id", userId).eq("lesson_id", lessonId).maybeSingle();

  const btn = document.getElementById("completeBtn");
  if (existing) {
    btn.textContent = "✓ Урок пройден";
    btn.disabled = true;
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const { error } = await supabase.from("lesson_progress").insert({
      user_id: userId, lesson_id: lessonId,
    });
    if (error) {
      showToast("Не удалось сохранить прогресс");
      btn.disabled = false;
      return;
    }
    btn.textContent = "✓ Урок пройден";
    showToast("Прогресс сохранён");
  });
}

// Текст урока хранится как обычный текст с пустыми строками между абзацами
function formatContent(text) {
  return (text || "").split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

function isEmbeddable(url) {
  return /youtube\.com|youtu\.be|vimeo\.com/.test(url);
}
function toEmbedUrl(url) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
