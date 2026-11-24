import Workspace from "@/components/Workspace";
import { StoreProvider } from "@/components/store";
import { FEATURES } from "@/lib/features";

export const metadata = {
  title: FEATURES.hospitals
    ? "Kéné — Pharmacies et urgences à Abidjan"
    : "Kéné — Trouver un médicament & pharmacies de garde à Abidjan",
};

export default function HomePage() {
  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  );
}
