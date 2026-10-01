import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {projects} from '../content/projects.ts';
import {PROJECT_DETAILS} from '../content/project-details.ts';
import {CV_SHA256,CV_DOWNLOAD_HREF} from '../content/cv.ts';
import {resolveTerminalCommand} from './portfolio-terminal.ts';

test('Tradefly is available alongside all existing projects in the shared catalog',()=>{
  const ids=projects.map(project=>project.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of ['tradefly','hashi','aliquot','framed','portfolio','pyra'])assert.ok(ids.includes(id),id);
  const tradefly=projects.find(project=>project.id==='tradefly');
  assert.equal(tradefly.link,'https://papertradefly.vercel.app/');
  assert.equal(tradefly.github,'https://github.com/DocMorphic/tradefly');
  assert.ok(PROJECT_DETAILS.tradefly.sections.length>=3);
  assert.ok(PROJECT_DETAILS.hashi);
  assert.deepEqual(resolveTerminalCommand('open tradefly.app',ids,[]),{route:{section:'work',item:'tradefly'}});
});

test('desktop CV version matches the actual bundled download',()=>{
  const pdf=readFileSync(new URL('../public/cv.pdf',import.meta.url));
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  assert.equal(createHash('sha256').update(pdf).digest('hex'),CV_SHA256,'update the download version when replacing the CV');
  assert.equal(CV_DOWNLOAD_HREF,`/cv.pdf?v=${CV_SHA256.slice(0,12)}`);
  assert.match(readFileSync(new URL('../components/desktop/DesktopIcons.tsx',import.meta.url),'utf8'),/downloadHref: CV_DOWNLOAD_HREF/);
});
