import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FileItem } from '../models/file-item.model';

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
}
