import { supabase, requireAuth, renderSidebarUser } from "./auth.js";

const auth = await requireAuth();
if (auth) {
  renderSidebarUser(auth.profile);
  await loadCourses(auth.user.id);
}

async function loadCourses(userId) {
  const listEl = document.getElementById("courseList");

  const { data: courses, error } = await supabase
    .from("courses")
    .select("*, lessons(id)")
    .order("order_index");

  if (error) {
    listEl.innerHTML = `<p class="muted">Не удалось загрузить курсы: ${error.message}</p>`;
    return;
  }

  if (!courses.length) {
    listEl.innerHTML = `<p class="muted">Курсы пока не добавлены. Обратитесь к администратору.</p>`;
    return;
  }

  const { data: progressRows } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId);
  const doneLessonIds = new Set((progressRows || []).map(r => r.lesson_id));

  listEl.innerHTML = courses.map((course, i) => {
    const total = course.lessons.length;
    const done = course.lessons.filter(l => doneLessonIds.has(l.id)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const num = String(i + 1).padStart(2, "0");

    return `
      <a class="listing-card" href="course.html?id=${course.id}">
        <span class="listing-tag">КУРС ${num}</span>
        <div class="listing-body" style="flex:1">
          <h3>${escapeHtml(course.title)}</h3>
          <p>${escapeHtml(course.description || "")}</p>
          <div class="progress-bar"><span style="width:${pct}%"></span></div>
          <div class="progress-label">${done} / ${total} уроков пройдено · ${pct}%</div>
        </div>
      </a>`;
  }).join("");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
