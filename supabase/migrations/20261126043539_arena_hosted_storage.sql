create table public.arena_guests (
 id text primary key,
 expires bigint not null,
 request_minute bigint not null default 0,
 requests integer not null default 0
);
create table public.arena_matches (
 id uuid primary key,
 guest text not null,
 idem uuid not null,
 status text not null check (status in ('preparing','completed','interrupted')),
 replay jsonb,
 config jsonb not null,
 reflection jsonb,
 created timestamptz not null default now(),
 unique (guest,idem)
);
create index arena_matches_created on public.arena_matches(created);
create table public.arena_coaching (
 guest text not null,
 revision text not null,
 text text not null check (length(text)<=1000),
 saved timestamptz not null default clock_timestamp(),
 primary key (guest,revision)
);
create table public.arena_memories (
 guest text primary key,
 revision integer not null,
 lessons jsonb not null
);
alter table public.arena_guests enable row level security;
alter table public.arena_matches enable row level security;
alter table public.arena_coaching enable row level security;
alter table public.arena_memories enable row level security;
revoke all on public.arena_guests,public.arena_matches,public.arena_coaching,public.arena_memories from public,anon,authenticated;
grant select,insert,update,delete on public.arena_guests,public.arena_matches,public.arena_coaching,public.arena_memories to service_role;

create function public.arena_create_guest(p_id text,p_expires bigint)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(73025);
 delete from public.arena_guests where expires <= extract(epoch from clock_timestamp())*1000;
 if (select count(*) from public.arena_guests)>=100 then return false; end if;
 insert into public.arena_guests(id,expires) values(p_id,p_expires);
 return true;
end;
$$;

create function public.arena_guest_request(p_id text)
returns text language plpgsql security invoker set search_path='' as $$
declare
 minute_bucket bigint := floor(extract(epoch from clock_timestamp())/60);
begin
 update public.arena_guests
 set request_minute=minute_bucket, requests=case when request_minute=minute_bucket then requests+1 else 1 end
 where id=p_id and expires > extract(epoch from clock_timestamp())*1000
 and (request_minute<>minute_bucket or requests<90);
 if found then return 'allowed'; end if;
 if exists(select 1 from public.arena_guests where id=p_id and expires > extract(epoch from clock_timestamp())*1000)
 then return 'limited'; end if;
 return 'missing';
end;
$$;

create function public.arena_reserve_match(p_id uuid,p_owner text,p_idem uuid,p_config jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 job public.arena_matches;
 memory jsonb;
 current_timepoint timestamptz := clock_timestamp();
begin
 perform pg_advisory_xact_lock(73026);
 if not exists(select 1 from public.arena_guests where id=p_owner and expires>extract(epoch from clock_timestamp())*1000)
 then return jsonb_build_object('status','unauthorized'); end if;
 update public.arena_matches set status='interrupted' where status='preparing' and created < current_timepoint - interval '90 seconds';
 select * into job from public.arena_matches where guest=p_owner and idem=p_idem;
 if found then return jsonb_build_object('status','existing','job',to_jsonb(job)); end if;
 if (select count(*) from public.arena_matches where created > current_timepoint - interval '1 day' and guest=p_owner)>=2
 then return jsonb_build_object('status','agent-limit'); end if;
 -- Reserve the worst-case 20 decision calls plus one reflection per match for 24 hours.
 if (select count(*) from public.arena_matches where created > current_timepoint - interval '1 day')>=2
 then return jsonb_build_object('status','arena-limit'); end if;
 if exists (select 1 from public.arena_matches where created > current_timepoint - interval '60 seconds')
 or exists (select 1 from public.arena_matches where reflection is null and status in ('preparing','completed') and created > current_timepoint - interval '90 seconds') then
  return jsonb_build_object('status','busy');
 end if;
 select jsonb_build_object('revision',revision,'lessons',lessons) into memory from public.arena_memories where guest=p_owner;
 p_config := jsonb_set(p_config,'{coaches,0,memory}',coalesce(memory,'{"revision":0,"lessons":[]}'::jsonb));
 insert into public.arena_matches(id,guest,idem,status,config) values(p_id,p_owner,p_idem,'preparing',p_config) returning * into job;
 return jsonb_build_object('status','new','job',to_jsonb(job));
end;
$$;

create function public.arena_reflect_match(p_owner text,p_id uuid,p_lessons jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare
 next_revision integer;
begin
 perform pg_advisory_xact_lock(73026);
 perform 1 from public.arena_matches where id=p_id and guest=p_owner and status='completed' and reflection is null;
 if not found then return; end if;
 if p_lessons is null then
  update public.arena_matches set reflection='{"status":"unavailable"}' where id=p_id;
  return;
 end if;
 insert into public.arena_memories(guest,revision,lessons) values(p_owner,1,p_lessons)
 on conflict(guest) do update set revision=arena_memories.revision+1,lessons=excluded.lessons
 returning revision into next_revision;
 update public.arena_matches set reflection=jsonb_build_object('status','saved','revision',next_revision,'lessons',p_lessons) where id=p_id;
end;
$$;

revoke execute on function public.arena_create_guest(text,bigint),public.arena_guest_request(text),public.arena_reserve_match(uuid,text,uuid,jsonb),public.arena_reflect_match(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.arena_create_guest(text,bigint),public.arena_guest_request(text),public.arena_reserve_match(uuid,text,uuid,jsonb),public.arena_reflect_match(text,uuid,jsonb) to service_role;
