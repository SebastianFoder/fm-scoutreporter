import { pageMetadata } from "@/lib/site";

export const generateMetadata = pageMetadata({
  page: "backroom",
  path: "/staff/backroom",
});

export default function BackroomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
