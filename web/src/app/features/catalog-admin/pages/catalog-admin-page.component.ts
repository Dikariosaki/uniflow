import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormDialogComponent } from '../../../shared/components/form-dialog.component';

import { CatalogAdminStore } from '../data-access/catalog-admin.store';

@Component({
  selector: 'app-catalog-admin-page',
  imports: [CommonModule, FormsModule, FormDialogComponent],
  templateUrl: './catalog-admin-page.component.html',
  host: { style: 'display:contents' },
})
export class CatalogAdminPage implements OnInit, OnDestroy {
  private readonly store = inject(CatalogAdminStore);
  productSearchTerm = '';
  get vm() {
    return this.store.view();
  }

  get filteredProducts() {
    const query = this.productSearchTerm
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('es');
    if (!query) return this.vm.adminProducts;

    return this.vm.adminProducts.filter((product) =>
      `${product.name} ${product.categoryName} ${product.description ?? ''}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es')
        .includes(query),
    );
  }

  ngOnInit() {
    void this.store.loadAdminData();
  }
  ngOnDestroy() {}
}
