import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MyFilesPage } from './my-files-page';
import { FilesApiService } from '../../core/api/files-api.service';
import { FileItem } from '../../core/models/file-item.model';

function item(over: Partial<FileItem> = {}): FileItem {
  return {
    id: '1',
    originalName: 'photo.jpg',
    size: 5000,
    mimeType: 'image/jpeg',
    tags: [],
    isProtected: false,
    status: 'active',
    expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    downloadCount: 0,
    downloadToken: 'tok1',
    downloadUrl: 'http://localhost:4200/d/tok1',
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function setup(list: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [MyFilesPage],
    providers: [{ provide: FilesApiService, useValue: { list } }, provideRouter([])],
  });
  const fixture = TestBed.createComponent(MyFilesPage);
  fixture.detectChanges();
  return fixture;
}

const el = (f: ReturnType<typeof setup>) => f.nativeElement as HTMLElement;

describe('MyFilesPage', () => {
  it('charge la liste « Tous » au démarrage', () => {
    const list = vi.fn().mockReturnValue(of({ items: [item()], count: 1 }));
    const fixture = setup(list);

    expect(list).toHaveBeenCalledWith('all');
    expect(el(fixture).textContent).toContain('photo.jpg');
    expect(el(fixture).textContent).toContain('Accéder');
  });

  it("affiche le message d'expiration pour un fichier expiré", () => {
    const list = vi.fn().mockReturnValue(
      of({
        items: [item({ status: 'expired', downloadToken: undefined })],
        count: 1,
      }),
    );
    const fixture = setup(list);

    expect(el(fixture).textContent).toContain("n'est plus stocké chez nous");
    expect(el(fixture).textContent).not.toContain('Accéder');
  });

  it("recharge avec le bon statut au changement d'onglet", () => {
    const list = vi.fn().mockReturnValue(of({ items: [], count: 0 }));
    const fixture = setup(list);

    const expiredTab = [...el(fixture).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Expiré'),
    );
    expiredTab?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(list).toHaveBeenLastCalledWith('expired');
  });

  it("affiche un état vide quand il n'y a aucun fichier", () => {
    const list = vi.fn().mockReturnValue(of({ items: [], count: 0 }));
    const fixture = setup(list);

    expect(el(fixture).textContent).toContain('Aucun fichier');
  });

  it('supprime un fichier après confirmation et recharge la liste', () => {
    const list = vi.fn().mockReturnValue(of({ items: [item()], count: 1 }));
    const remove = vi.fn().mockReturnValue(of(undefined));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    TestBed.configureTestingModule({
      imports: [MyFilesPage],
      providers: [{ provide: FilesApiService, useValue: { list, remove } }, provideRouter([])],
    });
    const fixture = TestBed.createComponent(MyFilesPage);
    fixture.detectChanges();

    const btn = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Supprimer'),
    );
    btn?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(remove).toHaveBeenCalledWith('1');
    expect(list).toHaveBeenCalledTimes(2); // chargement initial + rechargement
  });

  it('ne supprime rien si la confirmation est annulée', () => {
    const list = vi.fn().mockReturnValue(of({ items: [item()], count: 1 }));
    const remove = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    TestBed.configureTestingModule({
      imports: [MyFilesPage],
      providers: [{ provide: FilesApiService, useValue: { list, remove } }, provideRouter([])],
    });
    const fixture = TestBed.createComponent(MyFilesPage);
    fixture.detectChanges();

    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Supprimer'))
      ?.dispatchEvent(new Event('click'));

    expect(remove).not.toHaveBeenCalled();
  });
});
