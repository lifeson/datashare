import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    // US01 — écran « Ajouter un fichier »
    loadComponent: () =>
      import('./features/upload/upload-page').then((m) => m.UploadPage),
  },
  {
    path: 'auth',
    // US03 / US04 — Connexion et Créer un compte
    loadComponent: () =>
      import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  { path: '**', redirectTo: '' },
];