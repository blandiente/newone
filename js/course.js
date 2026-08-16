import { supabase, requireAuth, renderSidebarUser } from "./auth.js";

const auth = await requireAuth();
const courseId = new URLSearchParams(location.search).get("id");

if (auth && courseId) {
  renderSidebarUser(auth.profile);
  await loadCourse(auth.user.id);
} else if (auth) {
  document.getElementById("courseTitle").textContent = "Курс не найден";
}

async function loadCourse(userId) {
  const { data: course, error } = await supabase
    .from("courses").select("*").eq("id", courseId).single();

  if (error || !course) {
    document.getElementById("courseTitle").textContent = "Курс не найден";
    return;
  }

  document.getElementById("courseTitle").textContent = course.title;
  document.getElementById("courseDesc").textContent = course.description || "";

  const { data: lessons } = await supabase
    .from("lessons").select("*").eq("course_id", courseId).order("order_index");

  const { data: progressRows } = await supabase
    .from("lesson_progress").select("lesson_id").eq("user_id", userId);
  const done = new Set((progressRows || []).map(r => r.lesson_id));

  const listEl = document.getElementById("lessonList");
  if (!lessons || !lessons.length) {
    listEl.innerHTML = `<p class="muted">В этом курсе пока нет уроков.</p>`;
  } else {
    listEl.innerHTML = lessons.map((l, i) => {
      const isDone = done.has(l.id);
      const num = String(i + 1).padStart(2, "0");
      return `
        <a class="listing-card" href="lesson.html?id=${l.id}&course=${courseId}">
          <span class="listing-tag" style="${isDone ? 'background:var(--good-tint);color:var(--good)' : ''}">
            ${isDone ? "✓ ГОТОВО" : "УРОК " + num}
          </span>
          <div class="listing-body"><h3>${escapeHtml(l.title)}</h3></div>
        </a>`;
    }).join("");
  }

  const allDone = lessons && lessons.length > 0 && lessons.every(l => done.has(l.id));

  const { data: test } = await supabase
    .from("tests").select("*").eq("course_id", courseId).maybeSingle();

  const testBlock = document.getElementById("testBlock");
  if (test) {
    if (allDone) {
      testBlock.innerHTML = `
        <div class="card">
          <h3 style="margin-bottom:.3em">Итоговый тест: ${escapeHtml(test.title)}</h3>
          <p class="muted">Проходной балл: ${test.pass_score}%</p>
          <a class="btn btn-brass" href="test.html?id=${test.id}&course=${courseId}">Пройти тест</a>
        </div>`;
    } else {
      testBlock.innerHTML = `<p class="muted">Пройдите все уроки, чтобы открыть итоговый тест.</p>`;
    }
  }
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
