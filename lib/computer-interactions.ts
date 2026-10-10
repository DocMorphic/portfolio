export type ComputerView = "overview" | "keyboard" | "screen";
export const MAX_CODE_LENGTH = 32;
export const TERMINAL_CODE = "TERMINAL";
export const TERMINAL_HINT_KEYS = new Set(TERMINAL_CODE);
export type KeyFeedback = "correct" | "misplaced" | "wrong";
/** Wrong guesses leave the next slot open; deletion undoes an accepted letter. */
export function advanceTerminalCode(accepted:string,key:string):{accepted:string;feedback:KeyFeedback|null} {
  if(key==="Backspace")return {accepted:accepted.slice(0,-1),feedback:null};
  if(key==="Clear")return {accepted:"",feedback:null};
  if(key.length!==1&&key!=="Space")return {accepted,feedback:null};
  const letter=key.toUpperCase();
  if(letter===TERMINAL_CODE[accepted.length])return {accepted:accepted+letter,feedback:"correct"};
  return {accepted,feedback:TERMINAL_HINT_KEYS.has(letter)?"misplaced":"wrong"};
}
export function keyboardHintsVisible(view: ComputerView, moving: boolean, terminal: boolean) {
  return view === "keyboard" && !moving && !terminal;
}
// A rolling suffix lets a visitor recover from a wrong guess without a visible
// password field. This is an Easter egg, never an authentication boundary.
export function terminalCodeEntered(value: string) {
  return value.toUpperCase().endsWith(TERMINAL_CODE);
}
export const KEYCAP_REST = 0.18;
export const KEYCAP_PRESSED = 0.105;
export function stepKeycap(height: number, pressed: boolean, dt: number) {
  const target = pressed ? KEYCAP_PRESSED : KEYCAP_REST;
  return target + (height - target) * Math.exp(-Math.max(0, dt) * (pressed ? 45 : 18));
}
export const keyboardRows = [
  ["Esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Backspace"],
  ["Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "-"],
  ["Caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", "Enter"],
  ["Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "Shift"],
  ["Ctrl", "Alt", "Space", "Alt", "Left", "Right"],
];
export function keyUnits(key: string) {
  return ({ Space: 6.2, Backspace: 1.7, Enter: 2, Shift: 1.5, Caps: 1.5, Tab: 1.2 } as Record<string, number>)[key] ?? 1;
}
export function editCode(value: string, key: string) {
  if (key === "Backspace") return value.slice(0, -1);
  if (key === "Clear") return "";
  if (key === "Space" || key === " ") return (value + " ").slice(0, MAX_CODE_LENGTH);
  return key.length === 1 && /[a-z0-9.,_-]/i.test(key) ? (value + key.toUpperCase()).slice(0, MAX_CODE_LENGTH) : value;
}
export function findComputerMedia<T extends { code: string }>(value: string, media: T[]) {
  const code = value.trim().toUpperCase();
  return code ? media.find(item => item.code.trim().toUpperCase() === code) : undefined;
}
