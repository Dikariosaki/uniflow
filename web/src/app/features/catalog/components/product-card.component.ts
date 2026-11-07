import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Product } from '../../../shared/models';
import { DisplayFormats } from '../../../shared/presentation/display-formats';
@Component({
  selector: 'app-product-card',
  imports: [CommonModule],
  templateUrl: './product-card.component.html',
  host: { style: 'display:contents' },
})
export class ProductCard extends DisplayFormats {
  @Input({ required: true }) product!: Product;
  @Input() online = true;
  @Input() quantity = 0;
  @Output() added = new EventEmitter<Product>();
  @Output() quantityChanged = new EventEmitter<number>();
}
