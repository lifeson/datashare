import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    // US01 — écran « Ajouter un fichier »
    // TODO (guide auth) : protéger par le `authGuard` une fois l'authentification en place
    loadComponent: () => import('./features/upload/upload-page').then((m) => m.UploadPage),
  },
];
