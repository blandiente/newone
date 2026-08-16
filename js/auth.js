// js/auth.js — общий клиент Supabase и защита страниц входом
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const LOGIN_DOMAIN = "@lms.learning";
export function toLoginEmail(raw) {
  const value = (raw || "").trim().toLowerCase().replace(/\s+/g, "");
  return value.includes("@") ? value : value + LOGIN_DOMAIN;
}

// Возвращает { user, profile } или редиректит на index.html, если не вошёл.
// requireAdmin=true — дополнительно проверяет роль admin.
export async function requireAuth({ requireAdmin = false } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) {
    await supabase.auth.signOut();
    window.location.href = "index.html";
    return null;
  }

  if (requireAdmin && profile.role !== "admin") {
    window.location.href = "dashboard.html";
    return null;
  }

  return { user: session.user, profile };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}

// Заполняет сайдбар (имя пользователя + ссылка "Админка" если role=admin)
export function renderSidebarUser(profile) {
  const nameEl = document.querySelector("[data-user-name]");
  const roleEl = document.querySelector("[data-user-role]");
  if (nameEl) nameEl.textContent = profile.full_name;
  if (roleEl) roleEl.textContent = profile.role === "admin" ? "Администратор" : "Менеджер по продажам";

  const adminLink = document.querySelector("[data-admin-link]");
  if (adminLink) adminLink.style.display = profile.role === "admin" ? "" : "none";

  const logoutBtn = document.querySelector("[data-logout]");
  if (logoutBtn) logoutBtn.addEventListener("click", signOut);
}

export function showToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2600);
}
