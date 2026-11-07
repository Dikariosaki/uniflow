import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OrderingStore } from '../data-access/ordering.store';

@Component({
  selector: 'app-receipt-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './receipt-page.component.html',
  host: { style: 'display:contents' },
})
export class ReceiptPage implements OnInit, OnDestroy {
  private readonly store = inject(OrderingStore);
  get vm() {
    return this.store.view();
  }

  ngOnInit() {}
  ngOnDestroy() {}
}
