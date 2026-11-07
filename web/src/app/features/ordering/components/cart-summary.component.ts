import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { OrderingStore } from '../data-access/ordering.store';
@Component({
  selector: 'app-cart-summary',
  imports: [CommonModule],
  templateUrl: './cart-summary.component.html',
  host: { style: 'display:contents' },
})
export class CartSummary {
  private readonly store = inject(OrderingStore);
  private readonly failedImages = new Set<string>();
  get vm() {
    return this.store.view();
  }
  hasImage(productId: string, imageUrl: string | null) {
    return !!imageUrl && !this.failedImages.has(productId);
  }
  onImageError(productId: string) {
    this.failedImages.add(productId);
  }
}
