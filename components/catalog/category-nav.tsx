import type { Category } from '@/types/domain';

interface CategoryNavProps {
  categories: Category[];
}

/**
 * Server Component: Sticky Category Navigation Bar.
 * Employs native CSS smooth scrolling with scroll-margin-top anchors.
 * Receives strictly categories containing active products.
 */
export function CategoryNav({ categories }: CategoryNavProps) {
  return (
    <nav
      aria-label="Categorías del catálogo"
      className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-2.5 scroll-smooth no-scrollbar">
        {categories.map((category) => (
          <a
            key={category.id}
            href={`#category-${category.id}`}
            className="flex-shrink-0 min-h-[40px] items-center inline-flex rounded-full bg-neutral-100 px-4 py-1.5 text-xs font-bold text-neutral-700 transition active:scale-95 hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {category.name}
          </a>
        ))}
      </div>
    </nav>
  );
}
