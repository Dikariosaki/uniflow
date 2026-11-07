import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OperationsAdminStore } from '../data-access/operations-admin.store';

@Component({
  selector: 'app-operations-admin-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './operations-admin-page.component.html',
  host: { style: 'display:contents' },
})
export class OperationsAdminPage implements OnInit, OnDestroy {
  private readonly store = inject(OperationsAdminStore);
  get vm() {
    return this.store.view();
  }

  ngOnInit() {
    void this.store.loadReport();
  }
  ngOnDestroy() {}
}
