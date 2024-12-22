export interface LineItem {
    "line_item/product_code": string;
    "line_item/unit": string;
    "line_item/quantity": string;
    "line_item/unit_price": string;
    "line_item/amount": string;
    "line_item/description": string;
  }
  
  export interface FieldConfidence {
    field: string;
    confidence: number;
  }
  
  export interface Invoice {
    id: string;
    emailDocId?: string;
    invoice_date?: string;
    invoice_type?: string;
    total_tax_amount?: string;
    due_date?: string;
    invoice_id?: string;
    total_amount?: string;
    supplier_address?: string;
    supplier_email?: string;
    net_amount?: string;
    ship_to_address?: string;
    receiver_name?: string;
    ship_to_name?: string;
    supplier_name?: string;
    freight_amount?: string;
    carrier?: string;
    remit_to_address?: string;
    supplier_phone?: string;
    line_items?: LineItem[];
    fieldsConfidence?: FieldConfidence[];
    from?: string;
    receivedAt?: string;
    processedAt?: string;
    messageId?: string;
    snippet?: string;
    subject?: string;
    file_name?: string;
    folder_name?: string;
    url?: string;
    labels?: string[];
    organizationId?: string;
  }

  export interface SupplierRecord {
    supplier_name: string;
    createdAt: FirebaseFirestore.Timestamp;
    invoice_ids: string[];
    matched_names: string[];
    supplier_address?: string;
    supplier_email?: string;
    supplier_phone?: string;
  }