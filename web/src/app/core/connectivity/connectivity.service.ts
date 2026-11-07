import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  readonly online = signal(navigator.onLine);
  private readonly changes = new Subject<boolean>();
  readonly changes$ = this.changes.asObservable();
  constructor() {
    const changed = () => {
      this.online.set(navigator.onLine);
      this.changes.next(navigator.onLine);
    };
    window.addEventListener('online', changed);
    window.addEventListener('offline', changed);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', changed);
      window.removeEventListener('offline', changed);
      this.changes.complete();
    });
  }
}
