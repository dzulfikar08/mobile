import { stripAnsi } from './stripAnsi';

describe('stripAnsi', () => {
  it('returns plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world');
  });

  it('removes CSI escape sequences', () => {
    expect(stripAnsi('\x1b[31mred text\x1b[0m')).toBe('red text');
  });

  it('removes multiple CSI sequences', () => {
    expect(stripAnsi('\x1b[1;32;40mbold green\x1b[0m normal')).toBe('bold green normal');
  });

  it('removes OSC sequences (window title)', () => {
    expect(stripAnsi('\x1b]0;window title\x07remaining')).toBe('remaining');
  });

  it('removes OSC sequences with BEL terminator variant', () => {
    expect(stripAnsi('\x1b]2;title\x1b\\text')).toBe('text');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('removes cursor movement sequences', () => {
    expect(stripAnsi('\x1b[2J\x1b[Hcleared')).toBe('cleared');
  });

  it('removes SGR sequences (color/bold/underline)', () => {
    const input = '\x1b[38;5;196mcolored\x1b[0m \x1b[4munderlined\x1b[24m';
    expect(stripAnsi(input)).toBe('colored underlined');
  });

  it('preserves newlines and tabs', () => {
    expect(stripAnsi('line1\n\tline2')).toBe('line1\n\tline2');
  });

  it('removes bare ESC sequences', () => {
    expect(stripAnsi('\x1b[?25htext')).toBe('text');
  });
});