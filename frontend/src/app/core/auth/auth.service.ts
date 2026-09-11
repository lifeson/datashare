import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthResponse, AuthUser } from '../models/auth.model';

const TOKEN_KEY = 'datashare_token';

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

/** Gère la session : token JWT, utilisateur courant, login / register / logout. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /** Token courant (null si déconnecté). */
  readonly token = signal<string | null>(this.readToken());
  /** Utilisateur courant, enrichi via /auth/me. */
  readonly currentUser = signal<AuthUser | null>(null);
  /** Vrai dès qu'un token est présent. */
  readonly isAuthenticated = computed(() => this.token() !== null);

  constructor() {
    // Au démarrage : si un token existe, on récupère le profil.
    // `queueMicrotask` : appeler `this.http.get` (donc l'intercepteur, qui
    // injecte `AuthService`) de façon synchrone ICI provoquerait un
    // NG0200 (dépendance circulaire) — l'instance n'a pas fini de se
    // construire que l'intercepteur tente déjà de l'injecter à nouveau.
    // Reporter l'appel d'un micro-tick laisse le constructeur se terminer
    // avant que l'intercepteur ne s'exécute.
    if (this.token()) {
      queueMicrotask(() => {
        this.http.get<AuthUser>('/api/auth/me').subscribe({
          next: (user) => this.currentUser.set(user),
          error: () => this.logout(),
        });
      });
    }
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/register', payload)
      .pipe(tap((res) => this.setSession(res)));
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/login', payload)
      .pipe(tap((res) => this.setSession(res)));
  }

  logout(): void {
    this.writeToken(null);
    this.token.set(null);
    this.currentUser.set(null);
  }

  private setSession(res: AuthResponse): void {
    this.writeToken(res.accessToken);
    this.token.set(res.accessToken);
    this.currentUser.set(res.user);
  }

  private readToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private writeToken(value: string | null): void {
    try {
      if (value) {
        localStorage.setItem(TOKEN_KEY, value);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      /* localStorage indisponible (mode privé strict) : session en mémoire seulement */
    }
  }
}