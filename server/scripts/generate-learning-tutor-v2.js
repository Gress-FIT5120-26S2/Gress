import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';

const destination=new URL('../data/learning-tutor/v2/',import.meta.url);
const migration=new URL('../../supabase/migrations/20261008014000_learning_tutor_evidence_v2.sql',import.meta.url);
for(const path of [new URL('manifest.json',destination),migration])
  await access(path).then(()=>{throw new Error('Existing versions and migrations cannot be overwritten.');},()=>undefined);
const original=JSON.parse(await readFile(new URL('../data/learning-tutor/v1/manifest.json',import.meta.url)));
const {manifestHash:oldHash,review:oldReview,...body}=original;
body.manifestVersion='learning-tutor-v2';
// Arthur: NarIyirm
// 中文：补充公开正文只来自登记官方来源，保留课程哈希和独立模板；不将模板答案用作检索材料。
// EN: Supplement public prose from registered official sources, preserving the course hash and independent templates without indexing template answers.
body.knowledge.push({chunkCode:'intermediate-components:reuse-bridge-v2',entityCode:'intermediate-components',
  title:{en:'Reuse suitable items',zh:'再利用合适物品'},topicCodes:['reuse-resources'],sourceRefs:['vic-reuse','vic-single-use'],
  block:{type:'paragraph',text:{
    en:'Reuse suitable items: keep an existing item in use instead of replacing it after one use. Making products uses materials, energy and water. A reusable cup, water bottle or shopping bag can replace repeated disposable purchases. Check that the item is suitable, clean it and follow its care instructions. Do not repurpose packaging in ways that could create food or chemical safety risks. Recycling also needs collection and processing, so consider safe reuse first. This is general Victoria guidance, not a promise about a particular council or business.',
    zh:'再利用合适物品：让已有物品继续使用，避免用一次就换新。制造产品需要材料、能源和水。可重复使用的杯子、水瓶或购物袋可以代替反复购买的一次性物品。核对物品是否适用，清洁并遵循护理说明。不要把包装改作可能造成食品或化学安全风险的用途。回收也需要收集与处理，因此先考虑安全再利用。这是维州的一般指引，不保证某个 council 或商家提供具体服务。'}}});
const manifestHash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
const review={status:'pending',author:'NarIyirm',reviewer:null,reviewedAt:null,approvedManifestHash:null};
await mkdir(destination,{recursive:true});
await writeFile(new URL('manifest.json',destination),JSON.stringify({...body,manifestHash,review},null,2)+'\n');
await writeFile(new URL('eval-cases.json',destination),await readFile(new URL('../data/learning-tutor/v1/eval-cases.json',import.meta.url)));
const quote=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
await writeFile(migration,`-- Arthur: NarIyirm\n-- 中文：补足官方再利用公开教学证据，新增版本不覆盖已应用 v1，独立审核仍 pending。\n-- EN: Add public official reuse evidence as a new version without rewriting applied v1; independent review remains pending.\ninsert into public.learning_tutor_manifests(manifest_version,content_version,content_hash,manifest_hash,body,review_metadata)\nvalues ('${body.manifestVersion}','${body.contentVersion}','${body.contentHash}','${manifestHash}',${quote(body)},${quote(review)});\n`);
console.log(JSON.stringify({manifestVersion:body.manifestVersion,manifestHash,chunks:body.knowledge.length}));
