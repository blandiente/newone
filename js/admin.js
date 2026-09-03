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

// ---------- RICH TEXT EDITOR ----------
function createRte(placeholder = "Текст…") {
  const wrap = document.createElement("div");
  wrap.className = "rte-wrap";

  const toolbar = document.createElement("div");
  toolbar.className = "rte-toolbar";
  toolbar.innerHTML = `
    <button type="button" data-cmd="bold" title="Жирный"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Курсив"><i>I</i></button>
    <button type="button" data-cmd="underline" title="Подчёркнутый"><u>U</u></button>
    <span class="rte-sep"></span>
    <button type="button" data-cmd="fontSizeDown" title="Уменьшить шрифт">A−</button>
    <button type="button" data-cmd="fontSizeUp" title="Увеличить шрифт">A+</button>
    <span class="rte-sep"></span>
    <button type="button" data-cmd="insertUnorderedList" title="Список">• Список</button>
    <button type="button" data-cmd="insertOrderedList" title="Нумерованный">1. Список</button>
    <span class="rte-sep"></span>
    <button type="button" data-cmd="insertTable" title="Вставить таблицу">Таблица</button>
    <button type="button" data-cmd="insertImage" title="Вставить фото по URL">Фото URL</button>
    <label class="rte-btn" title="Загрузить фото с компьютера">
      📷 Файл
      <input type="file" accept="image/*" style="display:none" data-cmd="uploadImage">
    </label>
  `;

  const editor = document.createElement("div");
  editor.className = "rte-editor";
  editor.contentEditable = "true";
  editor.dataset.placeholder = placeholder;

  wrap.appendChild(toolbar);
  wrap.appendChild(editor);

  // команды
  toolbar.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cmd]");
    if (!btn) return;
    e.preventDefault();
    const cmd = btn.dataset.cmd;
    editor.focus();

    if (cmd === "fontSizeUp" || cmd === "fontSizeDown") {
      changeFontSize(editor, cmd === "fontSizeUp" ? 1 : -1);
      return;
    }
    if (cmd === "insertTable") {
      insertTable(editor);
      return;
    }
    if (cmd === "insertImage") {
      const url = prompt("Вставьте ссылку на изображение (https://…):");
      if (url && url.trim()) {
        document.execCommand("insertImage", false, url.trim());
      }
      return;
    }
    document.execCommand(cmd, false, null);
  });

  // загрузка файла → base64
  toolbar.querySelector('input[data-cmd="uploadImage"]').addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      showToast("Файл слишком большой (макс. ~1.5 МБ). Сожмите изображение.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      editor.focus();
      document.execCommand("insertImage", false, reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  });

  // запрет вставки «грязного» HTML при paste — оставляем форматирование, но чистим
  editor.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });

  return { wrap, editor, getHtml: () => editor.innerHTML.trim(), setHtml: (html) => { editor.innerHTML = html || ""; } };
}

function changeFontSize(editor, delta) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    // применить к будущему тексту
    const span = document.createElement("span");
    const current = parseInt(window.getComputedStyle(editor).fontSize) || 15;
    span.style.fontSize = (current + delta * 2) + "px";
    span.appendChild(document.createTextNode("\u200B"));
    range.insertNode(span);
    range.setStart(span.firstChild, 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }
  // обёртка выделенного
  const span = document.createElement("span");
  const size = Math.max(10, Math.min(28, (parseInt(window.getComputedStyle(range.commonAncestorContainer.parentElement || editor).fontSize) || 15) + delta * 2));
  span.style.fontSize = size + "px";
  try {
    range.surroundContents(span);
  } catch {
    // если выделение пересекает границы — просто меняем размер через execCommand fallback
    document.execCommand("fontSize", false, delta > 0 ? "5" : "2");
  }
}

function insertTable(editor) {
  const rows = prompt("Количество строк:", "3");
  const cols = prompt("Количество столбцов:", "3");
  const r = Math.min(10, Math.max(1, parseInt(rows) || 3));
  const c = Math.min(8, Math.max(1, parseInt(cols) || 3));
  let html = "<table><tbody>";
  for (let i = 0; i < r; i++) {
    html += "<tr>";
    for (let j = 0; j < c; j++) html += "<td>&nbsp;</td>";
    html += "</tr>";
  }
  html += "</tbody></table><p><br></p>";
  document.execCommand("insertHTML", false, html);
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

  wrap.innerHTML = courses.map(course => {
    const lessons = (course.lessons || []).sort((a, b) => a.order_index - b.order_index);
    return `
    <div class="card" style="margin-bottom:1rem">
      <div class="row" style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <h3 style="margin-bottom:.15em">${escapeHtml(course.title)}</h3>
          <p class="muted" style="margin-bottom:.6em">${escapeHtml(course.description || "")}</p>
        </div>
        <button class="small-x" data-del-course="${course.id}" title="Удалить курс">✕</button>
      </div>

      ${lessons.map((l, idx) => `
        <div class="repeater-item">
          <div class="row" style="justify-content:space-between;align-items:center">
            <b>${escapeHtml(l.title)}</b>
            <div style="display:flex;align-items:center;gap:.4rem">
              <div class="order-btns">
                <button type="button" data-move-lesson="${l.id}" data-dir="-1" data-course="${course.id}" title="Выше" ${idx === 0 ? "disabled" : ""}>↑</button>
                <button type="button" data-move-lesson="${l.id}" data-dir="1" data-course="${course.id}" title="Ниже" ${idx === lessons.length - 1 ? "disabled" : ""}>↓</button>
              </div>
              <button class="small-x" data-del-lesson="${l.id}">✕</button>
            </div>
          </div>
        </div>`).join("")}

      <details style="margin-top:.8em">
        <summary style="cursor:pointer;font-size:.88rem;color:var(--brass-dark);font-weight:600">+ Добавить урок</summary>
        <form class="add-lesson-form" data-course="${course.id}" style="margin-top:.8em">
          <div class="field"><label>Название урока</label><input type="text" class="l_title" required></div>
          <div class="field">
            <label>Текст урока</label>
            <div class="l_content_rte"></div>
          </div>
          <div class="field"><label>Ссылка на видео (YouTube/Vimeo или .mp4) — необязательно</label><input type="text" class="l_video"></div>
          <button class="btn btn-ghost" type="submit">Добавить урок</button>
        </form>
      </details>
    </div>`;
  }).join("");

  // инициализируем RTE для каждой формы добавления урока
  wrap.querySelectorAll(".add-lesson-form").forEach(form => {
    const container = form.querySelector(".l_content_rte");
    const rte = createRte("Текст урока. Можно форматировать, вставлять таблицы и фото.");
    container.appendChild(rte.wrap);
    form._rte = rte;
    form.addEventListener("submit", addLesson);
  });

  wrap.querySelectorAll("[data-del-course]").forEach(b => b.addEventListener("click", delCourse));
  wrap.querySelectorAll("[data-del-lesson]").forEach(b => b.addEventListener("click", delLesson));
  wrap.querySelectorAll("[data-move-lesson]").forEach(b => b.addEventListener("click", moveLesson));
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
  const contentHtml = form._rte ? form._rte.getHtml() : "";
  const { data: existing } = await supabase.from("lessons").select("id").eq("course_id", courseId);
  const { error } = await supabase.from("lessons").insert({
    course_id: courseId,
    title: form.querySelector(".l_title").value.trim(),
    content: contentHtml || "",
    video_url: form.querySelector(".l_video").value.trim() || null,
    order_index: (existing || []).length,
  });
  if (error) { showToast(error.message); return; }
  showToast("Урок добавлен");
  await loadCoursesAdmin();
}

async function moveLesson(e) {
  const btn = e.currentTarget;
  const lessonId = btn.dataset.moveLesson;
  const dir = Number(btn.dataset.dir);
  const courseId = btn.dataset.course;

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, order_index")
    .eq("course_id", courseId)
    .order("order_index");

  if (!lessons || lessons.length < 2) return;

  const idx = lessons.findIndex(l => l.id === lessonId);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= lessons.length) return;

  const a = lessons[idx];
  const b = lessons[newIdx];

  // swap order_index
  await supabase.from("lessons").update({ order_index: b.order_index }).eq("id", a.id);
  await supabase.from("lessons").update({ order_index: a.order_index }).eq("id", b.id);

  showToast("Порядок изменён");
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
let kbRte = null;

async function createKb(e) {
  e.preventDefault();
  const contentHtml = kbRte ? kbRte.getHtml() : document.getElementById("kb_content")?.value?.trim() || "";
  if (!contentHtml || contentHtml === "<br>" || contentHtml === "<div><br></div>") {
    showToast("Введите текст статьи");
    return;
  }
  const category = document.getElementById("kb_category").value.trim();
  const title = document.getElementById("kb_title").value.trim();
  if (!category || !title) {
    showToast("Заполните категорию и заголовок");
    return;
  }

  const { data: existing } = await supabase.from("knowledge_base").select("id");
  const { error } = await supabase.from("knowledge_base").insert({
    category,
    title,
    content: contentHtml,
    order_index: (existing || []).length,
  });
  if (error) {
    console.error("KB insert error:", error);
    showToast(error.message || "Ошибка при добавлении статьи");
    return;
  }
  document.getElementById("createKbForm").reset();
  if (kbRte) kbRte.setHtml("");
  showToast("Статья добавлена");
  await loadKbAdmin();
}

async function loadKbAdmin() {
  const { data: items, error } = await supabase
    .from("knowledge_base")
    .select("*")
    .order("category")
    .order("order_index");

  const wrap = document.getElementById("kbAdminList");
  if (error) {
    wrap.innerHTML = `<p class="muted">Ошибка загрузки: ${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!items || !items.length) {
    wrap.innerHTML = `<p class="muted">Статей пока нет.</p>`;
    return;
  }

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

  // KB form + RTE
  const kbForm = document.getElementById("createKbForm");
  const oldTa = document.getElementById("kb_content");
  if (oldTa) {
    const kbContentField = oldTa.closest(".field");
    if (kbContentField) {
      const label = kbContentField.querySelector("label");
      kbContentField.innerHTML = "";
      if (label) kbContentField.appendChild(label);
      kbRte = createRte("Текст статьи. Форматирование, таблицы, фото.");
      kbContentField.appendChild(kbRte.wrap);
    }
  }
  kbForm.addEventListener("submit", createKb);
}
