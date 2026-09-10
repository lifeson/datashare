import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, vi } from 'vitest';
import { DownloadPage } from './download-page';
import { FilesApiService } from '../../core/api/files-api.service';
import { FileMeta } from '../../core/models/file-meta.model';

const meta: FileMeta = {
  originalName: 'IMG_9210.jpg',
  size: 2_726_297,
  mimeType: 'image/jpeg',
  isProtected: false,
  expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  expired: false,
};

function setup(api: Partial<FilesApiService>) {
  TestBed.configureTestingModule({
    imports: [DownloadPage],
    providers: [
      { provide: FilesApiService, useValue: api },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => 'tok123' } } },
      },
    ],
  });
  const fixture = TestBed.createComponent(DownloadPage);
  fixture.detectChanges();
  return fixture;
}

function text(fixture: ReturnType<typeof setup>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('DownloadPage', () => {
  beforeEach(() => {
    // saveBlob() manipule le DOM : on neutralise les API navigateur.
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('affiche le nom et la taille du fichier une fois les métadonnées chargées', () => {
    const fixture = setup({ getMeta: vi.fn().mockReturnValue(of(meta)) });
    expect(text(fixture)).toContain('IMG_9210.jpg');
    expect(text(fixture)).toContain('2,6 Mo');
    expect(text(fixture)).toContain('expirera dans');
  });

  it('affiche le champ mot de passe et désactive le bouton si le fichier est protégé', () => {
    const fixture = setup({
      getMeta: vi.fn().mockReturnValue(of({ ...meta, isProtected: true })),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input[type="password"]')).not.toBeNull();
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it('affiche la bannière « expiré » sur un 410', () => {
    const fixture = setup({
      getMeta: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 410 }))),
    });
    expect(text(fixture)).toContain('il a expiré');
  });

  it('affiche « Lien invalide » sur un 404', () => {
    const fixture = setup({
      getMeta: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 }))),
    });
    expect(text(fixture)).toContain('Lien invalide');
  });

  it('déclenche le téléchargement au clic', () => {
    const response = new HttpResponse<Blob>({
      body: new Blob(['x']),
      headers: undefined,
      status: 200,
    });
    const download = vi.fn().mockReturnValue(of(response));
    const fixture = setup({
      getMeta: vi.fn().mockReturnValue(of(meta)),
      download,
    });

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(download).toHaveBeenCalledWith('tok123', undefined);
  });

  it('affiche un message sur un mot de passe incorrect (401)', () => {
    const fixture = setup({
      getMeta: vi.fn().mockReturnValue(of({ ...meta, isProtected: true })),
      download: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 }))),
    });

    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    input.value = 'mauvais';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(text(fixture)).toContain('Mot de passe incorrect ou requis.');
  });
});
