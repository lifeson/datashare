import { formatFileSize } from './file-size';

describe('formatFileSize', () => {
  it('affiche les octets en dessous de 1 Ko', () => {
    expect(formatFileSize(0)).toBe('0 o');
    expect(formatFileSize(512)).toBe('512 o');
  });

  it('convertit en Ko / Mo / Go', () => {
    expect(formatFileSize(1024)).toBe('1 Ko');
    expect(formatFileSize(2_726_297)).toBe('2,6 Mo');
    expect(formatFileSize(1_073_741_824)).toBe('1 Go');
  });

  it("arrondit à l'entier au-delà de 10", () => {
    expect(formatFileSize(15 * 1024 * 1024)).toBe('15 Mo');
  });
});
