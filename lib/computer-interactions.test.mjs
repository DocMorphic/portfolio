import assert from "node:assert/strict";
import { test } from "node:test";
import { editCode, findComputerMedia, keyboardRows, keyUnits, stepKeycap, KEYCAP_REST, KEYCAP_PRESSED, terminalCodeEntered, TERMINAL_HINT_KEYS, advanceTerminalCode, keyboardHintsVisible } from "./computer-interactions.ts";

test("secret feedback accepts only the next letter and does not consume bad guesses",()=>{
  assert.deepEqual(advanceTerminalCode("","E"),{accepted:"",feedback:"misplaced"});
  assert.deepEqual(advanceTerminalCode("T","Z"),{accepted:"T",feedback:"wrong"});
  assert.deepEqual(advanceTerminalCode("T","T"),{accepted:"T",feedback:"misplaced"});
  let accepted="";
  for(const key of "terminal"){const next=advanceTerminalCode(accepted,key);assert.equal(next.feedback,"correct");accepted=next.accepted;}
  assert.equal(accepted,"TERMINAL");
  assert.equal(advanceTerminalCode(accepted,"Backspace").accepted,"TERMINA");
  assert.equal(advanceTerminalCode("T","Shift").feedback,null);
  assert.equal(advanceTerminalCode("T","Space").feedback,"wrong");
});
test("hints never appear during the keyboard camera move or outside keyboard inspection",()=>{
  assert.equal(keyboardHintsVisible("keyboard",true,false),false);
  assert.equal(keyboardHintsVisible("screen",false,false),false);
  assert.equal(keyboardHintsVisible("keyboard",false,true),false);
  assert.equal(keyboardHintsVisible("keyboard",false,false),true);
});

test("terminal unlock is case insensitive and recovers after wrong guesses",()=>{
  assert.equal(terminalCodeEntered("termina"),false);
  assert.equal(terminalCodeEntered("terminal"),true);
  assert.equal(terminalCodeEntered("WRONGTERMINAL"),true);
  assert.equal(terminalCodeEntered("terminalx"),false);
  assert.equal(terminalCodeEntered("term inal"),false);
  assert.deepEqual([...TERMINAL_HINT_KEYS].sort(),[..."AEILMNRT"]);
});

test("keycaps visibly depress, hold down, and return without overshooting",()=>{
  let height=KEYCAP_REST;
  for(let i=0;i<6;i++)height=stepKeycap(height,true,1/60);
  assert.ok(height<KEYCAP_PRESSED+0.002);
  for(let i=0;i<60;i++)height=stepKeycap(height,true,1/60);
  assert.ok(Math.abs(height-KEYCAP_PRESSED)<1e-10);
  for(let i=0;i<30;i++){
    const next=stepKeycap(height,false,1/60);
    assert.ok(next>=height&&next<=KEYCAP_REST);height=next;
  }
  assert.ok(Math.abs(height-KEYCAP_REST)<0.0001);
});
test("keycap travel is frame-rate independent",()=>{
  const run=hz=>{let y=KEYCAP_REST;for(let i=0;i<hz/5;i++)y=stepKeycap(y,true,1/hz);return y;};
  assert.ok(Math.abs(run(30)-run(120))<1e-10);
});

test("on-screen keys enter letters, digits and spaces, and support deletion",()=>{
  let code="";for(const key of ["a","B","1","Space","Z"])code=editCode(code,key);
  assert.equal(code,"AB1 Z");assert.equal(editCode(code,"Backspace"),"AB1 ");assert.equal(editCode(code,"Clear"),"");
  assert.equal(editCode(code,"Shift"),code);assert.equal(editCode("A".repeat(32),"B").length,32);
});
test("only a configured nonempty code selects media",()=>{
  const media=[{code:"HELLO 123",src:"/media/test.mp4",kind:"video"}];
  assert.equal(findComputerMedia(" hello 123 ",media),media[0]);
  assert.equal(findComputerMedia("WRONG",media),undefined);assert.equal(findComputerMedia("",media),undefined);
  assert.equal(findComputerMedia("HELLO 123",[]),undefined);
});
test("the keyboard has all letters and digits, backspace and Enter",()=>{
  const keys=keyboardRows.flat();for(const key of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")assert.ok(keys.includes(key));
  assert.ok(keys.includes("Enter"));assert.ok(keys.includes("Backspace"));assert.ok(keyUnits("Space")>keyUnits("A"));
});
