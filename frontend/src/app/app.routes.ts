import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/upload/upload-page').then((m) => m.UploadPage),
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'mes-fichiers',
    canActivate: [authGuard],
    // US05 — historique de l'utilisateur
    loadComponent: () =>
      import('./features/my-files/my-files-page').then((m) => m.MyFilesPage),
  },
  {
    path: 'd/:token',
    // US02 — page publique de téléchargement (pas de garde)
    loadComponent: () =>
      import('./features/download/download-page').then((m) => m.DownloadPage),
  },
  { path: '**', redirectTo: '' },
];