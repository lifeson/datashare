import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FilesApiService } from '../../core/api/files-api.service';
import { FileItem } from '../../core/models/file-item.model';
import { formatFileSize } from '../../core/utils/file-size';

/** Taille maximale acceptée (1 Gio), alignée sur le back-end. */
const MAX_FILE_SIZE = 1_073_741_824;

interface ExpiryOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-upload-page',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './upload-page.html',
  styleUrl: './upload-page.scss',
})
export class UploadPage {
  private readonly fb = inject(FormBuilder);
  private readonly filesApi = inject(FilesApiService);

  protected readonly expiryOptions: ExpiryOption[] = [
    { value: 1, label: 'Une journée' },
    { value: 2, label: '2 jours' },
    { value: 3, label: '3 jours' },
    { value: 4, label: '4 jours' },
    { value: 5, label: '5 jours' },
    { value: 6, label: '6 jours' },
    { value: 7, label: 'Une semaine' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.minLength(6)]],
    expiresInDays: [7, [Validators.required]],
  });

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly result = signal<FileItem | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly linkCopied = signal(false);

  protected readonly tooLarge = computed(() => (this.selectedFile()?.size ?? 0) > MAX_FILE_SIZE);

  protected readonly formatSize = formatFileSize;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.result.set(null);
    this.serverError.set(null);
    input.value = '';
  }

  clearFile(): void {
    this.selectedFile.set(null);
    this.serverError.set(null);
  }

  submit(): void {
    const file = this.selectedFile();
    if (!file || this.tooLarge() || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.serverError.set(null);
    const { password, expiresInDays } = this.form.getRawValue();

    this.filesApi
      .upload({
        file,
        password: password || undefined,
        expiresInDays,
      })
      .subscribe({
        next: (item) => {
          this.result.set(item);
          this.submitting.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.serverError.set(this.toMessage(err));
          this.submitting.set(false);
        },
      });
  }

  async copyLink(): Promise<void> {
    const url = this.result()?.downloadUrl;
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    } catch {
      /* presse-papiers indisponible : l'utilisateur peut copier manuellement */
    }
  }

  reset(): void {
    this.selectedFile.set(null);
    this.result.set(null);
    this.serverError.set(null);
    this.linkCopied.set(false);
    this.form.reset({ password: '', expiresInDays: 7 });
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Le serveur est injoignable. Réessaie plus tard.';
    }
    if (err.status === 401) {
      return 'Tu dois être connecté pour téléverser un fichier.';
    }
    const raw: unknown = err.error?.message;
    if (Array.isArray(raw)) {
      return raw.join(' ');
    }
    if (typeof raw === 'string') {
      return raw;
    }
    return 'Le téléversement a échoué. Réessaie.';
  }
}
