import { supabase, requireAuth, renderSidebarUser, showToast } from "./auth.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const auth = await requireAuth({ requireAdmin: true });
if (auth) {
  renderSidebarUser(auth.profile);
  setupTabs();
  await Promise.all([loadUsers(), loadCoursesAdmin(), loadCourseOptions(), loadTestsAdmin(), loadKbAdmin(), loadProgress()]);
  wireForms();
}

// ---------- вкладки ----------
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

// ---------- ПОЛЬЗОВАТЕЛИ ----------
async function loadUsers() {
  const { data: users, error } = await supabase.from("profiles").select("*").order("created_at");
  const tbody = document.querySelector("#usersTable tbody");
  if (error) { tbody.innerHTML = `<tr><td class="muted">${error.message}</td></tr>`; return; }
  tbody.innerHTML = `<tr><th>Имя</th><th>Роль</th></tr>` + users.map(u => `
    <tr>
      <td>${escapeHtml(u.full_name)}</td>
      <td><span class="badge ${u.role}">${u.role === "admin" ? "Админ" : "Менеджер"}</span></td>
    </tr>`).join("");
}

async function createUser(e) {
  e.preventDefault();
  const btn = document.getElementById("createUserBtn");
  btn.disabled = true; btn.textContent = "Создаём…";

  const body = {
    full_name: document.getElementById("nu_name").value.trim(),
    email: document.getElementById("nu_email").value.trim(),
    password: document.getElementById("nu_password").value,
    role: document.getElementById("nu_role").value,
  };

  const { data: { session } } = await supabase.auth.getSession();

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/smooth-handler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Ошибка создания пользователя");

    showToast("Пользователь создан");
    document.getElementById("createUserForm").reset();
    await loadUsers();
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false; btn.textContent = "Создать аккаунт";
  }
}

// ---------- КУРСЫ И УРОКИ ----------
async function loadCoursesAdmin() {
  const { data: courses } = await supabase
    .from("courses").select("*, lessons(*)").order("order_index");
  const wrap = document.getElementById("coursesAdminList");
  if (!courses || !courses.length) { wrap.innerHTML = `<p class="muted">Курсов пока нет.</p>`; return; }

  wrap.innerHTML = courses.map(course => `
    <div class="card" style="margin-bottom:1rem">
      <div class="row" style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <h3 style="margin-bottom:.15em">${escapeHtml(course.title)}</h3>
          <p class="muted" style="margin-bottom:.6em">${escapeHtml(course.description || "")}</p>
        </div>
        <button class="small-x" data-del-course="${course.id}" title="Удалить курс">✕</button>
      </div>

      ${(course.lessons || []).sort((a,b)=>a.order_index-b.order_index).map(l => `
        <div class="repeater-item">
          <div class="row" style="justify-content:space-between">
            <b>${escapeHtml(l.title)}</b>
            <button class="small-x" data-del-lesson="${l.id}">✕</button>
          </div>
        </div>`).join("")}

      <details style="margin-top:.8em">
        <summary style="cursor:pointer;font-size:.88rem;color:var(--brass-dark);font-weight:600">+ Добавить урок</summary>
        <form class="add-lesson-form" data-course="${course.id}" style="margin-top:.8em">
          <div class="field"><label>Название урока</label><input type="text" class="l_title" required></div>
          <div class="field"><label>Текст урока (абзацы разделяйте пустой строкой)</label><textarea class="l_content" rows="4"></textarea></div>
          <div class="field"><label>Ссылка на видео (YouTube/Vimeo или .mp4) — необязательно</label><input type="text" class="l_video"></div>
          <button class="btn btn-ghost" type="submit">Добавить урок</button>
        </form>
      </details>
    </div>`).join("");

  wrap.querySelectorAll(".add-lesson-form").forEach(f => f.addEventListener("submit", addLesson));
  wrap.querySelectorAll("[data-del-course]").forEach(b => b.addEventListener("click", delCourse));
  wrap.querySelectorAll("[data-del-lesson]").forEach(b => b.addEventListener("click", delLesson));
}

async function createCourse(e) {
  e.preventDefault();
  const { data: existing } = await supabase.from("courses").select("id");
  const { error } = await supabase.from("courses").insert({
    title: document.getElementById("c_title").value.trim(),
    description: document.getElementById("c_desc").value.trim(),
    order_index: (existing || []).length,
  });
  if (error) { showToast(error.message); return; }
  document.getElementById("createCourseForm").reset();
  showToast("Курс добавлен");
  await Promise.all([loadCoursesAdmin(), loadCourseOptions()]);
}

async function addLesson(e) {
  e.preventDefault();
  const form = e.target;
  const courseId = form.dataset.course;
  const { data: existing } = await supabase.from("lessons").select("id").eq("course_id", courseId);
  const { error } = await supabase.from("lessons").insert({
    course_id: courseId,
    title: form.querySelector(".l_title").value.trim(),
    content: form.querySelector(".l_content").value.trim(),
    video_url: form.querySelector(".l_video").value.trim() || null,
    order_index: (existing || []).length,
  });
  if (error) { showToast(error.message); return; }
  showToast("Урок добавлен");
  await loadCoursesAdmin();
}

async function delCourse(e) {
  if (!confirm("Удалить курс и все его уроки/тесты?")) return;
  await supabase.from("courses").delete().eq("id", e.target.dataset.delCourse);
  await Promise.all([loadCoursesAdmin(), loadCourseOptions()]);
}
async function delLesson(e) {
  await supabase.from("lessons").delete().eq("id", e.target.dataset.delLesson);
  await loadCoursesAdmin();
}

async function loadCourseOptions() {
  const { data: courses } = await supabase.from("courses").select("id,title").order("order_index");
  const select = document.getElementById("t_course");
  select.innerHTML = (courses || []).map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("");
}

// ---------- ТЕСТЫ ----------
async function createTest(e) {
  e.preventDefault();
  const { error } = await supabase.from("tests").insert({
    course_id: document.getElementById("t_course").value,
    title: document.getElementById("t_title").value.trim(),
    pass_score: Number(document.getElementById("t_pass").value) || 70,
  });
  if (error) { showToast(error.message); return; }
  document.getElementById("createTestForm").reset();
  showToast("Тест создан");
  await loadTestsAdmin();
}

async function loadTestsAdmin() {
  const { data: tests } = await supabase
    .from("tests").select("*, courses(title), questions(*, answers(*))").order("created_at");
  const wrap = document.getElementById("testsAdminList");
  if (!tests || !tests.length) { wrap.innerHTML = `<p class="muted">Тестов пока нет.</p>`; return; }

  wrap.innerHTML = tests.map(test => `
    <div class="card" style="margin-bottom:1rem">
      <div class="row" style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <span class="eyebrow">${escapeHtml(test.courses?.title || "")}</span>
          <h3 style="margin-bottom:.15em">${escapeHtml(test.title)}</h3>
          <p class="muted">Проходной балл: ${test.pass_score}%</p>
        </div>
        <button class="small-x" data-del-test="${test.id}">✕</button>
      </div>

      ${(test.questions || []).sort((a,b)=>a.order_index-b.order_index).map((q, qi) => `
        <div class="repeater-item">
          <div class="row" style="justify-content:space-between">
            <b>${qi + 1}. ${escapeHtml(q.question_text)}</b>
            <button class="small-x" data-del-question="${q.id}">✕</button>
          </div>
          <ul style="margin:.5em 0 0;padding-left:1.2em">
            ${q.answers.map(a => `<li style="${a.is_correct ? "color:var(--good);font-weight:600" : ""}">${escapeHtml(a.answer_text)}${a.is_correct ? " ✓" : ""}</li>`).join("")}
          </ul>
        </div>`).join("")}

      <details style="margin-top:.8em">
        <summary style="cursor:pointer;font-size:.88rem;color:var(--brass-dark);font-weight:600">+ Добавить вопрос</summary>
        <form class="add-question-form" data-test="${test.id}" style="margin-top:.8em">
          <div class="field"><label>Текст вопроса</label><input type="text" class="q_text" required></div>
          <div class="field"><label>Варианты ответа (отметьте правильный)</label>
            ${[0,1,2,3].map(i => `
              <div class="row" style="margin-bottom:.4em">
                <input type="radio" name="correct" value="${i}" ${i===0 ? "checked" : ""} style="width:auto">
                <input type="text" class="a_text" placeholder="Вариант ${i+1}" ${i<2 ? "required" : ""}>
              </div>`).join("")}
          </div>
          <button class="btn btn-ghost" type="submit">Добавить вопрос</button>
        </form>
      </details>
    </div>`).join("");

  wrap.querySelectorAll(".add-question-form").forEach(f => f.addEventListener("submit", addQuestion));
  wrap.querySelectorAll("[data-del-test]").forEach(b => b.addEventListener("click", async e => {
    if (!confirm("Удалить тест?")) return;
    await supabase.from("tests").delete().eq("id", e.target.dataset.delTest);
    await loadTestsAdmin();
  }));
  wrap.querySelectorAll("[data-del-question]").forEach(b => b.addEventListener("click", async e => {
    await supabase.from("questions").delete().eq("id", e.target.dataset.delQuestion);
    await loadTestsAdmin();
  }));
}

async function addQuestion(e) {
  e.preventDefault();
  const form = e.target;
  const testId = form.dataset.test;
  const answerInputs = [...form.querySelectorAll(".a_text")];
  const correctIndex = Number(form.querySelector('input[name="correct"]:checked').value);

  const { data: existing } = await supabase.from("questions").select("id").eq("test_id", testId);
  const { data: question, error } = await supabase.from("questions").insert({
    test_id: testId,
    question_text: form.querySelector(".q_text").value.trim(),
    order_index: (existing || []).length,
  }).select().single();

  if (error) { showToast(error.message); return; }

  const answerRows = answerInputs
    .map((input, i) => ({ text: input.value.trim(), i }))
    .filter(a => a.text)
    .map(a => ({
      question_id: question.id,
      answer_text: a.text,
      is_correct: a.i === correctIndex,
      order_index: a.i,
    }));

  const { error: ansErr } = await supabase.from("answers").insert(answerRows);
  if (ansErr) { showToast(ansErr.message); return; }

  showToast("Вопрос добавлен");
  await loadTestsAdmin();
}

// ---------- БАЗА ЗНАНИЙ ----------
async function createKb(e) {
  e.preventDefault();
  const { data: existing } = await supabase.from("knowledge_base").select("id");
  const { error } = await supabase.from("knowledge_base").insert({
    category: document.getElementById("kb_category").value.trim(),
    title: document.getElementById("kb_title").value.trim(),
    content: document.getElementById("kb_content").value.trim(),
    order_index: (existing || []).length,
  });
  if (error) { showToast(error.message); return; }
  document.getElementById("createKbForm").reset();
  showToast("Статья добавлена");
  await loadKbAdmin();
}

async function loadKbAdmin() {
  const { data: items } = await supabase.from("knowledge_base").select("*").order("category").order("order_index");
  const wrap = document.getElementById("kbAdminList");
  if (!items || !items.length) { wrap.innerHTML = `<p class="muted">Статей пока нет.</p>`; return; }

  wrap.innerHTML = items.map(item => `
    <div class="repeater-item">
      <div class="row" style="justify-content:space-between">
        <div><span class="eyebrow">${escapeHtml(item.category)}</span><br><b>${escapeHtml(item.title)}</b></div>
        <button class="small-x" data-del-kb="${item.id}">✕</button>
      </div>
    </div>`).join("");

  wrap.querySelectorAll("[data-del-kb]").forEach(b => b.addEventListener("click", async e => {
    await supabase.from("knowledge_base").delete().eq("id", e.target.dataset.delKb);
    await loadKbAdmin();
  }));
}

// ---------- ПРОГРЕСС ----------
async function loadProgress() {
  const { data: results, error } = await supabase
    .from("test_results")
    .select("*, profiles(full_name), tests(title)")
    .order("completed_at", { ascending: false });

  const tbody = document.querySelector("#progressTable tbody");
  if (error) { tbody.innerHTML = `<tr><td class="muted">${error.message}</td></tr>`; return; }
  if (!results.length) { tbody.innerHTML = `<tr><td class="muted">Пока нет пройденных тестов.</td></tr>`; return; }

  tbody.innerHTML = `<tr><th>Менеджер</th><th>Тест</th><th>Результат</th><th>Дата</th></tr>` +
    results.map(r => `
      <tr>
        <td>${escapeHtml(r.profiles?.full_name || "—")}</td>
        <td>${escapeHtml(r.tests?.title || "—")}</td>
        <td><span class="badge ${r.passed ? "manager" : ""}" style="${r.passed ? "" : "background:var(--bad-tint);color:var(--bad)"}">${r.score}% ${r.passed ? "· сдан" : "· не сдан"}</span></td>
        <td class="muted">${new Date(r.completed_at).toLocaleDateString("ru-RU")}</td>
      </tr>`).join("");
}

function wireForms() {
  document.getElementById("createUserForm").addEventListener("submit", createUser);
  document.getElementById("createCourseForm").addEventListener("submit", createCourse);
  document.getElementById("createTestForm").addEventListener("submit", createTest);
  document.getElementById("createKbForm").addEventListener("submit", createKb);
}
