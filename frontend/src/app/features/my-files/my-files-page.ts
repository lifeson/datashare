import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FilesApiService } from '../../core/api/files-api.service';
import { FileItem } from '../../core/models/file-item.model';
import { expiryBadge } from '../../core/utils/file-status';
import { formatFileSize } from '../../core/utils/file-size';

type Tab = 'all' | 'active' | 'expired';

@Component({
  selector: 'app-my-files-page',
  imports: [RouterLink],
  templateUrl: './my-files-page.html',
  styleUrl: './my-files-page.scss',
})
export class MyFilesPage {
  private readonly filesApi = inject(FilesApiService);

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'active', label: 'Actifs' },
    { id: 'expired', label: 'Expiré' },
  ];

  protected readonly tab = signal<Tab>('all');
  protected readonly items = signal<FileItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly badge = expiryBadge;
  protected readonly formatSize = formatFileSize;

  constructor() {
    this.load();
  }

  selectTab(tab: Tab): void {
    if (tab === this.tab()) {
      return;
    }
    this.tab.set(tab);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.filesApi.list(this.tab()).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger tes fichiers.');
        this.loading.set(false);
      },
    });
  }
}