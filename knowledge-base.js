import { supabase, requireAuth, renderSidebarUser } from "./auth.js";

const auth = await requireAuth();
if (auth) {
  renderSidebarUser(auth.profile);
  await loadKB();
}

async function loadKB() {
  const listEl = document.getElementById("kbList");
  const { data: items, error } = await supabase
    .from("knowledge_base").select("*").order("category").order("order_index");

  if (error) { listEl.innerHTML = `<p class="muted">Ошибка загрузки: ${error.message}</p>`; return; }
  if (!items.length) { listEl.innerHTML = `<p class="muted">Пока пусто. Материалы добавит администратор.</p>`; return; }

  let html = "";
  let lastCategory = null;
  for (const item of items) {
    if (item.category !== lastCategory) {
      html += `<div class="kb-category">${escapeHtml(item.category)}</div>`;
      lastCategory = item.category;
    }
    html += `
      <details class="card" style="margin-bottom:.8rem">
        <summary style="cursor:pointer;font-weight:600;font-family:var(--font-display);font-size:1.02rem">
          ${escapeHtml(item.title)}
        </summary>
        <div style="margin-top:.8em">${formatContent(item.content)}</div>
      </details>`;
  }
  listEl.innerHTML = html;
}

function formatContent(text) {
  return (text || "").split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
