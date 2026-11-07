import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface FormDialogField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'textarea';
  value?: string | number;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  requiredMessage?: string;
  patternMessage?: string;
}

export interface FormDialogConfig {
  title: string;
  description?: string;
  confirmLabel?: string;
  fields: FormDialogField[];
}

@Component({
  selector: 'app-form-dialog',
  imports: [CommonModule, FormsModule],
  templateUrl: './form-dialog.component.html',
  host: { style: 'display:contents' },
})
export class FormDialogComponent implements OnChanges {
  @Input() config: FormDialogConfig | null = null;
  @Input() saving = false;
  @Input() errorMessage = '';
  @Output() saved = new EventEmitter<Record<string, string | number>>();
  @Output() cancelled = new EventEmitter<void>();
  values: Record<string, string | number> = {};
  errors: Record<string, string> = {};

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['config']) return;
    this.errors = {};
    this.values = Object.fromEntries(
      (this.config?.fields ?? []).map((field) => [field.key, field.value ?? '']),
    );
  }

  submit() {
    if (!this.config || this.saving) return;
    this.errorMessage = '';
    this.errors = {};
    for (const field of this.config.fields) {
      const value = this.values[field.key] ?? '';
      const text = String(value).trim();
      if (field.required && !text) {
        this.errors[field.key] = field.requiredMessage ?? 'Completa este campo.';
      } else if (text && field.type === 'number' && !Number.isFinite(Number(value))) {
        this.errors[field.key] = 'Ingresa un número válido.';
      } else if (text && field.type === 'number' && field.min !== undefined && Number(value) < field.min) {
        this.errors[field.key] = `El valor mínimo es ${field.min}.`;
      } else if (text && field.type === 'number' && field.max !== undefined && Number(value) > field.max) {
        this.errors[field.key] = `El valor máximo es ${field.max}.`;
      } else if (text && field.type === 'number' && field.step === 1 && !Number.isInteger(Number(value))) {
        this.errors[field.key] = 'Ingresa una cantidad entera.';
      } else if (text && field.minLength !== undefined && text.length < field.minLength) {
        this.errors[field.key] = `Escribe al menos ${field.minLength} caracteres.`;
      } else if (text && field.maxLength !== undefined && text.length > field.maxLength) {
        this.errors[field.key] = `Escribe máximo ${field.maxLength} caracteres.`;
      } else if (text && field.pattern && !new RegExp(field.pattern).test(text)) {
        this.errors[field.key] = field.patternMessage ?? 'Revisa el formato ingresado.';
      }
    }
    if (Object.keys(this.errors).length) return;
    this.saved.emit({ ...this.values });
  }

  clearServerError() {
    if (this.errorMessage) this.errorMessage = '';
  }

  cancel() {
    if (!this.saving) this.cancelled.emit();
  }

  backdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.cancel();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape() {
    if (this.config) this.cancel();
  }
}
