import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal, DestroyRef } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { StaffSession } from '../features/access';
import { OrderingStore } from '../features/ordering';
import { StaffOrdersStore } from '../features/staff-orders';
import { UiState } from '../core/state/ui-state.service';
import { ConnectivityService } from '../core/connectivity/connectivity.service';
import { PAGE_PATHS, pageFromUrl } from '../core/navigation/page-paths';
@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app-shell.component.html',
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly session = inject(StaffSession);
  private readonly ordering = inject(OrderingStore);
  private readonly operations = inject(StaffOrdersStore);
  private readonly ui = inject(UiState);
  private readonly connection = inject(ConnectivityService);
  private readonly path = signal(location.pathname);
  menuOpen = false;
  constructor() {
    void this.session.ensureSession();
    const subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.path.set(event.urlAfterRedirects);
        this.menuOpen = false;
      }
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }
  get page() {
    return pageFromUrl(this.path());
  }
  get isStaff() {
    return ['login', 'queue', 'history', 'inventory', 'reports'].includes(this.page);
  }
  get role() {
    return this.session.role;
  }
  get isOnline() {
    return this.connection.online();
  }
  get message() {
    return this.ui.message();
  }
  set message(value: string) {
    this.ui.message.set(value);
  }
  get cartCount() {
    return this.ordering.view().cartCount;
  }
  get activeOrders() {
    return this.operations.view().activeOrders;
  }
  @HostListener('document:keydown.escape')
  closeMobileNavigation() {
    this.menuOpen = false;
  }
  go(page: string) {
    this.menuOpen = false;
    this.ui.message.set('');
    void this.router.navigateByUrl(PAGE_PATHS[page] ?? '/');
  }
  logout() {
    void this.session.logout();
  }
}
