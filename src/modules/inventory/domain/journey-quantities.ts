import type { MovementJourneyItem } from "../contracts";
export function journeyMasterQuantity(items: MovementJourneyItem[]): number { return items.reduce((sum, item) => sum + (Number(String(item.quantity || "0").replace(/,/g, "")) || 0), 0); }
export function summarizeMovementJourney(items: MovementJourneyItem[]) {
    const quantities = new Map<string, number>();
    for (const item of items) {
        const shop = String(item.shop);
        quantities.set(shop, (quantities.get(shop) || 0) + Number(item.quantity || 0));
    }
    const totalQuantity = Array.from(quantities.values()).reduce((total, quantity) => total + quantity, 0);
    const missingQuantity = () => items.filter(item => !String(item.quantity || "").trim()).length;
    return { quantities, totalQuantity, missingQuantity };
}
