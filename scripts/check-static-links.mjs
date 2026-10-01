import fs from "node:fs";
import path from "node:path";

const htmlFiles=fs.readdirSync(".").filter(name=>name.endsWith(".html"));
let failed=false;

for(const file of htmlFiles){
  const content=fs.readFileSync(file,"utf8");
  const refs=[...content.matchAll(/(?:href|src)="([^"]+)"/g)].map(match=>match[1]);
  for(const ref of refs){
    if(!ref||ref.startsWith("#")||ref.startsWith("http://")||ref.startsWith("https://")||ref.startsWith("mailto:")||ref.startsWith("tel:")) continue;
    const clean=ref.split("#")[0].split("?")[0];
    if(!clean) continue;
    const target=path.normalize(path.join(path.dirname(file),clean));
    if(!fs.existsSync(target)){
      console.error(`✗ ${file}: missing local target ${ref}`);
      failed=true;
    }
  }
}
if(failed) process.exit(1);
console.log(`✓ local links/assets validated across ${htmlFiles.length} HTML files`);
