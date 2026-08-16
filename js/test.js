import { supabase, requireAuth, renderSidebarUser, showToast } from "./auth.js";

const auth = await requireAuth();
const params = new URLSearchParams(location.search);
const testId = params.get("id");
const courseId = params.get("course");

let questions = [];
let test = null;

if (auth && testId) {
  renderSidebarUser(auth.profile);
  document.getElementById("backLink").innerHTML =
    `<a href="course.html?id=${courseId}" style="color:inherit">← К курсу</a>`;
  await loadTest(auth.user.id);
}

async function loadTest(userId) {
  const { data: t } = await supabase.from("tests").select("*").eq("id", testId).single();
  test = t;
  if (!test) { document.getElementById("testTitle").textContent = "Тест не найден"; return; }
  document.getElementById("testTitle").textContent = test.title;

  const { data: qs } = await supabase
    .from("questions").select("*, answers(*)").eq("test_id", testId).order("order_index");
  questions = qs || [];

  const form = document.getElementById("testForm");
  form.innerHTML = questions.map((q, qi) => `
    <div class="question-block">
      <div class="question-title">${qi + 1}. ${escapeHtml(q.question_text)}</div>
      ${q.answers.map(a => `
        <label class="option-row">
          <input type="radio" name="q_${q.id}" value="${a.id}">
          ${escapeHtml(a.answer_text)}
        </label>`).join("")}
    </div>`).join("");

  document.getElementById("submitBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    await submitTest(userId);
  });
}

async function submitTest(userId) {
  let correct = 0;
  for (const q of questions) {
    const picked = document.querySelector(`input[name="q_${q.id}"]:checked`);
    const correctAnswer = q.answers.find(a => a.is_correct);
    if (picked && correctAnswer && picked.value === correctAnswer.id) correct++;
  }

  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  const passed = score >= (test.pass_score || 70);

  const { error } = await supabase.from("test_results").insert({
    user_id: userId, test_id: testId, score, passed,
  });

  if (error) { showToast("Не удалось сохранить результат"); return; }

  document.getElementById("resultBanner").innerHTML = `
    <div class="result-banner ${passed ? "pass" : "fail"}">
      ${passed ? "✓ Тест сдан" : "✗ Тест не сдан"} — результат ${score}% (нужно ${test.pass_score}%)
    </div>`;
  document.getElementById("testForm").style.display = "none";
  document.getElementById("submitBtn").style.display = "none";
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
