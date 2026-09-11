import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { AuthResponse } from '../models/auth.model';

const TOKEN_KEY = 'datashare_token';

const authResponse: AuthResponse = {
  accessToken: 'jwt-123',
  user: {
    id: 'u1',
    email: 'claire@example.com',
    name: 'Claire',
    createdAt: '2026-09-10T00:00:00.000Z',
  },
};

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const service = TestBed.inject(AuthService);
  const httpMock = TestBed.inject(HttpTestingController);
  return { service, httpMock };
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("login() stocke le token, renseigne l'utilisateur et passe isAuthenticated à true", () => {
    const { service, httpMock } = setup();

    service.login({ email: 'claire@example.com', password: 'motdepasse8' }).subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(authResponse);

    expect(service.token()).toBe('jwt-123');
    expect(service.currentUser()?.email).toBe('claire@example.com');
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-123');
    httpMock.verify();
  });

  it('register() ouvre une session de la même manière', () => {
    const { service, httpMock } = setup();

    service.register({ email: 'claire@example.com', password: 'motdepasse8' }).subscribe();

    httpMock.expectOne('/api/auth/register').flush(authResponse);

    expect(service.token()).toBe('jwt-123');
    expect(service.isAuthenticated()).toBe(true);
    httpMock.verify();
  });

  it("logout() vide le token, l'utilisateur et le localStorage", () => {
    const { service, httpMock } = setup();
    service.login({ email: 'a@b.c', password: 'motdepasse8' }).subscribe();
    httpMock.expectOne('/api/auth/login').flush(authResponse);

    service.logout();

    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    httpMock.verify();
  });

  it('au démarrage avec un token, récupère le profil via GET /api/auth/me', async () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-existant');
    const { service, httpMock } = setup();

    // L'appel est différé d'un micro-tick (queueMicrotask) pour éviter une
    // dépendance circulaire avec l'intercepteur — on laisse le micro-tick s'écouler.
    await Promise.resolve();

    const req = httpMock.expectOne('/api/auth/me');
    expect(req.request.method).toBe('GET');
    req.flush(authResponse.user);

    expect(service.currentUser()?.email).toBe('claire@example.com');
    httpMock.verify();
  });

  it('au démarrage, un /api/auth/me en échec (401) déconnecte', async () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-perime');
    const { service, httpMock } = setup();

    await Promise.resolve();

    httpMock.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(service.token()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    httpMock.verify();
  });
});
