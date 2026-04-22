import { Badge } from "@/components/ui/badge";

export function AuthorBadge({
  author,
  isOfficial,
}: {
  author: string | null;
  isOfficial: boolean;
}) {
  if (isOfficial) {
    return (
      <Badge className="bg-orange-600 text-white hover:bg-orange-600">
        Anthropic
      </Badge>
    );
  }
  if (author === "self") return <Badge variant="secondary">You</Badge>;
  if (author == null) {
    return (
      <Badge variant="outline" className="text-neutral-500">
        unknown
      </Badge>
    );
  }
  return <Badge variant="secondary">{author}</Badge>;
}
