import { CartSummary } from '../components/cart-summary.component';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OrderingStore } from '../data-access/ordering.store';

@Component({
  selector: 'app-checkout-page',
  imports: [CommonModule, FormsModule, CartSummary],
  templateUrl: './checkout-page.component.html',
  host: { style: 'display:contents' },
})
export class CheckoutPage implements OnInit, OnDestroy {
  private readonly store = inject(OrderingStore);
  get vm() {
    return this.store.view();
  }

  ngOnInit() {
    this.store.page = 'checkout';
    void this.store.loadSlots();
  }
  ngOnDestroy() {}
}
