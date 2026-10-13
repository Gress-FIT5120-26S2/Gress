import { writeFile } from 'node:fs/promises';

// Arthur: NarIyirm
// 中文：固定到公开仓库的提交，避免分支更新改变展示素材；平台会删除 data URL 图片。
// EN: Pin public assets to a commit so branch updates cannot change them; Mahara removes data URL images.
const base = 'https://raw.githubusercontent.com/Gress-FIT5120-26S2/Gress/bc2ca53af5cb55598ecc117860624598d611f555/';
const assets = {
  logo: base + 'assets/icon.png',
  spoonie: base + 'assets/kitchmemo-assistant.png',
  family: base + 'assets/shared-fridge-family.png',
  mountain: base + 'assets/achievements/mountain-lv3.png',
  learning: base + 'docs/learning-room/verification/2026-10-05/p2-web/01-hub.jpg',
  course: base + 'assets/learning-room/waste-basics-course-cover.webp',
  kitchen: 'https://eportfolio.monash.edu/artefact/file/download.php?file=562155&view=253992&time=1791744121',
};
const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const image = (key, alt, width, extra = '') => `<img src="${escape(assets[key])}" alt="${alt}" width="${width}" style="max-width:100%;height:auto;margin:0 auto;${extra}" />`;
const h2 = text => `<h2 style="color:#163c2c;font-size:34px;line-height:1.2;margin:0 0 14px;font-weight:bold;">${text}</h2>`;
const h3 = text => `<h3 style="color:#163c2c;font-size:29px;line-height:1.2;margin:0 0 12px;font-weight:bold;">${text}</h3>`;
const h4 = text => `<h4 style="color:#163c2c;font-size:24px;line-height:1.3;margin:0 0 10px;font-weight:bold;">${text}</h4>`;
const p = text => `<p style="font-size:16px;line-height:1.7;margin:0 0 14px;color:#42584a;">${text}</p>`;
const label = text => `<p style="color:#245b3e;font-size:14px;font-weight:bold;margin:0 0 12px;">${text}</p>`;
const link = (url, text) => `<a href="${escape(url)}" style="color:#245b3e;font-size:15px;font-weight:bold;text-decoration:underline;">${text} &#8599;</a>`;
const column = content => `<div style="float:left;width:48%;max-width:470px;margin:12px 1%;font-size:16px;">${content}</div>`;
const columns = (left, right) => `<div>${column(left)}${column(right)}<div style="clear:both;"></div></div>`;
const card = content => `<div style="background-color:#f2f5ec;border:1px solid #dce5d5;border-radius:20px;padding:28px;margin:0 0 24px;">${content}</div>`;
const bullet = text => `<li style="font-size:16px;line-height:1.7;margin-bottom:7px;">${text}</li>`;
const one = 'https://eportfolio.monash.edu/view/view.php?t=437f0c2c53a9242490ab';
const two = 'https://eportfolio.monash.edu/view/view.php?t=91864bcd6724f3369d72';

// Arthur: NarIyirm
// 中文：Some HTML 删除 style、section、display 和图片 width 样式；用 float 百分比双栏适配平台的电脑端容器。
// EN: Some HTML strips style, section, display and image width CSS; percentage floats fit the platform's desktop containers.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KitchMemo | Project introduction</title></head><body>
<div style="max-width:1080px;margin:0 auto;background-color:#fbfcf7;color:#42584a;font-family:Arial,Helvetica,sans-serif;line-height:1.6;padding:24px;">
  <div style="border-bottom:1px solid #dce5d5;padding:0 0 20px;margin:0 0 28px;">
    <p style="margin:0;color:#163c2c;font-size:27px;font-weight:bold;"><img src="${escape(assets.logo)}" alt="" width="40" height="40" style="vertical-align:middle;margin-right:10px;" />KitchMemo</p>
    <p style="margin:8px 0 0;font-size:14px;color:#556957;">Our story &nbsp; / &nbsp; Our journey &nbsp; / &nbsp; Our team</p>
  </div>
  ${columns(`<h1 style="color:#163c2c;font-size:42px;line-height:1.12;margin:0 0 22px;font-weight:bold;">Remember your food.<br />Rethink your waste.</h1>${p('Know what you have. Use it in time. Waste less.')}${p('A connected kitchen for young households.')}`, image('kitchen', 'The miniature KitchMemo kitchen, from our Iteration 1 portfolio.', 460))}
  <div style="background-color:#edf3e3;border:1px solid #dce5d5;border-radius:20px;padding:28px;margin:30px 0;">
    <div style="float:right;width:96px;margin:0 0 14px 16px;">${image('spoonie','Spoonie welcomes our industry mentor.',96)}</div>
    ${h2('Welcome, Hilda!')}${p('<strong>Our Industry Mentor</strong>')}${p('Thank you for your guidance, thoughtful feedback, and support throughout the KitchMemo journey.')}${link('https://www.linkedin.com/in/hilda-permata-9387a2a2','Hilda Permata on LinkedIn')}<div style="clear:both;"></div>
  </div>
  <div style="padding:20px 0 32px;">
    ${h2('Why KitchMemo?')}${p('<strong>Forgotten food. Repeat purchases. Everyday effort.</strong>')}${p('Young Australian households can lose track of what is at home, what needs using, and what to buy next.')}${p('Our starting point is simple: make food easier to remember. KitchMemo connects inventory, freshness, shopping and learning so households can make confident decisions and waste less together.')}
    <div style="border-top:2px solid #dce5d5;padding-top:18px;margin-top:24px;">${h4('01 &nbsp; Capture')}${p('Add food through photo-assisted, barcode or manual entry.')}${h4('02 &nbsp; Know')}${p('See what you have and what needs attention.')}${h4('03 &nbsp; Act')}${p('Use food in time, plan shopping and learn practical actions.')}</div>
  </div>
  <div style="background-color:#163c2c;color:#ffffff;border-radius:20px;padding:32px;margin:0 0 40px;">
    <!-- Arthur: NarIyirm
         中文：平台主题强制标题为深色；在子元素上明确设为白色以保持对比度。
         EN: The platform theme forces dark heading text; set white on the child to preserve contrast. -->
    <h2 style="font-size:31px;line-height:1.2;margin:0 0 14px;"><span style="color:#ffffff;">A glimpse of the KitchMemo story</span></h2>
    <p style="color:#ffffff;margin:0 0 10px;font-size:17px;">Our AI-created product film</p>
    <p style="color:#e4ecd9;margin:0;font-size:15px;line-height:1.6;">An AI-created story about everyday food choices, practical learning and shared responsibility.</p>
  </div>
  ${h2('Our journey')}${p('From food awareness to shared household action.')}
  ${card(`${label('ITERATION 1')}${h3('Know your kitchen')}${p('A foundation for knowing what is at home.')}<ul style="padding-left:22px;margin:18px 0;">${bullet('Interactive 3D kitchen')}${bullet('Food entry and shared inventory')}${bullet('Freshness reminders and shopping awareness')}</ul>${p('We connected the fridge, reminders and shopping around the same household information, making daily food decisions easier to follow.')}${link(one,'View the Iteration 1 portfolio')}`)}
  ${card(`${label('ITERATION 2')}${h3('Turn knowledge into action')}${p('Fridge-aware guidance and positive feedback for everyday food habits.')}${columns(`${image('spoonie','Spoonie, the fridge-aware AI assistant.',130)}${h4('Spoonie AI')}${p('<strong>“What should I use first?”</strong>')}${p('Ask freely or use quick prompts. Spoonie grounds its guidance in your household fridge, helping you review food and plan restocking.')}${p('Inventory changes only happen after you confirm. Requests outside its purpose are safely declined.')}`, `${image('mountain','Mountain artwork representing Kitchen Wins progress.',430)}${h4('Kitchen Wins')}${p('<strong>Save food. Earn XP. Climb higher.</strong>')}${p('Levels, a medal wall and daily / weekly quests reward real food actions, encouraging better habits through positive feedback.')}`)}${p('Also improved: barcode entry, shopping and restocking, fridge filters, and inventory outcome tracking.')}${link(two,'View the Iteration 2 portfolio')}`)}
  ${card(`${label('ITERATION 3')}${h3('Learn together.<br />Waste less together.')}${p('We brought practical waste education and deeper household collaboration into the kitchen, building on our shared-inventory foundation.')}
    <div style="background-color:#ffffff;border:1px solid #dce5d5;border-radius:16px;padding:20px;margin:24px 0;">${columns(`${h4('Learning Academy')}${p('<strong>Understand waste. Know what to do next.</strong>')}${p('Learn about food waste and connect that knowledge to practical everyday actions through short lessons and hands-on activities.')}${image('course','Course artwork from Learning Academy.',250)}`,`${image('learning','Learning Academy interface from our October 2026 verification captures.',310)}<p style="color:#556957;font-size:13px;margin:12px 0;text-align:center;">Learning Academy interface.</p>`)}</div>
    <div style="background-color:#ffffff;border:1px solid #dce5d5;border-radius:16px;padding:20px;margin:24px 0;">${columns(`${h4('Shared Fridge')}${p('<strong>One household. One shared view.</strong>')}${p('Household members share the same inventory, coordinate what needs using, and plan shopping together. Food management becomes a shared routine.')}${p('<strong>Share inventory &nbsp; / &nbsp; Coordinate food use &nbsp; / &nbsp; Plan together</strong>')}`,image('family','Two household members managing one shared fridge.',450))}</div>
    ${p('<strong>Understand the impact. Take practical action. Make it a household habit.</strong>')}`)}
  <div style="padding:24px 0 30px;">${h2('Meet Team Gress')}${p('Monash University · FIT5120 Industry Experience')}<ul style="padding-left:22px;margin:18px 0;">${bullet('<strong>Guanxin Wu</strong> &nbsp; MIT')}${bullet('<strong>Jingduo Zhang</strong> &nbsp; MIT')}${bullet('<strong>Haoxuan Sun</strong> &nbsp; MBIS')}${bullet('<strong>Yang Qiao</strong> &nbsp; MDS')}${bullet('<strong>Chang Lei</strong> &nbsp; MCS')}</ul></div>
  <div style="border-top:1px solid #dce5d5;padding-top:20px;">${p('<strong>KitchMemo</strong> &nbsp; A Monash FIT5120 student project by Team Gress.')}<p style="color:#556957;font-size:14px;margin:0;">Remember your food. Rethink your waste.</p></div>
</div></body></html>`;
await writeFile(new URL('./mahara-compatible.html', import.meta.url), html);
await writeFile(new URL('./KitchMemo-Introduction-Desktop.html', import.meta.url), html);
await writeFile(new URL('./KitchMemo-Introduction-Final.html', import.meta.url), html);
console.log(`Created mahara-compatible.html (${Buffer.byteLength(html)} bytes).`);
