import { CartSummary } from '../components/cart-summary.component';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OrderingStore } from '../data-access/ordering.store';

@Component({
  selector: 'app-cart-page',
  imports: [CommonModule, FormsModule, CartSummary],
  templateUrl: './cart-page.component.html',
  host: { style: 'display:contents' },
})
export class CartPage implements OnInit, OnDestroy {
  private readonly store = inject(OrderingStore);
  get vm() {
    return this.store.view();
  }

  ngOnInit() {
    this.store.page = 'cart';
  }
  ngOnDestroy() {}
}
