import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { Order } from '../../../shared/models';
import { DisplayFormats } from '../../../shared/presentation/display-formats';
@Component({
  selector: 'app-order-detail-dialog',
  imports: [CommonModule],
  templateUrl: './order-detail-dialog.component.html',
  host: { style: 'display:contents' },
})
export class OrderDetailDialog extends DisplayFormats implements AfterViewInit, OnDestroy {
  @Input({ required: true }) order!: Order;
  @Output() closed = new EventEmitter<void>();
  @ViewChild('orderDialog') dialog!: ElementRef<HTMLDialogElement>;
  private readonly trigger = document.activeElement as HTMLElement | null;
  ngAfterViewInit() {
    this.dialog.nativeElement.showModal();
  }
  ngOnDestroy() {
    this.dialog.nativeElement.close();
    if (this.trigger?.isConnected) this.trigger.focus();
  }
  close() {
    this.closed.emit();
  }
  keepDialogFocus(event: Event) {
    const key = event as KeyboardEvent;
    const controls = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex="0"]',
      ),
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (
      (!key.shiftKey && document.activeElement === last) ||
      (key.shiftKey && document.activeElement === first)
    ) {
      event.preventDefault();
      (key.shiftKey ? last : first)?.focus();
    }
  }
}
