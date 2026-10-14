/** Plural leaf: picked with Intl.PluralRules; `other` is required. */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

/** Dictionary shape derived from English; Arabic must match it exactly (checked by tsc). */
export type DeepMessages<T> = {
  [K in keyof T]: T[K] extends PluralForms
    ? PluralForms
    : T[K] extends string
      ? string
      : DeepMessages<T[K]>;
};

type Join<A extends string, B extends string> = `${A}.${B}`;

export type StringPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends PluralForms
    ? never
    : T[K] extends string
      ? P extends ""
        ? K
        : Join<P, K>
      : StringPaths<T[K], P extends "" ? K : Join<P, K>>;
}[keyof T & string];

export type PluralPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends PluralForms
    ? P extends ""
      ? K
      : Join<P, K>
    : T[K] extends string
      ? never
      : PluralPaths<T[K], P extends "" ? K : Join<P, K>>;
}[keyof T & string];
