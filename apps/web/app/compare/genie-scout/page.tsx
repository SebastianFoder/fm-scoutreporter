import { CompareVs } from "@/components/CompareVs";
import { pageMetadata } from "@/lib/site";

export const generateMetadata = pageMetadata({
  page: "compareGenie",
  path: "/compare/genie-scout",
});

export default function GenieScoutComparePage() {
  return (
    <CompareVs
      path="/compare/genie-scout"
      page="genie"
      rival="genie"
      crumb="Scout Reporter vs Genie Scout"
      stronger={["history", "search", "extras", "shortlist"]}
      different={["browser", "weights", "potential", "team", "open"]}
      faq={["free", "fm27", "mac"]}
    />
  );
}
