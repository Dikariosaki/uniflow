import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiState {
  readonly message = signal('');
}
