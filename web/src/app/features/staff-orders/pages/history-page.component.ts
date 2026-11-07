import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { StaffOrdersStore } from '../data-access/staff-orders.store';
import { OrderDetailDialog } from '../components/order-detail-dialog.component';

@Component({
  selector: 'app-history-page',
  imports: [CommonModule, FormsModule, OrderDetailDialog],
  templateUrl: './history-page.component.html',
  host: { style: 'display:contents' },
})
export class HistoryPage implements OnInit, OnDestroy {
  private readonly store = inject(StaffOrdersStore);
  get vm() {
    return this.store.view();
  }

  ngOnInit() {
    this.store.startHistory();
  }
  ngOnDestroy() {
    this.store.stop();
  }
}
