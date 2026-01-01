create or replace function public.handle_project_delete_cleanup()
returns trigger as $$
begin
  update public.training_runs
    set status = 'canceled',
        cancel_requested = true,
        canceled_at = now(),
        completed_at = now(),
        error_message = 'Project deleted.'
    where project_id = old.id
      and status in ('running', 'canceling');

  delete from public.training_runs
    where project_id = old.id
      and status = 'queued';

  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_cleanup_training_runs on public.projects;
create trigger trg_projects_cleanup_training_runs
before delete on public.projects
for each row
execute procedure public.handle_project_delete_cleanup();
