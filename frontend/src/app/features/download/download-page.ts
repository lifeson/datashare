import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FilesApiService } from '../../core/api/files-api.service';
import { FileMeta } from '../../core/models/file-meta.model';
import {
  expiryHint,
  filenameFromHeader,
  saveBlob,
} from '../../core/utils/download';
import { formatFileSize } from '../../core/utils/file-size';

type PageState = 'loading' | 'ready' | 'gone' | 'not-found';

@Component({
  selector: 'app-download-page',
  imports: [ReactiveFormsModule],
  templateUrl: './download-page.html',
  styleUrl: './download-page.scss',
})
export class DownloadPage {
  private readonly fb = inject(FormBuilder);
  private readonly filesApi = inject(FilesApiService);

  /** Jeton lu dans l'URL /d/:token. */
  private readonly token =
    inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  protected readonly state = signal<PageState>('loading');
  protected readonly meta = signal<FileMeta | null>(null);
  protected readonly downloading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    password: [''],
  });

  protected readonly formatSize = formatFileSize;
  protected readonly hint = computed(() => {
    const m = this.meta();
    return m ? expiryHint(m.expiresAt) : null;
  });

  constructor() {
    this.loadMeta();
  }

  private loadMeta(): void {
    this.filesApi.getMeta(this.token).subscribe({
      next: (m) => {
        this.meta.set(m);
        this.state.set('ready');
        if (m.isProtected) {
          this.form.controls.password.addValidators(Validators.required);
          this.form.controls.password.updateValueAndValidity();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.state.set(err.status === 410 ? 'gone' : 'not-found');
      },
    });
  }

  download(): void {
    if (this.form.invalid || this.downloading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.downloading.set(true);
    this.error.set(null);

    const password = this.form.getRawValue().password || undefined;

    this.filesApi.download(this.token, password).subscribe({
      next: (response) => {
        const blob = response.body ?? new Blob();
        const filename = filenameFromHeader(
          response.headers.get('Content-Disposition'),
          this.meta()?.originalName ?? 'fichier',
        );
        saveBlob(blob, filename);
        this.downloading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.downloading.set(false);
        // NB : en `responseType: 'blob'`, err.error est un Blob — on se base sur le statut.
        if (err.status === 401) {
          this.error.set('Mot de passe incorrect ou requis.');
        } else if (err.status === 410) {
          this.state.set('gone');
        } else if (err.status === 404) {
          this.state.set('not-found');
        } else {
          this.error.set('Le téléchargement a échoué. Réessaie.');
        }
      },
    });
  }
}