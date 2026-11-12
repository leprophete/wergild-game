import { notFound } from "next/navigation";
import MaskEditor from "./MaskEditor";

export const metadata = { title: "Land / water mask — $WERGILD (dev)" };

/** Development tool only: review and correct the land/water mask over world.png. */
export default function MaskPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MaskEditor />;
}
