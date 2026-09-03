import { supabase, requireAuth, renderSidebarUser, showToast } from "./auth.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

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
const ICONS = {
  bold: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/></svg>`,
  italic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>`,
  underline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>`,
  sizeDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h7M8 4v16M14 12h7M17.5 9.5 14 12l3.5 2.5"/></svg>`,
  sizeUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h8M9 4v16M15 9h6M18 6v6"/></svg>`,
  ul: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  ol: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="3" y="8" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif" font-weight="700">1</text><text x="3" y="14" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif" font-weight="700">2</text><text x="3" y="20" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif" font-weight="700">3</text></svg>`,
  table: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
};

function createRte(placeholder = "Текст…") {
  const wrap = document.createElement("div");
  wrap.className = "rte-wrap";

  const toolbar = document.createElement("div");
  toolbar.className = "rte-toolbar";
  toolbar.innerHTML = `
    <button type="button" data-cmd="bold" title="Жирный">${ICONS.bold}</button>
    <button type="button" data-cmd="italic" title="Курсив">${ICONS.italic}</button>
    <button type="button" data-cmd="underline" title="Подчёркнутый">${ICONS.underline}</button>
    <span class="rte-sep"></span>
    <button type="button" data-cmd="fontSizeDown" title="Уменьшить шрифт">${ICONS.sizeDown}</button>
    <button type="button" data-cmd="fontSizeUp" title="Увеличить шрифт">${ICONS.sizeUp}</button>
    <span class="rte-sep"></span>
    <button type="button" data-cmd="insertUnorderedList" title="Маркированный список">${ICONS.ul}</button>
    <button type="button" data-cmd="insertOrderedList" title="Нумерованный список">${ICONS.ol}</button>
    <span class="rte-sep"></span>
    <button type="button" data-cmd="insertTable" title="Вставить таблицу">${ICONS.table}</button>
    <button type="button" data-cmd="insertImage" title="Фото по ссылке">${ICONS.image}</button>
    <label class="rte-btn" title="Загрузить фото с компьютера">
      ${ICONS.upload}
      <input type="file" accept="image/*" style="display:none" data-cmd="uploadImage">
    </label>
  `;

  const editor = document.createElement("div");
  editor.className = "rte-editor";
  editor.contentEditable = "true";
  editor.dataset.placeholder = placeholder;

  wrap.appendChild(toolbar);
  wrap.appendChild(editor);

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
  let html = '<table style="border-collapse:collapse;width:100%;border:2px solid #8a8478"><tbody>';
  for (let i = 0; i < r; i++) {
    html += "<tr>";
    for (let j = 0; j < c; j++) {
      html += '<td style="border:1.5px solid #8a8478;padding:8px 10px;min-width:60px">&nbsp;</td>';
    }
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
// кэш уроков для редактирования (id → данные)
let lessonsCache = {};
let kbRte = null;

async function loadCoursesAdmin() {
  const wrap = document.getElementById("coursesAdminList");
  if (!wrap) return;
  const { data: courses, error } = await supabase
    .from("courses").select("*, lessons(*)").order("order_index");
  if (error) {
    wrap.innerHTML = `<p class="muted">Ошибка загрузки курсов: ${escapeHtml(error.message)}</p>`;
    console.error("loadCoursesAdmin", error);
    return;
  }
  if (!courses || !courses.length) { wrap.innerHTML = `<p class="muted">Курсов пока нет.</p>`; return; }

  lessonsCache = {};
  courses.forEach(c => (c.lessons || []).forEach(l => { lessonsCache[l.id] = l; }));

  wrap.innerHTML = courses.map(course => {
    const lessons = (course.lessons || []).sort((a, b) => a.order_index - b.order_index);
    return `
    <div class="card" style="margin-bottom:1rem" data-course-card="${course.id}">
      <div class="row" style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <h3 style="margin-bottom:.15em">${escapeHtml(course.title)}</h3>
          <p class="muted" style="margin-bottom:.6em">${escapeHtml(course.description || "")}</p>
        </div>
        <button class="small-x" data-del-course="${course.id}" title="Удалить курс">✕</button>
      </div>

      <div class="lesson-list" data-course-id="${course.id}">
        ${lessons.map(l => `
          <div class="lesson-item" data-lesson-id="${l.id}">
            <div class="lesson-row" draggable="true" data-lesson-id="${l.id}" data-course-id="${course.id}">
              <span class="drag-handle" title="Перетащите, чтобы изменить порядок">⋮⋮</span>
              <span class="lesson-title-text">${escapeHtml(l.title)}</span>
              <div class="lesson-actions">
                <button type="button" class="btn-edit-lesson" data-edit-lesson="${l.id}">Изменить</button>
                <button class="small-x" data-del-lesson="${l.id}" title="Удалить">✕</button>
              </div>
            </div>
            <div class="edit-lesson-panel" data-edit-panel="${l.id}" style="display:none"></div>
          </div>
        `).join("")}
      </div>

      <details style="margin-top:.4em">
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

  // RTE для форм добавления
  wrap.querySelectorAll(".add-lesson-form").forEach(form => {
    const container = form.querySelector(".l_content_rte");
    const rte = createRte("Текст урока. Можно форматировать, вставлять таблицы и фото.");
    container.appendChild(rte.wrap);
    form._rte = rte;
    form.addEventListener("submit", addLesson);
  });

  wrap.querySelectorAll("[data-del-course]").forEach(b => b.addEventListener("click", delCourse));
  wrap.querySelectorAll("[data-del-lesson]").forEach(b => b.addEventListener("click", delLesson));
  wrap.querySelectorAll("[data-edit-lesson]").forEach(b => b.addEventListener("click", openEditLesson));

  // drag & drop
  wrap.querySelectorAll(".lesson-list").forEach(list => initLessonDragDrop(list));
}

function initLessonDragDrop(list) {
  let dragItem = null;

  list.querySelectorAll(".lesson-item").forEach(item => {
    const row = item.querySelector(".lesson-row");
    if (!row) return;

    row.addEventListener("dragstart", (e) => {
      dragItem = item;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.dataset.lessonId);
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      list.querySelectorAll(".lesson-row").forEach(r => r.classList.remove("drag-over"));
      dragItem = null;
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const targetRow = e.currentTarget;
      if (targetRow.closest(".lesson-item") !== dragItem) {
        targetRow.classList.add("drag-over");
      }
    });
    row.addEventListener("dragleave", (e) => {
      e.currentTarget.classList.remove("drag-over");
    });
    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      const targetRow = e.currentTarget;
      targetRow.classList.remove("drag-over");
      const targetItem = targetRow.closest(".lesson-item");
      if (!dragItem || !targetItem || dragItem === targetItem) return;

      const courseId = list.dataset.courseId;
      const items = [...list.querySelectorAll(".lesson-item")];
      const fromIdx = items.indexOf(dragItem);
      const toIdx = items.indexOf(targetItem);
      if (fromIdx < 0 || toIdx < 0) return;

      if (fromIdx < toIdx) {
        targetItem.after(dragItem);
      } else {
        targetItem.before(dragItem);
      }

      const newOrder = [...list.querySelectorAll(".lesson-item")].map(el => el.dataset.lessonId);
      await saveLessonOrder(courseId, newOrder);
    });
  });
}

async function saveLessonOrder(courseId, orderedIds) {
  try {
    await Promise.all(orderedIds.map((id, index) =>
      supabase.from("lessons").update({ order_index: index }).eq("id", id)
    ));
    showToast("Порядок уроков сохранён");
  } catch (err) {
    showToast("Не удалось сохранить порядок");
    console.error(err);
  }
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

function openEditLesson(e) {
  const lessonId = e.currentTarget.dataset.editLesson;
  const lesson = lessonsCache[lessonId];
  if (!lesson) return;

  const panel = document.querySelector(`[data-edit-panel="${lessonId}"]`);
  if (!panel) return;

  // закрыть другие открытые панели
  document.querySelectorAll(".edit-lesson-panel").forEach(p => {
    if (p !== panel) { p.style.display = "none"; p.innerHTML = ""; }
  });

  if (panel.style.display === "block") {
    panel.style.display = "none";
    panel.innerHTML = "";
    return;
  }

  panel.style.display = "block";
  panel.innerHTML = `
    <div class="field"><label>Название урока</label>
      <input type="text" class="edit_title" required>
    </div>
    <div class="field">
      <label>Текст урока</label>
      <div class="edit_content_rte"></div>
    </div>
    <div class="field"><label>Ссылка на видео</label>
      <input type="text" class="edit_video">
    </div>
    <div class="edit-lesson-actions">
      <button type="button" class="btn btn-brass btn-save-lesson">Сохранить</button>
      <button type="button" class="btn btn-ghost btn-cancel-edit">Отмена</button>
    </div>
  `;

  panel.querySelector(".edit_title").value = lesson.title || "";
  panel.querySelector(".edit_video").value = lesson.video_url || "";

  const rte = createRte("Текст урока…");
  panel.querySelector(".edit_content_rte").appendChild(rte.wrap);
  // старый контент мог быть plain text — показываем как есть
  if (lesson.content && /<[a-z][\s\S]*>/i.test(lesson.content)) {
    rte.setHtml(lesson.content);
  } else {
    rte.setHtml((lesson.content || "").split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join(""));
  }
  panel._rte = rte;

  panel.querySelector(".btn-cancel-edit").addEventListener("click", () => {
    panel.style.display = "none";
    panel.innerHTML = "";
  });

  panel.querySelector(".btn-save-lesson").addEventListener("click", async () => {
    const title = panel.querySelector(".edit_title").value.trim();
    if (!title) { showToast("Укажите название"); return; }
    const content = panel._rte.getHtml();
    const video = panel.querySelector(".edit_video").value.trim() || null;

    const { error } = await supabase.from("lessons").update({
      title,
      content,
      video_url: video,
    }).eq("id", lessonId);

    if (error) { showToast(error.message); return; }
    showToast("Урок обновлён");
    await loadCoursesAdmin();
  });
}

async function delCourse(e) {
  if (!confirm("Удалить курс и все его уроки/тесты?")) return;
  await supabase.from("courses").delete().eq("id", e.target.dataset.delCourse);
  await Promise.all([loadCoursesAdmin(), loadCourseOptions()]);
}
async function delLesson(e) {
  if (!confirm("Удалить урок?")) return;
  await supabase.from("lessons").delete().eq("id", e.target.dataset.delLesson);
  await loadCoursesAdmin();
}

async function loadCourseOptions() {
  const { data: courses } = await supabase.from("courses").select("id,title").order("order_index");
  const select = document.getElementById("t_course");
  if (!select) return;
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
  const userForm = document.getElementById("createUserForm");
  const courseForm = document.getElementById("createCourseForm");
  const testForm = document.getElementById("createTestForm");
  const kbForm = document.getElementById("createKbForm");

  if (userForm) userForm.addEventListener("submit", createUser);
  if (courseForm) courseForm.addEventListener("submit", createCourse);
  if (testForm) testForm.addEventListener("submit", createTest);

  // KB form + RTE
  if (kbForm) {
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
}

// ---------- старт (после всех объявлений, чтобы не было TDZ) ----------
const auth = await requireAuth({ requireAdmin: true });
if (auth) {
  renderSidebarUser(auth.profile);
  setupTabs();
  try { wireForms(); } catch (e) { console.error("wireForms:", e); }
  const safe = (name, fn) => fn().catch(err => console.error(name, err));
  await Promise.all([
    safe("loadUsers", loadUsers),
    safe("loadCoursesAdmin", loadCoursesAdmin),
    safe("loadCourseOptions", loadCourseOptions),
    safe("loadTestsAdmin", loadTestsAdmin),
    safe("loadKbAdmin", loadKbAdmin),
    safe("loadProgress", loadProgress),
  ]);
}
