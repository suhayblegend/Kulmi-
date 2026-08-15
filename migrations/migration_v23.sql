-- =============================================================
--  KULMI migration v23 — normalise gender so opposite-gender-only
--  discovery is reliable. Idempotent.
-- =============================================================

-- Collapse any legacy / mixed-case / variant gender labels down to the two
-- canonical lowercase values the app matches on. Anything unrecognised is left
-- as-is (and simply won't appear as a match until corrected).
update public.profiles
set gender = case
  when lower(trim(gender)) in ('male', 'man', 'brother', 'boy', 'm')   then 'male'
  when lower(trim(gender)) in ('female', 'woman', 'sister', 'girl', 'f') then 'female'
  else gender
end
where gender is not null
  and gender <> case
    when lower(trim(gender)) in ('male', 'man', 'brother', 'boy', 'm')   then 'male'
    when lower(trim(gender)) in ('female', 'woman', 'sister', 'girl', 'f') then 'female'
    else gender
  end;

notify pgrst, 'reload schema';
