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
  get vm() {
    return this.store.view();
  }

  ngOnInit() {
    void this.store.loadAdminData();
  }
  ngOnDestroy() {}
}
