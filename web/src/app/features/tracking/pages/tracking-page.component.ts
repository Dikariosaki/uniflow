import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TrackingStore } from '../data-access/tracking.store';

@Component({
  selector: 'app-tracking-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './tracking-page.component.html',
  host: { style: 'display:contents' },
})
export class TrackingPage implements OnInit, OnDestroy {
  private readonly store = inject(TrackingStore);
  get vm() {
    return this.store.view();
  }
  private readonly route = inject(ActivatedRoute);
  private subscription?: { unsubscribe(): void };
  ngOnInit() {
    this.subscription = this.route.fragment.subscribe(
      (token) => void this.store.initialize(token ?? ''),
    );
  }
  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.store.stop();
  }
}
