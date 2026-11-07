import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { FeatureStore } from '../../../core/state/feature-store';

@Injectable({ providedIn: 'root' })
export class StaffSession extends FeatureStore {
  private readonly auth = inject(AuthService);
  private readonly currentRole = signal('');
  get role() {
    return this.currentRole();
  }
  email = '';
  password = '';
  passwordSetup = false;
  recoveryRequested = false;
  recoveryMode = false;
  forgotPassword = false;
  get loginMode() {
    return this.passwordSetup ? 'password' : this.recoveryRequested ? 'sent' : this.forgotPassword ? 'forgot' : 'login';
  }
  returnUrl: string | null = null;

  private landingUrl() {
    return this.role === 'administrator' ? '/personal/inventory' : '/personal';
  }

  private async continueToPanel() {
    if (!(await this.ensureSession()))
      throw new Error('Tu usuario no tiene acceso activo al panel. Contacta al administrador.');
    await this.router.navigateByUrl(this.returnUrl ?? this.landingUrl());
  }

  async ensureSession() {
    const previousRole = this.currentRole();
    let hasSession = false;
    try {
      hasSession = !!(await this.auth.session());
    } catch (error) {
      this.logError('staff-session', error);
      return previousRole !== '';
    }
    if (!hasSession) {
      this.currentRole.set('');
      return false;
    }
    try {
      const me = await this.api.get<{ role: string }>('/staff/me');
      this.currentRole.set(me.role);
      return true;
    } catch (error) {
      this.logError('staff-session', error);
      if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 429 || error.status >= 500))
        return previousRole !== '';
      this.currentRole.set('');
      return false;
    }
  }
  async initializeLogin(fragment: string | null, returnUrl: string | null) {
    this.recoveryMode = /type=recovery/.test(fragment ?? '');
    this.passwordSetup = /type=(invite|recovery)/.test(fragment ?? '');
    this.returnUrl = returnUrl?.startsWith('/personal') ? returnUrl : null;
    let hasSession = false;
    try {
      hasSession = !!(await this.auth.session());
    } catch (error) {
      this.message = this.errorText(error, 'No pudimos validar el enlace. Inténtalo de nuevo.');
      this.notifyChange();
      return;
    }
    if (this.passwordSetup && !hasSession)
      this.message = 'El enlace de acceso no es válido o ya venció. Solicita una nueva invitación.';
    else if (!this.passwordSetup && hasSession) {
      try {
        await this.continueToPanel();
      } catch (error) {
        this.message = this.errorText(error, 'No pudimos validar el acceso al panel.');
      }
    }
    this.notifyChange();
  }
  async requestPasswordReset() {
    if (!this.email.trim() || !/^\S+@\S+\.\S+$/.test(this.email.trim())) {
      this.message = 'Escribe un correo válido para enviarte el enlace.';
      this.notifyChange();
      return;
    }
    this.isBusy = true;
    this.message = '';
    try {
      await this.auth.sendPasswordReset(this.email.trim());
      this.recoveryRequested = true;
    } catch (error) {
      this.message = this.errorText(error, 'No pudimos enviar el correo. Intenta de nuevo más tarde.');
    } finally {
      this.isBusy = false;
      this.notifyChange();
    }
  }
  showLogin() {
    this.recoveryRequested = false;
    this.forgotPassword = false;
    this.message = '';
    this.notifyChange();
  }
  showForgotPassword() {
    this.forgotPassword = true;
    this.message = '';
    this.notifyChange();
  }
  async login() {
    this.isBusy = true;
    this.message = '';
    try {
      await this.auth.signIn(this.email, this.password);
      await this.continueToPanel();
    } catch (error) {
      this.message = this.errorText(error, 'No pudimos iniciar sesión.');
    } finally {
      this.isBusy = false;
      this.notifyChange();
    }
  }
  async setPassword() {
    if (this.password.length < 8) {
      this.message = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }
    this.isBusy = true;
    try {
      await this.auth.updatePassword(this.password);
      await this.continueToPanel();
      this.passwordSetup = false;
      this.recoveryMode = false;
    } catch (error) {
      this.message = this.errorText(error, 'No se pudo actualizar la contraseña.');
    } finally {
      this.isBusy = false;
      this.notifyChange();
    }
  }
  async logout() {
    this.message = '';
    try {
      await this.auth.signOut();
    } catch (error) {
      this.message = this.errorText(error, 'No pudimos cerrar la sesión por completo.');
    }
    this.currentRole.set('');
    this.password = '';
    await this.router.navigateByUrl('/personal/login');
    this.notifyChange();
  }
}
