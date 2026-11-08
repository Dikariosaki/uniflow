import { Injectable } from '@angular/core';

import { FeatureStore } from '../../../core/state/feature-store';

import { Category, Product } from '../../../shared/models';

@Injectable({ providedIn: 'root' })
export class CatalogStore extends FeatureStore {
  categoryFilter = 'all';
  searchTerm = '';
  categories: Category[] = [];
  products: Product[] = [];
  productTotal = 0;
  hasMoreProducts = false;
  isLoadingMore = false;
  private page = 0;
  private readonly pageSize = 24;
  private queryVersion = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
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
    return this.products;
  }
  setSearchTerm(value: string) {
    this.searchTerm = value;
    this.notifyChange();
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadProductPage(true), 250);
  }
  setCategoryFilter(value: string) {
    if (this.categoryFilter === value) return;
    clearTimeout(this.searchTimer);
    this.categoryFilter = value;
    void this.loadProductPage(true);
  }
  clearFilters() {
    this.searchTerm = '';
    this.categoryFilter = 'all';
    clearTimeout(this.searchTimer);
    void this.loadProductPage(true);
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
        const [categories, status] = await Promise.all([
          this.api.get<Category[]>('/catalog/categories'),
          this.api.get<{ name: string; isOpen: boolean; ordersPaused: boolean }>('/status'),
        ]);
        this.categories = categories;
        this.businessStatus = status;
        this.catalogFresh = true;
        this.isOnline = navigator.onLine;
        await this.loadProductPage(true);
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

  async loadNextProductPage() {
    if (!this.hasMoreProducts || this.isBusy || this.isLoadingMore) return;
    await this.loadProductPage(false);
  }

  private async loadProductPage(reset: boolean) {
    const version = ++this.queryVersion;
    if (reset) {
      this.page = 0;
      this.products = [];
      this.productTotal = 0;
      this.hasMoreProducts = false;
      this.isLoadingMore = false;
      this.isBusy = true;
    } else {
      this.isLoadingMore = true;
    }
    this.message = '';
    this.notifyChange();

    try {
      const requestedPage = reset ? 1 : this.page + 1;
      const params: Record<string, string> = {
        page: String(requestedPage),
        pageSize: String(this.pageSize),
      };
      if (this.searchTerm.trim()) params['search'] = this.searchTerm.trim();
      if (this.categoryFilter !== 'all') params['categoryId'] = this.categoryFilter;
      const result = await this.api.getPage<Product>('/catalog/products', params);
      if (version !== this.queryVersion) return;
      this.products = reset ? result.items : [...this.products, ...result.items];
      this.page = requestedPage;
      this.productTotal = result.total;
      this.hasMoreProducts = this.products.length < result.total;
      this.catalogFresh = true;
    } catch (error) {
      if (version === this.queryVersion) this.message = this.errorText(error, 'No pudimos cargar los productos. Intenta de nuevo.');
    } finally {
      if (version === this.queryVersion) {
        this.isBusy = false;
        this.isLoadingMore = false;
        this.notifyChange();
      }
    }
  }
}
