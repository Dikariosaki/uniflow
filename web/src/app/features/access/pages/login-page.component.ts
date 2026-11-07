import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { StaffSession } from '../data-access/staff-session.store';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './login-page.component.html',
  host: { style: 'display:contents' },
})
export class LoginPage implements OnInit, OnDestroy {
  private readonly store = inject(StaffSession);
  get vm() {
    return this.store.view();
  }
  private readonly route = inject(ActivatedRoute);
  ngOnInit() {
    void this.store.initializeLogin(
      this.route.snapshot.fragment,
      this.route.snapshot.queryParamMap.get('returnUrl'),
    );
  }
  ngOnDestroy() {}
}
