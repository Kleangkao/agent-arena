create function public.arena_reserve_match(p_id uuid,p_owner text,p_idem uuid,p_config jsonb,p_start_interval_seconds integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 job public.arena_matches;
 memory jsonb;
 current_timepoint timestamptz;
 last_start timestamptz;
 retry_after integer := 0;
 start_interval interval := make_interval(secs=>
  case when p_start_interval_seconds between 1 and 3600 then p_start_interval_seconds else 60 end);
begin
 perform pg_advisory_xact_lock(73026);
 current_timepoint := clock_timestamp();
 if not exists(select 1 from public.arena_guests where id=p_owner and expires>extract(epoch from current_timepoint)*1000)
 then return jsonb_build_object('status','unauthorized'); end if;
 update public.arena_matches set status='interrupted' where status='preparing' and created <= current_timepoint - interval '90 seconds';
 select * into job from public.arena_matches where guest=p_owner and idem=p_idem;
 if found then return jsonb_build_object('status','existing','job',to_jsonb(job)); end if;
 select max(created) into last_start from public.arena_matches where created > current_timepoint - start_interval;
 if last_start is not null then
  retry_after := ceil(extract(epoch from last_start+start_interval-current_timepoint));
 end if;
 if exists (select 1 from public.arena_matches where reflection is null and status in ('preparing','completed') and created > current_timepoint - interval '90 seconds')
 then retry_after := greatest(retry_after,5); end if;
 if retry_after>0 then return jsonb_build_object('status','busy','retryAfter',retry_after); end if;
 select jsonb_build_object('revision',revision,'lessons',lessons) into memory from public.arena_memories where guest=p_owner;
 p_config := jsonb_set(p_config,'{coaches,0,memory}',coalesce(memory,'{"revision":0,"lessons":[]}'::jsonb));
 insert into public.arena_matches(id,guest,idem,status,config,created) values(p_id,p_owner,p_idem,'preparing',p_config,current_timepoint) returning * into job;
 return jsonb_build_object('status','new','job',to_jsonb(job));
end;
$$;

-- Keep existing deployments compatible during rollout.
create or replace function public.arena_reserve_match(p_id uuid,p_owner text,p_idem uuid,p_config jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select public.arena_reserve_match(p_id,p_owner,p_idem,p_config,60);
$$;

revoke execute on function public.arena_reserve_match(uuid,text,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.arena_reserve_match(uuid,text,uuid,jsonb,integer) to service_role;
notify pgrst, 'reload schema';
