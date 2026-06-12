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

export interface StatCard {
  title: string;
  prop: string;
  icon?: string;
  color?: string;
}

export interface StatCardsComponent {
  type: "statCards";
  cards: StatCard[];
}

export interface FormField {
  label: string;
  prop: string;
  type: "input" | "select" | "date" | "textarea" | "number";
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface FormComponent {
  type: "form";
  fields: FormField[];
}

export type PageComponent =
  | SearchFormComponent
  | TableComponent
  | PaginationComponent
  | StatCardsComponent
  | FormComponent;

export interface PageSchema {
  pageName: string;
  pageType?: "list" | "form" | "dashboard";
  components: PageComponent[];
}

export interface HistoryItem {
  id: string;
  prompt: string;
  schema: PageSchema;
  createdAt: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
