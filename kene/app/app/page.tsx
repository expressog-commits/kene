import Workspace from "@/components/Workspace";
import { StoreProvider } from "@/components/store";
import { FEATURES } from "@/lib/features";

export const metadata = {
  title: FEATURES.hospitals
    ? "Kéné — Disponibilité des médicaments et lits d'urgences"
    : "Kéné — Trouver un médicament & pharmacies de garde",
};

export default function AppPage() {
  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  );
}
