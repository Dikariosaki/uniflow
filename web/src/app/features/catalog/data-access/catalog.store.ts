import { Injectable } from '@angular/core';

import { FeatureStore } from '../../../core/state/feature-store';

import { Category, Product } from '../../../shared/models';

@Injectable({ providedIn: 'root' })
export class CatalogStore extends FeatureStore {
  categoryFilter = 'all';
  searchTerm = '';
  categories: Category[] = [];
  products: Product[] = [];
  private visibleProductsCache: Product[] = [];
  private cachedSource: Product[] | null = null;
  private cachedCategoryFilter = '';
  private cachedSearchQuery = '';
  businessStatus = { name: 'Cafetería Bloque B', isOpen: false, ordersPaused: false };
  catalogFresh = false;
  get displayBusinessName() {
    return (this.businessStatus.name || 'Cafetería universitaria')
      .replace(/Cafeter\?a/gi, 'Cafetería')
      .replace(/&#x20;/gi, ' ')
      .trim();
  }
  invalidate() {
    this.catalogFresh = false;
    this.notifyChange();
  }
  get visibleProducts() {
    const query = this.normalizeSearch(this.searchTerm);
    if (
      this.cachedSource === this.products &&
      this.cachedCategoryFilter === this.categoryFilter &&
      this.cachedSearchQuery === query
    ) return this.visibleProductsCache;
    const terms = query.split(/\s+/).filter(Boolean);
    this.visibleProductsCache = this.products.filter((product) => {
      if (this.categoryFilter !== 'all' && product.categoryId !== this.categoryFilter) return false;
      if (!terms.length) return true;
      const searchable = this.normalizeSearch(
        `${product.name} ${product.description} ${product.categoryName}`,
      );
      return terms.every((term) => searchable.includes(term));
    });
    this.cachedSource = this.products;
    this.cachedCategoryFilter = this.categoryFilter;
    this.cachedSearchQuery = query;
    return this.visibleProductsCache;
  }
  setSearchTerm(value: string) {
    this.searchTerm = value;
    this.notifyChange();
  }
  clearFilters() {
    this.searchTerm = '';
    this.categoryFilter = 'all';
    this.notifyChange();
  }
  private normalizeSearch(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .trim();
  }
  get groupedCategories() {
    return this.categories;
  }
  async loadMenu() {
    try {
      this.catalogFresh = false;
      this.isBusy = true;
      this.message = '';
      try {
        const [categories, products, status] = await Promise.all([
          this.api.get<Category[]>('/catalog/categories'),
          this.api.get<Product[]>('/catalog/products'),
          this.api.get<{ name: string; isOpen: boolean; ordersPaused: boolean }>('/status'),
        ]);
        this.categories = categories;
        this.products = products;
        this.businessStatus = status;
        this.catalogFresh = true;
        this.isOnline = navigator.onLine;
      } catch (e) {
        if ((e as { status?: number }).status === 0) this.isOnline = false;
        this.message = this.errorText(
          e,
          'No pudimos cargar el menú. Intenta actualizar la página.',
        );
      } finally {
        this.isBusy = false;
      }
    } finally {
      this.notifyChange();
    }
  }
}
