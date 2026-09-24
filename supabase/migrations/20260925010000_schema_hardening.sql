-- Portail Scolaire — contraintes PostgreSQL complémentaires.
-- Migration uniquement additive : elle ne supprime aucune donnée ni aucun objet.

-- PostgreSQL considère les valeurs NULL comme distinctes dans un index unique.
-- Deux index partiels rendent explicites les deux espaces de noms attendus :
-- utilisateurs plateforme et utilisateurs d'un établissement.
create unique index if not exists ux_users_platform_username
  on public.users (username)
  where school_id is null;

create unique index if not exists ux_users_tenant_username
  on public.users (school_id, username)
  where school_id is not null;

-- Même principe pour les coefficients généraux et ceux propres à une série.
create unique index if not exists ux_coef_without_series
  on public.coefficients (school_id, level_id, subject_id)
  where series_id is null;

create unique index if not exists ux_coef_with_series
  on public.coefficients (school_id, level_id, series_id, subject_id)
  where series_id is not null;

-- Le schéma autorise six interrogations mais seulement deux devoirs.
do $$ begin
  alter table public.grades add constraint grades_type_idx_check
    check (type <> 'devoir' or idx <= 2);
exception when duplicate_object then null;
end $$;

-- Un super-administrateur appartient à la plateforme, tous les autres rôles à une école.
do $$ begin
  alter table public.users add constraint users_role_school_check
    check (
      (role = 'superadmin' and school_id is null)
      or (role <> 'superadmin' and school_id is not null)
    );
exception when duplicate_object then null;
end $$;

-- Les clés étrangères simples garantissent l'existence, mais pas l'appartenance au même
-- établissement. Ces déclencheurs empêchent une référence croisée même en cas de bug serveur.
create or replace function public.assert_same_school()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_school_id bigint;
  student_school_id bigint;
begin
  case tg_table_name
    when 'students' then
      select school_id into parent_school_id from public.users where id = new.user_id;
      select school_id into student_school_id from public.classes where id = new.class_id;
      if parent_school_id is distinct from new.school_id or student_school_id is distinct from new.school_id then
        raise exception using errcode = '23514', message = 'students references must belong to the same school';
      end if;
    when 'classes' then
      select school_id into parent_school_id from public.levels where id = new.level_id;
      if parent_school_id is distinct from new.school_id then
        raise exception using errcode = '23514', message = 'class level must belong to the same school';
      end if;
      if new.series_id is not null then
        select school_id into parent_school_id from public.series where id = new.series_id;
        if parent_school_id is distinct from new.school_id then
          raise exception using errcode = '23514', message = 'class series must belong to the same school';
        end if;
      end if;
    when 'parent_students' then
      select school_id into parent_school_id from public.users where id = new.parent_id;
      select school_id into student_school_id from public.students where id = new.student_id;
      if parent_school_id is distinct from student_school_id then
        raise exception using errcode = '23514', message = 'parent and student must belong to the same school';
      end if;
    else
      raise exception 'assert_same_school is not configured for table %', tg_table_name;
  end case;
  return new;
end
$$;

drop trigger if exists students_same_school on public.students;
create trigger students_same_school
before insert or update on public.students
for each row execute function public.assert_same_school();

drop trigger if exists classes_same_school on public.classes;
create trigger classes_same_school
before insert or update on public.classes
for each row execute function public.assert_same_school();

drop trigger if exists parent_students_same_school on public.parent_students;
create trigger parent_students_same_school
before insert or update on public.parent_students
for each row execute function public.assert_same_school();

create or replace function public.assert_scoped_reference()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ref_column text := tg_argv[0];
  ref_table text := tg_argv[1];
  ref_id bigint;
  ref_school_id bigint;
begin
  ref_id := (to_jsonb(new) ->> ref_column)::bigint;
  if ref_id is null then return new; end if;
  execute format('select school_id from public.%I where id = $1', ref_table)
    into ref_school_id using ref_id;
  if ref_school_id is distinct from new.school_id then
    raise exception using errcode = '23514', message = format('%s.%s must belong to school_id %s', tg_table_name, ref_column, new.school_id);
  end if;
  return new;
end
$$;

do $$
declare
  spec text[];
  specs text[][] := array[
    array['coefficients','level_id','levels'], array['coefficients','series_id','series'], array['coefficients','subject_id','subjects'],
    array['teaching_assignments','teacher_id','users'], array['teaching_assignments','class_id','classes'], array['teaching_assignments','subject_id','subjects'],
    array['grades','student_id','students'], array['grades','subject_id','subjects'], array['grades','term_id','terms'], array['grades','created_by','users'],
    array['attendance','student_id','students'], array['attendance','class_id','classes'], array['attendance','subject_id','subjects'], array['attendance','recorded_by','users'],
    array['justifications','attendance_id','attendance'], array['justifications','student_id','students'], array['justifications','submitted_by','users'], array['justifications','reviewed_by','users'],
    array['chapters','class_id','classes'], array['chapters','subject_id','subjects'], array['chapters','teacher_id','users'],
    array['lessons','class_id','classes'], array['lessons','subject_id','subjects'], array['lessons','teacher_id','users'],
    array['archives','class_id','classes'], array['archives','subject_id','subjects'], array['archives','uploaded_by','users'],
    array['discipline','student_id','students'], array['discipline','class_id','classes'], array['discipline','recorded_by','users'],
    array['announcements','author_id','users'], array['announcement_images','announcement_id','announcements']
  ];
begin
  foreach spec slice 1 in array specs loop
    execute format('drop trigger if exists %I on public.%I', spec[1] || '_' || spec[2] || '_same_school', spec[1]);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.assert_scoped_reference(%L, %L)',
      spec[1] || '_' || spec[2] || '_same_school', spec[1], spec[2], spec[3]
    );
  end loop;
end
$$;

-- Le rôle serveur contourne RLS par conception, tandis que les rôles anon/authenticated
-- restent sans droit d'écriture jusqu'à la migration explicite vers Supabase Auth.
comment on function public.assert_same_school() is 'Bloque les références inter-établissements non représentées par un school_id sur la ligne.';
comment on function public.assert_scoped_reference() is 'Vérifie que chaque référence porte le même school_id que la ligne insérée ou modifiée.';
