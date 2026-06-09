/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
/* eslint-enable @typescript-eslint/no-require-imports */

const srcPath  = path.join(__dirname, '..', 'public', 'safepredict-demo.html');
const outPath  = path.join(__dirname, '..', 'public', 'safepredict-demo-protected.html');
const deskPath = path.join('C:\\Users\\johnh\\OneDrive\\Desktop', 'SafePredict-Demo.html');

const html = fs.readFileSync(srcPath, 'utf8');

// Locate the single app <script> block (last one in the file)
const scriptRx = /<script>([\s\S]+?)<\/script>\s*<\/body>\s*<\/html>\s*$/;
const match = html.match(scriptRx);
if (!match) { console.error('❌  Could not find app script block'); process.exit(1); }

const originalScript = match[1];

console.log('🔒  Obfuscating JavaScript...');
const obfuscationResult = JavaScriptObfuscator.obfuscate(originalScript, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.4,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  rotateStringArray: true,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
});
const obfuscatedCode = obfuscationResult.getObfuscatedCode();

// Anti-copy / anti-inspect shield (runs before app code)
const shield = `(function(){
  document.addEventListener('contextmenu',function(e){e.preventDefault();return false;});
  document.addEventListener('keydown',function(e){
    var k=e.key?e.key.toLowerCase():'';
    if(e.ctrlKey&&['u','s','a','p'].indexOf(k)>-1){e.preventDefault();return false;}
    if(k==='f12'){e.preventDefault();return false;}
    if(e.ctrlKey&&e.shiftKey&&['i','j','c','k'].indexOf(k)>-1){e.preventDefault();return false;}
  });
  document.addEventListener('selectstart',function(e){
    if(e.target.tagName!=='INPUT'&&e.target.tagName!=='TEXTAREA')e.preventDefault();
  });
})();`;

const protectedHtml = html.replace(
  scriptRx,
  `<script>\n${shield}\n${obfuscatedCode}\n</script>\n</body>\n</html>`
);

fs.writeFileSync(outPath, protectedHtml, 'utf8');
fs.writeFileSync(deskPath, protectedHtml, 'utf8');

const kb = Math.round(fs.statSync(outPath).size / 1024);
console.log(`✅  Done — ${kb} KB`);
console.log(`   → public/safepredict-demo-protected.html`);
console.log(`   → Desktop/SafePredict-Demo.html (ready to email)`);
