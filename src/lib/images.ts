import { prototypeStorage } from './prototype-storage';
import { supabase } from '@/integrations/supabase/client';
import {getDemoSession} from './demo';
import {readFile} from './store';
import { generateId } from "./utils";
import { readPreviewSession } from './preview-session';
export async function uploadImage(file:File){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Choose a JPG, PNG or WebP image under 5 MB.');if(getDemoSession()){const path=`demo-image:${generateId()}`;prototypeStorage().setItem(path,await readFile(file));return path;}const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in first');const path=`${user.id}/${generateId()}.${file.type.split('/')[1]}`;const {error}=await supabase.storage.from('ironhaus-images').upload(path,file,{contentType:file.type});if(error)throw error;return path;}
export async function uploadWorkoutMedia(file:File){
  const allowedTypes=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'];
  const maxSize=getDemoSession()?3*1024*1024:25*1024*1024;
  if(!allowedTypes.includes(file.type)||file.size>maxSize)throw new Error(`Choose a JPG, PNG, WebP, GIF or MP4/WebM/MOV video under ${getDemoSession()?'3':'25'} MB.`);
  const extension:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
  if(getDemoSession()){const path=`demo-image:${generateId()}`;prototypeStorage().setItem(path,await readFile(file));return path;}
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in first');const path=`${user.id}/${generateId()}.${extension[file.type]}`;const {error}=await supabase.storage.from('ironhaus-images').upload(path,file,{contentType:file.type});if(error)throw error;return path;
}
export async function imageUrl(path:string){if(!path)return '';if(/^(https?:|data:(?:image|video)\/|blob:|\/)/.test(path))return path;if(getDemoSession()&&path.startsWith('demo-image:'))return prototypeStorage().getItem(path)??'';if(readPreviewSession())return '';const {data,error}=await supabase.storage.from('ironhaus-images').createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}