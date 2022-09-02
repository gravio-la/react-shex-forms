import { ReactNode } from 'react'

export type Array2StringTransformOptions = {
  join?: string;
};

export type DateToISOTransformOptions = {
  inputDateFormat?: string;
  outputDateFormat?: string;
};

export type ColumnOptions = {
  dateFormat?: string;
  filter?: {
    operator?: string;
  };
  transform?: {
    array2string?: Array2StringTransformOptions;
    date2Iso?: DateToISOTransformOptions;
  };
};

export interface ColumnRaw {
  name: string;
  header: string;
  type: string;
  editable?: boolean;
  defaultWidth?: number;
  group?: string;
  options?: ColumnOptions;
}

export type CustomRendererMatcher = {
  match: { [key: string]: any };
  render: ( ...args: any[] ) => ReactNode;
};
