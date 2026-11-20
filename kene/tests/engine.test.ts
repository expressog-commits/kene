import assert from "node:assert/strict";
import test from "node:test";
import {
  dutyPharmacies,
  popularMedicines,
  priceRange,
  publicPharmacies,
  searchMedicine,
  searchMedicineList,
  type SearchFilters,
} from "../lib/engine";
import { seedState } from "../lib/seed";

const DEFAULT_FILTERS: SearchFilters = {
  quartier: "Tous",
  onlyOpen: false,
  onlyDuty: false,
  onlyInStock: false,
  sort: "distance",
};

test("publicPharmacies exclut les officines en attente ou suspendues", () => {
  const state = seedState();
  const visible = publicPharmacies(state);
  assert.equal(visible.length, 7);
  assert.ok(visible.every((p) => p.verificationStatus === "verified"));
  assert.equal(
    visible.some((p) => p.id === "ph_koumassi"),
    false,
  );
});

test("searchMedicine recherche multi-mots NFD et filtre les officines non vérifiées", () => {
  const state = seedState();
  // Ajoute du stock dans l'officine en attente (Koumassi) pour vérifier l'exclusion.
  state.stock.push({
    pharmacyId: "ph_koumassi",
    medicineId: "med_cetirizine",
    price: 900,
    quantity: 50,
    updatedAt: new Date().toISOString(),
  });

  const rows = searchMedicine(state, "cetirizine comprimes", {
    ...DEFAULT_FILTERS,
    onlyInStock: true,
    sort: "price",
  });

  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.pharmacy.verificationStatus === "verified"));
  assert.equal(
    rows.some((row) => row.pharmacy.id === "ph_koumassi"),
    false,
  );
  assert.ok(rows.every((row) => row.level !== "out"));
});

test("searchMedicine trie par distance GPS quand userLocation est fournie", () => {
  const state = seedState();
  const cocodyCenter = { lat: 5.388, lng: -3.988 };

  const rows = searchMedicine(
    state,
    "paracetamol 500",
    { ...DEFAULT_FILTERS, onlyInStock: true, sort: "distance" },
    cocodyCenter,
  );

  assert.ok(rows.length >= 2);
  assert.equal(rows[0].pharmacy.id, "ph_cocody");
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i - 1].level === rows[i].level) {
      assert.ok(rows[i - 1].distanceKm <= rows[i].distanceKm);
    }
  }
});

test("searchMedicineList classe les officines complètes en tête et déduplique les IDs", () => {
  const state = seedState();
  const results = searchMedicineList(
    state,
    ["med_paracetamol", "med_amoxicilline", "med_paracetamol"],
    { ...DEFAULT_FILTERS, onlyInStock: true, sort: "price" },
  );

  assert.ok(results.length > 0);
  assert.ok(results.every((r) => r.totalRequested === 2));
  assert.ok(results.every((r) => r.availableCount > 0));
  assert.ok(results.every((r) => r.pharmacy.verificationStatus === "verified"));

  const firstIncompleteIndex = results.findIndex((r) => !r.complete);
  if (firstIncompleteIndex !== -1) {
    assert.ok(results.slice(firstIncompleteIndex).every((r) => !r.complete));
  }
});

test("dutyPharmacies ne retourne que les officines de garde vérifiées", () => {
  const state = seedState();
  const koumassi = state.pharmacies.find((p) => p.id === "ph_koumassi");
  assert.ok(koumassi);
  koumassi.onDuty = true;

  const duty = dutyPharmacies(state, { query: "amoxicilline" });
  assert.ok(duty.length >= 1);
  assert.ok(duty.every((item) => item.pharmacy.onDuty));
  assert.ok(duty.every((item) => item.pharmacy.verificationStatus === "verified"));
  assert.equal(
    duty.some((item) => item.pharmacy.id === "ph_koumassi"),
    false,
  );
  assert.ok(duty.every((item) => item.matchingMedicines.length > 0));
});

test("priceRange et popularMedicines ignorent les officines non vérifiées", () => {
  const state = seedState();
  const before = priceRange(state, "med_salbutamol");

  state.stock = state.stock.filter((s) => s.pharmacyId === "ph_koumassi");
  state.stock.push({
    pharmacyId: "ph_koumassi",
    medicineId: "med_salbutamol",
    price: 100,
    quantity: 10,
    updatedAt: new Date().toISOString(),
  });

  const onlyPending = priceRange(state, "med_salbutamol");
  assert.equal(onlyPending.count, 0);
  assert.equal(onlyPending.min, 0);
  assert.ok(before.count >= 0);

  const popular = popularMedicines(state, 5);
  assert.equal(popular.length, 5);
});
