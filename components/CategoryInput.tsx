"use client";

export default function CategoryInput({
  value,
  onChange,
  categories,
  listId = "category-options",
  placeholder = "Category",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
  listId?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          className ??
          "rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
        }
      />
      <datalist id={listId}>
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
