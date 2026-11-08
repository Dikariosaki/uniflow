import { ProductCard } from '../components/product-card.component';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CatalogStore } from '../data-access/catalog.store';

import { OrderingStore } from '../../ordering';
@Component({
  selector: 'app-menu-page',
  imports: [CommonModule, FormsModule, ProductCard],
  templateUrl: './menu-page.component.html',
  host: { style: 'display:contents' },
})
export class MenuPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('loadMoreTarget') private loadMoreTarget?: ElementRef<HTMLElement>;
  private observer?: IntersectionObserver;
  private readonly store = inject(CatalogStore);
  get vm() {
    return this.store.view();
  }
  readonly cart = inject(OrderingStore);
  get cartVm() {
    return this.cart.view();
  }
  ngOnInit() {
    void this.store.loadMenu();
  }
  ngAfterViewInit() {
    if (typeof IntersectionObserver === 'undefined' || !this.loadMoreTarget) return;
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void this.store.loadNextProductPage();
    }, { rootMargin: '500px 0px' });
    this.observer.observe(this.loadMoreTarget.nativeElement);
  }
  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
