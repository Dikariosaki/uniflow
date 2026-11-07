import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormDialogComponent } from '../../../shared/components/form-dialog.component';

import { StaffOrdersStore } from '../data-access/staff-orders.store';
import { OrderDetailDialog } from '../components/order-detail-dialog.component';

@Component({
  selector: 'app-queue-page',
  imports: [CommonModule, FormsModule, OrderDetailDialog, FormDialogComponent],
  templateUrl: './queue-page.component.html',
  host: { style: 'display:contents' },
})
export class QueuePage implements OnInit, OnDestroy {
  private readonly store = inject(StaffOrdersStore);
  get vm() {
    return this.store.view();
  }

  ngOnInit() {
    void this.store.startQueue();
  }
  ngOnDestroy() {
    this.store.stop();
  }
}
