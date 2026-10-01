import fs from "node:fs";
const out="_site";fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of ["index.html","jobs.html","housing.html","application.html","styles.css","app.js",".nojekyll"])fs.copyFileSync(file,`${out}/${file}`);
fs.mkdirSync(`${out}/data/live`,{recursive:true});
for(const file of ["jobs.json","housing.json","visa-uk.json"])fs.copyFileSync(`data/live/${file}`,`${out}/data/live/${file}`);
console.log("✓ Static site built in _site/");
