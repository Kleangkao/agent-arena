import type {IncomingMessage,ServerResponse} from 'node:http';
import {waitUntil} from '@vercel/functions';
import {createApi} from '../server/api.js';
import {supabaseStorage} from '../server/supabase-storage.js';

const {SUPABASE_URL,SUPABASE_SECRET_KEY,ARENA_PUBLIC_ORIGIN,GEMINI_API_KEY,GEMINI_MODEL,VERCEL_ENV,VERCEL_URL,
 GEMINI_V2_API_KEY,ARENA_V2_VALIDATION_TOKEN,ARENA_V25_VALIDATION_TOKEN,ARENA_V26_VALIDATION_TOKEN,
 ARENA_PREVIEW_SQUADS,ARENA_PUBLIC_SQUADS,ARENA_LIVE_MIN_START_INTERVAL_SECONDS}=process.env;
const origin=ARENA_PUBLIC_ORIGIN||(VERCEL_ENV==='preview'&&/^[a-z0-9-]+\.vercel\.app$/i.test(VERCEL_URL??'')?`https://${VERCEL_URL}`:undefined);
const app=SUPABASE_URL&&SUPABASE_SECRET_KEY&&origin&&GEMINI_API_KEY&&GEMINI_MODEL?
 createApi(supabaseStorage(SUPABASE_URL,SUPABASE_SECRET_KEY,ARENA_LIVE_MIN_START_INTERVAL_SECONDS),{
  key:GEMINI_API_KEY,model:GEMINI_MODEL,origin,hosted:true,background:waitUntil,
  hostedSquads:VERCEL_ENV==='preview'&&ARENA_PREVIEW_SQUADS==='1'||VERCEL_ENV==='production'&&ARENA_PUBLIC_SQUADS==='1',
  v2Trial:VERCEL_ENV==='preview'&&GEMINI_V2_API_KEY&&ARENA_V2_VALIDATION_TOKEN?
   {key:GEMINI_V2_API_KEY,token:ARENA_V2_VALIDATION_TOKEN}:undefined,
  v25Trial:VERCEL_ENV==='preview'&&GEMINI_V2_API_KEY&&ARENA_V25_VALIDATION_TOKEN?
   {key:GEMINI_V2_API_KEY,token:ARENA_V25_VALIDATION_TOKEN}:undefined,
  v26Trial:VERCEL_ENV==='preview'&&GEMINI_V2_API_KEY&&ARENA_V26_VALIDATION_TOKEN?
   {key:GEMINI_V2_API_KEY,token:ARENA_V26_VALIDATION_TOKEN}:undefined,
 }):null;

export default function handler(req:IncomingMessage,res:ServerResponse){
 if(!app){
  res.setHeader('Cache-Control','no-store');
  res.writeHead(503,{'Content-Type':'application/json'}).end(JSON.stringify({geminiConfigured:false}));
  return;
 }
 const url=new URL(req.url??'/','http://localhost');
 if(url.pathname==='/api/arena'){
  const route=url.searchParams.get('arenaPath');
  if(!route||! /^(health|guest|coaching|memory|matches(?:\/(?:entry|[a-f0-9-]{36}))?)$/.test(route)){
   res.writeHead(404).end();
   return;
  }
  req.url='/api/'+route;
 }
 app(req,res);
}
