export interface Product {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  priceCop: number;
  stockQuantity?: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  available: boolean;
  active?: boolean;
  imageUrl: string | null;
}
export interface Category {
  id: string;
  name: string;
  displayOrder: number;
  active?: boolean;
}
