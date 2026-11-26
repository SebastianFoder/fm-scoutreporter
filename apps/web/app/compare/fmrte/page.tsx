import { CompareVs } from "@/components/CompareVs";
import { pageMetadata } from "@/lib/site";

export const generateMetadata = pageMetadata({
  page: "compareFmrte",
  path: "/compare/fmrte",
});

export default function FmrteComparePage() {
  return (
    <CompareVs
      path="/compare/fmrte"
      page="fmrte"
      rival="fmrte"
      crumb="Scout Reporter vs FMRTE"
      stronger={["edit", "platforms", "stats"]}
      different={["readOnly", "free", "weights", "potential", "team"]}
      faq={["cheat", "price", "mac"]}
    />
  );
}
