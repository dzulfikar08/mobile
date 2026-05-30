const ANSI_PATTERN = /\x1B\[[0-9;]*[mKfHhl]|\x1B\[[0-9;]*[JK]|\x1B\[[?][0-9;]*[hl]|\x1B\][0-9;]*;[^\x07]*\x07|\x1B\][0-9;]*;[^\x1B]*\x1B\\/g;
const NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '').replace(NON_PRINTABLE, '');
}
