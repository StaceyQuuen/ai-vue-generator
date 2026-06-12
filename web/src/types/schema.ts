export interface SearchFormField {
  label: string;
  prop: string;
  type?: "input" | "select" | "date";
  options?: string[];
}

export interface SearchFormComponent {
  type: "searchForm";
  fields: SearchFormField[];
}

export interface TableColumn {
  label: string;
  prop: string;
  width?: number;
}

export interface TableComponent {
  type: "table";
  columns: TableColumn[];
}

export interface PaginationComponent {
  type: "pagination";
  total?: number;
}

export type PageComponent =
  | SearchFormComponent
  | TableComponent
  | PaginationComponent;

export interface PageSchema {
  pageName: string;
  components: PageComponent[];
}

export interface HistoryItem {
  id: string;
  prompt: string;
  schema: PageSchema;
  createdAt: number;
}
