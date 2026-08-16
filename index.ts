// supabase/functions/admin-create-user/index.ts
//
// Позволяет администратору создавать новые аккаунты (логин/пароль).
// Работает на сервере Supabase — service_role ключ никогда не попадает
// в браузер / репозиторий на GitHub. Только эта функция может создавать
// пользователей: обычный signUp() в приложении не используется и должен
// быть отключён в настройках Supabase (см. README, шаг 3).
//
// Деплой: supabase functions deploy admin-create-user

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Клиент от имени вызывающего — чтобы узнать, кто он такой
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return json({ error: "Не авторизован." }, 401);
    }

    // Админ-клиент (service_role) — для проверки роли и создания пользователя
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .single();

    if (callerProfile?.role !== "admin") {
      return json({ error: "Только администратор может создавать пользователей." }, 403);
    }

    const { email, password, full_name, role } = await req.json();

    if (!email || !password || !full_name) {
      return json({ error: "Заполните email, пароль и имя." }, 400);
    }
    if (password.length < 8) {
      return json({ error: "Пароль должен быть не короче 8 символов." }, 400);
    }
    if (role !== "admin" && role !== "manager") {
      return json({ error: "Роль должна быть admin или manager." }, 400);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // не требуем подтверждения почты — вход сразу
    });

    if (createErr) {
      return json({ error: createErr.message }, 400);
    }

    const { error: profileErr } = await admin.from("profiles").insert({
      id: created.user.id,
      full_name,
      role,
    });

    if (profileErr) {
      // откатываем созданного auth-пользователя, если профиль не сохранился
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: profileErr.message }, 400);
    }

    return json({ success: true, user_id: created.user.id }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Неизвестная ошибка" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
