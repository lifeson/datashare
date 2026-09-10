import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthPage } from './auth-page';
import { AuthService } from '../../core/auth/auth.service';

function setup(authOverrides: Partial<AuthService> = {}) {
  const auth = {
    login: vi.fn().mockReturnValue(of({})),
    register: vi.fn().mockReturnValue(of({})),
    ...authOverrides,
  };
  const router = { navigateByUrl: vi.fn() };
  const route = { snapshot: { queryParamMap: { get: () => null } } };

  TestBed.configureTestingModule({
    imports: [AuthPage],
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: route },
    ],
  });
  const fixture = TestBed.createComponent(AuthPage);
  fixture.detectChanges();
  return { fixture, auth, router };
}

function el(fixture: ReturnType<typeof setup>['fixture']): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function fill(fixture: ReturnType<typeof setup>['fixture'], name: string, value: string) {
  const input = el(fixture).querySelector(`input[formcontrolname="${name}"]`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur')); // marque le contrôle « touched »
  fixture.detectChanges();
}

function clickText(fixture: ReturnType<typeof setup>['fixture'], text: string) {
  const btn = [...el(fixture).querySelectorAll('button')].find((b) =>
    b.textContent?.includes(text),
  );
  btn?.dispatchEvent(new Event('click'));
  fixture.detectChanges();
}

describe('AuthPage', () => {
  it('démarre en mode Connexion sans champ de confirmation', () => {
    const { fixture } = setup();
    const text = el(fixture).textContent ?? '';
    expect(el(fixture).querySelector('.card__title')?.textContent).toContain('Connexion');
    expect(text).not.toContain('Vérification du mot de passe');
  });

  it('bascule en mode Créer un compte et affiche la confirmation', () => {
    const { fixture } = setup();
    clickText(fixture, 'Créer un compte');
    expect(el(fixture).querySelector('.card__title')?.textContent).toContain('Créer un compte');
    expect(el(fixture).textContent).toContain('Vérification du mot de passe');
  });

  it('signale des mots de passe différents et désactive le bouton', () => {
    const { fixture } = setup();
    clickText(fixture, 'Créer un compte');
    fill(fixture, 'email', 'claire@example.com');
    fill(fixture, 'password', 'motdepasse8');
    fill(fixture, 'passwordConfirm', 'autre-chose');
    const btn = el(fixture).querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(el(fixture).textContent).toContain('ne correspondent pas');
    expect(btn.disabled).toBe(true);
  });

  it('connexion réussie → appelle auth.login et redirige', () => {
    const { fixture, auth, router } = setup();
    fill(fixture, 'email', 'claire@example.com');
    fill(fixture, 'password', 'motdepasse8');
    el(fixture).querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(auth.login).toHaveBeenCalledWith({
      email: 'claire@example.com',
      password: 'motdepasse8',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('affiche un message clair sur un 409 (email déjà utilisé)', () => {
    const { fixture } = setup({
      register: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 }))),
    });
    clickText(fixture, 'Créer un compte');
    fill(fixture, 'email', 'claire@example.com');
    fill(fixture, 'password', 'motdepasse8');
    fill(fixture, 'passwordConfirm', 'motdepasse8');
    el(fixture).querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(el(fixture).textContent).toContain('Un compte existe déjà avec cet email.');
  });
});
