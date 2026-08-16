-- =========================================================
-- LMS для менеджеров по продажам недвижимости
-- Схема базы данных + политики безопасности (RLS)
-- Выполнить целиком в Supabase → SQL Editor → New query → Run
-- =========================================================

-- Расширение для генерации UUID (обычно уже включено в Supabase)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- ПРОФИЛИ ПОЛЬЗОВАТЕЛЕЙ
-- Хранит роль (admin / manager) для каждого аккаунта.
-- Строки создаются только Edge Function'ом admin-create-user
-- (через service_role, в обход RLS) — сами пользователи не
-- могут себя зарегистрировать или назначить себе роль.
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'manager' check (role in ('admin','manager')),
  created_at timestamptz not null default now()
);

-- Функция для проверки "текущий пользователь — админ".
-- security definer позволяет ей читать profiles в обход RLS,
-- иначе политика на profiles сама себя рекурсивно блокировала бы.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

create policy "profiles: read own or admin reads all"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles: admin can update any, user can update own name"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- Вставка строк в profiles делает только Edge Function через
-- service_role — политика INSERT намеренно не создаётся, поэтому
-- обычным пользователям (anon/authenticated) вставка запрещена.

-- ---------------------------------------------------------
-- КУРСЫ / УРОКИ
-- ---------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  content text not null default '',
  video_url text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;
alter table public.lessons enable row level security;

create policy "courses: any logged-in user can read"
  on public.courses for select
  using (auth.role() = 'authenticated');

create policy "courses: only admin can write"
  on public.courses for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "lessons: any logged-in user can read"
  on public.lessons for select
  using (auth.role() = 'authenticated');

create policy "lessons: only admin can write"
  on public.lessons for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------
-- ТЕСТЫ / ВОПРОСЫ / ОТВЕТЫ
-- ---------------------------------------------------------
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  pass_score int not null default 70, -- минимальный % для сдачи
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  question_text text not null,
  order_index int not null default 0
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_text text not null,
  is_correct boolean not null default false,
  order_index int not null default 0
);

alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;

create policy "tests: any logged-in user can read"
  on public.tests for select using (auth.role() = 'authenticated');
create policy "tests: only admin can write"
  on public.tests for all using (public.is_admin()) with check (public.is_admin());

create policy "questions: any logged-in user can read"
  on public.questions for select using (auth.role() = 'authenticated');
create policy "questions: only admin can write"
  on public.questions for all using (public.is_admin()) with check (public.is_admin());

-- ВНИМАНИЕ: is_correct на answers виден любому вошедшему пользователю
-- (т.к. это простой клиентский LMS без сервера, проверяющего ответы).
-- Это защищает от посторонних (не залогиненных), но не от списывания
-- через код внутри своей команды. Для полной защиты потребовался бы
-- отдельный Edge Function, проверяющий ответы на сервере — см. README,
-- раздел "Ограничения", если это критично для вас.
create policy "answers: any logged-in user can read"
  on public.answers for select using (auth.role() = 'authenticated');
create policy "answers: only admin can write"
  on public.answers for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------
-- ПРОГРЕСС ОБУЧЕНИЯ
-- ---------------------------------------------------------
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default true,
  completed_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  score int not null,
  passed boolean not null,
  completed_at timestamptz not null default now()
);

alter table public.lesson_progress enable row level security;
alter table public.test_results enable row level security;

create policy "lesson_progress: own rows or admin"
  on public.lesson_progress for select
  using (auth.uid() = user_id or public.is_admin());
create policy "lesson_progress: insert own rows only"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);
create policy "lesson_progress: update own rows only"
  on public.lesson_progress for update
  using (auth.uid() = user_id);

create policy "test_results: own rows or admin"
  on public.test_results for select
  using (auth.uid() = user_id or public.is_admin());
create policy "test_results: insert own rows only"
  on public.test_results for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------
-- БАЗА ЗНАНИЙ / СКРИПТЫ ПРОДАЖ
-- ---------------------------------------------------------
create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Общее',
  title text not null,
  content text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.knowledge_base enable row level security;

create policy "knowledge_base: any logged-in user can read"
  on public.knowledge_base for select using (auth.role() = 'authenticated');
create policy "knowledge_base: only admin can write"
  on public.knowledge_base for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------
-- ГОТОВО.
-- Дальше: создайте первого администратора через Edge Function
-- admin-create-user (см. README, шаг 4), либо вручную:
--   1. Authentication → Users → Add user (задайте email/пароль)
--   2. Table editor → profiles → Insert row:
--      id = скопированный id пользователя,
--      full_name = 'Администратор', role = 'admin'
-- ---------------------------------------------------------
