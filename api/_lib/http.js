'use strict';

const buckets = new Map();

function parseAllowedOrigins() {
  return String(process.env.SIMECO_ALLOWED_ORIGINS || '').split(',').map(x=>x.trim()).filter(Boolean);
}

function applyCors(req,res) {
  const origin = req.headers.origin || '';
  const allowed = parseAllowedOrigins();
  const host = req.headers.host || '';
  let sameOrigin = !origin;
  if (origin) { try { sameOrigin = new URL(origin).host === host; } catch { sameOrigin = false; } }
  let accepted = sameOrigin;
  if (allowed.includes('*')) accepted = true;
  if (origin && allowed.includes(origin)) accepted = true;
  if (accepted && origin) res.setHeader('Access-Control-Allow-Origin', origin);
  if (accepted && !origin) res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  return accepted;
}

function enforceOrigin(req,res) {
  if (req.method === 'OPTIONS') { applyCors(req,res); res.status(204).end(); return false; }
  const ok = applyCors(req,res);
  if (!ok) { res.status(403).json({error:'Origen no autorizado. Configura SIMECO_ALLOWED_ORIGINS en el backend.'}); return false; }
  return true;
}

function rateLimit(req,res) {
  const max = Math.max(1, Number(process.env.SIMECO_MAX_REQUESTS_PER_MINUTE || 12));
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const windowMs = 60_000;
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.started >= windowMs) bucket = {started:now,count:0};
  bucket.count += 1; buckets.set(ip,bucket);
  res.setHeader('X-RateLimit-Limit',String(max));
  res.setHeader('X-RateLimit-Remaining',String(Math.max(0,max-bucket.count)));
  if (bucket.count > max) { res.status(429).json({error:'Demasiadas consultas. Intenta nuevamente en un minuto.'}); return false; }
  if (buckets.size > 1000) for (const [key,val] of buckets) if (now-val.started > windowMs*2) buckets.delete(key);
  return true;
}

function getQuery(req,name,defaultValue='') {
  const value = req.query?.[name];
  return Array.isArray(value) ? value[0] : (value ?? defaultValue);
}

module.exports={enforceOrigin,rateLimit,getQuery};
