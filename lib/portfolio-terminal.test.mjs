import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveTerminalCommand, terminalRowIndex } from "./portfolio-terminal.ts";
test("number shortcuts resolve only existing rows, including zero-padded and multi-digit entries",()=>{
  assert.equal(terminalRowIndex("1",5),0);
  assert.equal(terminalRowIndex(" 03 ",5),2);
  assert.equal(terminalRowIndex("12",15),11);
  for(const input of ["0","6","-1","1.5","1e0","2work",""])assert.equal(terminalRowIndex(input,5),null);
  assert.equal(terminalRowIndex("1",0),null);
});
const resolve = input => resolveTerminalCommand(input, ["aliquot", "portfolio"], ["germany", "india"]);
test("terminal routes use real content IDs and shell-like aliases", () => {
  assert.deepEqual(resolve("cat about.txt"), { route: { section: "about" } });
  assert.deepEqual(resolve(" LS /projects/ "), { route: { section: "work" } });
  assert.deepEqual(resolve("work"), { route: { section: "resume" } });
  assert.deepEqual(resolve("open aliquot.app"), { route: { section: "work", item: "aliquot" } });
  assert.deepEqual(resolve("cd photos/germany"), { route: { section: "photos", item: "germany" } });
  assert.deepEqual(resolve("resume"), { route: { section: "resume" } });
  assert.deepEqual(resolve("exit"), { action: "exit" });
  assert.deepEqual(resolve("clear"), { action: "clear" });
});
test("unknown commands are inert, not executed or silently routed", () => {
  assert.ok("error" in resolve("rm -rf /"));
  assert.ok("error" in resolve("open unknown"));
  assert.ok("error" in resolve("__proto__"));
});
