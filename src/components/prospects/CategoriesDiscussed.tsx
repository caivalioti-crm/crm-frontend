interface CategoriesDiscussedProps {
  entityId: string;
}

export default function CategoriesDiscussed({ entityId }: CategoriesDiscussedProps) {
  return (
    <section className="bg-card text-card-foreground rounded-xl shadow-md p-6">
      <h2 className="text-lg font-semibold mb-2">
        🗂 Κατηγορίες που Συζητήθηκαν
      </h2>
      <div className="text-sm text-muted-foreground/70 italic">
        Categories discussed for entity {entityId} (placeholder)
      </div>
    </section>
  );
}