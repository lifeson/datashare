import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

type Mode = 'login' | 'register';

/** Valide que `password` et `passwordConfirm` sont identiques. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pwd = group.get('password')?.value;
  const confirm = group.get('passwordConfirm')?.value;
  return pwd === confirm ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly mode = signal<Mode>('login');
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly isRegister = computed(() => this.mode() === 'register');

  protected readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: [''],
    },
    { validators: [] },
  );

  switchMode(mode: Mode): void {
    this.mode.set(mode);
    this.serverError.set(null);
    // La confirmation n'est requise qu'à l'inscription.
    const confirm = this.form.controls.passwordConfirm;
    if (mode === 'register') {
      confirm.addValidators(Validators.required);
      this.form.addValidators(passwordsMatch);
    } else {
      confirm.clearValidators();
      confirm.setValue('');
      this.form.clearValidators();
    }
    confirm.updateValueAndValidity();
    this.form.updateValueAndValidity();
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);

    const { email, password } = this.form.getRawValue();
    const request$ = this.isRegister()
      ? this.auth.register({ email, password })
      : this.auth.login({ email, password });

    request$.subscribe({
      next: () => {
        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err: HttpErrorResponse) => {
        this.serverError.set(this.toMessage(err));
        this.submitting.set(false);
      },
    });
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Serveur injoignable. Réessaie plus tard.';
    }
    if (err.status === 401) {
      return 'Email ou mot de passe incorrect.';
    }
    if (err.status === 409) {
      return 'Un compte existe déjà avec cet email.';
    }
    const raw: unknown = err.error?.message;
    if (Array.isArray(raw)) {
      return raw.join(' ');
    }
    if (typeof raw === 'string') {
      return raw;
    }
    return "L'opération a échoué. Réessaie.";
  }
}