import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { CustomerOrderHistoryStore } from '../data-access/customer-order-history.store';

@Component({
  selector: 'app-customer-orders-page',
  imports: [CommonModule],
  templateUrl: './customer-orders-page.component.html',
  host: { style: 'display:contents' },
})
export class CustomerOrdersPage implements OnInit {
  private readonly store = inject(CustomerOrderHistoryStore);
  get vm() {
    return this.store.view();
  }
  ngOnInit() {
    void this.store.refreshOrders();
  }
}
