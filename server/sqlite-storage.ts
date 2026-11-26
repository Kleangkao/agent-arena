import type {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {loadMemory,saveReflection} from '../scripts/memory-store';
import {liveStartInterval,matchStatus,type ArenaStorage,type Job,type Reflection} from './storage';

export function sqliteStorage(db:DatabaseSync,memoryDir:string,minStartIntervalSeconds?:string|number):ArenaStorage {
 const startIntervalMs=liveStartInterval(minStartIntervalSeconds)*1000;
 const staleMs=90_000;
 db.exec(`PRAGMA busy_timeout=1000;
 CREATE TABLE IF NOT EXISTS guests(id TEXT PRIMARY KEY, expires INTEGER);
 CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY, guest TEXT, idem TEXT, status TEXT, replay TEXT, config TEXT, created INTEGER, UNIQUE(guest,idem));
 CREATE INDEX IF NOT EXISTS arena_matches_created ON matches(created);
 CREATE TABLE IF NOT EXISTS coaching(guest TEXT NOT NULL, revision TEXT NOT NULL, text TEXT NOT NULL, PRIMARY KEY(guest,revision));`);
 const recoverAbandoned=db.prepare("UPDATE matches SET status='interrupted' WHERE status='preparing' AND created<=?");
 const latestStart=db.prepare('SELECT max(created) AS created FROM matches WHERE created>?');
 const inFlightMatch=db.prepare(`SELECT 1 FROM matches WHERE created>? AND
  (status='preparing' OR (status='completed' AND json_extract(config,'$.reflection') IS NULL)) LIMIT 1`);
 const read=(query:string,owner:string,argument:string):Job|null=>{
  const row=db.prepare(query).get(owner,argument) as {id:string;status:Job['status'];replay:string|null;config:string;created:number}|undefined;
  if(!row)return null;
  if(row.status==='preparing'&&row.created<=Date.now()-staleMs){
   recoverAbandoned.run(Date.now()-staleMs);
   return read(query,owner,argument);
  }
  const config=JSON.parse(row.config);
  return {id:row.id,status:row.status,replay:row.replay?JSON.parse(row.replay):null,config,reflection:config.reflection??null};
 };
 const memory=(owner:string)=>loadMemory(memoryDir,owner.slice(0,40));
 const existing=(owner:string,idem:string)=>read('SELECT * FROM matches WHERE guest=? AND idem=?',owner,idem);
 return {
  guest:id=>!!db.prepare('SELECT 1 FROM guests WHERE id=? AND expires>?').get(id,Date.now()),
  createGuest(id,expires){
   db.prepare('DELETE FROM guests WHERE expires <= ?').run(Date.now());
   if(Number(db.prepare('SELECT count(*) AS n FROM guests').get()?.n)>=100)return false;
   db.prepare('INSERT INTO guests VALUES (?,?)').run(id,expires);
   return true;
  },
  memory,
  coaching:owner=>(db.prepare('SELECT text FROM coaching WHERE guest=? ORDER BY rowid DESC LIMIT 1').get(owner)?.text as string|undefined)??null,
  saveCoaching(owner,text,revision){db.prepare('INSERT OR REPLACE INTO coaching VALUES (?,?,?)').run(owner,revision,text)},
  find:(owner,id)=>read('SELECT * FROM matches WHERE guest=? AND id=?',owner,id),
  existing,
  reserve({id,owner,requestId,config}){
   db.exec('BEGIN IMMEDIATE');
   try {
    const now=Date.now();
    recoverAbandoned.run(now-staleMs);
    const found=existing(owner,requestId);
    if(found)return {status:'existing',job:found};
    const last=latestStart.get(now-startIntervalMs)?.created;
    const wait=typeof last==='number'?Math.ceil((last+startIntervalMs-now)/1000):0;
    const retryAfter=Math.max(wait,inFlightMatch.get(now-staleMs)?5:0);
    if(retryAfter)return {status:'busy',retryAfter};
    db.prepare('INSERT INTO matches VALUES (?,?,?,?,?,?,?)').run(id,owner,requestId,'preparing',null,JSON.stringify(config),now);
    db.exec('COMMIT');
   }finally{
    if(db.isTransaction)db.exec('ROLLBACK');
   }
   return {status:'new',job:{id,status:'preparing',replay:null,config,reflection:null}};
  },
  finish(id,replay,attempts,durationMs){
   const row=db.prepare('SELECT config FROM matches WHERE id=?').get(id);
   const config={...JSON.parse(String(row?.config)),attempts,durationMs};
   const status=matchStatus(replay);
   db.prepare("UPDATE matches SET status=?,replay=?,config=? WHERE id=? AND status='preparing'").run(status,replay?JSON.stringify(replay):null,JSON.stringify(config),id);
  },
  reflect(owner,id,lessons){
   const row=db.prepare("SELECT config FROM matches WHERE id=? AND guest=? AND status='completed'").get(id,owner);
   if(!row)return;
   const config=JSON.parse(String(row.config));
   if(config.reflection)return;
   const reflection:Reflection=lessons?{status:'saved',revision:saveReflection(memoryDir,owner.slice(0,40),createHash('sha256').update(id).digest('hex'),lessons).revision,lessons}:{status:'unavailable'};
   db.prepare('UPDATE matches SET config=? WHERE id=?').run(JSON.stringify({...config,reflection}),id);
  },
 };
}
