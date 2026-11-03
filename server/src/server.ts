import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { db } from './db.js';
import { isValidAdminSessionToken } from './admin-session.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters.');
const production = process.env.NODE_ENV === 'production';
const frontendOrigins = (process.env.FRONTEND_ORIGIN || (production ? '' : 'http://localhost:5173'))
 .split(',')
 .map(origin => origin.trim())
 .filter(Boolean);
if (production && frontendOrigins.length === 0) throw new Error('FRONTEND_ORIGIN must be set in production.');
const sameSiteValue = process.env.COOKIE_SAME_SITE || (production ? 'none' : 'lax');
const sameSiteValues = ['strict', 'lax', 'none'] as const;
const cookieSameSite = sameSiteValues.find(value => value === sameSiteValue);
if (!cookieSameSite) throw new Error('COOKIE_SAME_SITE must be strict, lax, or none.');
if (sameSiteValue === 'none' && !production) throw new Error('COOKIE_SAME_SITE=none requires production HTTPS.');
app.disable('x-powered-by');
app.use(cors({ origin: frontendOrigins, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }));
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const cookieOptions = { httpOnly: true, secure: production, sameSite: cookieSameSite, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
type User = {id:string; full_name:string; phone:string; email:string|null; password_hash:string; account_type:'owner'|'client'; qr_id:string; created_at:string; is_active:number};
function safeUser(u: User) { return { id:u.id, fullName:u.full_name, phone:u.phone, email:u.email, accountType:u.account_type === 'owner' ? 'gym' : 'individual', qrId:u.qr_id, createdAt:u.created_at }; }
function getUser(req: express.Request): User | undefined {
 const token = req.cookies?.gyvora_session;
 if (!token) return undefined;
 try { const payload = jwt.verify(token, secret!) as {sid:string; sub:string}; const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash=?').get(hashToken(payload.sid)) as {user_id:string;expires_at:number}|undefined; if (!session || session.expires_at < Date.now() || session.user_id !== payload.sub) return undefined; return db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(session.user_id) as User|undefined; } catch { return undefined; }
}
function requireUser(req:express.Request,res:express.Response,next:express.NextFunction){ const user=getUser(req); if(!user)return res.status(401).json({error:'Please sign in.'}); (req as any).user=user; next(); }
app.get('/api/health', (_req,res)=>res.json({ok:true}));
app.post('/api/auth/register', (req,res)=>{
 const fullName=typeof req.body?.fullName==='string'?req.body.fullName.trim():'';
 const phone=typeof req.body?.phone==='string'?req.body.phone.replace(/[\s()-]/g,''):'';
 const email=typeof req.body?.email==='string'&&req.body.email.trim()?req.body.email.trim().toLowerCase():null;
 const password=req.body?.password;
 const type=req.body?.accountType;
 if(!fullName||fullName.length>100||!phone||phone.length>30||typeof password!=='string'||password.length<4||password.length>128||!['gym','individual'].includes(type)) return res.status(400).json({error:'Enter a name, valid phone number, account type, and password of at least 4 characters.'});
 if(email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>255)) return res.status(400).json({error:'Enter a valid email address.'});
 const normalizedPhone=normalizePhone(phone);
 if(db.prepare('SELECT id FROM users WHERE phone=?').get(normalizedPhone)) return res.status(409).json({error:'This phone number already has an account. Please sign in instead.'});
 if(email && db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({error:'This email already has an account. Please sign in instead.'});
 const id=randomUUID(), qrId=randomBytes(24).toString('base64url'), passwordHash=bcrypt.hashSync(password,12);
 try { db.prepare('INSERT INTO users (id,full_name,phone,email,password_hash,account_type,qr_id) VALUES (?,?,?,?,?,?,?)').run(id,fullName,normalizedPhone,email,passwordHash,type==='gym'?'owner':'client',qrId); const user=db.prepare('SELECT * FROM users WHERE id=?').get(id) as User; return res.status(201).json({user:safeUser(user)}); }
 catch(e){ if(String(e).includes('UNIQUE'))return res.status(409).json({error:'This phone number or email already has an account. Please sign in instead.'}); console.error('register failed'); return res.status(500).json({error:'Could not create account.'}); }
});
app.post('/api/auth/login',(req,res)=>{
 const contact=typeof req.body?.contact==='string'?req.body.contact.trim():''; const password=req.body?.password;
 if(!contact||typeof password!=='string'||!password)return res.status(400).json({error:'Enter your phone or email and password.'});
 const normalizedContact=contact.includes('@')?contact.toLowerCase():normalizePhone(contact);
 const user=db.prepare('SELECT * FROM users WHERE (phone=? OR lower(coalesce(email,\'\'))=lower(?)) AND is_active=1').get(normalizedContact,normalizedContact) as User|undefined;
 if(!user||!bcrypt.compareSync(password,user.password_hash))return res.status(401).json({error:'No matching account was found, or the password is incorrect.'});
 const sid=randomBytes(32).toString('base64url'), expires=Date.now()+7*24*60*60*1000;
 db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hashToken(sid),user.id,expires);
 const token=jwt.sign({sid,sub:user.id},secret!,{expiresIn:'7d',issuer:'gyvora-api',audience:'gyvora-app'});
 res.cookie('gyvora_session',token,cookieOptions); return res.json({user:safeUser(user)});
});
app.post('/api/auth/logout',(req,res)=>{const user=getUser(req); const token=req.cookies?.gyvora_session; if(token){try{const p=jwt.verify(token,secret!) as {sid:string};db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(p.sid));}catch{}} res.clearCookie('gyvora_session',{path:'/'});res.json({ok:true});});
app.get('/api/auth/me',requireUser,(req,res)=>res.json({user:safeUser((req as any).user)}));
app.get('/api/users/me',requireUser,(req,res)=>res.json({user:safeUser((req as any).user)}));
app.get('/api/admin/users',rateLimit({windowMs:15*60*1000,limit:120,standardHeaders:'draft-8',legacyHeaders:false}),(req,res)=>{
 const authorization=req.header('authorization')??'';
 const token=authorization.startsWith('Bearer ')?authorization.slice(7):'';
 const adminSecret=process.env.GYVORA_ADMIN_SESSION_SECRET||process.env.GYVORA_ADMIN_PASSWORD;
 if(!adminSecret||!token||!isValidAdminSessionToken(token,adminSecret))return res.status(403).json({error:'Administrator access required.'});
 const users=db.prepare('SELECT id,full_name,phone,email,account_type,qr_id,created_at,is_active FROM users ORDER BY created_at DESC')
  .all() as Array<{id:string;full_name:string;phone:string;email:string|null;account_type:'owner'|'client';qr_id:string;created_at:string;is_active:number}>;
 const safeUsers=users.map(user=>({
  id:user.id,
  fullName:user.full_name,
  phone:user.phone,
  email:user.email??'',
  accountType:user.account_type==='owner'?'gym':'individual',
  qrId:user.qr_id,
  createdAt:user.created_at,
  isActive:user.is_active===1,
 }));
 res.json({users:safeUsers});
});
app.post('/api/admin/users/:id/messages',rateLimit({windowMs:15*60*1000,limit:60,standardHeaders:'draft-8',legacyHeaders:false}),(req,res)=>{
 const authorization=req.header('authorization')??'';
 const token=authorization.startsWith('Bearer ')?authorization.slice(7):'';
 const adminSecret=process.env.GYVORA_ADMIN_SESSION_SECRET||process.env.GYVORA_ADMIN_PASSWORD;
 if(!adminSecret||!token||!isValidAdminSessionToken(token,adminSecret))return res.status(403).json({error:'Administrator access required.'});
 const targetId=String(req.params.id??'');
 const body=typeof req.body?.body==='string'?req.body.body.trim():'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)||!body||body.length>2000)
  return res.status(400).json({error:'Enter a valid account and a message of 1-2000 characters.'});
 const target=db.prepare('SELECT id FROM users WHERE id=? AND is_active=1').get(targetId) as {id:string}|undefined;
 if(!target)return res.status(404).json({error:'Active account not found.'});
 const id=randomUUID();
 db.prepare('INSERT INTO account_messages (id,recipient_id,body) VALUES (?,?,?)').run(id,targetId,body);
 const message=db.prepare('SELECT id,body,created_at,read_at FROM account_messages WHERE id=?').get(id);
 return res.status(201).json({message});
});
app.get('/api/users/me/messages',requireUser,(req,res)=>{
 const user=(req as any).user as User;
 const messages=db.prepare('SELECT id,body,created_at,read_at FROM account_messages WHERE recipient_id=? ORDER BY created_at DESC,id DESC').all(user.id);
 res.json({messages});
});
app.post('/api/users/me/messages/read',requireUser,(req,res)=>{
 const user=(req as any).user as User;
 const ids=req.body?.ids;
 if(!Array.isArray(ids)||ids.length>500||ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))
  return res.status(400).json({error:'Invalid message IDs.'});
 if(ids.length){
  const placeholders=ids.map(()=>'?').join(',');
  db.prepare(`UPDATE account_messages SET read_at=CURRENT_TIMESTAMP WHERE recipient_id=? AND id IN (${placeholders})`).run(user.id,...ids);
 }
 return res.json({ok:true});
});
function normalizePhone(value:string){let p=value.replace(/[\s()-]/g,'');if(p.startsWith('0020'))p=`+${p.slice(2)}`;else if(p.startsWith('0'))p=`+20${p.slice(1)}`;else if(p.startsWith('20'))p=`+${p}`;else if(!p.startsWith('+'))p=`+${p}`;return p}
app.get('/api/users/qr/:qrId',requireUser,(req,res)=>{const qrId=String(req.params.qrId||'');if(qrId.length<16||qrId.length>100)return res.status(404).json({error:'QR code not found.'});const user=db.prepare('SELECT id,full_name,phone,email,account_type,qr_id,created_at FROM users WHERE qr_id=? AND is_active=1').get(qrId) as User|undefined;if(!user)return res.status(404).json({error:'QR code not found.'});res.json({user:safeUser(user)});});
app.listen(port, '0.0.0.0',()=>console.log(`GYVORA API listening on port ${port}`));
