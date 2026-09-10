import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { UploadPage } from './upload-page';
import { FilesApiService } from '../../core/api/files-api.service';
import { FileItem } from '../../core/models/file-item.model';

const fakeItem: FileItem = {
  id: '1',
  originalName: 'photo.jpg',
  size: 5000,
  mimeType: 'image/jpeg',
  tags: [],
  isProtected: false,
  status: 'active',
  expiresAt: '2026-09-17T00:00:00.000Z',
  downloadCount: 0,
  downloadToken: 'tok123',
  downloadUrl: 'http://localhost:4200/d/tok123',
  createdAt: '2026-09-10T00:00:00.000Z',
};

function makeComponent(api: Partial<FilesApiService>) {
  TestBed.configureTestingModule({
    imports: [UploadPage],
    providers: [{ provide: FilesApiService, useValue: api }],
  });
  const fixture = TestBed.createComponent(UploadPage);
  fixture.detectChanges();
  return fixture;
}

function pickFile(fixture: ReturnType<typeof makeComponent>, file: File) {
  const input = (fixture.nativeElement as HTMLElement).querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

describe('UploadPage', () => {
  it("affiche l'invite d'accueil quand aucun fichier n'est choisi", () => {
    const fixture = makeComponent({ upload: vi.fn() });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Tu veux partager un fichier ?');
  });

  it("passe au formulaire après sélection d'un fichier", () => {
    const fixture = makeComponent({ upload: vi.fn() });
    pickFile(fixture, new File(['x'], 'photo.jpg'));
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Ajouter un fichier');
    expect(html).toContain('photo.jpg');
  });

  it('bloque le téléversement au-delà de 1 Go', () => {
    const fixture = makeComponent({ upload: vi.fn() });
    const big = new File(['x'], 'big.bin');
    Object.defineProperty(big, 'size', { value: 1_073_741_825 });
    pickFile(fixture, big);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('La taille des fichiers est limitée à 1 Go.');
    const submit = el.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit?.disabled).toBe(true);
  });

  it("appelle l'API et affiche le lien en cas de succès", () => {
    const upload = vi.fn().mockReturnValue(of(fakeItem));
    const fixture = makeComponent({ upload });
    pickFile(fixture, new File(['x'], 'photo.jpg'));

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(upload).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'http://localhost:4200/d/tok123',
    );
  });

  it("affiche un message quand l'API renvoie une erreur", () => {
    const upload = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { message: 'Non autorisé' },
          }),
      ),
    );
    const fixture = makeComponent({ upload });
    pickFile(fixture, new File(['x'], 'photo.jpg'));

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('connecté');
  });
});
