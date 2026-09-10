import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FileItem } from '../models/file-item.model';
import { FileMeta } from '../models/file-meta.model';

export interface UploadPayload {
  file: File;
  password?: string;
  expiresInDays?: number;
}

/** Accès HTTP aux endpoints /api/files. */
@Injectable({ providedIn: 'root' })
export class FilesApiService {
  private readonly http = inject(HttpClient);

  /** US01 — Téléverse un fichier et renvoie ses métadonnées + le lien. */
  upload(payload: UploadPayload): Observable<FileItem> {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.password) {
      form.append('password', payload.password);
    }
    if (payload.expiresInDays != null) {
      form.append('expiresInDays', String(payload.expiresInDays));
    }
    return this.http.post<FileItem>('/api/files', form);
  }

  /** US02 — Métadonnées publiques d'un fichier. */
  getMeta(token: string): Observable<FileMeta> {
    return this.http.get<FileMeta>(`/api/files/${token}`);
  }

  /** US02 — Télécharge le fichier (réponse binaire + en-têtes). */
  download(token: string, password?: string): Observable<HttpResponse<Blob>> {
    return this.http.post(
      `/api/files/${token}/download`,
      { password: password ?? undefined },
      { responseType: 'blob', observe: 'response' },
    );
  }

  /** US05 — Liste des fichiers de l'utilisateur (filtrée par onglet). */
  list(
    status: 'all' | 'active' | 'expired',
  ): Observable<{ items: FileItem[]; count: number }> {
    return this.http.get<{ items: FileItem[]; count: number }>('/api/files', {
      params: { status },
    });
  }
}