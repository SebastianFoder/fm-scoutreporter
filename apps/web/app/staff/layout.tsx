import { pageMetadata } from "@/lib/site";

export const generateMetadata = pageMetadata({
  page: "staff",
  path: "/staff",
});

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
