import { Injectable, inject } from '@angular/core';

import { FeatureStore } from '../../../core/state/feature-store';

import { runtimeConfig } from '../../../core/config/runtime-config';
import { Category, Product } from '../../../shared/models';
import { FormDialogConfig } from '../../../shared/components/form-dialog.component';
import { StaffSession } from '../../access';

const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_WEBP_BYTES = 5_000_000;

class ProductImageConversionError extends Error {}

async function convertProductImageToWebp(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new ProductImageConversionError('Selecciona una imagen JPG, PNG o WebP.');
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new ProductImageConversionError('La imagen original no puede superar 20 MB.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ProductImageConversionError('No se pudo leer la imagen seleccionada.');
  }

  try {
    if (bitmap.width > 8000 || bitmap.height > 8000 || bitmap.width * bitmap.height > 40_000_000) {
      throw new ProductImageConversionError('La imagen tiene una resolución demasiado alta.');
    }

    for (const maxDimension of [1600, 1280, 1024]) {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new ProductImageConversionError('El navegador no pudo procesar la imagen.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.82, 0.72, 0.62]) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/webp', quality),
        );
        if (!blob) throw new ProductImageConversionError('El navegador no pudo convertir la imagen a WebP.');
        if (blob.size <= MAX_WEBP_BYTES) {
          const name = file.name.replace(/\.[^.]+$/, '') || 'producto';
          return new File([blob], `${name}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
        }
      }
    }

    throw new ProductImageConversionError('No se pudo reducir la imagen por debajo de 5 MB.');
  } finally {
    bitmap.close();
  }
}

@Injectable({ providedIn: 'root' })
export class CatalogAdminStore extends FeatureStore {
  private loadVersion = 0;
  isLoading = false;
  readonly trackProduct = (_: number, product: Product) => product.id;
  adminProducts: Product[] = [];
  adminCategories: Category[] = [];
  productDraft = { categoryId: '', name: '', description: '', priceCop: 0, stockQuantity: 0, available: true };
  categoryDraft = { name: '', displayOrder: 0 };
  formDialog: FormDialogConfig | null = null;
  dialogSaving = false;
  dialogError = '';
  private editingProduct: Product | null = null;
  private editingCategory: Category | null = null;
  private readonly session = inject(StaffSession);
  get role() {
    return this.session.role;
  }
  async loadAdminData() {
    const version = ++this.loadVersion;
    this.isLoading = true;
    this.notifyChange();
    try {
      const [products, categories] = await Promise.all([
        this.api.get<Product[]>('/admin/products'),
        this.api.get<Category[]>('/admin/categories'),
      ]);
      if (version !== this.loadVersion) return;
      this.adminProducts = products;
      this.adminCategories = categories;
      if (!this.productDraft.categoryId)
        this.productDraft.categoryId = categories.find((c) => c.active)?.id ?? '';
    } catch (e) {
      if (version !== this.loadVersion) return;
      this.message = this.errorText(e, 'No fue posible cargar el catálogo.');
    } finally {
      if (version === this.loadVersion) this.isLoading = false;
      this.notifyChange();
    }
  }
  async saveProduct() {
    try {
      try {
        await this.api.post('/admin/products', {
          ...this.productDraft,
          priceCop: Number(this.productDraft.priceCop),
        });
        this.productDraft = {
          categoryId: this.adminCategories[0]?.id ?? '',
          name: '',
          description: '',
          priceCop: 0,
          stockQuantity: 0,
          available: true,
        };
        await this.loadAdminData();
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo guardar el producto.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async toggleProduct(product: Product, event: Event) {
    try {
      try {
        const available = (event.target as HTMLInputElement).checked;
        await this.api.put(`/admin/products/${product.id}`, {
          ...product,
          available,
          active: product.active ?? true,
        });
        await this.loadAdminData();
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo actualizar el producto.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async toggleProductActive(product: Product) {
    try {
      try {
        await this.api.put(`/admin/products/${product.id}`, {
          ...product,
          active: !product.active,
        });
        await this.loadAdminData();
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo cambiar la publicación del producto.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async uploadImage(product: Product, event: Event) {
    const input = event.target as HTMLInputElement;
    try {
      const sourceFile = input.files?.[0];
      if (!sourceFile) return;
      try {
        const file = await convertProductImageToWebp(sourceFile);
        const signed = await this.api.post<{
          path: string;
          upload: { url?: string; signedURL?: string; token?: string };
          publicUrl: string;
        }>(`/admin/products/${product.id}/image-upload`, {
          contentType: file.type,
          sizeBytes: file.size,
        });
        const signedPath = signed.upload.signedURL ?? signed.upload.url ?? '';
        const uploadUrl = signedPath.startsWith('http')
          ? signedPath
          : `${runtimeConfig.supabaseUrl}/storage/v1${signedPath}${signed.upload.token && !signedPath.includes('token=') ? `?token=${signed.upload.token}` : ''}`;
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type, 'x-upsert': 'true' },
          body: file,
        });
        if (!response.ok) throw new Error('No pudimos cargar la imagen.');
        await this.api.post(`/admin/products/${product.id}/image`, { path: signed.path });
        await this.loadAdminData();
      } catch (e) {
        this.message = e instanceof ProductImageConversionError
          ? e.message
          : this.errorText(e, 'No se pudo cargar la imagen.');
      }
    } finally {
      input.value = '';
      this.notifyChange();
    }
  }
  async addCategory() {
    try {
      try {
        await this.api.post('/admin/categories', this.categoryDraft);
        this.categoryDraft = { name: '', displayOrder: this.adminCategories.length };
        await this.loadAdminData();
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo guardar la categoría.');
      }
    } finally {
      this.notifyChange();
    }
  }
  editProduct(product: Product) {
    this.editingProduct = product;
    this.editingCategory = null;
    this.formDialog = {
      title: 'Editar producto',
      description: 'Actualiza el nombre, el precio y la descripción del producto.',
      confirmLabel: 'Guardar producto',
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', value: product.name, required: true, maxLength: 120 },
        { key: 'priceCop', label: 'Precio en COP', type: 'number', value: product.priceCop, required: true, min: 0, max: 100_000_000, step: 100 },
        { key: 'stockQuantity', label: 'Unidades en inventario', type: 'number', value: product.stockQuantity ?? 0, required: true, min: 0, max: 1_000_000, step: 1 },
        { key: 'description', label: 'Descripción', type: 'textarea', value: product.description, maxLength: 1000 },
      ],
    };
    this.notifyChange();
  }
  editCategory(category: Category) {
    this.editingCategory = category;
    this.editingProduct = null;
    this.formDialog = {
      title: 'Editar categoría',
      description: 'Cambia el nombre que aparece en el menú.',
      confirmLabel: 'Guardar categoría',
      fields: [
        { key: 'name', label: 'Nombre de la categoría', type: 'text', value: category.name, required: true, maxLength: 80 },
      ],
    };
    this.notifyChange();
  }
  closeDialog() {
    if (this.dialogSaving) return;
    this.formDialog = null;
    this.dialogError = '';
    this.editingProduct = null;
    this.editingCategory = null;
    this.notifyChange();
  }
  async saveDialog(values: Record<string, string | number>) {
    if (this.dialogSaving) return;
    this.dialogSaving = true;
    this.dialogError = '';
    this.notifyChange();
    try {
      if (this.editingProduct) {
        const product = this.editingProduct;
        await this.api.put(`/admin/products/${product.id}`, {
          ...product,
          name: String(values['name'] ?? '').trim(),
          priceCop: Number(values['priceCop']),
          stockQuantity: Number(values['stockQuantity']),
          description: String(values['description'] ?? '').trim(),
          active: product.active ?? true,
        });
      } else if (this.editingCategory) {
        const category = this.editingCategory;
        await this.api.put(`/admin/categories/${category.id}`, {
          name: String(values['name'] ?? '').trim(),
          displayOrder: category.displayOrder,
          active: category.active ?? true,
        });
      } else {
        return;
      }
      this.formDialog = null;
      this.editingProduct = null;
      this.editingCategory = null;
      await this.loadAdminData();
    } catch (e) {
      this.dialogError = this.errorText(e, 'No se pudieron guardar los cambios.');
    } finally {
      this.dialogSaving = false;
      this.notifyChange();
    }
  }
  async toggleCategory(category: Category) {
    try {
      try {
        await this.api.put(`/admin/categories/${category.id}`, {
          name: category.name,
          displayOrder: category.displayOrder,
          active: !category.active,
        });
        await this.loadAdminData();
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo cambiar la publicación de la categoría.');
      }
    } finally {
      this.notifyChange();
    }
  }
}
